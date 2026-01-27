import { DeclarationWithRawData } from './types';

/**
 * Безпечно отримує rawData з декларації.
 * Використовується для обходу проблем типізації TypeScript при роботі з union типами.
 * 
 * @param doc - Декларація (може бути різних типів)
 * @returns rawData об'єкт або undefined, якщо не існує
 * 
 * @example
 * ```ts
 * const rawData = getRawData(declaration);
 * const status = rawData?.ccd_status;
 * ```
 */
export function getRawData(doc: any): DeclarationWithRawData['rawData'] {
    return (doc as DeclarationWithRawData).rawData;
}

/**
 * Форматує дату з формату митних систем (YYYYMMDDTHHMMSS) в читабельний формат.
 * 
 * Формат вхідних даних: `20250529T100000`
 * Формат вихідних даних: `29.05.2025, 10:00:00` (українська локаль)
 * 
 * @param dateStr - Рядок дати в форматі YYYYMMDDTHHMMSS або undefined
 * @returns Відформатована дата або "---" якщо дата відсутня/невалідна
 * 
 * @example
 * ```ts
 * formatRegisteredDate('20250116T120000') // "16.01.2025, 12:00:00"
 * formatRegisteredDate(undefined) // "---"
 * ```
 */
export function formatRegisteredDate(dateStr: string | undefined): string {
    if (!dateStr) return '---';
    try {
        // Format: 20250529T100000 -> 2025-05-29 10:00:00
        const match = dateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
        if (match) {
            const [, year, month, day, hour, minute, second] = match;
            const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
            return date.toLocaleString('uk-UA');
        }
        return dateStr;
    } catch {
        return dateStr;
    }
}

/**
 * Декодує текст з Windows-1251 кодування в UTF-8.
 * 
 * **Проблема**: При парсингу XML з митних систем кирилиця може зберігатися як Windows-1251 байти,
 * але інтерпретуватися як символи з тими ж кодами. Наприклад, "ІМ ЕЕ" може відображатися як "ааъ аа".
 * 
 * **Рішення**: Функція перевіряє, чи текст вже правильно закодований в UTF-8. Якщо ні,
 * конвертує кожен символ як Windows-1251 байт і мапить його в відповідний UTF-8 символ.
 * 
 * **Алгоритм**:
 * 1. Перевіряє, чи текст вже містить коректну кирилицю (UTF-8)
 * 2. Якщо ні, конвертує кожен char code (0-255) як Windows-1251 байт
 * 3. Використовує повну мапу Windows-1251 → UTF-8 для конвертації
 * 4. Обробляє ASCII символи окремо (0-127)
 * 
 * @param text - Текст для декодування (може бути undefined)
 * @returns Декодований текст в UTF-8 або "---" якщо текст відсутній
 * 
 * @example
 * ```ts
 * decodeWindows1251(String.fromCharCode(0xC7, 0xCC, 0xC5)) // "ЗМЕ"
 * decodeWindows1251('Україна') // "Україна" (вже UTF-8)
 * decodeWindows1251(undefined) // "---"
 * ```
 */
export function decodeWindows1251(text: string | undefined): string {
    if (!text) return '---';
    
    // Check if text is already correctly encoded UTF-8 with Cyrillic
    if (/^[А-ЯЁа-яёІіЇїЄєҐґ\s\d]+$/.test(text)) {
        return text; // Already correctly encoded
    }
    
    try {
        // Convert each character code directly to win1251 byte
        // Each char code (0-255) represents a win1251 byte
        const bytes: number[] = [];
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            // Treat char code as win1251 byte (0-255)
            if (charCode <= 255) {
                bytes.push(charCode);
            } else {
                // Multi-byte UTF-8 char - extract first byte or skip
                bytes.push(charCode & 0xFF);
            }
        }
        
        // Convert windows-1251 bytes to UTF-8 string using complete mapping
        const win1251ToUtf8: { [key: number]: string } = {
            // ASCII (0x00-0x7F) - handled separately
            // Extended ASCII and Cyrillic (0x80-0xFF)
            0x80: 'Ђ', 0x81: 'Ѓ', 0x82: '‚', 0x83: 'ѓ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
            0x88: '€', 0x89: '‰', 0x8A: 'Љ', 0x8B: '‹', 0x8C: 'Њ', 0x8D: 'Ќ', 0x8E: 'Ћ', 0x8F: 'Џ',
            0x90: 'ђ', 0x91: '‘', 0x92: '’', 0x93: '"', 0x94: '"', 0x95: '•', 0x96: '–', 0x97: '—',
            0x98: ' ', 0x99: '™', 0x9A: 'љ', 0x9B: '›', 0x9C: 'њ', 0x9D: 'ќ', 0x9E: 'ћ', 0x9F: 'џ',
            0xA0: ' ', 0xA1: 'Ё', 0xA2: 'ё', 0xA3: 'Ђ', 0xA4: 'ђ', 0xA5: 'Є', 0xA6: 'є', 0xA7: 'Ї',
            0xA8: 'ї', 0xA9: 'Љ', 0xAA: 'љ', 0xAB: 'Њ', 0xAC: 'њ', 0xAD: 'Ќ', 0xAE: 'ќ', 0xAF: 'Ћ',
            0xB0: 'ћ', 0xB1: 'Џ', 0xB2: 'џ', 0xB3: '№', 0xB4: 'Ђ', 0xB5: 'ђ', 0xB6: '‚', 0xB7: 'ѓ',
            0xB8: '„', 0xB9: '…', 0xBA: '†', 0xBB: '‡', 0xBC: '€', 0xBD: '‰', 0xBE: 'Љ', 0xBF: '‹',
            // Cyrillic uppercase (0xC0-0xDF)
            0xC0: 'А', 0xC1: 'Б', 0xC2: 'В', 0xC3: 'Г', 0xC4: 'Д', 0xC5: 'Е', 0xC6: 'Ж', 0xC7: 'З',
            0xC8: 'И', 0xC9: 'Й', 0xCA: 'К', 0xCB: 'Л', 0xCC: 'М', 0xCD: 'Н', 0xCE: 'О', 0xCF: 'П',
            0xD0: 'Р', 0xD1: 'С', 0xD2: 'Т', 0xD3: 'У', 0xD4: 'Ф', 0xD5: 'Х', 0xD6: 'Ц', 0xD7: 'Ч',
            0xD8: 'Ш', 0xD9: 'Щ', 0xDA: 'Ъ', 0xDB: 'Ы', 0xDC: 'Ь', 0xDD: 'Э', 0xDE: 'Ю', 0xDF: 'Я',
            // Cyrillic lowercase (0xE0-0xFF)
            0xE0: 'а', 0xE1: 'б', 0xE2: 'в', 0xE3: 'г', 0xE4: 'д', 0xE5: 'е', 0xE6: 'ж', 0xE7: 'з',
            0xE8: 'и', 0xE9: 'й', 0xEA: 'к', 0xEB: 'л', 0xEC: 'м', 0xED: 'н', 0xEE: 'о', 0xEF: 'п',
            0xF0: 'р', 0xF1: 'с', 0xF2: 'т', 0xF3: 'у', 0xF4: 'ф', 0xF5: 'х', 0xF6: 'ц', 0xF7: 'ч',
            0xF8: 'ш', 0xF9: 'щ', 0xFA: 'ъ', 0xFB: 'ы', 0xFC: 'ь', 0xFD: 'э', 0xFE: 'ю', 0xFF: 'я'
        };
        
        let result = '';
        for (const byte of bytes) {
            if (byte < 128) {
                // ASCII
                result += String.fromCharCode(byte);
            } else if (win1251ToUtf8[byte]) {
                result += win1251ToUtf8[byte];
            } else {
                // Fallback: try to use char code directly
                result += String.fromCharCode(byte);
            }
        }
        return result;
    } catch {
        return text;
    }
}

/**
 * Отримує номер митної декларації (МД) в стандартизованому форматі.
 * 
 * **Пріоритет отримання номера**:
 * 1. `rawData.MRN` - сучасний формат MRN (якщо доступний)
 * 2. `mrn` - параметр mrn з декларації (якщо доступний)
 * 3. Конструкція з частин: `ccd_07_01 / ccd_07_02 / ccd_07_03` (старий формат)
 * 4. "---" - якщо жодне значення не доступне
 * 
 * **Формат старого номера**: `XXX / YYY / ZZZZZZ`
 * - `ccd_07_01` - код митниці (3 символи)
 * - `ccd_07_02` - код декларанта (3 символи)
 * - `ccd_07_03` - порядковий номер (6 символів, з ведучими нулями)
 * 
 * @param rawData - rawData об'єкт з декларації (може бути null/undefined)
 * @param mrn - MRN з декларації (може бути null)
 * @returns Номер МД в стандартизованому форматі або "---"
 * 
 * @example
 * ```ts
 * getMDNumber({ MRN: 'MRN123' }, null) // "MRN123"
 * getMDNumber(null, 'MRN456') // "MRN456"
 * getMDNumber({ ccd_07_01: '123', ccd_07_02: '456', ccd_07_03: '789' }, null) // "123 / 456 / 000789"
 * getMDNumber(null, null) // "---"
 * ```
 */
export function getMDNumber(rawData: DeclarationWithRawData['rawData'], mrn: string | null): string {
    if (rawData?.MRN) {
        return rawData.MRN;
    }
    if (mrn) {
        return mrn;
    }
    if (rawData?.ccd_07_01 && rawData?.ccd_07_02 && rawData?.ccd_07_03) {
        const part3 = String(rawData.ccd_07_03).padStart(6, '0');
        return `${rawData.ccd_07_01} / ${rawData.ccd_07_02} / ${part3}`;
    }
    return '---';
}
