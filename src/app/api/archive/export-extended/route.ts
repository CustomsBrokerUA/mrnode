import { auth } from '@/auth';
import { db } from '@/lib/db';
import { filterAllowedCompanyIds, getActiveCompanyWithAccess } from '@/lib/company-access';
import { mapXmlToDeclaration } from '@/lib/xml-mapper';
import { getUSDExchangeRateForDate } from '@/lib/nbu-api';
import ExcelJS from 'exceljs';
import { PassThrough, Readable } from 'node:stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DeclPaymentScanRow = {
  id: string;
  xmlData: string | null;
};

type DeclWriteRow = {
  id: string;
  customsId: string | null;
  mrn: string | null;
  status: string;
  xmlData: string | null;
};

type RawData60 = {
  guid?: string;
  MRN?: string;
  ccd_registered?: string;
  ccd_status?: string;
  ccd_type?: string;
  trn_all?: any;
  ccd_07_01?: string;
  ccd_07_02?: string;
  ccd_07_03?: string;
  ccd_01_01?: string;
  ccd_01_02?: string;
  ccd_01_03?: string;
};

function parseRawData60FromXmlData(xmlData: string | null | undefined): RawData60 | null {
  if (!xmlData) return null;
  const trimmed = xmlData.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const data60 = parsed && typeof parsed === 'object' ? (parsed as any).data60_1 : null;
      if (data60 && typeof data60 === 'object') {
        return {
          guid: data60.guid,
          MRN: data60.MRN,
          ccd_registered: data60.ccd_registered,
          ccd_status: data60.ccd_status,
          ccd_type: data60.ccd_type,
          trn_all: data60.trn_all,
          ccd_07_01: data60.ccd_07_01,
          ccd_07_02: data60.ccd_07_02,
          ccd_07_03: data60.ccd_07_03,
          ccd_01_01: data60.ccd_01_01,
          ccd_01_02: data60.ccd_01_02,
          ccd_01_03: data60.ccd_01_03,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getMDNumber(rawData: RawData60 | null, mrn: string | null): string {
  if (rawData?.MRN) return String(rawData.MRN);
  if (mrn) return mrn;
  if (rawData?.ccd_07_01 && rawData?.ccd_07_02 && rawData?.ccd_07_03) {
    const part3 = String(rawData.ccd_07_03).padStart(6, '0');
    return `${rawData.ccd_07_01} / ${rawData.ccd_07_02} / ${part3}`;
  }
  return '---';
}

function getStatusText(rawData: RawData60 | null, docStatus: string): string {
  const status = rawData?.ccd_status || docStatus;
  if (status === 'R') return 'Оформлена';

  const statusLabels: Record<string, string> = {
    CLEARED: 'Оформлено',
    PROCESSING: 'В роботі',
    REJECTED: 'Помилка',
  };

  return statusLabels[docStatus] || status;
}

function findDocumentInfo(mappedData: any, goodsIndex: number | null, codes: number[]) {
  const codesStr = codes.map(String);

  if (goodsIndex !== null && mappedData?.goods) {
    const goods: any[] = Array.isArray(mappedData.goods) ? mappedData.goods : [];
    const good = goods.find((g: any) => (g?.index || 0) === goodsIndex || goods.indexOf(g) + 1 === goodsIndex);
    if (good?.docs && Array.isArray(good.docs)) {
      const found = good.docs.find((d: any) => codesStr.includes(String(d?.code)));
      if (found) return { number: found.name || '---', date: found.dateBeg || '---' };
    }
  }

  if (mappedData?.documents && Array.isArray(mappedData.documents)) {
    const found = mappedData.documents.find((d: any) => codesStr.includes(String(d?.type)));
    if (found) return { number: found.number || '---', date: found.date || '---' };
  }

  return { number: '---', date: '---' };
}

function formatGoodsPayments(goods: any): string {
  const payments = Array.isArray(goods?.payments) ? goods.payments : [];
  if (payments.length === 0) return '---';

  return payments
    .map((p: any) => {
      const code = String(p?.code || '').trim();
      const ch = String(p?.char || '').trim();
      const amount = typeof p?.amount === 'number' ? p.amount : Number(p?.amount || 0);
      const value = Number.isFinite(amount) ? amount : 0;
      return `${code || ''} ${ch || ''}: ${value.toLocaleString('uk-UA')}`.trim();
    })
    .filter(Boolean)
    .join('; ');
}

function getXmlData61_1(xmlData: string | null | undefined): string | null {
  if (!xmlData) return null;
  const trimmed = xmlData.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && (parsed as any).data61_1) {
        return String((parsed as any).data61_1);
      }
      return null;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
    return xmlData;
  }

  return null;
}

function formatDateForExport(value: unknown): string {
  if (!value) return '---';
  try {
    if (value instanceof Date) return value.toLocaleString('uk-UA');
    const s = String(value);

    const match = s.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      const d = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
      return d.toLocaleString('uk-UA');
    }

    const iso = new Date(s);
    if (!Number.isNaN(iso.getTime())) return iso.toLocaleString('uk-UA');

    return s;
  } catch {
    return String(value);
  }
}

function getQueryStringParam(url: URL, key: string): string {
  const v = url.searchParams.get(key);
  return (v || '').trim();
}

function getQueryStringParams(url: URL, key: string): string[] {
  const raw = url.searchParams.getAll(key);
  const split = raw.flatMap((v) => String(v || '').split(','));
  return split.map((x) => x.trim()).filter(Boolean);
}

async function getShowEeDeclarationsForCompany(companyId: string): Promise<boolean> {
  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { syncSettings: true },
    });
    return (company?.syncSettings as any)?.showEeDeclarations === true;
  } catch {
    return false;
  }
}

function buildWhere(params: {
  companyIds: string[];
  showEeDeclarations: boolean;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    customsOffice?: string;
    currency?: string;
    consignor?: string;
    consignee?: string;
    contractHolder?: string;
    hsCode?: string;
    declarationType?: string;
    searchTerm?: string;
  };
}): any {
  const { companyIds, showEeDeclarations, filters } = params;

  const where: any = {
    companyId: companyIds.length === 1 ? companyIds[0] : { in: companyIds },
  };

  const andConditions: any[] = [];

  if (!showEeDeclarations) {
    andConditions.push({
      NOT: {
        summary: {
          declarationType: {
            endsWith: 'ЕЕ',
          },
        },
      },
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: any = {};
    const summaryDateFilter: any = {};

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      dateFilter.gte = fromDate;
      summaryDateFilter.gte = fromDate;
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
      summaryDateFilter.lte = toDate;
    }

    andConditions.push({
      OR: [{ date: dateFilter }, { summary: { registeredDate: summaryDateFilter } }],
    });
  }

  const summaryFilters: any = {};

  if (filters.customsOffice) {
    summaryFilters.customsOffice = { contains: filters.customsOffice, mode: 'insensitive' as const };
  }

  if (filters.currency && filters.currency !== 'all') {
    andConditions.push({
      OR: [{ summary: { currency: filters.currency } }, { summary: { invoiceCurrency: filters.currency } }],
    });
  }

  if (filters.consignor) {
    summaryFilters.senderName = { contains: filters.consignor, mode: 'insensitive' as const };
  }

  if (filters.consignee) {
    summaryFilters.recipientName = { contains: filters.consignee, mode: 'insensitive' as const };
  }

  if (filters.contractHolder) {
    summaryFilters.contractHolder = { contains: filters.contractHolder, mode: 'insensitive' as const };
  }

  if (filters.hsCode) {
    andConditions.push({
      hsCodes: {
        some: {
          hsCode: { contains: filters.hsCode, mode: 'insensitive' as const },
        },
      },
    });
  }

  if (filters.declarationType) {
    const types = filters.declarationType
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (types.length > 0) {
      summaryFilters.declarationType = { in: types };
    }
  }

  if (Object.keys(summaryFilters).length > 0) {
    andConditions.push({ summary: summaryFilters });
  }

  if (filters.searchTerm) {
    const searchTerm = filters.searchTerm.trim();
    andConditions.push({
      OR: [
        { mrn: { contains: searchTerm, mode: 'insensitive' as const } },
        { customsId: { contains: searchTerm, mode: 'insensitive' as const } },
        { summary: { senderName: { contains: searchTerm, mode: 'insensitive' as const } } },
        { summary: { recipientName: { contains: searchTerm, mode: 'insensitive' as const } } },
        { summary: { contractHolder: { contains: searchTerm, mode: 'insensitive' as const } } },
        { summary: { customsOffice: { contains: searchTerm, mode: 'insensitive' as const } } },
        { summary: { declarationType: { contains: searchTerm, mode: 'insensitive' as const } } },
      ],
    });
  }

  if (andConditions.length > 0) {
    const companyFilter = companyIds.length === 1 ? { companyId: companyIds[0] } : { companyId: { in: companyIds } };

    where.AND = [companyFilter, ...andConditions];
    delete where.companyId;
  }

  return where;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  const access = await getActiveCompanyWithAccess();
  if (!access.success || !access.companyId) {
    return new Response('No active company', { status: 403 });
  }

  const url = new URL(req.url);
  const debug = url.searchParams.get('debug') === '1';

  const companyIdsRaw = getQueryStringParams(url, 'companyIds');
  let targetCompanyIds: string[];

  if (companyIdsRaw.length > 0) {
    targetCompanyIds = await filterAllowedCompanyIds(companyIdsRaw);
    if (targetCompanyIds.length === 0) {
      return new Response('Forbidden', { status: 403 });
    }
  } else {
    targetCompanyIds = [access.companyId];
  }

  const showEeDeclarations = await getShowEeDeclarationsForCompany(access.companyId);

  const filters = {
    dateFrom: getQueryStringParam(url, 'dateFrom') || undefined,
    dateTo: getQueryStringParam(url, 'dateTo') || undefined,
    customsOffice: getQueryStringParam(url, 'customsOffice') || undefined,
    currency: getQueryStringParam(url, 'currency') || undefined,
    consignor: getQueryStringParam(url, 'consignor') || undefined,
    consignee: getQueryStringParam(url, 'consignee') || undefined,
    contractHolder: getQueryStringParam(url, 'contractHolder') || undefined,
    hsCode: getQueryStringParam(url, 'hsCode') || undefined,
    declarationType: getQueryStringParam(url, 'declarationType') || undefined,
    searchTerm: getQueryStringParam(url, 'searchTerm') || undefined,
  };

  const columnsParam = getQueryStringParam(url, 'columns');
  const columnOrderParam = getQueryStringParam(url, 'columnOrder');

  const activeKeys = columnsParam
    ? columnsParam
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  const columnOrder = columnOrderParam
    ? columnOrderParam
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  const baseColumnMap: Record<string, string> = {
    mdNumber: 'Номер МД',
    registeredDate: 'Дата оформлення',
    status: 'Статус',
    type: 'Тип декларації',
    consignor: 'Відправник',
    consignee: 'Отримувач',
    invoiceValue: 'Фактурна вартість',
    invoiceCurrency: 'Валюта',
    goodsCount: 'Кількість товарів',
    customsOffice: 'Митниця',
    declarantName: 'Декларант',
    guid: 'GUID',
    mrn: 'Номер МРН',
    invoiceNumber: '№ Інвойсу',
    invoiceDate: 'Дата інвойсу',
    cmrNumber: '№ CMR/Накладної',
    cmrDate: 'Дата CMR/Накладної',
    contractNumber: '№ Контракту',
    contractDate: 'Дата контракту',
    manufacturer: 'Виробник',
    carrierName: 'Перевізник',
    deliveryTermsIncoterms: 'Умови поставки (Інкотермс)',
    deliveryTermsDetails: 'Місце поставки',
    goodsIndex: 'Номер товару в МД',
    goodsHSCode: 'Код УКТЗЕД товару',
    goodsDescription: 'Опис товару (графа 31)',
    goodsPrice: 'Фактурна вартість в валюті',
    goodsInvoiceValueUah: 'Фактурна вартість в грн',
    goodsInvoiceValueUsd: 'Фактурна вартість в дол',
    goodsCustomsValue: 'Митна вартість в грн',
    goodsPayments: 'Платежі по товару',
    transport: 'Транспорт',
    invoiceValueCurrency: 'Фактурна вартість (валюта)',
  };

  const defaultKeys = Object.keys(baseColumnMap);
  const keys = (columnOrder.length > 0 ? columnOrder : defaultKeys).filter((k) => (activeKeys.length > 0 ? activeKeys.includes(k) : true));

  const extraColumns = [
    { key: 'consigneeEdrpou', label: 'ЄДРПОУ контрактотримача' },
    { key: 'consigneeName', label: 'Назва контрактотримача' },
    { key: 'extraUnit', label: 'Дод. од. виміру' },
    { key: 'grossWeight', label: 'Вага брутто' },
    { key: 'netWeight', label: 'Вага нетто' },
    { key: 'usdRate', label: 'Курс дол' },
    { key: 'customsValueUsd', label: 'Митна вартість в дол' },
    { key: 'customsValueUsdPerKg', label: 'Митна вартість в дол за кг нетто' },
  ];

  const debugHeaders = debug
    ? [
        { key: 'usdRateDateRawUsed', label: 'debug_usdRateDateRaw' },
        { key: 'usdRateUsed', label: 'debug_usdRate' },
      ]
    : [];

  const where = buildWhere({ companyIds: targetCompanyIds, showEeDeclarations, filters });

  const paymentCodes = new Set<string>();

  const usdRateCache = new Map<string, number>();

  // First pass: collect payment codes
  let cursorId: string | null = null;
  const batchSize = 200;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch: DeclPaymentScanRow[] = await db.declaration.findMany({
      where,
      take: batchSize,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        xmlData: true,
      },
    });

    if (batch.length === 0) break;

    for (const d of batch) {
      const xml61 = getXmlData61_1(d.xmlData);
      if (!xml61) continue;
      try {
        const mapped = mapXmlToDeclaration(xml61);
        const gps = (mapped as any)?.generalPayments;
        if (Array.isArray(gps)) {
          for (const p of gps) {
            const code = String((p as any)?.code || '').trim();
            if (code && code !== '---') paymentCodes.add(code);
          }
        }
      } catch {
        continue;
      }
    }

    cursorId = batch[batch.length - 1].id;
  }

  const pass = new PassThrough();

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `Розширений_експорт_${yyyy}-${mm}-${dd}.xlsx`;

  const headers = [
    ...keys.map((k) => baseColumnMap[k] || k),
    ...extraColumns.map((c) => c.label),
    ...debugHeaders.map((c) => c.label),
    ...Array.from(paymentCodes).sort().map((code) => `Платіж ${code}`),
  ];

  (async () => {
    try {
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: false });
      const ws = workbook.addWorksheet('Export');

      ws.addRow(headers).commit();

      let writeCursorId: string | null = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const batch: DeclWriteRow[] = await db.declaration.findMany({
          where,
          take: batchSize,
          ...(writeCursorId
            ? {
                cursor: { id: writeCursorId },
                skip: 1,
              }
            : {}),
          orderBy: { id: 'asc' },
          select: {
            id: true,
            customsId: true,
            mrn: true,
            status: true,
            xmlData: true,
          },
        });

        if (batch.length === 0) break;

        for (const d of batch) {
          const xml61 = getXmlData61_1(d.xmlData);
          if (!xml61) continue;

          let mapped: any;
          try {
            mapped = mapXmlToDeclaration(xml61);
          } catch {
            continue;
          }

          if (!mapped) continue;

          const header = mapped.header || {};
          const rawData60 = parseRawData60FromXmlData(d.xmlData);
          const mdNumber = getMDNumber(rawData60, d.mrn);
          const statusText = getStatusText(rawData60, d.status);

          let completionDateRaw = '';
          const completionProtocol = Array.isArray(mapped.protocol)
            ? mapped.protocol.find((p: any) => p?.actionName && String(p.actionName).includes('Завершення митного оформлення'))
            : null;
          if (completionProtocol?.serverDate) {
            completionDateRaw = completionProtocol.serverDate;
          } else {
            completionDateRaw = header.currencyRateDateRaw || header.rawDate || rawData60?.ccd_registered || '';
          }
          const completionDate = completionDateRaw ? formatDateForExport(completionDateRaw) : '---';

          const usdRateDateRaw = (() => {
            const v = String(header.currencyRateDateRaw || header.rawDate || rawData60?.ccd_registered || '').trim();
            return v && v !== '---' ? v : '';
          })();

          const declarationType = rawData60
            ? [rawData60.ccd_01_01, rawData60.ccd_01_02, rawData60.ccd_01_03].filter(Boolean).join(' ') || rawData60.ccd_type || '---'
            : header.type || header.declarationType || '---';
          const mrn = d.mrn || header.mrn || '---';

          const carrier = Array.isArray(mapped.clients) ? mapped.clients.find((c: any) => c?.box === '50')?.name : undefined;
          const transport = Array.isArray(mapped.transports)
            ? mapped.transports
                .filter((t: any) => String(t?.box || '').trim() === '18')
                .map((t: any) => String(t?.name || '').trim())
                .filter((v: string) => v && v !== '---')
                .join('/') || '---'
            : '---';

          const generalPayments = Array.isArray(mapped.generalPayments) ? mapped.generalPayments : [];
          const paymentCodeList = Array.from(paymentCodes).sort();

          const goodsList = Array.isArray(mapped.goods) ? mapped.goods : [];

          let usdRate = 0;
          if (usdRateDateRaw) {
            const key = usdRateDateRaw;
            const cached = usdRateCache.get(key);
            if (typeof cached === 'number') {
              usdRate = cached;
            } else {
              try {
                const rate = await getUSDExchangeRateForDate(usdRateDateRaw);
                usdRate = typeof rate === 'number' && Number.isFinite(rate) ? rate : 0;
              } catch {
                usdRate = 0;
              }
              usdRateCache.set(key, usdRate);
            }
          }

          const addRow = (goods: any | null) => {
            const goodsIdx = goods?.index || (goods ? goodsList.indexOf(goods) + 1 : '');

            const effectiveGoodsIndex: number | null = (() => {
              if (!goods) return null;
              const goodsIndexNumber = typeof goodsIdx === 'number' ? goodsIdx : Number(goodsIdx);
              return Number.isFinite(goodsIndexNumber) && goodsIndexNumber > 0 ? goodsIndexNumber : null;
            })();

            const docInvoice = findDocumentInfo(mapped, effectiveGoodsIndex, [380]);
            const docCmr = findDocumentInfo(mapped, effectiveGoodsIndex, [730]);
            const docContract = findDocumentInfo(mapped, effectiveGoodsIndex, [4100, 4104]);

            const producerName = goods?.producerName || '---';

            const exchangeRate = Number(header.exchangeRate || 0);
            const invoiceValueInCurrency = Number(goods?.price || 0);
            const invoiceValueUah = invoiceValueInCurrency * exchangeRate;

            const netWeight = Number(goods?.netWeight || 0);
            const grossWeight = Number(goods?.grossWeight || 0);
            const customsValueUah = Number(goods?.customsValue || 0);

            const invoiceValueUsd = usdRate > 0 ? invoiceValueUah / usdRate : 0;
            const customsValueUsd = usdRate > 0 ? customsValueUah / usdRate : 0;
            const customsValueUsdPerKg = netWeight > 0 ? customsValueUsd / netWeight : 0;

            const base: any[] = [];
            for (const key of keys) {
              switch (key) {
                case 'mdNumber':
                  base.push(mdNumber);
                  break;
                case 'registeredDate':
                  base.push(completionDate);
                  break;
                case 'status':
                  base.push(statusText);
                  break;
                case 'type':
                  base.push(declarationType);
                  break;
                case 'transport':
                  base.push(transport);
                  break;
                case 'consignor':
                  base.push(header.consignor || '---');
                  break;
                case 'consignee':
                  base.push(header.consignee || '---');
                  break;
                case 'invoiceValue':
                  base.push(invoiceValueUah);
                  break;
                case 'invoiceCurrency':
                  base.push(header.invoiceCurrency || header.currency || '---');
                  break;
                case 'goodsCount':
                  base.push(goodsList.length || 0);
                  break;
                case 'customsOffice':
                  base.push(header.customsOffice || '---');
                  break;
                case 'declarantName':
                  base.push(header.declarantName || '---');
                  break;
                case 'guid':
                  base.push(rawData60?.guid || d.customsId || '---');
                  break;
                case 'mrn':
                  base.push(mrn);
                  break;
                case 'invoiceNumber':
                  base.push(docInvoice.number);
                  break;
                case 'invoiceDate':
                  base.push(docInvoice.date);
                  break;
                case 'cmrNumber':
                  base.push(docCmr.number);
                  break;
                case 'cmrDate':
                  base.push(docCmr.date);
                  break;
                case 'contractNumber':
                  base.push(docContract.number);
                  break;
                case 'contractDate':
                  base.push(docContract.date);
                  break;
                case 'manufacturer':
                  base.push(producerName);
                  break;
                default:
                  if (key === 'carrierName') base.push(carrier || '---');
                  else if (key === 'deliveryTermsIncoterms') base.push(header.deliveryTerms || '---');
                  else if (key === 'deliveryTermsDetails') base.push(`${header.deliveryPlace || ''} ${header.deliveryCountryCode || ''}`.trim() || '---');
                  else if (key === 'goodsIndex') base.push(goodsIdx);
                  else if (key === 'goodsHSCode') base.push(goods?.hsCode || '---');
                  else if (key === 'goodsDescription') base.push(goods?.description || '---');
                  else if (key === 'goodsPrice') base.push(invoiceValueInCurrency);
                  else if (key === 'goodsInvoiceValueUah') base.push(invoiceValueUah);
                  else if (key === 'goodsInvoiceValueUsd') base.push(invoiceValueUsd);
                  else if (key === 'goodsCustomsValue') base.push(customsValueUah);
                  else if (key === 'goodsPayments') base.push(formatGoodsPayments(goods));
                  else base.push('---');
                  break;
              }
            }

            const extra: any[] = [];
            const client9 = Array.isArray(mapped.clients) ? mapped.clients.find((c: any) => c?.box === '9') : null;
            extra.push(client9?.code || '---');
            extra.push(client9?.name || '---');
            extra.push(goods?.addUnitCode || '---');
            extra.push(grossWeight || 0);
            extra.push(netWeight || 0);
            extra.push(usdRate > 0 ? usdRate : '---');
            extra.push(customsValueUsd || 0);
            extra.push(customsValueUsdPerKg || 0);

            const paymentMap = new Map<string, number>();
            for (const p of generalPayments) {
              const code = String(p?.code || '').trim();
              if (!code || code === '---') continue;
              const amountRaw = p?.amount;
              const num = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw || 0);
              const amount = Number.isFinite(num) ? num : 0;
              paymentMap.set(code, (paymentMap.get(code) || 0) + amount);
            }

            const debugCols: any[] = debug ? [usdRateDateRaw || '---', usdRate > 0 ? usdRate : '---'] : [];

            const payments: any[] = paymentCodeList.map((code) => (paymentMap.get(code) || 0).toFixed(2));

            ws.addRow([...base, ...extra, ...debugCols, ...payments]).commit();
          };

          if (goodsList.length === 0) {
            addRow(null);
          } else {
            for (const g of goodsList) {
              addRow(g);
            }
          }
        }

        writeCursorId = batch[batch.length - 1].id;
      }

      await workbook.commit();
      pass.end();
    } catch {
      try {
        pass.end();
      } catch {
        // ignore
      }
    }
  })();

  const webStream = Readable.toWeb(pass) as unknown as ReadableStream;

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
