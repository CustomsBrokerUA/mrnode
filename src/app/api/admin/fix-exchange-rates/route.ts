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

async function fetchNbuAllRatesYYYYMMDD(yyyymmdd: string): Promise<Array<{ currencyCode: string; currencyName: string; rate: number }> | null> {
  const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${yyyymmdd}&json`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = (await res.json()) as any[];
  if (!Array.isArray(data) || data.length === 0) return null;

  const out: Array<{ currencyCode: string; currencyName: string; rate: number }> = [];

  for (const r of data) {
    const code = typeof r?.cc === 'string' ? r.cc.trim().toUpperCase() : '';
    const name = typeof r?.txt === 'string' ? r.txt.trim() : '';
    const rate = typeof r?.rate === 'number' ? r.rate : null;
    if (!code || rate === null) continue;
    out.push({ currencyCode: code, currencyName: name, rate });
  }

  return out.length ? out : null;
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
  let aborted = false;
  req.signal?.addEventListener('abort', () => {
    aborted = true;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let checkedDays = 0;
      let upserted = 0;
      let nbuMissingDays = 0;
      let errors = 0;

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
        if (aborted) {
          emit({ type: 'aborted', checkedDays, totalDays, upserted, nbuMissingDays, errors });
          controller.close();
          return;
        }

        const dateOnly = new Date(current);
        dateOnly.setHours(0, 0, 0, 0);

        const yyyymmdd = formatYYYYMMDD(dateOnly);
        const iso = formatISODate(dateOnly);

        try {
          const rates = await fetchNbuAllRatesYYYYMMDD(yyyymmdd);
          if (!rates) {
            nbuMissingDays++;
          } else {
            await db.$transaction(async (tx) => {
              for (const r of rates) {
                await tx.exchangeRate.upsert({
                  where: {
                    date_currencyCode: {
                      date: dateOnly,
                      currencyCode: r.currencyCode,
                    },
                  },
                  update: {
                    rate: r.rate,
                    currencyName: r.currencyName,
                    updatedAt: new Date(),
                  },
                  create: {
                    date: dateOnly,
                    currencyCode: r.currencyCode,
                    rate: r.rate,
                    currencyName: r.currencyName,
                  },
                });
                upserted++;
              }
            });
          }
        } catch (e: any) {
          errors++;
          emit({ type: 'error', date: iso, message: e?.message || 'Error' });
        }

        checkedDays++;
        emit({ type: 'progress', checkedDays, totalDays, date: iso, upserted, nbuMissingDays, errors });

        current.setDate(current.getDate() + 1);
        await new Promise((r) => setTimeout(r, 150));
      }

      emit({ type: 'done', checkedDays, totalDays, upserted, nbuMissingDays, errors });
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
