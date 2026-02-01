import { NextRequest, NextResponse } from "next/server";
import { syncExchangeRatesLast3Years, syncMissingExchangeRates } from "@/lib/exchange-rate-sync";
import { acquireOperationLock, finishOperationLog, startOperationLog } from "@/lib/operations";

/**
 * API endpoint для синхронізації курсів валют
 * 
 * GET /api/exchange-rates/sync?type=full - Синхронізує за останні 3 роки
 * GET /api/exchange-rates/sync?type=daily - Синхронізує відсутні курси (щоденне оновлення)
 */
export async function GET(request: NextRequest) {
    let lockKey: string | null = null;
    let opId: string | null = null;
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

        const normalizedType = type === 'full' ? 'full' : 'daily';
        const ttlMs = normalizedType === 'full' ? 60 * 60 * 1000 : 10 * 60 * 1000;
        lockKey = `EXCHANGE_RATES_SYNC:${normalizedType}`;

        const lock = await acquireOperationLock({
            scopeKey: lockKey,
            operation: 'SYNC_EXCHANGE_RATES',
            companyId: null,
            userId: null,
            ttlMs,
        });

        if (!lock.ok) {
            const op = await startOperationLog({
                operation: 'SYNC_EXCHANGE_RATES',
                companyId: null,
                userId: null,
                meta: { type: normalizedType, reason: lock.reason },
            });
            await finishOperationLog({
                id: op.id,
                status: 'blocked',
                details: 'Rate limited (operation lock)',
            });

            return NextResponse.json({
                success: false,
                error: 'Rate limited'
            }, { status: 429 });
        }

        const op = await startOperationLog({
            operation: 'SYNC_EXCHANGE_RATES',
            companyId: null,
            userId: null,
            meta: {
                type: normalizedType,
                ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
                userAgent: request.headers.get('user-agent') || null,
            },
        });
        opId = op.id;

        if (normalizedType === 'full') {
            // Синхронізація за останні 3 роки
            const totalSynced = await syncExchangeRatesLast3Years((currentDate, synced, total) => {
                console.log(`Progress: ${synced}/${total} days processed (${formatDateToYYYYMMDD(currentDate)})`);
            });

            await finishOperationLog({
                id: opId,
                status: 'success',
                meta: { totalSynced },
            });

            return NextResponse.json({
                success: true,
                message: `Синхронізовано курсів валют за останні 3 роки: ${totalSynced}`,
                totalSynced
            });
        } else if (normalizedType === 'daily') {
            // Щоденне оновлення (відсутні курси)
            const totalSynced = await syncMissingExchangeRates();

            await finishOperationLog({
                id: opId,
                status: 'success',
                meta: { totalSynced },
            });

            return NextResponse.json({
                success: true,
                message: `Синхронізовано відсутні курси валют: ${totalSynced}`,
                totalSynced
            });
        } else {
            await finishOperationLog({
                id: opId,
                status: 'error',
                details: 'Invalid type',
                meta: { type },
            });
            return NextResponse.json({
                success: false,
                error: 'Невірний тип синхронізації. Використовуйте "full" або "daily"'
            }, { status: 400 });
        }
    } catch (error) {
        console.error('Error syncing exchange rates:', error);

        try {
            if (opId) {
                await finishOperationLog({
                    id: opId,
                    status: 'error',
                    details: error instanceof Error ? error.message : 'Помилка синхронізації курсів валют',
                });
            }
        } catch {
            // ignore
        }

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
