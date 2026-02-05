import { auth } from '@/auth';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'andrii@brokerua.com';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatYYYYMMDD(date: Date) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

function formatISODate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

async function fetchNbuUsdRateYYYYMMDD(yyyymmdd: string): Promise<number | null> {
  const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&date=${yyyymmdd}&json`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = (await res.json()) as any[];
  const rate = data?.[0]?.rate;
  if (typeof rate !== 'number') return null;
  return rate;
}

function getDateRange(params: URLSearchParams) {
  const yearsRaw = params.get('years');
  const years = yearsRaw ? Math.max(1, Math.min(10, Number(yearsRaw) || 3)) : 3;

  const now = new Date();
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);

  const fromRaw = params.get('from');
  const toRaw = params.get('to');

  const fromParsed = fromRaw ? new Date(fromRaw) : null;
  const toParsed = toRaw ? new Date(toRaw) : null;

  if (fromParsed && !Number.isNaN(fromParsed.getTime())) {
    fromParsed.setHours(0, 0, 0, 0);
    start.setTime(fromParsed.getTime());
  }

  if (toParsed && !Number.isNaN(toParsed.getTime())) {
    toParsed.setHours(0, 0, 0, 0);
    end.setTime(toParsed.getTime());
  }

  if (start > end) {
    const t = new Date(start);
    start.setTime(end.getTime());
    end.setTime(t.getTime());
  }

  return { start, end };
}

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Неавторизований доступ' }, { status: 401 });
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const { start, end } = getDateRange(url.searchParams);

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let checked = 0;
      let mismatches = 0;
      let dbMissing = 0;
      let nbuMissing = 0;

      const current = new Date(start);
      current.setHours(0, 0, 0, 0);

      const emit = (obj: any) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      emit({
        type: 'start',
        start: formatISODate(start),
        end: formatISODate(end),
        totalDays,
      });

      while (current <= end) {
        const dateOnly = new Date(current);
        dateOnly.setHours(0, 0, 0, 0);

        const yyyymmdd = formatYYYYMMDD(dateOnly);
        const iso = formatISODate(dateOnly);

        const [dbRateRow, nbuRate] = await Promise.all([
          db.exchangeRate.findUnique({
            where: {
              date_currencyCode: {
                date: dateOnly,
                currencyCode: 'USD',
              },
            },
            select: { rate: true },
          }),
          fetchNbuUsdRateYYYYMMDD(yyyymmdd),
        ]);

        const dbRate = dbRateRow?.rate ?? null;

        if (dbRate === null) dbMissing++;
        if (nbuRate === null) nbuMissing++;

        if (dbRate !== null && nbuRate !== null) {
          const diff = Number(dbRate) - Number(nbuRate);
          if (Math.abs(diff) > 1e-6) {
            mismatches++;
            emit({
              type: 'mismatch',
              date: iso,
              dbRate: Number(dbRate),
              nbuRate: Number(nbuRate),
              diff,
            });
          }
        }

        checked++;
        emit({ type: 'progress', checked, totalDays, date: iso, mismatches, dbMissing, nbuMissing });

        current.setDate(current.getDate() + 1);
        await new Promise((r) => setTimeout(r, 150));
      }

      emit({
        type: 'done',
        checked,
        totalDays,
        mismatches,
        dbMissing,
        nbuMissing,
      });

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
