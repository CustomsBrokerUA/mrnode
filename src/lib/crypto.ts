import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

// In a real app, this should be in an environment variable
// For the local MVP demo, we'll use a hardcoded key if env is missing
// IMPORTANT: The user must replace this before production
const SECRET_KEY = (() => {
    const envKey = process.env.ENCRYPTION_KEY;
    if (process.env.NODE_ENV === 'production' && !envKey) {
        throw new Error('Missing ENCRYPTION_KEY in production environment');
    }
    return envKey || 'mrnode-local-mvp-secret-key-32-bytes!!';
})();
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

const V2_PREFIX = 'v2:';
const V2_ALGORITHM = 'aes-256-gcm';
const V2_IV_LENGTH = 12;

export async function encrypt(text: string): Promise<string> {
    // Ensure key is 32 bytes
    const key = (await promisify(scrypt)(SECRET_KEY, 'salt', 32)) as Buffer;
    const iv = randomBytes(V2_IV_LENGTH);
    const cipher = createCipheriv(V2_ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${V2_PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export async function decrypt(text: string): Promise<string> {
    if (text.startsWith(V2_PREFIX)) {
        const body = text.slice(V2_PREFIX.length);
        const parts = body.split(':');
        const ivHex = parts[0];
        const cipherHex = parts[1];
        const tagHex = parts[2];

        if (!ivHex || cipherHex === undefined || tagHex === undefined) throw new Error('Invalid encrypted text format');

        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(cipherHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');

        const key = (await promisify(scrypt)(SECRET_KEY, 'salt', 32)) as Buffer;
        const decipher = createDecipheriv(V2_ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString('utf8');
    }

    const textParts = text.split(':');
    const ivPart = textParts.shift();
    if (!ivPart) throw new Error('Invalid encrypted text format');

    const iv = Buffer.from(ivPart, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');

    const key = (await promisify(scrypt)(SECRET_KEY, 'salt', 32)) as Buffer;
    const decipher = createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}
