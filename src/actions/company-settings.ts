'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface SyncSettings {
    // Automatic sync (simplified - only enable/disable, runs on login)
    autoSyncEnabled: boolean;

    // UI/data filter settings
    showEeDeclarations: boolean;
    
    // Performance settings
    requestDelay: number; // Delay between requests in seconds (1-10)
    chunkSize: number; // Chunk size in days (3, 7, 14, 30)
    
    // Notifications (placeholders for now)
    emailNotifications: {
        onSyncComplete: boolean;
        onSyncError: boolean;
        onCriticalError: boolean; // 3+ errors
    };
    browserNotifications: boolean;
}

export type ArchiveStatsSettings = { [key: string]: boolean };

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
    autoSyncEnabled: false,
    showEeDeclarations: false,
    requestDelay: 1,
    chunkSize: 7,
    emailNotifications: {
        onSyncComplete: false,
        onSyncError: false,
        onCriticalError: true,
    },
    browserNotifications: false,
};

export async function getSyncSettings(): Promise<{ success: boolean; settings?: SyncSettings; error?: string }> {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { success: false, error: "Неавторизований доступ" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();
        
        if (!access.success || !access.companyId) {
            return { success: false, error: "Активна компанія не встановлена" };
        }

        const company = await db.company.findUnique({
            where: { id: access.companyId },
            select: {
                syncSettings: true,
            }
        });

        if (!company) {
            return { success: false, error: "Компанію не знайдено" };
        }

        if (company.syncSettings) {
            const settings = company.syncSettings as any;
            // Merge with defaults to ensure all fields exist
            return {
                success: true,
                settings: { ...DEFAULT_SYNC_SETTINGS, ...settings }
            };
        }

        return {
            success: true,
            settings: DEFAULT_SYNC_SETTINGS
        };
    } catch (error: any) {
        console.error("Error getting sync settings:", error);
        return { success: false, error: error.message || "Помилка отримання налаштувань" };
    }
}

export async function updateSyncSettings(formData: FormData): Promise<{ success: boolean; message?: string; error?: string }> {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { success: false, error: "Неавторизований доступ" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();
        
        if (!access.success || !access.companyId) {
            return { success: false, error: "Активна компанія не встановлена" };
        }

        // Тільки OWNER може змінювати налаштування синхронізації
        if (access.role !== 'OWNER') {
            return { success: false, error: "Тільки власник може змінювати налаштування синхронізації" };
        }

        // Parse form data
        const autoSyncEnabled = formData.get('autoSyncEnabled') === 'true' || formData.get('autoSyncEnabled') === 'on';
        const showEeDeclarations = formData.get('showEeDeclarations') === 'true' || formData.get('showEeDeclarations') === 'on';
        const requestDelay = parseInt(formData.get('requestDelay') as string) || 1;
        const chunkSize = parseInt(formData.get('chunkSize') as string) || 7;
        
        const emailNotifications = {
            onSyncComplete: formData.get('emailNotifications.onSyncComplete') === 'true' || formData.get('emailNotifications.onSyncComplete') === 'on',
            onSyncError: formData.get('emailNotifications.onSyncError') === 'true' || formData.get('emailNotifications.onSyncError') === 'on',
            onCriticalError: formData.get('emailNotifications.onCriticalError') === 'true' || formData.get('emailNotifications.onCriticalError') === 'on',
        };
        
        const browserNotifications = formData.get('browserNotifications') === 'true' || formData.get('browserNotifications') === 'on';

        // Validate
        if (requestDelay < 1 || requestDelay > 10) {
            return { success: false, error: "Затримка між запитами має бути від 1 до 10 секунд" };
        }

        if (![3, 7, 14, 30].includes(chunkSize)) {
            return { success: false, error: "Розмір chunk має бути 3, 7, 14 або 30 днів" };
        }

        const settings: SyncSettings = {
            autoSyncEnabled,
            showEeDeclarations,
            requestDelay,
            chunkSize,
            emailNotifications,
            browserNotifications,
        };

        const currentCompany = await db.company.findUnique({
            where: { id: access.companyId },
            select: { syncSettings: true },
        });
        const current = (currentCompany?.syncSettings as any) || {};

        await db.company.update({
            where: { id: access.companyId },
            data: { syncSettings: { ...current, ...settings } as any }
        });

        revalidatePath("/dashboard/settings");
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/archive");

        const { clearAllStatisticsCache } = await import("@/lib/statistics-cache");
        clearAllStatisticsCache();
        return { success: true, message: "Налаштування синхронізації успішно збережено" };
    } catch (error: any) {
        console.error("Error updating sync settings:", error);
        return { success: false, error: error.message || "Помилка збереження налаштувань" };
    }
}

export async function getArchiveStatsSettings(): Promise<{ success: boolean; settings?: ArchiveStatsSettings; error?: string }> {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { success: false, error: "Неавторизований доступ" };
    }

    try {
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();

        if (!access.success || !access.companyId) {
            return { success: false, error: "Активна компанія не встановлена" };
        }

        const company = await db.company.findUnique({
            where: { id: access.companyId },
            select: { syncSettings: true },
        });

        const settings = (company?.syncSettings as any) || {};
        const archiveStatsSettings = settings.archiveStatsSettings;

        if (archiveStatsSettings && typeof archiveStatsSettings === 'object') {
            return { success: true, settings: archiveStatsSettings as ArchiveStatsSettings };
        }

        return { success: true, settings: {} };
    } catch (error: any) {
        console.error("Error getting archive stats settings:", error);
        return { success: false, error: error.message || "Помилка отримання налаштувань" };
    }
}

export async function updateArchiveStatsSettings(
    archiveStatsSettings: ArchiveStatsSettings
): Promise<{ success: boolean; message?: string; error?: string }> {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { success: false, error: "Неавторизований доступ" };
    }

    try {
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();

        if (!access.success || !access.companyId) {
            return { success: false, error: "Активна компанія не встановлена" };
        }

        const company = await db.company.findUnique({
            where: { id: access.companyId },
            select: { syncSettings: true },
        });

        const current = (company?.syncSettings as any) || {};

        await db.company.update({
            where: { id: access.companyId },
            data: { syncSettings: { ...current, archiveStatsSettings } as any },
        });

        revalidatePath("/dashboard/archive");
        return { success: true, message: "Налаштування статистики успішно збережено" };
    } catch (error: any) {
        console.error("Error updating archive stats settings:", error);
        return { success: false, error: error.message || "Помилка збереження налаштувань" };
    }
}
