/**
 * Функції для синхронізації курсів валют з НБУ API
 */

import { db } from "@/lib/db";
import { getAllExchangeRates, formatDateToYYYYMMDD, NBUExchangeRate } from "@/lib/nbu-api";

/**
 * Синхронізує курси валют для конкретної дати
 * @param date - Дата для синхронізації
 * @returns Кількість доданих/оновлених курсів
 */
export async function syncExchangeRatesForDate(date: Date): Promise<number> {
    try {
        const rates = await getAllExchangeRates(date);
        
        if (!rates || rates.length === 0) {
            console.log(`No exchange rates found for date ${formatDateToYYYYMMDD(date)}`);
            return 0;
        }

        let syncedCount = 0;
        
        // Створюємо дату без часу для збереження в БД
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        for (const rate of rates) {
            try {
                await db.exchangeRate.upsert({
                    where: {
                        date_currencyCode: {
                            date: dateOnly,
                            currencyCode: rate.cc
                        }
                    },
                    update: {
                        rate: rate.rate,
                        currencyName: rate.txt,
                        updatedAt: new Date()
                    },
                    create: {
                        date: dateOnly,
                        currencyCode: rate.cc,
                        rate: rate.rate,
                        currencyName: rate.txt
                    }
                });
                syncedCount++;
            } catch (error) {
                console.error(`Error syncing rate for ${rate.cc} on ${formatDateToYYYYMMDD(date)}:`, error);
            }
        }

        return syncedCount;
    } catch (error) {
        console.error(`Error syncing exchange rates for date ${formatDateToYYYYMMDD(date)}:`, error);
        return 0;
    }
}

/**
 * Синхронізує курси валют за період
 * @param startDate - Початкова дата
 * @param endDate - Кінцева дата
 * @param onProgress - Callback для відстеження прогресу (date, synced, total)
 * @returns Загальна кількість синхронізованих курсів
 */
export async function syncExchangeRatesForPeriod(
    startDate: Date,
    endDate: Date,
    onProgress?: (currentDate: Date, synced: number, total: number) => void
): Promise<number> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    let totalSynced = 0;
    const current = new Date(start);
    
    // Рахуємо загальну кількість днів
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let processedDays = 0;

    while (current <= end) {
        // Пропускаємо вихідні дні (субота = 6, неділя = 0)
        // Але насправді НБУ може мати курси і на вихідні, тому перевіряємо всі дні
        const synced = await syncExchangeRatesForDate(current);
        totalSynced += synced;
        processedDays++;

        if (onProgress) {
            onProgress(new Date(current), processedDays, totalDays);
        }

        // Додаємо один день
        current.setDate(current.getDate() + 1);
        
        // Невелика затримка, щоб не перевантажити API НБУ
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return totalSynced;
}

/**
 * Синхронізує курси валют за останні 3 роки
 * @param onProgress - Callback для відстеження прогресу
 * @returns Загальна кількість синхронізованих курсів
 */
export async function syncExchangeRatesLast3Years(
    onProgress?: (currentDate: Date, synced: number, total: number) => void
): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 3);
    
    return await syncExchangeRatesForPeriod(startDate, endDate, onProgress);
}

/**
 * Синхронізує курси валют для відсутніх дат (щоденне оновлення)
 * Перевіряє останні 30 днів і додає відсутні курси
 * @returns Кількість доданих курсів
 */
export async function syncMissingExchangeRates(): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30); // Перевіряємо останні 30 днів

    let totalSynced = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
        // Перевіряємо, чи є курси для цієї дати
        const existingRates = await db.exchangeRate.findMany({
            where: {
                date: current
            },
            take: 1
        });

        // Якщо курсів немає, синхронізуємо
        if (existingRates.length === 0) {
            const synced = await syncExchangeRatesForDate(current);
            totalSynced += synced;
        }

        // Додаємо один день
        current.setDate(current.getDate() + 1);
        
        // Невелика затримка
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return totalSynced;
}

/**
 * Отримати курс валюти з бази даних
 * @param currencyCode - Код валюти (USD, EUR, тощо)
 * @param date - Дата
 * @returns Курс валюти або null
 */
export async function getExchangeRateFromDB(
    currencyCode: string,
    date: Date
): Promise<number | null> {
    try {
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        // Використовуємо $queryRaw для безпечного доступу до БД
        // Це працює як на сервері, так і на клієнті (через server action)
        const result = await db.$queryRaw<Array<{ rate: number }>>`
            SELECT rate
            FROM "ExchangeRate"
            WHERE date = ${dateOnly}::date
            AND "currencyCode" = ${currencyCode.toUpperCase()}
            LIMIT 1
        `;

        if (Array.isArray(result) && result.length > 0 && result[0].rate) {
            return Number(result[0].rate);
        }

        return null;
    } catch (error) {
        // Якщо помилка (наприклад, Prisma Client не доступний на клієнті), повертаємо null
        // Функція getUSDExchangeRateForDate має fallback на API
        console.debug(`Could not get exchange rate from DB for ${currencyCode} on ${formatDateToYYYYMMDD(date)}:`, error);
        return null;
    }
}
