const { PrismaClient } = require('@prisma/client');
const { createCipheriv, createDecipheriv, randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');

const prisma = new PrismaClient();

const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

const V2_PREFIX = 'v2:';
const V2_IV_LENGTH = 12;
const V2_ALGORITHM = 'aes-256-gcm';

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

async function encryptV2WithKey(secretKey, text) {
  const key = await deriveKey(secretKey);
  const iv = randomBytes(V2_IV_LENGTH);
  const cipher = createCipheriv(V2_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${V2_PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

async function decryptWithKey(secretKey, text) {
  if (String(text).startsWith(V2_PREFIX)) {
    const body = String(text).slice(V2_PREFIX.length);
    const parts = body.split(':');
    const ivPart = parts[0];
    const cipherPart = parts[1];
    const tagPart = parts[2];
    if (!ivPart || !cipherPart || !tagPart) throw new Error('Invalid encrypted text format');

    const iv = Buffer.from(ivPart, 'hex');
    const encryptedText = Buffer.from(cipherPart, 'hex');
    const tag = Buffer.from(tagPart, 'hex');

    const key = await deriveKey(secretKey);
    const decipher = createDecipheriv(V2_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString('utf8');
  }

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

function looksLikeEncryptedPayloadV2(value) {
  if (typeof value !== 'string') return false;
  if (!value.startsWith(V2_PREFIX)) return false;
  const body = value.slice(V2_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) return false;
  const [ivHex, cipherHex, tagHex] = parts;
  if (!ivHex || !cipherHex || !tagHex) return false;
  if (ivHex.length !== V2_IV_LENGTH * 2) return false;
  if (tagHex.length !== 32) return false; // 16 bytes tag
  return /^[0-9a-f]+$/i.test(ivHex) && /^[0-9a-f]+$/i.test(cipherHex) && /^[0-9a-f]+$/i.test(tagHex);
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

  const toV2 = process.argv.includes('--to-v2');
  const force = process.argv.includes('--force');
  const allowFailures = process.argv.includes('--allow-failures');

  const oldKey = process.env.OLD_ENCRYPTION_KEY || getArg('--old-key');
  const newKey = process.env.NEW_ENCRYPTION_KEY || getArg('--new-key');
  const singleKey = process.env.ENCRYPTION_KEY || getArg('--key');

  if (toV2) {
    if (!singleKey) {
      console.error('❌ Missing ENCRYPTION_KEY for --to-v2. Provide via env ENCRYPTION_KEY, or arg --key');
      process.exit(1);
    }

    // Safety: do not allow live migration without an explicit confirmation flag.
    // This prevents partial migrations if the provided key is wrong.
    if (!dryRun && !force) {
      console.error('❌ Refusing to run LIVE --to-v2 migration without --force.');
      console.error('   Run a DRY RUN first and ensure Failed: 0, then re-run with --force.');
      process.exit(1);
    }
  } else {
    if (!oldKey || !newKey) {
      console.error('❌ Missing keys. Provide via env OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY, or args --old-key and --new-key');
      process.exit(1);
    }

    if (oldKey === newKey) {
      console.error('❌ OLD and NEW keys are identical. Aborting.');
      process.exit(1);
    }
  }

  console.log('🔄 Starting customsToken encryption migration...');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  if (toV2) {
    console.log('Target: format migration to v2 (aes-256-gcm)');
    console.log(`Failures policy: ${allowFailures ? 'ALLOW FAILURES (will continue)' : 'STRICT (Failed must be 0 before LIVE)'}`);
  }

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

    if (toV2) {
      try {
        if (looksLikeEncryptedPayloadV2(token)) {
          skippedAlreadyNew++;
          continue;
        }

        let plaintext;
        const tokenIsEncrypted = looksLikeEncryptedPayload(token);
        if (!tokenIsEncrypted) {
          plaintext = String(token);
        } else {
          try {
            plaintext = await decryptWithKey(singleKey, token);
          } catch (eOld) {
            const msgOld = eOld && eOld.message ? String(eOld.message) : String(eOld);

            // If it's malformed payload, treat as plaintext (legacy placeholders).
            if (msgOld.includes('Invalid initialization vector') || msgOld.includes('Invalid encrypted text format')) {
              plaintext = String(token);
            } else {
              // If decrypt fails (e.g. bad decrypt), it's likely a wrong key or corrupted data.
              // In strict mode we mark as failed and keep original value.
              throw eOld;
            }
          }
        }

        const reEncrypted = await encryptV2WithKey(singleKey, plaintext);

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

        if (!allowFailures) {
          console.error('   Hint: verify ENCRYPTION_KEY is the same key that was used to encrypt current customsToken values.');
        }
      }
      continue;
    }

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
    if (toV2 && !allowFailures) {
      console.error('❗ v2 migration had failures. Do NOT run LIVE until you fix the key/data and DRY RUN shows Failed: 0.');
    }
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
