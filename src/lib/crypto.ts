import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

// In a real app, this should be in an environment variable
// For the local MVP demo, we'll use a hardcoded key if env is missing
// IMPORTANT: The user must replace this before production
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'mrnode-local-mvp-secret-key-32-bytes!!';
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

export async function encrypt(text: string): Promise<string> {
    // Ensure key is 32 bytes
    const key = (await promisify(scrypt)(SECRET_KEY, 'salt', 32)) as Buffer;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export async function decrypt(text: string): Promise<string> {
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
