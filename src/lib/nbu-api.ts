/**
 * NBU API для отримання курсу валют
 * API: https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange
 */

export interface NBUExchangeRate {
    r030: number;
    txt: string;
    rate: number;
    cc: string;
    exchangedate: string;
}

/**
 * Отримати курс долара США на конкретну дату
 * @param date - Дата у форматі YYYYMMDD або Date об'єкт
 * @returns Курс долара або null якщо не вдалося отримати
 */
export async function getUSDExchangeRate(date: string | Date): Promise<number | null> {
    try {
        // Форматуємо дату у формат YYYYMMDD
        let dateStr: string;
        if (date instanceof Date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            dateStr = `${year}${month}${day}`;
        } else {
            dateStr = date;
        }

        // API НБУ: https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&date=YYYYMMDD&json
        const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&date=${dateStr}&json`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'force-cache' // Кеш для уникнення зайвих запитів
        });

        if (!response.ok) {
            console.error('NBU API error:', response.status, response.statusText);
            return null;
        }

        const data: NBUExchangeRate[] = await response.json();
        
        if (data && data.length > 0 && data[0].cc === 'USD') {
            return data[0].rate;
        }

        return null;
    } catch (error) {
        console.error('Error fetching USD rate from NBU:', error);
        return null;
    }
}

/**
 * Парсить дату з різних форматів у формат YYYYMMDD для API НБУ
 */
function parseDateToYYYYMMDD(dateStr: string): string | null {
    const s = dateStr.trim();
    if (!s || s === '---') return null;
    // Формат YYYYMMDDTHHMMSS (Customs format)
    const customsMatch = s.match(/^(\d{4})(\d{2})(\d{2})T/);
    if (customsMatch) {
        const [, year, month, day] = customsMatch;
        return `${year}${month}${day}`;
    }
    
    // Формат YYYYMMDD
    if (/^\d{8}$/.test(s)) {
        return s;
    }
    
    // Формат DD.MM.YYYY або DD.MM.YYYY HH:MM:SS (з formatDate)
    const ddmmyyyyMatch = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        return `${year}${month}${day}`;
    }
    
    // Формат YYYY-MM-DD
    const yyyymmddMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmddMatch) {
        const [, year, month, day] = yyyymmddMatch;
        return `${year}${month}${day}`;
    }
    
    return null;
}

/**
 * Отримати курс долара на дату декларації (спочатку з БД, потім з API + збереження в БД)
 * @param declarationDate - Дата декларації (може бути у форматі DD.MM.YYYY, YYYY-MM-DD, YYYYMMDD, або Date)
 * @returns Курс долара
 */
export async function getUSDExchangeRateForDate(declarationDate: string | Date | null): Promise<number | null> {
    if (!declarationDate) {
        // Якщо дати немає, намагаємося отримати поточний курс
        return await getUSDExchangeRate(new Date());
    }

    let date: Date;
    
    if (declarationDate instanceof Date) {
        date = new Date(declarationDate);
    } else {
        // Парсимо рядок дати
        const dateStr = parseDateToYYYYMMDD(declarationDate);
        if (!dateStr) {
            // Якщо передано дату, але її не вдалося розпарсити, не підміняємо її поточним курсом
            return null;
        }
        // Конвертуємо YYYYMMDD в Date
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        date = new Date(year, month, day);
    }
    
    // Якщо функція викликається на клієнті, використовуємо server action
    // Якщо на сервері, спочатку пробуємо БД, потім API
    if (typeof window === 'undefined') {
        // Серверна сторона - спочатку пробуємо БД
        try {
            const { getExchangeRateFromDB } = await import('@/lib/exchange-rate-sync');
            const dbRate = await getExchangeRateFromDB('USD', date);
            if (dbRate !== null) {
                return dbRate;
            }
        } catch (error) {
            // Якщо не вдалося отримати з БД, продовжуємо з API
            console.debug('Could not get rate from DB, falling back to API');
        }
    }
    
    // Якщо немає в БД або викликається на клієнті, використовуємо server action
    try {
        const { getExchangeRateForCurrency } = await import('@/actions/exchange-rates');
        const rate = await getExchangeRateForCurrency('USD', date);
        if (rate !== null) {
            return rate;
        }
    } catch (error) {
        console.debug('Could not get rate from server action, falling back to direct API');
    }
    
    // Fallback на прямий API запит (якщо server action не доступний)
    const dateStr = formatDateToYYYYMMDD(date);
    const rate = await getUSDExchangeRate(dateStr);
    
    // Якщо не вдалося отримати курс на дату декларації, пробуємо поточний
    if (!rate) {
        return await getUSDExchangeRate(new Date());
    }
    
    return rate;
}

/**
 * Форматує дату у формат YYYYMMDD для API НБУ
 */
export function formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Отримати всі курси валют на конкретну дату
 * @param date - Дата у форматі YYYYMMDD або Date об'єкт
 * @returns Масив курсів валют або null якщо не вдалося отримати
 */
export async function getAllExchangeRates(date: string | Date): Promise<NBUExchangeRate[] | null> {
    try {
        // Форматуємо дату у формат YYYYMMDD
        let dateStr: string;
        if (date instanceof Date) {
            dateStr = formatDateToYYYYMMDD(date);
        } else {
            dateStr = date;
        }

        // API НБУ: https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=YYYYMMDD&json
        const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${dateStr}&json`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store' // Не кешуємо для синхронізації
        });

        if (!response.ok) {
            console.error('NBU API error:', response.status, response.statusText);
            return null;
        }

        const data: NBUExchangeRate[] = await response.json();
        
        if (data && Array.isArray(data) && data.length > 0) {
            return data;
        }

        return null;
    } catch (error) {
        console.error('Error fetching exchange rates from NBU:', error);
        return null;
    }
}

