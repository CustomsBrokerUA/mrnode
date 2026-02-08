'use strict';

const { PrismaClient } = require('@prisma/client');

function getXmlData61_1(xmlData) {
  if (!xmlData) return null;
  const trimmed = String(xmlData).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      const xml61 = parsed && typeof parsed === 'object' ? parsed.data61_1 : null;
      return typeof xml61 === 'string' && xml61.trim() ? xml61 : null;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
    return trimmed;
  }

  return null;
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const db = new PrismaClient();

  const batchSize = Number(process.env.BATCH || 200);
  const companyId = String(process.env.COMPANY_ID || '').trim();

  let where = {
    xmlData: { not: null },
  };

  if (companyId) {
    where = { ...where, companyId };
  }

  console.log(`[backfill-invoice-uah] Starting. batch=${batchSize}${companyId ? ` companyId=${companyId}` : ''}`);

  let cursorId = null;
  let scanned = 0;
  let updated = 0;
  let skippedNoXml = 0;
  let skippedNoSummary = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await db.declaration.findMany({
      where,
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        xmlData: true,
      },
    });

    if (batch.length === 0) break;

    for (const d of batch) {
      scanned++;

      const xml61 = getXmlData61_1(d.xmlData);
      if (!xml61) {
        skippedNoXml++;
        continue;
      }

      const extractTagText = (xml, tagName) => {
        try {
          const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
          const m = String(xml).match(re);
          return m && m[1] != null ? String(m[1]).trim() : '';
        } catch {
          return '';
        }
      };

      const parseNum = (v) => {
        const s = String(v || '').trim();
        if (!s || s === '---') return 0;
        const n = Number(s.replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
      };

      const headerInvoiceUah = parseNum(extractTagText(xml61, 'ccd_22_03'));
      const headerInvoiceVal = parseNum(extractTagText(xml61, 'ccd_22_02'));
      const headerRate = parseNum(extractTagText(xml61, 'ccd_23_01'));

      let goodsInvoiceUahSum = 0;
      let goodsInvoiceValSum = 0;
      try {
        const goodsBlocks = String(xml61).matchAll(/<ccd_goods\b[^>]*>([\\s\\S]*?)<\/ccd_goods>/gi);
        for (const m of goodsBlocks) {
          const block = m[1] || '';
          goodsInvoiceUahSum += parseNum(extractTagText(block, 'ccd_42_02'));
          goodsInvoiceValSum += parseNum(extractTagText(block, 'ccd_42_01'));
        }
      } catch {
        // ignore
      }

      let invoiceValueUah = 0;

      // 1) ccd_22_03 (direct in UAH)
      invoiceValueUah = headerInvoiceUah;

      // 2) sum ccd_42_02 per goods (UAH)
      if (invoiceValueUah === 0 && goodsInvoiceUahSum > 0) {
        invoiceValueUah = goodsInvoiceUahSum;
      }

      // 3) ccd_22_02 * ccd_23_01
      if (invoiceValueUah === 0 && headerInvoiceVal > 0 && headerRate > 0) {
        invoiceValueUah = headerInvoiceVal * headerRate;
      }

      // 4) sum ccd_42_01 * ccd_23_01
      if (invoiceValueUah === 0 && goodsInvoiceValSum > 0 && headerRate > 0) {
        invoiceValueUah = goodsInvoiceValSum * headerRate;
      }

      const valueToStore = invoiceValueUah > 0 ? invoiceValueUah : null;

      const res = await db.declarationSummary.updateMany({
        where: { declarationId: d.id },
        data: { invoiceValueUah: valueToStore },
      });

      if (res.count > 0) {
        updated += res.count;
      } else {
        skippedNoSummary++;
      }

      if (scanned % 1000 === 0) {
        console.log(`[backfill-invoice-uah] scanned=${scanned} updated=${updated} skippedNoXml=${skippedNoXml} skippedNoSummary=${skippedNoSummary} cursor=${d.id}`);
      }
    }

    cursorId = batch[batch.length - 1].id;
  }

  console.log(`[backfill-invoice-uah] Done. scanned=${scanned} updated=${updated} skippedNoXml=${skippedNoXml} skippedNoSummary=${skippedNoSummary}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
