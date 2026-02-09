'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { syncDeclarations } from "./sync";
import { getSyncSettings } from "./company-settings";

/**
 * Get the date of the last successful synchronization
 * Returns null if no sync history exists
 */
export async function getLastSyncDate() {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();

        if (!access.success || !access.companyId) {
            return { error: "Активна компанія не встановлена" };
        }

        // Find last successful sync (status: "success" or itemsCount > 0)
        const lastSync = await db.syncHistory.findFirst({
            where: {
                companyId: access.companyId,
                OR: [
                    { status: "success" },
                    { itemsCount: { gt: 0 } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            select: {
                dateTo: true,
                createdAt: true
            }
        });

        // Use createdAt (exact time) instead of dateTo (which is only date without time)
        // This ensures we sync from the exact moment of last sync, not just the date
        if (lastSync) {
            // Use createdAt (exact timestamp) for incremental sync
            // This way we get all data after the exact time of last sync
            const lastDate = lastSync.createdAt;
            return { success: true, lastSyncDate: lastDate };
        }

        return { success: true, lastSyncDate: null };
    } catch (error: any) {
        console.error("Error getting last sync date:", error);
        return { error: error.message || "Помилка отримання дати останньої синхронізації" };
    }
}

/**
 * Sync declarations from last sync date to now
 */
export async function syncFromLastSync() {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        // Get last sync date
        const lastSyncResult = await getLastSyncDate();
        if (lastSyncResult.error) {
            return { error: lastSyncResult.error };
        }

        const lastSyncDate = lastSyncResult.lastSyncDate;
        const now = new Date();

        // If no last sync, return error (should use full sync instead)
        if (!lastSyncDate) {
            return {
                error: "Немає даних про останню синхронізацію. Використайте повну синхронізацію."
            };
        }

        // Check if dates are valid
        const fromDate = new Date(lastSyncDate);
        const toDate = new Date(now);

        // Add 1 minute buffer to ensure we don't miss declarations created at the exact same time
        // Also check if there's at least 1 minute difference (to avoid sync loops)
        const timeDiff = toDate.getTime() - fromDate.getTime();
        const minutesDiff = timeDiff / (1000 * 60);

        // If less than 1 minute passed, there's likely nothing new
        if (minutesDiff < 1) {
            return {
                success: true,
                message: "Синхронізація нещодавно виконувалась. Спробуйте через хвилину або використайте повну синхронізацію."
            };
        }

        // Ensure fromDate is before toDate
        if (fromDate >= toDate) {
            return {
                success: true,
                message: "Дані вже синхронізовані. Немає нових даних для завантаження."
            };
        }

        // Don't sync if the period is too large (larger than allowed full-period range)
        const fromLimit = new Date(now.getFullYear() - 3, 0, 1);
        fromLimit.setHours(0, 0, 0, 0);
        if (fromDate < fromLimit) {
            const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            return {
                error: `Період синхронізації занадто великий (${daysDiff} днів). Використайте повну синхронізацію.`
            };
        }

        // Format dates for syncDeclarations
        // syncDeclarations takes Date objects, but we need to work with dates (not timestamps)
        // Since API works with dates (not times), we should:
        // - Use the date of last sync as the starting point
        // - But if last sync was today, we still need to sync today to catch new declarations
        // - To be safe, always sync from the date of last sync to today

        const fromDateDay = new Date(fromDate);
        fromDateDay.setHours(0, 0, 0, 0);

        // Always sync up to today (end of current day)
        const toDateDay = new Date(toDate);
        toDateDay.setHours(23, 59, 59, 999);

        // If fromDate and toDate are the same day, we're syncing today's data
        // This is correct - it will catch any declarations created today after the last sync
        // The API will return all declarations for that date range

        // Call syncDeclarations with Date objects.
        // 61.1-only mode: syncDeclarations auto-starts background 61.1 loading via SyncJob.
        const syncResult: any = await syncDeclarations("60.1", fromDateDay, toDateDay);

        if (syncResult?.success) {
            const newCount = Array.isArray(syncResult.newGuids) ? syncResult.newGuids.length : 0;
            const suffix = syncResult.jobId ? ` (запущено завдання 61.1: ${syncResult.jobId})` : '';
            return {
                ...syncResult,
                message: `Синхронізація завершена. Нових декларацій: ${newCount}.${suffix}`
            };
        }

        return syncResult;
    } catch (error: any) {
        console.error("Error syncing from last sync:", error);
        return { error: error.message || "Помилка інкрементальної синхронізації" };
    }
}

/**
 * Check if auto-sync is enabled and trigger sync on login
 */
export async function triggerAutoSyncOnLogin() {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        // Get sync settings
        const settingsResult = await getSyncSettings();
        if (!settingsResult.success || !settingsResult.settings) {
            return { success: false, message: "Не вдалося завантажити налаштування" };
        }

        const settings = settingsResult.settings;

        // Check if auto-sync is enabled
        if (!settings.autoSyncEnabled) {
            return { success: false, message: "Автоматична синхронізація вимкнена" };
        }

        // Trigger incremental sync
        const syncResult = await syncFromLastSync();

        if (syncResult.error) {
            return { success: false, error: syncResult.error };
        }

        return {
            success: true,
            message: (syncResult as any).message || "Автоматична синхронізація запущена"
        };
    } catch (error: any) {
        console.error("Error triggering auto-sync on login:", error);
        return { error: error.message || "Помилка автоматичної синхронізації" };
    }
}
