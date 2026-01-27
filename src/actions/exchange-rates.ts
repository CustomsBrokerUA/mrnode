'use server';

import { formatDateToYYYYMMDD } from "@/lib/nbu-api";
import { db } from "@/lib/db";

export interface ExchangeRateData {
    currencyCode: string;
    currencyName: string;
    rate: number;
}

/**
 * Отримати курси валют на конкретну дату
 * Спочатку перевіряє БД, якщо немає - робить API запит і зберігає в БД
 */
export async function getExchangeRatesForDate(date: Date): Promise<ExchangeRateData[]> {
    try {
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        // Спочатку перевіряємо БД
        let dbRates: any[] = [];
        try {
            // Використовуємо $queryRaw для безпечного доступу до БД
            const result = await db.$queryRaw`
                SELECT "currencyCode", "currencyName", rate, date
                FROM "ExchangeRate"
                WHERE date = ${dateOnly}::date
                ORDER BY "currencyCode" ASC
            `;
            dbRates = Array.isArray(result) ? result : [];
        } catch (dbError) {
            // Якщо таблиця не існує або помилка доступу, продовжуємо з API
            console.log('Could not query ExchangeRate table, will fetch from API:', dbError);
        }

        // Якщо є дані в БД, повертаємо їх
        if (dbRates.length > 0) {
            return dbRates.map((rate: any) => ({
                currencyCode: rate.currencyCode || '',
                currencyName: rate.currencyName || rate.currencyCode || '',
                rate: Number(rate.rate) || 0
            }));
        }

        // Якщо немає в БД, робимо API запит напряму
        const dateStr = formatDateToYYYYMMDD(dateOnly);
        const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${dateStr}&json`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.error(`NBU API error for ${dateStr}:`, response.status, response.statusText);
                return [];
            }

            const apiRates: Array<{ r030: number; txt: string; rate: number; cc: string; exchangedate: string }> = await response.json();
            
            if (!apiRates || apiRates.length === 0) {
                console.log(`No exchange rates from API for date ${dateStr}`);
                return [];
            }

            // Зберігаємо в БД
            try {
                const dateOnlyForDB = new Date(dateOnly);
                dateOnlyForDB.setHours(0, 0, 0, 0);
                
                for (const rate of apiRates) {
                    try {
                        // Використовуємо $executeRaw для вставки/оновлення
                        await db.$executeRaw`
                            INSERT INTO "ExchangeRate" (id, date, "currencyCode", rate, "currencyName", "createdAt", "updatedAt")
                            VALUES (gen_random_uuid(), ${dateOnlyForDB}::date, ${rate.cc}, ${rate.rate}, ${rate.txt}, NOW(), NOW())
                            ON CONFLICT (date, "currencyCode")
                            DO UPDATE SET
                                rate = EXCLUDED.rate,
                                "currencyName" = EXCLUDED."currencyName",
                                "updatedAt" = NOW()
                        `;
                    } catch (dbError) {
                        console.error(`Error saving rate for ${rate.cc}:`, dbError);
                    }
                }
            } catch (syncError) {
                console.error('Error syncing exchange rates to DB:', syncError);
                // Продовжуємо навіть якщо синхронізація не вдалася
            }

            // Повертаємо дані
            return apiRates.map(rate => ({
                currencyCode: rate.cc,
                currencyName: rate.txt,
                rate: rate.rate
            }));
        } catch (error) {
            console.error(`Error fetching exchange rates from API for ${dateStr}:`, error);
            return [];
        }
    } catch (error) {
        console.error('Error getting exchange rates:', error);
        return [];
    }
}

/**
 * Отримати курс конкретної валюти на дату
 * Спочатку перевіряє БД, якщо немає - робить API запит і зберігає в БД
 */
export async function getExchangeRateForCurrency(
    currencyCode: string,
    date: Date
): Promise<number | null> {
    try {
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        // Спочатку перевіряємо БД
        let dbRate: any = null;
        try {
            const result = await db.$queryRaw`
                SELECT rate
                FROM "ExchangeRate"
                WHERE date = ${dateOnly}::date
                AND "currencyCode" = ${currencyCode.toUpperCase()}
                LIMIT 1
            `;
            if (Array.isArray(result) && result.length > 0) {
                dbRate = result[0];
            }
        } catch (dbError) {
            console.log('Could not query ExchangeRate table, will fetch from API:', dbError);
        }

        if (dbRate && dbRate.rate) {
            return Number(dbRate.rate);
        }

        // Якщо немає в БД, робимо API запит для всіх валют
        const dateStr = formatDateToYYYYMMDD(dateOnly);
        const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${dateStr}&json`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                console.error(`NBU API error for ${dateStr}:`, response.status, response.statusText);
                return null;
            }

            const apiRates: Array<{ r030: number; txt: string; rate: number; cc: string; exchangedate: string }> = await response.json();
            
            if (!apiRates || apiRates.length === 0) {
                return null;
            }

            // Зберігаємо всі курси в БД
            try {
                const dateOnlyForDB = new Date(dateOnly);
                dateOnlyForDB.setHours(0, 0, 0, 0);
                
                for (const rate of apiRates) {
                    try {
                        // Використовуємо $executeRaw для вставки/оновлення
                        await db.$executeRaw`
                            INSERT INTO "ExchangeRate" (id, date, "currencyCode", rate, "currencyName", "createdAt", "updatedAt")
                            VALUES (gen_random_uuid(), ${dateOnlyForDB}::date, ${rate.cc}, ${rate.rate}, ${rate.txt}, NOW(), NOW())
                            ON CONFLICT (date, "currencyCode")
                            DO UPDATE SET
                                rate = EXCLUDED.rate,
                                "currencyName" = EXCLUDED."currencyName",
                                "updatedAt" = NOW()
                        `;
                    } catch (dbError) {
                        console.error(`Error saving rate for ${rate.cc}:`, dbError);
                    }
                }
            } catch (syncError) {
                console.error('Error syncing exchange rates to DB:', syncError);
            }

            // Знаходимо потрібну валюту
            const rate = apiRates.find(r => r.cc.toUpperCase() === currencyCode.toUpperCase());
            return rate?.rate || null;
        } catch (error) {
            console.error(`Error fetching exchange rates from API for ${dateStr}:`, error);
            return null;
        }
    } catch (error) {
        console.error(`Error getting exchange rate for ${currencyCode}:`, error);
        return null;
    }
}
