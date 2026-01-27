/**
 * Скрипт для синхронізації курсів валют
 * 
 * Використання:
 * node sync-exchange-rates.js full    - Синхронізує за останні 3 роки
 * node sync-exchange-rates.js daily   - Синхронізує відсутні курси (щоденне оновлення)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAllExchangeRates(date) {
    try {
        let dateStr;
        if (date instanceof Date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            dateStr = `${year}${month}${day}`;
        } else {
            dateStr = date;
        }

        const url = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${dateStr}&json`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`NBU API error for ${dateStr}:`, response.status, response.statusText);
            return null;
        }

        const data = await response.json();
        
        if (data && Array.isArray(data) && data.length > 0) {
            return data;
        }

        return null;
    } catch (error) {
        console.error(`Error fetching exchange rates for ${dateStr}:`, error);
        return null;
    }
}

async function syncExchangeRatesForDate(date) {
    try {
        const rates = await getAllExchangeRates(date);
        
        if (!rates || rates.length === 0) {
            return 0;
        }

        let syncedCount = 0;
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        for (const rate of rates) {
            try {
                await prisma.exchangeRate.upsert({
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
                console.error(`Error syncing rate for ${rate.cc} on ${date.toISOString().split('T')[0]}:`, error);
            }
        }

        return syncedCount;
    } catch (error) {
        console.error(`Error syncing exchange rates for date ${date.toISOString().split('T')[0]}:`, error);
        return 0;
    }
}

async function syncExchangeRatesForPeriod(startDate, endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    let totalSynced = 0;
    const current = new Date(start);
    
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let processedDays = 0;

    while (current <= end) {
        const synced = await syncExchangeRatesForDate(current);
        totalSynced += synced;
        processedDays++;

        if (processedDays % 10 === 0 || processedDays === totalDays) {
            console.log(`Progress: ${processedDays}/${totalDays} days processed (${current.toISOString().split('T')[0]})`);
        }

        current.setDate(current.getDate() + 1);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return totalSynced;
}

async function syncMissingExchangeRates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    let totalSynced = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
        const existingRates = await prisma.exchangeRate.findMany({
            where: {
                date: current
            },
            take: 1
        });

        if (existingRates.length === 0) {
            const synced = await syncExchangeRatesForDate(current);
            totalSynced += synced;
            if (synced > 0) {
                console.log(`Synced rates for ${current.toISOString().split('T')[0]}: ${synced} currencies`);
            }
        }

        current.setDate(current.getDate() + 1);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return totalSynced;
}

async function main() {
    const type = process.argv[2] || 'daily';

    try {
        if (type === 'full') {
            console.log('🔄 Starting full synchronization (last 3 years)...');
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(endDate.getFullYear() - 3);
            
            const totalSynced = await syncExchangeRatesForPeriod(startDate, endDate);
            console.log(`✅ Full synchronization completed! Total rates synced: ${totalSynced}`);
        } else if (type === 'daily') {
            console.log('🔄 Starting daily synchronization (missing rates)...');
            const totalSynced = await syncMissingExchangeRates();
            console.log(`✅ Daily synchronization completed! Total rates synced: ${totalSynced}`);
        } else {
            console.error('❌ Invalid type. Use "full" or "daily"');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
