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

  const normalizeGroup = (val) => {
    const s = String(val ?? '').trim();
    if (!s) return '';
    const digits = s.replace(/\D/g, '');
    return digits.replace(/^0+/, '') || digits;
  };

  const extractFirstTagText = (block, tagName) => {
    try {
      const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
      const m = String(block).match(re);
      if (!m || !m[1]) return null;
      const text = String(m[1]).trim();
      return text ? text : null;
    } catch {
      return null;
    }
  };

  const getClientBlocks = () => {
    const blocks = [];
    try {
      const re = /<ccd_clients\b[^>]*>[\s\S]*?<\/ccd_clients>|<ccd_client\b[^>]*>[\s\S]*?<\/ccd_client>/gi;
      let m;
      while ((m = re.exec(xml61)) !== null) {
        blocks.push(m[0]);
        if (blocks.length > 2000) break;
      }
    } catch {
      // ignore
    }
    return blocks;
  };

  const pickClientNameByGroup = (group) => {
    try {
      const target = String(group);
      const blocks = getClientBlocks();
      for (const block of blocks) {
        const grRaw = extractFirstTagText(block, 'ccd_cl_gr');
        const gr = normalizeGroup(grRaw);
        if (gr !== target) continue;
        const nameRaw = extractFirstTagText(block, 'ccd_cl_name');
        const name = String(nameRaw || '').trim();
        if (!name || name === '---') return null;
        return name;
      }
      return null;
    } catch {
      return null;
    }
  };

  const pickBankName = () => {
    try {
      const re = /<ccd_bank\b[^>]*>[\s\S]*?<\/ccd_bank>/i;
      const m = xml61.match(re);
      if (!m || !m[0]) return null;
      const name = String(extractFirstTagText(m[0], 'ccd_bn_name') || '').trim();
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
