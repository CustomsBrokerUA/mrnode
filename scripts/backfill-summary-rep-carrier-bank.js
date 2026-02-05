const { PrismaClient } = require('@prisma/client');

function extractRepresentativeCarrierBank(xmlDataStr) {
  if (!xmlDataStr) return { representativeName: null, carrierName: null, bankName: null };

  let xml61 = null;
  try {
    const trimmed = String(xmlDataStr).trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && parsed.data61_1) {
        xml61 = parsed.data61_1;
      }
    } else if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
      // Old format: pure 61.1 XML
      xml61 = trimmed;
    }
  } catch {
    xml61 = null;
  }

  if (!xml61 || typeof xml61 !== 'string') {
    return { representativeName: null, carrierName: null, bankName: null };
  }

  const pickClientNameByGroup = (group) => {
    try {
      // Find the first client entry where ccd_cl_gr == group, and extract ccd_cl_name
      // We keep it regex-based to avoid heavy XML parsing dependencies in a one-off script.
      const re = new RegExp(`<ccd_client>[\\s\\S]*?<ccd_cl_gr>\\s*${group}\\s*<\\/ccd_cl_gr>[\\s\\S]*?<ccd_cl_name>([\\s\\S]*?)<\\/ccd_cl_name>[\\s\\S]*?<\\/ccd_client>`, 'i');
      const m = xml61.match(re);
      if (!m || !m[1]) return null;
      const name = String(m[1]).trim();
      return name && name !== '---' ? name : null;
    } catch {
      return null;
    }
  };

  const pickBankName = () => {
    try {
      const re = /<ccd_bank>[\s\S]*?<ccd_bn_name>([\s\S]*?)<\/ccd_bn_name>[\s\S]*?<\/ccd_bank>/i;
      const m = xml61.match(re);
      if (!m || !m[1]) return null;
      const name = String(m[1]).trim();
      return name && name !== '---' ? name : null;
    } catch {
      return null;
    }
  };

  return {
    representativeName: pickClientNameByGroup(14),
    carrierName: pickClientNameByGroup(50),
    bankName: pickBankName(),
  };
}

async function main() {
  const prisma = new PrismaClient();

  const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE || 200);

  let totalScanned = 0;
  let totalUpdated = 0;
  let cursorId = null;

  console.log(`[backfill] Starting. batch=${BATCH_SIZE}`);

  try {
    while (true) {
      const rows = await prisma.declaration.findMany({
        where: {
          xmlData: { not: null },
          OR: [
            { xmlData: { contains: '"data61_1"' } },
            { xmlData: { startsWith: '<' } },
            { xmlData: { startsWith: '<?xml' } },
          ],
        },
        select: {
          id: true,
          xmlData: true,
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });

      if (!rows.length) break;

      for (const r of rows) {
        totalScanned++;
        const extracted = extractRepresentativeCarrierBank(r.xmlData);

        if (!extracted.representativeName && !extracted.carrierName && !extracted.bankName) {
          continue;
        }

        await prisma.declarationSummary.upsert({
          where: { declarationId: r.id },
          create: {
            declarationId: r.id,
            representativeName: extracted.representativeName,
            carrierName: extracted.carrierName,
            bankName: extracted.bankName,
          },
          update: {
            representativeName: extracted.representativeName,
            carrierName: extracted.carrierName,
            bankName: extracted.bankName,
          },
        });

        totalUpdated++;
      }

      cursorId = rows[rows.length - 1].id;
      if (totalScanned % 1000 === 0) {
        console.log(`[backfill] scanned=${totalScanned} updated=${totalUpdated} cursor=${cursorId}`);
      }
    }

    console.log(`[backfill] Done. scanned=${totalScanned} updated=${totalUpdated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('[backfill] Fatal:', e);
  process.exit(1);
});
