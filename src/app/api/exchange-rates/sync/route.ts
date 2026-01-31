import { NextRequest, NextResponse } from "next/server";
import { syncExchangeRatesLast3Years, syncMissingExchangeRates } from "@/lib/exchange-rate-sync";

/**
 * API endpoint для синхронізації курсів валют
 * 
 * GET /api/exchange-rates/sync?type=full - Синхронізує за останні 3 роки
 * GET /api/exchange-rates/sync?type=daily - Синхронізує відсутні курси (щоденне оновлення)
 */
export async function GET(request: NextRequest) {
    try {
        const expectedSecret = process.env.EXCHANGE_RATES_SYNC_SECRET;
        if (!expectedSecret) {
            return NextResponse.json({
                success: false,
                error: 'Missing EXCHANGE_RATES_SYNC_SECRET'
            }, { status: 500 });
        }

        const authHeader = request.headers.get('authorization') || '';
        const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
            ? authHeader.slice(7).trim()
            : null;

        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type') || 'daily';
        const secret = searchParams.get('secret');

        const providedSecret = bearerToken || secret;
        if (!providedSecret || providedSecret !== expectedSecret) {
            return NextResponse.json({
                success: false,
                error: 'Unauthorized'
            }, { status: 401 });
        }

        if (type === 'full') {
            // Синхронізація за останні 3 роки
            const totalSynced = await syncExchangeRatesLast3Years((currentDate, synced, total) => {
                console.log(`Progress: ${synced}/${total} days processed (${formatDateToYYYYMMDD(currentDate)})`);
            });

            return NextResponse.json({
                success: true,
                message: `Синхронізовано курсів валют за останні 3 роки: ${totalSynced}`,
                totalSynced
            });
        } else if (type === 'daily') {
            // Щоденне оновлення (відсутні курси)
            const totalSynced = await syncMissingExchangeRates();

            return NextResponse.json({
                success: true,
                message: `Синхронізовано відсутні курси валют: ${totalSynced}`,
                totalSynced
            });
        } else {
            return NextResponse.json({
                success: false,
                error: 'Невірний тип синхронізації. Використовуйте "full" або "daily"'
            }, { status: 400 });
        }
    } catch (error) {
        console.error('Error syncing exchange rates:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Помилка синхронізації курсів валют'
        }, { status: 500 });
    }
}

function formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}
