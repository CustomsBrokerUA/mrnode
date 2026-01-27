import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../crypto';

describe('Crypto Utils', () => {
    describe('encrypt', () => {
        it('should encrypt a simple string', async () => {
            const text = 'test-string';
            const encrypted = await encrypt(text);
            
            expect(encrypted).toBeDefined();
            expect(typeof encrypted).toBe('string');
            expect(encrypted).toContain(':'); // Format: iv:encrypted
            expect(encrypted.split(':').length).toBeGreaterThan(1);
        });

        it('should encrypt text with special characters', async () => {
            const text = 'test@#$%^&*()!';
            const encrypted = await encrypt(text);
            
            expect(encrypted).toBeDefined();
            expect(encrypted).toContain(':');
        });

        it('should encrypt UTF-8 text (Ukrainian)', async () => {
            const text = 'Україна, тест, 123, @#$';
            const encrypted = await encrypt(text);
            
            expect(encrypted).toBeDefined();
            expect(encrypted).toContain(':');
        });

        it('should encrypt empty string', async () => {
            const text = '';
            const encrypted = await encrypt(text);
            
            expect(encrypted).toBeDefined();
            expect(encrypted).toContain(':');
        });

        it('should produce different encrypted values for same input (due to random IV)', async () => {
            const text = 'same-text';
            const encrypted1 = await encrypt(text);
            const encrypted2 = await encrypt(text);
            
            // Should be different due to random IV
            expect(encrypted1).not.toBe(encrypted2);
            // But format should be the same
            expect(encrypted1.split(':').length).toBe(encrypted2.split(':').length);
        });

        it('should encrypt long text', async () => {
            const text = 'a'.repeat(1000);
            const encrypted = await encrypt(text);
            
            expect(encrypted).toBeDefined();
            expect(encrypted).toContain(':');
        });
    });

    describe('decrypt', () => {
        it('should decrypt encrypted text correctly', async () => {
            const originalText = 'test-string';
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should decrypt text with special characters', async () => {
            const originalText = 'test@#$%^&*()!';
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should decrypt UTF-8 text (Ukrainian)', async () => {
            const originalText = 'Україна, тест, 123, @#$';
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should decrypt empty string', async () => {
            const originalText = '';
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should decrypt long text', async () => {
            const originalText = 'a'.repeat(1000);
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should throw error for invalid encrypted text format (missing colon)', async () => {
            const invalidText = 'no-colon-here';
            
            // When no colon, textParts.shift() returns the whole string, not undefined
            // Then Buffer.from will create invalid IV, causing crypto error
            await expect(decrypt(invalidText)).rejects.toThrow(); // Will throw crypto error
        });

        it('should throw error for invalid encrypted text format (empty string)', async () => {
            const invalidText = '';
            
            await expect(decrypt(invalidText)).rejects.toThrow('Invalid encrypted text format');
        });

        it('should throw error for malformed encrypted data', async () => {
            const invalidText = 'invalid:hex:data:with:multiple:colons';
            
            // Should try to decrypt but might fail with crypto errors
            await expect(decrypt(invalidText)).rejects.toThrow();
        });
    });

    describe('encrypt → decrypt round-trip', () => {
        it('should successfully round-trip simple text', async () => {
            const originalText = 'test-string';
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should successfully round-trip text with newlines', async () => {
            const originalText = 'line1\nline2\nline3';
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should successfully round-trip text with tabs', async () => {
            const originalText = 'col1\tcol2\tcol3';
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should successfully round-trip JSON string', async () => {
            const originalText = JSON.stringify({ key: 'value', number: 123, bool: true });
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
            expect(JSON.parse(decrypted)).toEqual({ key: 'value', number: 123, bool: true });
        });

        it('should successfully round-trip complex UTF-8 text', async () => {
            const originalText = 'Україна 🇺🇦 Тест 测试 テスト 🚀';
            const encrypted = await encrypt(originalText);
            const decrypted = await decrypt(encrypted);
            
            expect(decrypted).toBe(originalText);
        });

        it('should successfully round-trip multiple times', async () => {
            const originalText = 'test-text';
            let current = originalText;
            
            // Encrypt and decrypt 5 times
            for (let i = 0; i < 5; i++) {
                const encrypted = await encrypt(current);
                current = await decrypt(encrypted);
            }
            
            expect(current).toBe(originalText);
        });
    });

    describe('encryption stability', () => {
        it('should encrypt same text with same key consistently (same format)', async () => {
            const text = 'test-text';
            const encrypted1 = await encrypt(text);
            const encrypted2 = await encrypt(text);
            
            // Format should be consistent (iv:encrypted)
            const parts1 = encrypted1.split(':');
            const parts2 = encrypted2.split(':');
            
            expect(parts1.length).toBeGreaterThan(0);
            expect(parts2.length).toBeGreaterThan(0);
            expect(parts1.length).toBe(parts2.length);
            
            // IV part should be different (random), but length should be same
            expect(parts1[0].length).toBe(parts2[0].length);
        });

        it('should handle concurrent encryption/decryption', async () => {
            const texts = ['text1', 'text2', 'text3', 'text4', 'text5'];
            
            const results = await Promise.all(
                texts.map(async (text) => {
                    const encrypted = await encrypt(text);
                    const decrypted = await decrypt(encrypted);
                    return { original: text, decrypted };
                })
            );
            
            results.forEach((result) => {
                expect(result.decrypted).toBe(result.original);
            });
        });
    });
});
