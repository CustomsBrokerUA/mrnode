'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { cancelSyncJobById, getSyncJobErrors, listSyncJobs } from '@/actions/admin-sync';

type SyncJobStatus = 'processing' | 'completed' | 'cancelled' | 'error';

type JobsResponse =
  | {
      success: true;
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      jobs: Array<{
        id: string;
        status: SyncJobStatus;
        companyId: string;
        company: { id: string; name: string; edrpou: string };
        totalChunks60_1: number;
        completedChunks60_1: number;
        totalGuids: number;
        completed61_1: number;
        dateFrom: string | Date;
        dateTo: string | Date;
        errorMessage: string | null;
        cancelledAt: string | Date | null;
        createdAt: string | Date;
        updatedAt: string | Date;
        errorsCount: number;
      }>;
    }
  | { error: string };

type ErrorsResponse =
  | {
      success: true;
      errors: Array<{
        id: string;
        chunkNumber: number;
        dateFrom: string | Date;
        dateTo: string | Date;
        errorMessage: string;
        errorCode: string | null;
        retryAttempts: number;
        isRetried: boolean;
        createdAt: string | Date;
      }>;
    }
  | { error: string };

export default function AdminSyncPageClient() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | SyncJobStatus>('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const [auditRunning, setAuditRunning] = useState(false);
  const [auditProgress, setAuditProgress] = useState<{ checked: number; totalDays: number; date?: string; mismatches: number; dbMissing: number; nbuMissing: number } | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditMismatches, setAuditMismatches] = useState<Array<{ date: string; dbRate: number; nbuRate: number; diff: number }>>([]);
  const auditAbortRef = useState<{ abort: (() => void) | null }>({ abort: null })[0];

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Extract<JobsResponse, { success: true }> | null>(null);

  const totalPages = useMemo(() => data?.totalPages ?? 1, [data?.totalPages]);

  const [errorsOpen, setErrorsOpen] = useState(false);
  const [errorsJobId, setErrorsJobId] = useState<string | null>(null);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [errorsError, setErrorsError] = useState<string | null>(null);
  const [errorsData, setErrorsData] = useState<Extract<ErrorsResponse, { success: true }> | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = (await listSyncJobs({
        query: query.trim(),
        status,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        page,
        pageSize,
      })) as JobsResponse;

      if ((resp as any).success) {
        setData(resp as Extract<JobsResponse, { success: true }>);
      } else {
        setData(null);
        setError((resp as any).error || 'Помилка завантаження');
      }
    } catch (e: any) {
      setData(null);
      setError(e?.message || 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  }, [createdFrom, createdTo, page, pageSize, query, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadJobs();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadJobs]);

  const openErrors = useCallback(async (jobId: string) => {
    setErrorsOpen(true);
    setErrorsJobId(jobId);
    setErrorsLoading(true);
    setErrorsError(null);
    setErrorsData(null);

    try {
      const resp = (await getSyncJobErrors({ jobId })) as ErrorsResponse;
      if ((resp as any).success) {
        setErrorsData(resp as Extract<ErrorsResponse, { success: true }>);
      } else {
        setErrorsError((resp as any).error || 'Помилка завантаження помилок');
      }
    } catch (e: any) {
      setErrorsError(e?.message || 'Помилка завантаження помилок');
    } finally {
      setErrorsLoading(false);
    }
  }, []);

  const closeErrors = useCallback(() => {
    setErrorsOpen(false);
    setErrorsJobId(null);
    setErrorsError(null);
    setErrorsData(null);
  }, []);

  const handlePrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNext = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const handleFilterChange = useCallback((updater: () => void) => {
    updater();
    setPage(1);
  }, []);

  const handleCancel = useCallback(
    async (jobId: string) => {
      if (!confirm('Скасувати це завдання синхронізації?')) return;

      try {
        const resp = await cancelSyncJobById({ jobId });
        if ((resp as any).error) {
          alert((resp as any).error);
          return;
        }
        await loadJobs();
      } catch (e: any) {
        alert(e?.message || 'Помилка скасування');
      }
    },
    [loadJobs]
  );

  const startExchangeRateAudit = useCallback(async () => {
    if (auditRunning) return;
    if (!confirm('Перевірити USD курс в БД проти НБУ по днях за останні 3 роки? Це може тривати довго.')) return;

    const controller = new AbortController();
    auditAbortRef.abort = () => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    };

    setAuditRunning(true);
    setAuditError(null);
    setAuditProgress(null);
    setAuditMismatches([]);

    try {
      const res = await fetch('/api/admin/audit-exchange-rates?years=3', {
        signal: controller.signal,
        headers: { Accept: 'application/x-ndjson' },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No response body');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;

          let msg: any;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }

          if (msg?.type === 'progress') {
            setAuditProgress({
              checked: Number(msg.checked) || 0,
              totalDays: Number(msg.totalDays) || 0,
              date: msg.date,
              mismatches: Number(msg.mismatches) || 0,
              dbMissing: Number(msg.dbMissing) || 0,
              nbuMissing: Number(msg.nbuMissing) || 0,
            });
          } else if (msg?.type === 'mismatch') {
            setAuditMismatches((prev) => {
              const next = [...prev, { date: msg.date, dbRate: msg.dbRate, nbuRate: msg.nbuRate, diff: msg.diff }];
              if (next.length > 500) next.shift();
              return next;
            });
          } else if (msg?.type === 'done') {
            setAuditProgress({
              checked: Number(msg.checked) || 0,
              totalDays: Number(msg.totalDays) || 0,
              mismatches: Number(msg.mismatches) || 0,
              dbMissing: Number(msg.dbMissing) || 0,
              nbuMissing: Number(msg.nbuMissing) || 0,
            });
          }
        }
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setAuditError('Скасовано');
      } else {
        setAuditError(e?.message || 'Помилка аудиту');
      }
    } finally {
      setAuditRunning(false);
      auditAbortRef.abort = null;
    }
  }, [auditAbortRef, auditRunning]);

  const cancelExchangeRateAudit = useCallback(() => {
    auditAbortRef.abort?.();
  }, [auditAbortRef]);

  const getStageInfoFromErrorMessage = useCallback((message: string | null) => {
    if (!message || !message.includes('STAGE:')) return null;
    const stageMatch = message.match(/STAGE:(\d+):([^|]+)/);
    if (!stageMatch) return null;

    const nextMatch = message.match(/NEXT:(\d+)/);
    const isCompleted = message.includes('COMPLETED');

    return {
      stage: parseInt(stageMatch[1], 10),
      stageName: stageMatch[2],
      nextStage: nextMatch ? parseInt(nextMatch[1], 10) : undefined,
      isCompleted,
    };
  }, []);

  return (
    <div className="w-full max-w-none space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Адмін: Sync Jobs</CardTitle>
          <CardDescription>Моніторинг виконання синхронізацій та помилок</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">Audit: USD курс в БД vs НБУ (тимчасово)</div>
                <div className="text-xs text-slate-500">Перевіряє кожен день за останні 3 роки. Показує розбіжності (зберігає останні 500).</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={startExchangeRateAudit} disabled={auditRunning}>
                  {auditRunning ? 'Перевіряю…' : 'Запустити перевірку'}
                </Button>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={cancelExchangeRateAudit}
                  disabled={!auditRunning}
                >
                  Скасувати
                </Button>
              </div>
            </div>

            {auditError && <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{auditError}</div>}

            {auditProgress && (
              <div className="mt-2 text-sm text-slate-700">
                <div>
                  Прогрес: <span className="font-medium">{auditProgress.checked}</span> /{' '}
                  <span className="font-medium">{auditProgress.totalDays}</span>
                  {auditProgress.totalDays ? (
                    <span className="text-slate-500"> ({Math.round((auditProgress.checked / auditProgress.totalDays) * 100)}%)</span>
                  ) : null}
                  {auditProgress.date ? <span className="ml-2 text-slate-500">останній день: {auditProgress.date}</span> : null}
                </div>
                <div className="text-xs text-slate-600">
                  mismatches: <span className="font-medium">{auditProgress.mismatches}</span> | db missing:{' '}
                  <span className="font-medium">{auditProgress.dbMissing}</span> | nbu missing:{' '}
                  <span className="font-medium">{auditProgress.nbuMissing}</span>
                </div>
              </div>
            )}

            {auditMismatches.length > 0 && (
              <div className="mt-3 rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>DB</TableHead>
                      <TableHead>NBU</TableHead>
                      <TableHead>Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditMismatches
                      .slice()
                      .reverse()
                      .map((m) => (
                        <TableRow key={`${m.date}-${m.dbRate}-${m.nbuRate}`}>
                          <TableCell className="font-medium">{m.date}</TableCell>
                          <TableCell className="text-xs">{m.dbRate}</TableCell>
                          <TableCell className="text-xs">{m.nbuRate}</TableCell>
                          <TableCell className="text-xs">{m.diff}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="q">Компанія (назва/ЄДРПОУ)</Label>
              <Input
                id="q"
                value={query}
                onChange={(e) => handleFilterChange(() => setQuery(e.target.value))}
                placeholder="ТОВ ... або 12345678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => handleFilterChange(() => setStatus(e.target.value as any))}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50"
              >
                <option value="all">Всі</option>
                <option value="processing">processing</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
                <option value="error">error</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">Дата (від)</Label>
              <Input
                id="from"
                type="date"
                value={createdFrom}
                onChange={(e) => handleFilterChange(() => setCreatedFrom(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="to">Дата (до)</Label>
              <Input
                id="to"
                type="date"
                value={createdTo}
                onChange={(e) => handleFilterChange(() => setCreatedTo(e.target.value))}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Статус</TableHead>
                  <TableHead>Компанія</TableHead>
                  <TableHead>Період</TableHead>
                  <TableHead>Прогрес</TableHead>
                  <TableHead>Помилки</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6}>Завантаження…</TableCell>
                  </TableRow>
                )}

                {!loading && data?.jobs?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>Нічого не знайдено</TableCell>
                  </TableRow>
                )}

                {!loading &&
                  data?.jobs?.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">{j.status}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium">{j.company?.name}</div>
                          <div className="text-xs text-slate-500">{j.company?.edrpou}</div>
                          <div className="text-xs text-slate-400">jobId: {j.id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div>
                          {new Date(j.dateFrom).toLocaleDateString('uk-UA')} → {new Date(j.dateTo).toLocaleDateString('uk-UA')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          created: {new Date(j.createdAt).toLocaleString('uk-UA')}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>60.1: {j.completedChunks60_1}/{j.totalChunks60_1}</div>
                        <div>61.1: {j.completed61_1}/{j.totalGuids}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm">{j.errorsCount}</div>
                          <Button
                            variant="outline"
                            onClick={() => openErrors(j.id)}
                            disabled={j.errorsCount <= 0}
                          >
                            Деталі
                          </Button>
                        </div>
                        {(() => {
                          const stageInfo = getStageInfoFromErrorMessage(j.errorMessage);
                          if (stageInfo) {
                            return (
                              <div className="mt-2 text-xs text-slate-600">
                                STAGE:{stageInfo.stage}:{stageInfo.stageName}
                                {stageInfo.isCompleted ? ' | COMPLETED' : ''}
                                {stageInfo.nextStage ? ` | NEXT:${stageInfo.nextStage}` : ''}
                              </div>
                            );
                          }

                          if (!j.errorMessage) return null;

                          return <div className="mt-2 text-xs text-red-700 line-clamp-2">{j.errorMessage}</div>;
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => handleCancel(j.id)}
                            disabled={j.status !== 'processing'}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            {data ? (
              <span>
                Всього: <span className="font-medium">{data.total}</span>. Сторінка{' '}
                <span className="font-medium">{data.page}</span> /{' '}
                <span className="font-medium">{data.totalPages}</span>
              </span>
            ) : (
              <span />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => loadJobs()} disabled={loading}>
              Оновити список
            </Button>
            <Button variant="outline" onClick={handlePrev} disabled={loading || page <= 1}>
              Назад
            </Button>
            <Button variant="outline" onClick={handleNext} disabled={loading || page >= totalPages}>
              Далі
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={errorsOpen} onOpenChange={(o) => (o ? null : closeErrors())}>
        <DialogContent className="max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>SyncJobError ({errorsJobId || ''})</DialogTitle>
          </DialogHeader>

          {errorsLoading && <div>Завантаження…</div>}
          {errorsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorsError}</div>
          )}

          {!errorsLoading && errorsData && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Період</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Retry</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorsData.errors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>Немає помилок</TableCell>
                    </TableRow>
                  )}
                  {errorsData.errors.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.chunkNumber}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {new Date(e.dateFrom).toLocaleDateString('uk-UA')} → {new Date(e.dateTo).toLocaleDateString('uk-UA')}
                      </TableCell>
                      <TableCell className="text-xs">{e.errorCode || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {e.retryAttempts} / {e.isRetried ? 'ретраєно' : '—'}
                      </TableCell>
                      <TableCell className="text-xs whitespace-pre-wrap">{e.errorMessage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeErrors}>
              Закрити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
