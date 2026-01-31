const { PrismaClient } = require('@prisma/client');
const { createCipheriv, createDecipheriv, randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');

const prisma = new PrismaClient();

const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

async function deriveKey(secret) {
  return (await promisify(scrypt)(secret, 'salt', 32));
}

async function encryptWithKey(secretKey, text) {
  const key = await deriveKey(secretKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function decryptWithKey(secretKey, text) {
  const textParts = String(text).split(':');
  const ivPart = textParts.shift();
  if (!ivPart) throw new Error('Invalid encrypted text format');

  const iv = Buffer.from(ivPart, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');

  const key = await deriveKey(secretKey);
  const decipher = createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

function looksLikeEncryptedPayload(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length < 2) return false;
  const [ivHex, ...rest] = parts;
  const cipherHex = rest.join(':');
  if (!ivHex || !cipherHex) return false;
  if (ivHex.length !== 32) return false; // 16 bytes IV => 32 hex chars
  return /^[0-9a-f]+$/i.test(ivHex) && /^[0-9a-f]+$/i.test(cipherHex);
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const oldKey = process.env.OLD_ENCRYPTION_KEY || getArg('--old-key');
  const newKey = process.env.NEW_ENCRYPTION_KEY || getArg('--new-key');

  if (!oldKey || !newKey) {
    console.error('❌ Missing keys. Provide via env OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY, or args --old-key and --new-key');
    process.exit(1);
  }

  if (oldKey === newKey) {
    console.error('❌ OLD and NEW keys are identical. Aborting.');
    process.exit(1);
  }

  console.log('🔄 Starting customsToken encryption migration...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}`);

  let companies;
  try {
    companies = await prisma.company.findMany({
      where: { customsToken: { not: null } },
      select: { id: true, edrpou: true, customsToken: true },
    });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    if (msg.includes("Can't reach database server")) {
      const dbUrl = process.env.DATABASE_URL || '';
      const looksLikeRenderInternal = /@dpg-[^./]+\//.test(dbUrl) || /@dpg-[^./]+:5432/.test(msg);
      if (looksLikeRenderInternal) {
        console.error('❗ схоже, що ти використовуєш Internal Database URL з Render (hostname типу dpg-...).');
        console.error('   Він працює тільки зсередини Render. Для запуску з твого ПК потрібен External Database URL (з доменом *.render.com / *.renderusercontent.com).');
      }
      console.error('❗ Якщо Render Postgres вимагає SSL, додай до DATABASE_URL параметр: ?sslmode=require');
    }
    throw e;
  }

  let migrated = 0;
  let skippedAlreadyNew = 0;
  let failed = 0;

  for (const company of companies) {
    const token = company.customsToken;
    if (!token) continue;

    try {
      let plaintext;
      const tokenIsEncrypted = looksLikeEncryptedPayload(token);

      if (!tokenIsEncrypted) {
        // Legacy/plaintext token (or placeholder like DEMO_TOKEN_ENCRYPTED)
        plaintext = String(token);
      } else {
        try {
          plaintext = await decryptWithKey(oldKey, token);
        } catch (eOld) {
          // Maybe already encrypted with new key
          try {
            await decryptWithKey(newKey, token);
            skippedAlreadyNew++;
            continue;
          } catch (eNew) {
            const msgOld = eOld && eOld.message ? String(eOld.message) : String(eOld);
            if (msgOld.includes('Invalid initialization vector') || msgOld.includes('Invalid encrypted text format')) {
              // Data looks encrypted but is malformed; treat as plaintext to avoid blocking migration
              plaintext = String(token);
            } else {
              throw eOld;
            }
          }
        }
      }

      const reEncrypted = await encryptWithKey(newKey, plaintext);

      if (!dryRun) {
        await prisma.company.update({
          where: { id: company.id },
          data: { customsToken: reEncrypted },
        });
      }

      migrated++;

      if (migrated % 25 === 0) {
        console.log(`Progress: migrated=${migrated}, skipped=${skippedAlreadyNew}, failed=${failed}`);
      }
    } catch (e) {
      failed++;
      console.error(`❌ Failed for company id=${company.id} edrpou=${company.edrpou}:`, e && e.message ? e.message : e);
    }
  }

  console.log('✅ Migration finished');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped (already new key): ${skippedAlreadyNew}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
