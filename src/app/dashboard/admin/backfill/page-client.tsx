'use client';

import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input } from "@/components/ui";

type BackfillResponse = {
  success: boolean;
  error?: string;
  processed?: number;
  updated?: number;
  nextCursor?: string | null;
  done?: boolean;
  batchSize?: number;
};

export default function BackfillPageClient({ companyId }: { companyId: string }) {
  const [batchSize, setBatchSize] = useState<string>('100');
  const [cursor, setCursor] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState<BackfillResponse | null>(null);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalUpdated, setTotalUpdated] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef(false);

  const effectiveBatchSize = useMemo(() => {
    const n = parseInt(batchSize || '100', 10);
    if (!Number.isFinite(n)) return 100;
    return Math.min(Math.max(n, 1), 500);
  }, [batchSize]);

  const runOneBatch = useCallback(async (cursorValue: string): Promise<BackfillResponse> => {
    const params = new URLSearchParams();
    params.set('batchSize', String(effectiveBatchSize));
    if (cursorValue) params.set('cursor', cursorValue);

    const res = await fetch(`/api/admin/backfill-hscodes?${params.toString()}`, {
      method: 'POST',
    });

    const json = (await res.json()) as BackfillResponse;

    if (!res.ok || !json.success) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    return json;
  }, [effectiveBatchSize]);

  const handleRunOnce = useCallback(async () => {
    setError(null);
    try {
      const resp = await runOneBatch(cursor.trim());
      setLastResponse(resp);
      setCursor(resp.nextCursor ? resp.nextCursor : '');
      setTotalProcessed(p => p + (resp.processed || 0));
      setTotalUpdated(u => u + (resp.updated || 0));
    } catch (e: any) {
      setError(e?.message || 'Помилка');
    }
  }, [cursor, runOneBatch]);

  const handleRunUntilDone = useCallback(async () => {
    setError(null);
    setIsRunning(true);
    abortRef.current = false;

    let localCursor = cursor.trim();

    try {
      while (!abortRef.current) {
        const resp = await runOneBatch(localCursor);
        setLastResponse(resp);
        setTotalProcessed(p => p + (resp.processed || 0));
        setTotalUpdated(u => u + (resp.updated || 0));

        localCursor = resp.nextCursor ? resp.nextCursor : '';
        setCursor(localCursor);

        if (resp.done) break;

        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e: any) {
      setError(e?.message || 'Помилка');
    } finally {
      setIsRunning(false);
    }
  }, [cursor, runOneBatch]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  const handleResetCounters = useCallback(() => {
    setTotalProcessed(0);
    setTotalUpdated(0);
    setLastResponse(null);
    setError(null);
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Backfill: HS Codes + Contract Holder</CardTitle>
          <CardDescription>
            Компанія: {companyId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-sm text-slate-600">Batch size (1..500)</div>
              <Input value={batchSize} onChange={(e) => setBatchSize(e.target.value)} disabled={isRunning} />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-slate-600">Cursor (optional)</div>
              <Input value={cursor} onChange={(e) => setCursor(e.target.value)} disabled={isRunning} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div><span className="font-medium">Total processed:</span> {totalProcessed}</div>
            <div><span className="font-medium">Total updated:</span> {totalUpdated}</div>
            {lastResponse && (
              <div className="mt-2 text-xs text-slate-600 whitespace-pre-wrap">
                Last: processed={lastResponse.processed} updated={lastResponse.updated} done={String(lastResponse.done)} nextCursor={String(lastResponse.nextCursor)}
              </div>
            )}
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={handleRunOnce} disabled={isRunning} variant="outline">Run 1 batch</Button>
          <Button onClick={handleRunUntilDone} disabled={isRunning}>Run until done</Button>
          <Button onClick={handleStop} disabled={!isRunning} variant="ghost">Stop</Button>
          <Button onClick={handleResetCounters} disabled={isRunning} variant="ghost">Reset counters</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Як користуватись</CardTitle>
          <CardDescription>
            Тимчасовий екран для запуску бекфілу. Після завершення — приберемо.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-2">
          <div>1) Вибери активну компанію в селекторі зверху (якщо потрібно).</div>
          <div>2) Натисни <span className="font-medium">Run until done</span>.</div>
          <div>3) Якщо вкладка закрилась — зайди сюди знову і продовж з cursor.</div>
        </CardContent>
      </Card>
    </div>
  );
}
