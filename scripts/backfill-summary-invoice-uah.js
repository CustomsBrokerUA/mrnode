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

  const { mapXmlToDeclaration } = require('../src/lib/xml-mapper');

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

      let mapped;
      try {
        mapped = mapXmlToDeclaration(xml61);
      } catch {
        skippedNoXml++;
        continue;
      }

      if (!mapped) {
        skippedNoXml++;
        continue;
      }

      const header = mapped.header || {};
      const goods = Array.isArray(mapped.goods) ? mapped.goods : [];

      let invoiceValueUah = 0;

      // 1) direct field (often ccd_22_03)
      invoiceValueUah = num(header.invoiceValueUah);

      // 2) sum per-goods invoiceValueUah (ccd_42_02)
      if (invoiceValueUah === 0) {
        invoiceValueUah = goods.reduce((sum, g) => sum + num(g && g.invoiceValueUah), 0);
      }

      // 3) header invoiceValue (ccd_22_02) * exchangeRate (ccd_23_01)
      if (invoiceValueUah === 0) {
        const inv = num(header.invoiceValue);
        const rate = num(header.exchangeRate);
        if (inv > 0 && rate > 0) {
          invoiceValueUah = inv * rate;
        }
      }

      // 4) sum goods.price (ccd_42_01) * exchangeRate
      if (invoiceValueUah === 0) {
        const rate = num(header.exchangeRate);
        if (rate > 0) {
          invoiceValueUah = goods.reduce((sum, g) => sum + num(g && g.price) * rate, 0);
        }
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
