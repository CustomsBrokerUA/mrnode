import axios from 'axios';
import https from 'https';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';

// Create a relaxed agent to bypass SSL errors
const httpsAgent = new https.Agent({
    rejectUnauthorized: true,
    keepAlive: true
});

const API_ENDPOINT = 'https://sw4.customs.gov.ua/AskCustomsR2';

export interface CustomsResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export class CustomsService {

    private token: string;
    private edrpou: string;

    constructor(token: string, edrpou: string) {
        this.token = token;
        this.edrpou = edrpou;
    }

    /**
     * Генерує timestamp у форматі митниці: YYYYMMDDThhmmss.
     * 
     * Використовується для створення дат у XML запитах до API митниці.
     * 
     * @param date - Дата для форматування (за замовчуванням: поточна дата/час)
     * @returns Рядок у форматі "YYYYMMDDThhmmss" (наприклад: "20250116T143025")
     * 
     * @example
     * ```ts
     * const timestamp = this.getTimestamp(); // "20250116T143025"
     * const customTimestamp = this.getTimestamp(new Date('2025-01-01')); // "20250101T000000"
     * ```
     */
    private getTimestamp(date: Date = new Date()): string {
        const pad = (num: number) => String(num).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        // Format: YYYYMMDDThhmmss
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    }

    /**
     * Декодує Buffer у рядок, автоматично визначаючи кодування.
     * 
     * Алгоритм:
     * 1. Перевіряє XML декларацію на наявність encoding атрибуту
     * 2. Якщо encoding="UTF-8" - декодує як UTF-8
     * 3. Інакше - декодує як Windows-1251 (стандартне кодування митниці)
     * 4. При помилках - fallback на Windows-1251, потім UTF-8
     * 
     * Це критично важливо, оскільки API митниці повертає дані в Windows-1251,
     * але іноді може бути UTF-8, і неправильне декодування призводить до "кракозябр".
     * 
     * @param buffer - Buffer для декодування
     * @returns Декодований рядок
     * 
     * @example
     * ```ts
     * const utf8Buffer = Buffer.from('Тест', 'utf8');
     * const decoded = this.decodeBuffer(utf8Buffer); // "Тест"
     * ```
     */
    private decodeBuffer(buffer: Buffer): string {
        try {
            // First, try to detect encoding from the XML header
            const startOfXml = buffer.slice(0, 100).toString('ascii');
            const encodingMatch = startOfXml.match(/encoding=["'](.*?)["']/i);
            const declaredEncoding = encodingMatch ? encodingMatch[1].toLowerCase() : null;

            // If XML says UTF-8, decode as UTF-8 (data might be double-encoded, but we'll fix it later)
            // Otherwise, decode as windows-1251 (default for customs API)
            let decoded: string;
            if (declaredEncoding === 'utf-8' || declaredEncoding === 'utf8') {
                decoded = buffer.toString('utf8');
            } else {
                decoded = iconv.decode(buffer, 'win1251');
            }

            return decoded;
        } catch (e) {
            // Final fallback: try windows-1251
            try {
                return iconv.decode(buffer, 'win1251');
            } catch (e2) {
                // Last resort: return as UTF-8
                return buffer.toString('utf8');
            }
        }
    }

    /**
     * Парсить XML з деклараціями (60.1 формат) та витягує список декларацій.
     * 
     * Обробляє XML відповідь від API митниці, яка містить список коротких декларацій.
     * Автоматично виправляє подвійне кодування кирилиці.
     * 
     * **Особливості:**
     * - Використовує XMLParser для правильного парсингу
     * - Виправляє подвійне кодування у полях ccd_type та trn_all
     * - Обробляє як масиви, так і одиночні елементи <md>
     * - Fallback на regex парсинг при помилках XMLParser
     * 
     * @param xml - XML рядок з деклараціями
     * @returns Масив об'єктів декларацій (кожен містить поля типу MRN, ccd_status, ccd_type, тощо)
     * 
     * @example
     * ```ts
     * const xml = '<response><md><MRN>123/456/001</MRN></md></response>';
     * const declarations = this.parseXmlDeclarations(xml);
     * console.log(declarations[0].MRN); // "123/456/001"
     * ```
     */
    private parseXmlDeclarations(xml: string): any[] {
        /**
         * Виправляє подвійне кодування кирилиці у тексті.
         * 
         * **Проблема:** Коли Windows-1251 байти інтерпретуються як UTF-8, виникають помилки
         * кодування, наприклад: "Р•Рљ 10 РђРђ" замість "ЕК 10 АА".
         * 
         * **Алгоритм:**
         * 1. Шукає підозрілі патерни (кірилиця "Р" зі спецсимволами)
         * 2. Аналізує UTF-8 байтові послідовності
         * 3. Мапить їх назад до оригінальних Windows-1251 байтів
         * 4. Декодує в правильні символи
         * 
         * @param text - Текст з можливим подвійним кодуванням
         * @returns Виправлений текст або оригінальний, якщо подвійного кодування не виявлено
         */
        const fixDoubleEncoding = (text: string): string => {
            if (!text || typeof text !== 'string') return text;
            
            // Check for suspicious pattern: Cyrillic Р followed by special chars or other Cyrillic
            const suspiciousPattern = /Р[•†‡‥…ђљњћџ]/;
            if (!suspiciousPattern.test(text)) {
                return text; // No double encoding detected
            }
            
            // The problem: windows-1251 bytes were read as UTF-8
            // Example: "ЕК" in win1251 = [0xC5, 0xCA]
            // If read as UTF-8: 0xC5 0xCA = U+014A (Ŋ) - but we see "Р•Рљ"
            // This suggests the bytes were misinterpreted multiple times
            
            // Strategy: Fix double-encoding for ALL Cyrillic letters
            // The pattern "Р•Рљ" represents windows-1251 bytes that were interpreted as UTF-8
            // 
            // Key insight: When a windows-1251 byte (0xC0-0xFF) is read as UTF-8:
            // - It's invalid UTF-8 (bytes 0xC0-0xFF need continuation bytes)
            // - The system creates replacement characters or misinterprets
            // - These are then encoded as UTF-8, creating patterns like "Р•", "Рљ", etc.
            //
            // General solution: Extract the UTF-8 bytes and try to reverse-engineer
            // the original windows-1251 bytes by analyzing the byte patterns
            
            const utf8Bytes = Buffer.from(text, 'utf8');
            let result = '';
            let i = 0;
            
            while (i < utf8Bytes.length) {
                // Look for pattern: d0a0 (Р) followed by special UTF-8 sequences
                // This pattern suggests a windows-1251 byte was double-encoded
                
                if (i + 1 < utf8Bytes.length && utf8Bytes[i] === 0xD0 && utf8Bytes[i + 1] === 0xA0) {
                    // Found "Р" (d0a0) - check what follows
                    let j = i + 2;
                    let decodedChar = '';
                    
                    // Try to decode the following bytes to see what character it represents
                    // This helps us understand what windows-1251 byte was originally there
                    try {
                        // Look ahead to find the complete UTF-8 sequence
                        if (j < utf8Bytes.length) {
                            // Check if next bytes form a valid UTF-8 sequence
                            let seqLength = 1;
                            if (utf8Bytes[j] >= 0xE0 && utf8Bytes[j] <= 0xEF && j + 2 < utf8Bytes.length) {
                                seqLength = 3; // 3-byte UTF-8 sequence
                            } else if (utf8Bytes[j] >= 0xC0 && utf8Bytes[j] <= 0xDF && j + 1 < utf8Bytes.length) {
                                seqLength = 2; // 2-byte UTF-8 sequence
                            }
                            
                            const seq = utf8Bytes.slice(j, j + seqLength);
                            const decodedSeq = seq.toString('utf8');
                            
                            // Map the decoded sequence back to windows-1251 byte
                            // This is a heuristic based on common patterns
                            const charCode = decodedSeq.charCodeAt(0);
                            
                            // Try to find the original windows-1251 byte
                            // by analyzing the UTF-8 byte pattern
                            // The pattern "Р•" (d0a0e280a2) suggests original byte was 0xC5 (Е)
                            // The pattern "Рљ" (d0a0d199) suggests original byte was 0xCA (К)
                            
                            // Build a mapping based on UTF-8 byte patterns
                            const bytePattern = seq.toString('hex');
                            const win1251ByteMap: { [key: string]: number } = {
                                'e280a2': 0xC5, // • → Е
                                'd199': 0xCA,   // љ → К
                                'd192': 0xC0,   // ђ → А
                                'e280a0': 0xC7, // вЂ → І
                                'd19a': 0xCC,   // њ → М
                            };
                            
                            if (bytePattern in win1251ByteMap) {
                                const originalByte = win1251ByteMap[bytePattern];
                                decodedChar = iconv.decode(Buffer.from([originalByte]), 'win1251');
                                i = j + seqLength; // Skip the sequence
                            } else {
                                // Unknown pattern - keep "Р" and continue
                                decodedChar = 'Р';
                                i += 2;
                            }
                        } else {
                            decodedChar = 'Р';
                            i += 2;
                        }
                    } catch (e) {
                        // If decoding fails, keep "Р" and continue
                        decodedChar = 'Р';
                        i += 2;
                    }
                    
                    result += decodedChar;
                } else {
                    // Not a double-encoded pattern - keep the character as is
                    const char = String.fromCharCode(utf8Bytes[i]);
                    result += char;
                    i++;
                }
            }
            
            if (result !== text) {
                return result;
            }
            
            return text;
        };
        
        try {
            // Use XMLParser for proper encoding handling
            const { XMLParser } = require('fast-xml-parser');
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_",
                trimValues: true,
                // Ensure proper encoding handling
                processEntities: true,
                htmlEntities: true,
            });
            
            const parsed = parser.parse(xml);
            const rootKey = Object.keys(parsed).find(k => !k.startsWith('?')) || Object.keys(parsed)[0];
            const rootData = parsed[rootKey];
            
            if (!rootData) return [];
            
            // Extract md items - can be array or single object
            const mdItems = rootData.md;
            if (!mdItems) return [];
            
            const items = Array.isArray(mdItems) ? mdItems : [mdItems];
            
            // Extract trn_all directly from XML for each item if XMLParser didn't extract it
            // XMLParser sometimes misses fields, so we need to extract manually
            // Extract all <md> blocks first to match by index
            const mdBlocks: string[] = [];
            const mdRegex = /<md>([\s\S]*?)<\/md>/gi;
            let mdMatch;
            while ((mdMatch = mdRegex.exec(xml)) !== null) {
                mdBlocks.push(mdMatch[1]);
            }
            
            // Match items with their corresponding XML blocks
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                
                if (!item.trn_all && i < mdBlocks.length) {
                    const mdContent = mdBlocks[i];
                    
                    // Try to extract trn_all
                    const trnAllMatch = mdContent.match(/<trn_all>([\s\S]*?)<\/trn_all>/i);
                    if (trnAllMatch && trnAllMatch[1]) {
                        item.trn_all = trnAllMatch[1].trim();
                    } else {
                        // Try to extract from ccd_transport section
                        const transportMatches = mdContent.matchAll(/<ccd_transport[^>]*>([\s\S]*?)<\/ccd_transport>/gi);
                        const transportNames: string[] = [];
                        for (const match of transportMatches) {
                            const transportContent = match[1];
                            const trnNameMatch = transportContent.match(/<ccd_trn_name>([\s\S]*?)<\/ccd_trn_name>/i) ||
                                               transportContent.match(/<trn_name>([\s\S]*?)<\/trn_name>/i);
                            if (trnNameMatch && trnNameMatch[1]) {
                                transportNames.push(trnNameMatch[1].trim());
                            }
                        }
                        if (transportNames.length > 0) {
                            item.trn_all = transportNames.join(', ');
                        }
                    }
                }
            }
            
            // Apply fix to ccd_type and trn_all for double-encoding
            for (const item of items) {
                if (item.ccd_type) {
                    item.ccd_type = fixDoubleEncoding(item.ccd_type);
                }
                if (item.trn_all) {
                    item.trn_all = fixDoubleEncoding(item.trn_all);
                }
            }
            
            return items;
        } catch (error) {
            console.error("XMLParser error, falling back to regex:", error);
            // Fallback to regex parsing
        const items: any[] = [];
        const mdRegex = /<md>([\s\S]*?)<\/md>/g;

        let match;
        while ((match = mdRegex.exec(xml)) !== null) {
            const innerContent = match[1];
            const item: any = {};

            const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
            let fieldMatch;
            while ((fieldMatch = fieldRegex.exec(innerContent)) !== null) {
                item[fieldMatch[1]] = fieldMatch[2];
            }
                
                // Try to extract trn_all if not found
                if (!item.trn_all) {
                    const trnAllMatch = innerContent.match(/<trn_all>([\s\S]*?)<\/trn_all>/i);
                    if (trnAllMatch && trnAllMatch[1]) {
                        item.trn_all = trnAllMatch[1].trim();
                    } else {
                        // Try to extract from ccd_transport section
                        const transportMatches = innerContent.matchAll(/<ccd_transport[^>]*>([\s\S]*?)<\/ccd_transport>/gi);
                        const transportNames: string[] = [];
                        for (const transportMatch of transportMatches) {
                            const transportContent = transportMatch[1];
                            const trnNameMatch = transportContent.match(/<ccd_trn_name>([\s\S]*?)<\/ccd_trn_name>/i) ||
                                               transportContent.match(/<trn_name>([\s\S]*?)<\/trn_name>/i);
                            if (trnNameMatch && trnNameMatch[1]) {
                                transportNames.push(trnNameMatch[1].trim());
                            }
                        }
                        if (transportNames.length > 0) {
                            item.trn_all = transportNames.join(', ');
                        }
                    }
                }
                
                // Apply fixDoubleEncoding
                if (item.ccd_type) {
                    item.ccd_type = fixDoubleEncoding(item.ccd_type);
                }
                if (item.trn_all) {
                    item.trn_all = fixDoubleEncoding(item.trn_all);
                }
                
            items.push(item);
        }
        return items;
        }
    }

    /**
     * Отримує список декларацій за період (60.1 формат - короткий список).
     * 
     * Виконує запит до API митниці для отримання списку декларацій за вказаний період.
     * Повертає короткий формат з основними полями (MRN, статус, тип, дата тощо).
     * 
     * **Процес:**
     * 1. Формує XML запит з датами та EDRPOU
     * 2. Відправляє POST запит до API митниці
     * 3. Отримує Base64-encoded ZIP архів у відповіді
     * 4. Розпаковує ZIP та декодує XML (Windows-1251 → UTF-8)
     * 5. Парсить XML та витягує список декларацій
     * 
     * **Формат запиту:**
     * - MessageType: "UA.SFS.REQ.60.1"
     * - MessageBody: XML з датами та фільтрами
     * - Token: токен авторизації
     * 
     * **Формат відповіді:**
     * - messageBody: Base64-encoded ZIP архів
     * - ZIP містить doc1.xml з списком декларацій
     * 
     * @param dateFrom - Дата початку періоду (буде встановлена на 00:00:00)
     * @param dateTo - Дата кінця періоду (буде встановлена на 23:59:59.999)
     * @returns Об'єкт CustomsResponse з success флагом та даними або помилкою
     * 
     * @example
     * ```ts
     * const service = new CustomsService(token, edrpou);
     * const result = await service.getDeclarationsList(
     *   new Date('2025-01-01'),
     *   new Date('2025-01-31')
     * );
     * if (result.success) {
     *   console.log(result.data.md); // масив декларацій
     * }
     * ```
     */
    async getDeclarationsList(dateFrom: Date, dateTo: Date): Promise<CustomsResponse> {
        try {
            // 1. Construct XML Body
            // Ensure dateFrom starts at 00:00:00
            const startOfDay = new Date(dateFrom);
            startOfDay.setHours(0, 0, 0, 0);

            // Ensure dateTo ends at 23:59:59
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);

            const creationDate = this.getTimestamp();
            const dateBegin = this.getTimestamp(startOfDay);
            const dateEnd = this.getTimestamp(endOfDay);

            // XML Body matching working n8n example (with status field)
            const xmlBody = `<UA.SFS.REQ.60.1><creation_date>${creationDate}</creation_date><cli_code>${this.edrpou}</cli_code><date_begin>${dateBegin}</date_begin><date_end>${dateEnd}</date_end><date_type>1</date_type><status>R</status></UA.SFS.REQ.60.1>`;

            // 2. Construct Payload as SINGLE OBJECT
            const payload = {
                "MessageType": "UA.SFS.REQ.60.1",
                "MessageBody": xmlBody,
                "Token": this.token
            };


            // 3. Send Request
            console.log("📤 Sending 60.1 Request:");
            console.log("  - Date From:", dateBegin);
            console.log("  - Date To:", dateEnd);
            console.log("  - EDRPOU:", this.edrpou);
            console.log("  - XML Body:", xmlBody);
            
            const response = await axios.post(API_ENDPOINT, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                httpsAgent: httpsAgent,
                timeout: 90000 // Increased to 90 seconds for large chunks (45 days can have many declarations)
            });

            console.log("📥 Received 60.1 Response:");
            console.log("  - Status:", response.status);
            console.log("  - Response Data Type:", typeof response.data);
            console.log("  - Response Data Keys:", response.data ? Object.keys(response.data) : "null");
            if (response.data) {
                console.log("  - Has messageBody:", 'messageBody' in response.data);
                console.log("  - messageBody Type:", typeof response.data.messageBody);
                if (response.data.messageBody) {
                    console.log("  - messageBody Length:", response.data.messageBody.length);
                    console.log("  - messageBody Preview (first 200 chars):", response.data.messageBody.substring(0, 200));
                }
                // Log all top-level keys and their types
                for (const key in response.data) {
                    console.log(`  - response.data.${key}:`, typeof response.data[key], 
                        typeof response.data[key] === 'string' ? `(length: ${response.data[key].length})` : '');
                }
            }

            // Handle 204 No Content - API returns this when there's no data for the period
            if (response.status === 204 || (typeof response.data === 'string' && response.data === '')) {
                console.log("ℹ️ API returned 204 No Content - no data available for this period");
                return {
                    success: true,
                    data: {
                        md: [] // Empty array - no declarations for this period
                    }
                };
            }

            // 4. Handle Response
            // The messageBody is Base64-encoded ZIP file containing XML
            if (response.data && typeof response.data === 'object' && response.data.messageBody) {
                try {
                    // Decode Base64
                    const zipBuffer = Buffer.from(response.data.messageBody, 'base64');

                    // Extract ZIP
                    const zip = new AdmZip(zipBuffer);
                    const zipEntries = zip.getEntries();

                    if (zipEntries.length === 0) {
                        console.error("ZIP archive is empty");
                        return { success: false, error: "Empty ZIP response" };
                    }

                    // Get first file (should be doc1.xml)
                    const xmlBuffer = zipEntries[0].getData() as Buffer;
                    
                    if (!Buffer.isBuffer(xmlBuffer)) {
                        throw new Error("Failed to get Buffer from ZIP entry");
                    }
                    
                    // Decode from windows-1251 to UTF-8
                    const xmlContent = this.decodeBuffer(xmlBuffer);

                    // Parse XML to extract declarations
                    const parsedData = this.parseXmlDeclarations(xmlContent);

                    return {
                        success: true,
                        data: {
                            md: parsedData
                        }
                    };
                } catch (decodeError: any) {
                    console.error("Error decoding/extracting response:", decodeError);
                    return { success: false, error: "Failed to decode response: " + decodeError.message };
                }
            }

            console.warn("⚠️ Unexpected API Response format (60.1)");
            console.log("📋 Response Details:");
            console.log("  - Status Code:", response.status);
            console.log("  - Status Text:", response.statusText);
            console.log("  - Headers:", JSON.stringify(response.headers, null, 2));
            console.log("  - Data Type:", typeof response.data);
            console.log("  - Data Is Buffer:", Buffer.isBuffer(response.data));
            if (Buffer.isBuffer(response.data)) {
                console.log("  - Buffer Length:", response.data.length);
                console.log("  - Buffer Preview (first 500 bytes):", response.data.slice(0, 500).toString('utf8'));
                console.log("  - Buffer Hex (first 100 bytes):", response.data.slice(0, 100).toString('hex'));
            } else {
                console.log("  - Data Preview:", JSON.stringify(response.data, null, 2).substring(0, 1000));
            }
            console.log("  - Full Response Object Keys:", Object.keys(response));
            return { success: false, error: "Invalid Response Structure" };

        } catch (error: any) {
            console.error("❌ API ERROR (60.1):");
            console.error("Message:", error.message);
            if (error.response) {
                console.error("Status:", error.response.status);
                console.error("Status Text:", error.response.statusText);
                console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
                console.error("Response Headers:", error.response.headers);
                
                // Handle 500 Internal Server Error - often means period is too old or data unavailable
                if (error.response.status === 500) {
                    const errorMsg = typeof error.response.data === 'string' && error.response.data.trim()
                        ? error.response.data
                        : "Сервер митниці повернув помилку 500. Можливо, дані за цей період недоступні або період занадто старий.";
                    return { success: false, error: errorMsg };
                }
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Отримує детальну інформацію про декларацію за GUID (61.1 формат - повна інформація).
     * 
     * Виконує запит до API митниці для отримання повної інформації про конкретну декларацію.
     * Повертає детальний XML з усіма полями, товарами, платежами та документами.
     * 
     * **Процес:**
     * 1. Формує XML запит з GUID декларації
     * 2. Відправляє POST запит до API митниці
     * 3. Отримує Base64-encoded ZIP архів у відповіді
     * 4. Розпаковує ZIP та декодує XML
     * 5. Повертає сирий XML для подальшого парсингу через mapXmlToDeclaration
     * 
     * **Відмінності від 60.1:**
     * - Повертає повний XML замість короткого списку
     * - Містить всю інформацію: товари, платежі, документи, банки, клієнти
     * - Потребує GUID замість періоду дат
     * 
     * @param guid - GUID декларації (отримується з 60.1 списку)
     * @returns Об'єкт CustomsResponse з success флагом та XML даними або помилкою
     * 
     * @example
     * ```ts
     * const service = new CustomsService(token, edrpou);
     * const result = await service.getDeclarationDetails('abc-123-guid');
     * if (result.success) {
     *   const xml = result.data.xml; // повний XML декларації
     *   const mapped = mapXmlToDeclaration(xml); // парсинг через xml-mapper
     * }
     * ```
     */
    async getDeclarationDetails(guid: string): Promise<CustomsResponse> {
        try {
            // 1. Construct XML Body for 61.1
            const creationDate = this.getTimestamp();

            const xmlBody = `<UA.SFS.REQ.61.1><creation_date>${creationDate}</creation_date><cli_code>${this.edrpou}</cli_code><guid>${guid}</guid></UA.SFS.REQ.61.1>`;

            // 2. Construct Payload
            const payload = {
                "MessageType": "UA.SFS.REQ.61.1",
                "MessageBody": xmlBody,
                "Token": this.token
            };


            // 3. Send Request
            const response = await axios.post(API_ENDPOINT, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                httpsAgent: httpsAgent,
                timeout: 60000 // Increased to 60 seconds for 61.1 requests (details can be large)
            });


            // 4. Handle Response (same Base64/ZIP format)
            if (response.data && response.data.messageBody) {
                try {
                    const zipBuffer = Buffer.from(response.data.messageBody, 'base64');
                    const zip = new AdmZip(zipBuffer);
                    const zipEntries = zip.getEntries();

                    if (zipEntries.length === 0) {
                        return { success: false, error: "Empty ZIP response" };
                    }

                    // getData() returns Buffer for proper encoding handling
                    const xmlBuffer = zipEntries[0].getData() as Buffer;
                    if (!Buffer.isBuffer(xmlBuffer)) {
                        throw new Error("Failed to get Buffer from ZIP entry");
                    }
                    const xmlContent = this.decodeBuffer(xmlBuffer);

                    // For 61.1, we return the full XML as it contains detailed structure
                    return {
                        success: true,
                        data: {
                            xml: xmlContent,
                            guid: guid
                        }
                    };
                } catch (decodeError: any) {
                    console.error("Error decoding/extracting response:", decodeError);
                    return { success: false, error: "Failed to decode response: " + decodeError.message };
                }
            }

            console.warn("⚠️ Unexpected API Response format (61.1)");
            console.log("📋 Response Details (61.1):");
            console.log("  - Status Code:", response.status);
            console.log("  - Status Text:", response.statusText);
            console.log("  - Headers:", JSON.stringify(response.headers, null, 2));
            console.log("  - Data Type:", typeof response.data);
            console.log("  - Data Is Buffer:", Buffer.isBuffer(response.data));
            if (Buffer.isBuffer(response.data)) {
                console.log("  - Buffer Length:", response.data.length);
                console.log("  - Buffer Preview (first 500 bytes):", response.data.slice(0, 500).toString('utf8'));
                console.log("  - Buffer Hex (first 100 bytes):", response.data.slice(0, 100).toString('hex'));
            } else {
                console.log("  - Data Preview:", JSON.stringify(response.data, null, 2).substring(0, 1000));
            }
            console.log("  - Full Response Object Keys:", Object.keys(response));
            return { success: false, error: "Invalid Response Structure" };

        } catch (error: any) {
            console.error("❌ API ERROR (61.1):");
            console.error("Message:", error.message);
            console.error("Stack:", error.stack);
            if (error.response) {
                console.error("Status:", error.response.status);
                console.error("Status Text:", error.response.statusText);
                console.error("Headers:", JSON.stringify(error.response.headers, null, 2));
                if (Buffer.isBuffer(error.response.data)) {
                    console.error("Response Data (Buffer):");
                    console.error("  - Length:", error.response.data.length);
                    console.error("  - Preview (first 500 bytes):", error.response.data.slice(0, 500).toString('utf8'));
                    console.error("  - Hex (first 100 bytes):", error.response.data.slice(0, 100).toString('hex'));
                } else {
                    console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
                }
            }
            return { success: false, error: error.message };
        }
    }
}
