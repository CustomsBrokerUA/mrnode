import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const parseDateOnly = (v: string | null): Date | null => {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { getActiveCompanyWithAccess } = await import('@/lib/company-access');
  const access = await getActiveCompanyWithAccess();
  if (!access.success || !access.companyId) {
    return NextResponse.json({ error: access.error || 'Active company not set' }, { status: 400 });
  }

  const url = new URL(req.url);
  const dateFromParam = url.searchParams.get('from');
  const dateToParam = url.searchParams.get('to');

  // Default: January 2023
  const defaultFrom = new Date(2023, 0, 1);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(2023, 0, 31);
  defaultTo.setHours(23, 59, 59, 999);

  const dateFrom = parseDateOnly(dateFromParam) || defaultFrom;
  const dateTo = parseDateOnly(dateToParam) || defaultTo;
  dateFrom.setHours(0, 0, 0, 0);
  dateTo.setHours(23, 59, 59, 999);

  const [countByDeclarationDate, countByRegisteredDate, sample] = await Promise.all([
    db.declaration.count({
      where: {
        companyId: access.companyId,
        date: { gte: dateFrom, lte: dateTo },
      },
    }),
    db.declarationSummary.count({
      where: {
        declaration: { companyId: access.companyId },
        registeredDate: { gte: dateFrom, lte: dateTo },
      },
    }),
    db.declaration.findMany({
      where: {
        companyId: access.companyId,
        OR: [
          { date: { gte: dateFrom, lte: dateTo } },
          { summary: { registeredDate: { gte: dateFrom, lte: dateTo } } },
        ],
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: 20,
      select: {
        id: true,
        mrn: true,
        customsId: true,
        date: true,
        summary: {
          select: {
            registeredDate: true,
            invoiceCurrency: true,
            invoiceValue: true,
            exchangeRate: true,
            invoiceValueUah: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    now: new Date().toISOString(),
    companyId: access.companyId,
    range: {
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
    },
    counts: {
      byDeclarationDate: countByDeclarationDate,
      bySummaryRegisteredDate: countByRegisteredDate,
    },
    sample: sample.map((d) => ({
      id: d.id,
      mrn: d.mrn,
      customsId: d.customsId,
      date: d.date,
      summary: d.summary
        ? {
            registeredDate: d.summary.registeredDate,
            invoiceCurrency: d.summary.invoiceCurrency,
            invoiceValue: d.summary.invoiceValue,
            exchangeRate: d.summary.exchangeRate,
            invoiceValueUah: d.summary.invoiceValueUah,
          }
        : null,
    })),
  });
}
