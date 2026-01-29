'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CustomsService } from "@/lib/customs-api";
import { revalidatePath } from "next/cache";
import { updateDeclarationSummary } from "@/lib/declaration-summary";
import { splitPeriodIntoChunks } from "@/app/dashboard/sync/utils/period-splitter";

function getSyncChunkDays() {
    const raw = process.env.SYNC_CHUNK_DAYS;
    const parsed = raw ? Number(raw) : NaN;
    const defaultDays = process.env.NODE_ENV === 'production' ? 1 : 7;
    const value = Number.isFinite(parsed) ? parsed : defaultDays;
    const clamped = Math.max(1, Math.min(45, Math.floor(value)));
    return clamped;
}

function logMemory(label: string) {
    if (process.env.LOG_MEMORY !== '1') return;
    const mu = process.memoryUsage();
    const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
    console.log(`[mem] ${label} rss=${mb(mu.rss)}MB heapUsed=${mb(mu.heapUsed)}MB heapTotal=${mb(mu.heapTotal)}MB ext=${mb(mu.external)}MB`);
}

declare global {
    // eslint-disable-next-line no-var
    var __mrnodeUnhandledHandlersInstalled: boolean | undefined;
}

if (!global.__mrnodeUnhandledHandlersInstalled) {
    global.__mrnodeUnhandledHandlersInstalled = true;
    process.on('unhandledRejection', (reason: unknown) => {
        console.error('[unhandledRejection]', reason);
        logMemory('unhandledRejection');
    });
    process.on('uncaughtException', (err: unknown) => {
        console.error('[uncaughtException]', err);
        logMemory('uncaughtException');
    });
}

/**
 * Fetch declaration details (61.1) for a single GUID
 * Returns { success: boolean, guid: string, count: number, error?: string }
 */

async function upsertDeclaration61_1(
    customsService: CustomsService,
    companyId: string,
    guid: string
) {
    const declaration = await db.declaration.findFirst({
        where: {
            companyId,
            customsId: guid
        },
        include: {
            summary: true,
        }
    });

    if (!declaration) {
        return;
    }

    // Skip if summary already exists
    if (declaration.summary) {
        return;
    }

    const detailsResponse = await customsService.getDeclarationDetails(guid);
    if (!detailsResponse.success || !detailsResponse.data?.xml) {
        return;
    }

    let existingData: any = {};
    try {
        const existingXmlData = declaration.xmlData || '';
        if (existingXmlData.trim().startsWith('<') || existingXmlData.trim().startsWith('<?xml')) {
            existingData.data61_1 = existingXmlData;
        } else {
            const parsed = JSON.parse(existingXmlData);
            if (parsed.data60_1) existingData.data60_1 = parsed.data60_1;
            if (parsed.data61_1) existingData.data61_1 = parsed.data61_1;
        }
    } catch {
        // ignore
    }

    existingData.data61_1 = detailsResponse.data.xml;

    await db.declaration.update({
        where: { id: declaration.id },
        data: {
            xmlData: JSON.stringify(existingData),
            updatedAt: new Date()
        }
    });

    await updateDeclarationSummary(declaration.id, JSON.stringify(existingData));
}

async function processDetails61_1FromDb(
    companyId: string,
    jobId: string,
    customsToken: string,
    edrpou: string,
    dateFrom: Date,
    dateTo: Date,
    stage?: number
) {
    if (!('syncJob' in db && db.syncJob)) return;

    const customsService = new CustomsService(customsToken, edrpou);
    let completed61_1 = 0;
    let cursorId: string | undefined;
    const take = 200;

    while (true) {
        logMemory('61.1 loop start');
        const job = await (db.syncJob as any).findUnique({ where: { id: jobId } });
        if (!job || job.status === "cancelled") {
            console.log("Sync job cancelled, stopping 61.1 processing");
            break;
        }

        const batch = await db.declaration.findMany({
            where: {
                companyId,
                date: { gte: dateFrom, lte: dateTo },
                summary: { is: null },
                customsId: { not: null },
            },
            select: { id: true, customsId: true },
            orderBy: { id: 'asc' },
            take,
            ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        });

        if (batch.length === 0) {
            // Done
            logMemory('61.1 done');
            const jobBeforeUpdate = await (db.syncJob as any).findUnique({ where: { id: jobId } });
            let finalErrorMessage: string | null = null;

            if (stage && stage < 5 && jobBeforeUpdate?.errorMessage?.includes('STAGE:')) {
                const stageMatch = jobBeforeUpdate.errorMessage.match(/STAGE:(\d+):([^|]+)/);
                if (stageMatch) {
                    const stageNum = parseInt(stageMatch[1]);
                    const stageName = stageMatch[2];
                    const nextStage = stageNum + 1;
                    finalErrorMessage = `STAGE:${stageNum}:${stageName}|COMPLETED|NEXT:${nextStage}`;
                }
            }

            await (db.syncJob as any).update({
                where: { id: jobId },
                data: {
                    completed61_1,
                    status: "completed",
                    errorMessage: finalErrorMessage ?? jobBeforeUpdate?.errorMessage ?? null,
                }
            });
            break;
        }

        for (const item of batch) {
            const guid = item.customsId;
            if (!guid) continue;

            logMemory('61.1 before upsert');

            const jobInner = await (db.syncJob as any).findUnique({ where: { id: jobId } });
            if (!jobInner || jobInner.status === "cancelled") {
                console.log("Sync job cancelled, stopping 61.1 processing");
                return;
            }

            try {
                await upsertDeclaration61_1(customsService, companyId, guid);
            } catch (error: unknown) {
                console.error(`Error processing 61.1 for GUID ${guid}:`, error);
            }

            logMemory('61.1 after upsert');

            completed61_1++;
            if (completed61_1 % 10 === 0) {
                await (db.syncJob as any).update({
                    where: { id: jobId },
                    data: { completed61_1 }
                });
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        cursorId = batch[batch.length - 1]!.id;
    }
}

export async function fetchDeclarationDetail(guid: string) {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
        return { success: false, guid, count: 0, error: "Неавторизований доступ" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyFullAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyFullAccess();

        if (!access.success || !access.companyId) {
            return { success: false, guid, count: 0, error: "Активна компанія не встановлена" };
        }

        if (access.role !== 'OWNER' && access.role !== 'MEMBER') {
            return { success: false, guid, count: 0, error: "Недостатньо прав для синхронізації (потрібен статус Учасник або Власник)" };
        }

        if (!access.customsToken) {
            return { success: false, guid, count: 0, error: "Токен відсутній." };
        }

        // Розшифрувати токен
        // Розшифрувати токен
        const { decrypt } = await import("@/lib/crypto");
        let decryptedToken;
        try {
            decryptedToken = await decrypt(access.customsToken);
        } catch (e) {
            return { success: false, guid, count: 0, error: "Помилка розшифрування токена. Будь ласка, оновіть токен в налаштуваннях компанії." };
        }

        const customsService = new CustomsService(decryptedToken, access.edrpou!);

        if (!guid) {
            return { success: false, guid, count: 0, error: "GUID відсутній" };
        }

        try {
            const detailsResponse = await customsService.getDeclarationDetails(guid);

            if (detailsResponse.success && detailsResponse.data?.xml) {
                // Find declaration by GUID
                const declaration = await db.declaration.findFirst({
                    where: {
                        companyId: access.companyId,
                        customsId: guid
                    }
                });

                if (declaration) {
                    // Store 61.1 XML data, but preserve 60.1 data
                    let existingData: any = {};

                    try {
                        const existingXmlData = declaration.xmlData || '';
                        if (existingXmlData.trim().startsWith('<') || existingXmlData.trim().startsWith('<?xml')) {
                            // Old format - only 61.1 XML, need to preserve it
                            existingData.data61_1 = existingXmlData;
                        } else {
                            // Try to parse as JSON
                            const parsed = JSON.parse(existingXmlData);
                            if (parsed.data60_1) {
                                existingData.data60_1 = parsed.data60_1;
                            }
                            if (parsed.data61_1) {
                                existingData.data61_1 = parsed.data61_1;
                            }
                        }
                    } catch {
                        // Invalid format, start fresh but keep 61.1
                        existingData.data61_1 = detailsResponse.data.xml;
                    }

                    // Always update with fresh 61.1 data
                    existingData.data61_1 = detailsResponse.data.xml;

                    await db.declaration.update({
                        where: { id: declaration.id },
                        data: {
                            xmlData: JSON.stringify(existingData),
                            updatedAt: new Date()
                        }
                    });

                    // Update summary cache with new 61.1 data
                    await updateDeclarationSummary(declaration.id, JSON.stringify(existingData));
                    return { success: true, guid, count: 1, error: undefined };
                } else {
                    return { success: false, guid, count: 0, error: "Декларацію не знайдено" };
                }
            } else {
                return { success: false, guid, count: 0, error: detailsResponse.error || "Помилка отримання деталей" };
            }
        } catch (err: any) {
            return { success: false, guid, count: 0, error: err.message || "Помилка при обробці" };
        }
    } catch (error: any) {
        return { success: false, guid, count: 0, error: error.message || "Загальна помилка" };
    }
}

/**
 * Fetch declaration details (61.1) for specific GUIDs (batch - for backward compatibility)
 * NOTE: This function processes all GUIDs without cancellation support.
 * For cancellation support, use fetchDeclarationDetail in a loop on the client.
 */
export async function fetchDeclarationDetails(guids: string[]) {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyFullAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyFullAccess();

        if (!access.success || !access.companyId) {
            return { error: "Активна компанія не встановлена" };
        }

        // Тільки OWNER та MEMBER можуть синхронізувати
        if (access.role !== 'OWNER' && access.role !== 'MEMBER') {
            return { error: "Недостатньо прав для синхронізації" };
        }

        if (!access.customsToken || !access.edrpou) {
            return { error: "Токен або EDRPOU відсутній." };
        }

        // Розшифрувати токен
        // Розшифрувати токен
        const { decrypt } = await import("@/lib/crypto");
        let decryptedToken;
        try {
            decryptedToken = await decrypt(access.customsToken);
        } catch (e) {
            return { error: "Помилка розшифрування токена. Будь ласка, оновіть токен в налаштуваннях компанії." };
        }

        const customsService = new CustomsService(decryptedToken, access.edrpou);

        let successCount = 0;
        let errorCount = 0;

        for (const guid of guids) {
            if (!guid) continue;

            try {
                const detailsResponse = await customsService.getDeclarationDetails(guid);

                if (detailsResponse.success && detailsResponse.data?.xml) {
                    // Find declaration by GUID
                    const declaration = await db.declaration.findFirst({
                        where: {
                            companyId: access.companyId,
                            customsId: guid
                        }
                    });

                    if (declaration) {
                        // Store 61.1 XML data, but preserve 60.1 data
                        let existingData: any = {};

                        try {
                            const existingXmlData = declaration.xmlData || '';
                            if (existingXmlData.trim().startsWith('<') || existingXmlData.trim().startsWith('<?xml')) {
                                // Old format - only 61.1 XML, need to preserve it
                                existingData.data61_1 = existingXmlData;
                            } else {
                                // Try to parse as JSON
                                const parsed = JSON.parse(existingXmlData);
                                if (parsed.data60_1) {
                                    existingData.data60_1 = parsed.data60_1;
                                }
                                if (parsed.data61_1) {
                                    existingData.data61_1 = parsed.data61_1;
                                }
                            }
                        } catch {
                            // Invalid format, start fresh but keep 61.1
                            existingData.data61_1 = detailsResponse.data.xml;
                        }

                        // Always update with fresh 61.1 data
                        existingData.data61_1 = detailsResponse.data.xml;

                        await db.declaration.update({
                            where: { id: declaration.id },
                            data: {
                                xmlData: JSON.stringify(existingData),
                                updatedAt: new Date()
                            }
                        });

                        // Update summary cache with new 61.1 data
                        await updateDeclarationSummary(declaration.id, JSON.stringify(existingData));
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } else {
                    errorCount++;
                }

                // Rate limiting: wait 1 second between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err: any) {
                errorCount++;
            }
        }
        // Save sync history
        try {
            if ('syncHistory' in db && db.syncHistory) {
                await (db.syncHistory as any).create({
                    data: {
                        companyId: access.companyId,
                        type: "61.1",
                        status: errorCount === 0 && successCount > 0 ? "success" : errorCount > 0 ? "error" : "success",
                        itemsCount: successCount,
                        errorsCount: errorCount,
                    }
                });
            }
        } catch (historyError: any) {
            // Log but don't fail the sync if history save fails
            console.warn("Failed to save sync history (model may not be generated yet):", historyError.message);
        }

        revalidatePath("/dashboard/archive");
        revalidatePath("/dashboard/sync");
        return { success: true, count: successCount, errors: errorCount };

    } catch (error: any) {
        // Save error to history
        try {
            const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
            const accessResult = await getActiveCompanyWithAccess();
            if (accessResult.success && accessResult.companyId && 'syncHistory' in db && db.syncHistory) {
                try {
                    await (db.syncHistory as any).create({
                        data: {
                            companyId: accessResult.companyId,
                            type: "61.1",
                            status: "error",
                            itemsCount: 0,
                            errorsCount: 0,
                            errorMessage: error.message?.substring(0, 500) || "Критична помилка",
                        }
                    });
                } catch { }
            }
        } catch { }
        return { error: "Критична помилка: " + error.message };
    }
}

/**
 * Get list of declarations without 61.1 details
 */
/**
 * Get sync history for current company
 */
export async function getSyncHistory(limit: number = 50) {
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

        // Check if syncHistory model exists (Prisma Client might need regeneration)
        // Use try-catch and type checking to handle case when model is not yet generated
        let history = [];
        try {
            if ('syncHistory' in db && db.syncHistory) {
                history = await (db.syncHistory as any).findMany({
                    where: { companyId: access.companyId },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                });
            }
        } catch (error: any) {
            // If syncHistory model doesn't exist, return empty history
            console.warn("SyncHistory model not available. Please run 'npx prisma generate':", error.message);
            return { success: true, history: [] };
        }

        return {
            success: true, history: history.map((item: any) => {
                // Determine type label based on dateFrom/dateTo - if they span a large period (1095 days), it's "Завантаження всього періоду"
                const isFullPeriod = item.dateFrom && item.dateTo &&
                    (new Date(item.dateTo).getTime() - new Date(item.dateFrom).getTime()) > (1090 * 24 * 60 * 60 * 1000);

                const typeLabel = isFullPeriod
                    ? (item.type === "60.1" ? "Завантаження всього періоду (60.1)" : "Завантаження всього періоду (61.1)")
                    : (item.type === "60.1" ? "Запит 60.1 (Витяг)" : "Запит 61.1 (Оновлення)");

                return {
                    id: item.id,
                    type: typeLabel,
                    date: item.createdAt.toLocaleString('uk-UA'),
                    status: item.status,
                    items: item.itemsCount,
                    errors: item.errorsCount,
                    dateFrom: item.dateFrom ? new Date(item.dateFrom).toLocaleDateString('uk-UA') : undefined,
                    dateTo: item.dateTo ? new Date(item.dateTo).toLocaleDateString('uk-UA') : undefined,
                    errorMessage: item.errorMessage || undefined
                };
            })
        };
    } catch (error: any) {
        return { error: "Помилка: " + error.message };
    }
}

export async function getDeclarationsWithoutDetails() {
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

        // Get all declarations for this company
        const declarations = await db.declaration.findMany({
            where: { companyId: access.companyId },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                customsId: true,
                mrn: true,
                status: true,
                xmlData: true,
                date: true,
            }
        });

        // Filter declarations that don't have 61.1 data
        const withoutDetails = declarations.filter(decl => {
            if (!decl.xmlData) return true;

            try {
                const trimmed = decl.xmlData.trim();
                // If it's XML, it's old format (only 61.1), so it has details
                if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
                    return false;
                }

                // Try to parse as JSON
                const parsed = JSON.parse(decl.xmlData);
                // If no data61_1, it doesn't have details
                return !parsed.data61_1;
            } catch {
                // Invalid format, assume no details
                return true;
            }
        });

        return { success: true, declarations: withoutDetails };
    } catch (error: any) {
        return { error: "Помилка: " + error.message };
    }
}

export async function syncDeclarations(type: "60.1", dateFrom: Date, dateTo: Date) {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    // Validate: period cannot exceed 45 days (API limitation)
    const diffTime = Math.abs(dateTo.getTime() - dateFrom.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 45) {
        return { error: "Період не може перевищувати 45 днів (обмеження API митниці)" };
    }

    // Validate: start date cannot be more than 1095 days (3 years) ago (legislative requirement)
    const now = new Date();
    const maxAllowedDate = new Date(now);
    maxAllowedDate.setDate(maxAllowedDate.getDate() - 1095);
    maxAllowedDate.setHours(0, 0, 0, 0);

    const startDate = new Date(dateFrom);
    startDate.setHours(0, 0, 0, 0);

    if (startDate < maxAllowedDate) {
        const maxAllowedDateStr = maxAllowedDate.toLocaleDateString('uk-UA');
        return { error: `Дата початку не може бути раніше ${maxAllowedDateStr}. Згідно з законодавством, документи зберігаються протягом 1095 днів (3 роки).` };
    }

    let access: any = null;
    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyFullAccess } = await import("@/lib/company-access");
        access = await getActiveCompanyFullAccess();

        if (!access.success || !access.companyId) {
            return { error: "Активна компанія не встановлена" };
        }

        // Тільки OWNER та MEMBER можуть синхронізувати
        if (access.role !== 'OWNER' && access.role !== 'MEMBER') {
            return { error: "Недостатньо прав для синхронізації" };
        }

        if (!access.customsToken || !access.edrpou) {
            return { error: "Токен або EDRPOU відсутній." };
        }

        // Розшифрувати токен
        // Розшифрувати токен
        const { decrypt } = await import("@/lib/crypto");
        let decryptedToken;
        try {
            decryptedToken = await decrypt(access.customsToken);
        } catch (e) {
            return { error: "Помилка розшифрування токена. Будь ласка, оновіть токен в налаштуваннях компанії." };
        }

        const customsService = new CustomsService(decryptedToken, access.edrpou);

        let response;
        try {
            response = await customsService.getDeclarationsList(dateFrom, dateTo);
        } catch (apiError: any) {
            // Save error to history
            if ('syncHistory' in db && db.syncHistory) {
                try {
                    await (db.syncHistory as any).create({
                        data: {
                            companyId: access.companyId,
                            type: "60.1",
                            status: "error",
                            itemsCount: 0,
                            errorsCount: 0,
                            dateFrom: dateFrom,
                            dateTo: dateTo,
                            errorMessage: `Помилка з'єднання з митницею: ${apiError.message} (${apiError.code})`.substring(0, 500),
                        }
                    });
                } catch { }
            }
            revalidatePath("/dashboard/sync");
            return { error: `Помилка з'єднання з митницею: ${apiError.message} (${apiError.code})` };
        }

        if (!response.success || !response.data?.md) {
            // Save error to history
            if ('syncHistory' in db && db.syncHistory) {
                try {
                    await (db.syncHistory as any).create({
                        data: {
                            companyId: access.companyId,
                            type: "60.1",
                            status: "error",
                            itemsCount: 0,
                            errorsCount: 0,
                            dateFrom: dateFrom,
                            dateTo: dateTo,
                            errorMessage: (response.error || "Помилка отримання даних від митниці").substring(0, 500),
                        }
                    });
                } catch { }
            }
            revalidatePath("/dashboard/sync");
            return { error: response.error || "Помилка отримання даних від митниці" };
        }

        const declarations = response.data.md;
        let count = 0; // Total declarations processed
        let newCount = 0; // Only new declarations (not in DB yet)
        let newGuidsList: string[] = []; // List of new GUIDs for details fetching

        for (const item of declarations) {
            // Status mapping: R = Оформлена, N = Анульована, F = Відкликана/Відмовлена
            // Also check numeric status codes
            let status = "PROCESSING";
            const ccdStatus = String(item.ccd_status || '').trim();
            if (ccdStatus === "R" || ccdStatus === "10" || ccdStatus === "11") {
                status = "CLEARED";
            } else if (ccdStatus === "N") {
                status = "REJECTED";
            } else if (ccdStatus === "F" || ccdStatus === "90") {
                status = "REJECTED";
            }

            // Store data from 60.1 as JSON (contains: guid, MRN, ccd_registered, ccd_status, ccd_type, trn_all, etc.)
            const data60_1 = item; // Keep as object for merging

            // Manual upsert logic
            const existing = await db.declaration.findFirst({
                where: {
                    companyId: access.companyId,
                    OR: [
                        { customsId: item.guid },
                        { mrn: item.MRN }
                    ]
                }
            });

            const isNew = !existing;
            if (isNew) {
                newCount++; // Count only new declarations
                if (item.guid) {
                    newGuidsList.push(item.guid);
                }
            }

            if (existing) {
                // Parse existing data to preserve 61.1 XML if it exists
                let existingData: any = {};
                let has61_1Data = false;

                try {
                    const existingXmlData = existing.xmlData || '';
                    if (existingXmlData.trim().startsWith('<') || existingXmlData.trim().startsWith('<?xml')) {
                        // Has 61.1 XML data
                        existingData.data61_1 = existingXmlData;
                        has61_1Data = true;
                    } else {
                        // Try to parse as JSON
                        const parsed = JSON.parse(existingXmlData);
                        if (parsed.data61_1) {
                            existingData.data61_1 = parsed.data61_1;
                            has61_1Data = true;
                        }
                        if (parsed.data60_1) {
                            existingData.data60_1 = parsed.data60_1;
                        }
                    }
                } catch {
                    // Invalid format, will replace
                }

                // Always update with fresh 60.1 data
                existingData.data60_1 = data60_1;

                // Store as JSON with both datasets
                const updated = await db.declaration.update({
                    where: { id: existing.id },
                    data: {
                        status: status,
                        xmlData: JSON.stringify(existingData),
                        updatedAt: new Date()
                    }
                });

                // Update summary cache
                await updateDeclarationSummary(updated.id, JSON.stringify(existingData));
            } else {
                // New declaration - store 60.1 data
                const dataToStore = {
                    data60_1: data60_1
                };

                const created = await db.declaration.create({
                    data: {
                        companyId: access.companyId,
                        customsId: item.guid,
                        mrn: item.MRN,
                        xmlData: JSON.stringify(dataToStore),
                        status: status,
                    }
                });

                // Update summary cache
                await updateDeclarationSummary(created.id, JSON.stringify(dataToStore));
            }
            count++; // Total processed (both new and existing)
        }

        // Save sync history (only count new declarations, not existing ones)
        if ('syncHistory' in db && db.syncHistory) {
            try {
                await (db.syncHistory as any).create({
                    data: {
                        companyId: access.companyId,
                        type: "60.1",
                        status: "success",
                        itemsCount: newCount, // Only new declarations
                        errorsCount: 0,
                        dateFrom: dateFrom,
                        dateTo: dateTo,
                    }
                });
            } catch (historyError: any) {
                console.warn("Failed to save sync history (model may not be generated yet):", historyError.message);
            }
        }

        // Note: 60.1 now only loads the list, without auto-fetching 61.1 details
        // Users can selectively load 61.1 details from the sync page

        revalidatePath("/dashboard/archive");
        revalidatePath("/dashboard/sync");
        return { success: true, count: newCount, total: count, newGuids: Array.from(newGuidsList) }; // Return both new and total for potential future use

    } catch (error: any) {
        // Save error to history
        try {
            if ('syncHistory' in db && db.syncHistory && access?.companyId) {
                await (db.syncHistory as any).create({
                    data: {
                        companyId: access.companyId,
                        type: "60.1",
                        status: "error",
                        itemsCount: 0,
                        errorsCount: 0,
                        dateFrom: dateFrom,
                        dateTo: dateTo,
                        errorMessage: error.message?.substring(0, 500) || "Критична помилка",
                    }
                });
            }
        } catch { }
        return { error: "Критична помилка: " + error.message };
    }
}

/**
 * Get current active sync job status
 */
export async function getSyncJobStatus() {
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

        // Check if syncJob model exists
        if (!('syncJob' in db && db.syncJob)) {
            return { success: true, job: null };
        }

        const activeJob = await (db.syncJob as any).findFirst({
            where: {
                companyId: access.companyId,
                status: "processing"  // Only return actively processing jobs
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!activeJob) {
            return { success: true, job: null };
        }

        // Get errors for this job if syncJobError model exists
        let errors: Array<{
            chunkNumber: number;
            dateFrom: Date;
            dateTo: Date;
            errorMessage: string;
            errorCode: string | null;
        }> = [];

        try {
            if ('syncJobError' in db && db.syncJobError) {
                const jobErrors = await (db.syncJobError as any).findMany({
                    where: { syncJobId: activeJob.id },
                    orderBy: { chunkNumber: 'asc' }
                });
                errors = jobErrors.map((err: any) => ({
                    chunkNumber: err.chunkNumber,
                    dateFrom: err.dateFrom,
                    dateTo: err.dateTo,
                    errorMessage: err.errorMessage,
                    errorCode: err.errorCode
                }));
            }
        } catch (error: any) {
            console.warn("Failed to load sync job errors:", error.message);
        }

        return {
            success: true,
            job: {
                id: activeJob.id,
                status: activeJob.status,
                totalChunks60_1: activeJob.totalChunks60_1,
                completedChunks60_1: activeJob.completedChunks60_1,
                totalGuids: activeJob.totalGuids,
                completed61_1: activeJob.completed61_1,
                dateFrom: activeJob.dateFrom,
                dateTo: activeJob.dateTo,
                errorMessage: activeJob.errorMessage,
                createdAt: activeJob.createdAt,
                updatedAt: activeJob.updatedAt,
                errors: errors
            }
        };
    } catch (error: any) {
        return { error: error.message || "Помилка отримання статусу" };
    }
}

/**
 * Cancel active sync job
 */
export async function cancelSyncJob() {
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

        if (!('syncJob' in db && db.syncJob)) {
            return { error: "SyncJob модель недоступна" };
        }

        const activeJob = await (db.syncJob as any).findFirst({
            where: {
                companyId: access.companyId,
                status: "processing"
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!activeJob) {
            return { error: "Активне завдання не знайдено" };
        }

        await (db.syncJob as any).update({
            where: { id: activeJob.id },
            data: {
                status: "cancelled",
                cancelledAt: new Date()
            }
        });

        revalidatePath("/dashboard/sync");
        return { success: true };
    } catch (error: any) {
        return { error: error.message || "Помилка скасування завдання" };
    }
}

/**
 * Sync all available period (1095 days) - Phase 1: Load 60.1 lists
 * This function will:
 * 1. Create SyncJob
 * 2. Split period into chunks (45 days each)
 * 3. Process each chunk 60.1 sequentially
 * 4. Collect all GUIDs for later 61.1 processing
 */
export async function syncAllPeriod() {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyFullAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyFullAccess();

        if (!access.success || !access.companyId) {
            return { error: "Активна компанія не встановлена" };
        }

        // Тільки OWNER та MEMBER можуть синхронізувати
        if (access.role !== 'OWNER' && access.role !== 'MEMBER') {
            return { error: "Недостатньо прав для синхронізації" };
        }

        if (!access.customsToken || !access.edrpou) {
            return { error: "Токен або EDRPOU відсутній." };
        }

        // Розшифрувати токен
        const { decrypt } = await import("@/lib/crypto");
        let decryptedToken: string;
        try {
            decryptedToken = await decrypt(access.customsToken);
        } catch {
            return { error: "Помилка розшифрування токена. Будь ласка, оновіть токен в налаштуваннях компанії (або перевірте що ENCRYPTION_KEY на сервері не змінювався)." };
        }

        // Check if syncJob model exists
        if (!('syncJob' in db && db.syncJob)) {
            return { error: "SyncJob модель недоступна. Будь ласка, перезапустіть сервер." };
        }

        // Check if there's already an active job
        const existingJob = await (db.syncJob as any).findFirst({
            where: {
                companyId: access.companyId,
                status: "processing"
            }
        });

        if (existingJob) {
            return { error: "Вже виконується завантаження. Зачекайте завершення або скасуйте поточне завдання." };
        }

        // Calculate date range: 1095 days ago to today
        const now = new Date();
        const dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);

        const dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - 1095);
        dateFrom.setHours(0, 0, 0, 0);

        // Split period into chunks (7 days for syncAllPeriod to avoid timeout issues with large companies)
        // API allows up to 45 days, but for companies with many declarations, smaller chunks work better
        const chunks = splitPeriodIntoChunks(dateFrom, dateTo, getSyncChunkDays());
        const totalChunks = chunks.length;

        // Create SyncJob
        const syncJob = await (db.syncJob as any).create({
            data: {
                companyId: access.companyId,
                status: "processing",
                totalChunks60_1: totalChunks,
                completedChunks60_1: 0,
                totalGuids: 0,
                completed61_1: 0,
                dateFrom: dateFrom,
                dateTo: dateTo
            }
        });

        // Start processing in background (don't await - return immediately)
        // Process chunks sequentially
        processChunks60_1(access.companyId, syncJob.id, chunks, decryptedToken, access.edrpou)
            .catch(error => {
                console.error("Error in background processing:", error);
                // Update job status to error
                if ('syncJob' in db && db.syncJob) {
                    (db.syncJob as any).update({
                        where: { id: syncJob.id },
                        data: {
                            status: "error",
                            errorMessage: error.message?.substring(0, 500) || "Помилка обробки"
                        }
                    }).catch(() => { });
                }
            });

        revalidatePath("/dashboard/sync");
        return { success: true, jobId: syncJob.id };
    } catch (error: any) {
        return { error: error.message || "Помилка створення завдання синхронізації" };
    }
}

/**
 * Sync all period in stages for better UX (поетапне завантаження)
 * Stages:
 * 1. Last week (7 days) - ~30 seconds
 * 2. Last month (30 days) - ~1-2 minutes
 * 3. Last quarter (90 days) - ~3-5 minutes
 * 4. Last year (365 days) - ~10-15 minutes
 * 5. Full period (1095 days) - ~30-60 minutes
 * 
 * @param stage - Stage number (1-5), if not provided, starts from stage 1
 * @returns { success: boolean, jobId?: string, error?: string, stage?: number, stageName?: string, nextStage?: number, daysBack?: number }
 */
export async function syncAllPeriodStaged(stage: number = 1) {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyFullAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyFullAccess();

        if (!access.success || !access.companyId) {
            return { error: "Активна компанія не встановлена" };
        }

        // Тільки OWNER та MEMBER можуть синхронізувати
        if (access.role !== 'OWNER' && access.role !== 'MEMBER') {
            return { error: "Недостатньо прав для синхронізації" };
        }

        if (!access.customsToken || !access.edrpou) {
            return { error: "Токен або EDRPOU відсутній." };
        }

        // Розшифрувати токен
        const { decrypt } = await import("@/lib/crypto");
        let decryptedToken: string;
        try {
            decryptedToken = await decrypt(access.customsToken);
        } catch {
            return { error: "Помилка розшифрування токена. Будь ласка, оновіть токен в налаштуваннях компанії (або перевірте що ENCRYPTION_KEY на сервері не змінювався)." };
        }

        if (!('syncJob' in db && db.syncJob)) {
            return { error: "SyncJob модель недоступна. Будь ласка, перезапустіть сервер." };
        }

        // Check if there's already an active job
        const existingJob = await (db.syncJob as any).findFirst({
            where: {
                companyId: access.companyId,
                status: "processing"
            }
        });

        if (existingJob) {
            return { error: "Вже виконується завантаження. Зачекайте завершення або скасуйте поточне завдання." };
        }

        // Validate stage
        if (stage < 1 || stage > 5) {
            return { error: "Невірний номер етапу. Дозволено від 1 до 5." };
        }

        // Define stages with their date ranges
        const now = new Date();
        const dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);

        let dateFrom: Date;
        let stageName: string;
        let daysBack: number;

        switch (stage) {
            case 1: // Last week
                daysBack = 7;
                stageName = "Останній тиждень";
                break;
            case 2: // Last month
                daysBack = 30;
                stageName = "Останній місяць";
                break;
            case 3: // Last quarter
                daysBack = 90;
                stageName = "Останній квартал";
                break;
            case 4: // Last year
                daysBack = 365;
                stageName = "Останній рік";
                break;
            case 5: // Full period
                daysBack = 1095;
                stageName = "Весь період";
                break;
            default:
                return { error: "Невірний номер етапу" };
        }

        dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - daysBack);
        dateFrom.setHours(0, 0, 0, 0);

        // Split period into chunks (7 days for staged sync)
        const chunks = splitPeriodIntoChunks(dateFrom, dateTo, getSyncChunkDays());
        const totalChunks = chunks.length;

        // Create SyncJob with stage information stored in errorMessage field (temporary workaround)
        // Format: "STAGE:1:Останній тиждень" - will be parsed on frontend
        const syncJob = await (db.syncJob as any).create({
            data: {
                companyId: access.companyId,
                status: "processing",
                totalChunks60_1: totalChunks,
                completedChunks60_1: 0,
                totalGuids: 0,
                completed61_1: 0,
                dateFrom: dateFrom,
                dateTo: dateTo,
                errorMessage: `STAGE:${stage}:${stageName}` // Format: "STAGE:1:Останній тиждень"
            }
        });

        // Start processing in background
        processChunks60_1(
            access.companyId,
            syncJob.id,
            chunks,
            decryptedToken,
            access.edrpou,
            stage, // Pass stage number
            stage === 5 // isFinalStage - only stage 5 is final
        ).catch(error => {
            console.error("Error in background processing:", error);
            if ('syncJob' in db && db.syncJob) {
                (db.syncJob as any).update({
                    where: { id: syncJob.id },
                    data: {
                        status: "error",
                        errorMessage: error.message?.substring(0, 500) || "Помилка обробки"
                    }
                }).catch(() => { });
            }
        });

        revalidatePath("/dashboard/sync");
        const nextStage = stage < 5 ? stage + 1 : undefined;
        return {
            success: true,
            jobId: syncJob.id,
            stage: stage,
            stageName: stageName,
            nextStage: nextStage,
            daysBack: daysBack
        };
    } catch (error: any) {
        return { error: error.message || "Помилка створення завдання синхронізації" };
    }
}

/**
 * Process 60.1 chunks sequentially
 */
async function processChunks60_1(
    companyId: string,
    jobId: string,
    chunks: Array<{ start: Date; end: Date }>,
    customsToken: string,
    edrpou: string,
    stage?: number,
    isFinalStage: boolean = false
) {
    if (!('syncJob' in db && db.syncJob)) return;

    const customsService = new CustomsService(customsToken, edrpou);
    let completedChunks = 0;
    let failedChunks: Array<{ chunk: number; dateFrom: Date; dateTo: Date; error: string }> = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkNumber = i + 1;

        // Check if job was cancelled
        const job = await (db.syncJob as any).findUnique({ where: { id: jobId } });
        if (!job || job.status === "cancelled") {
            console.log("Sync job cancelled, stopping chunk processing");
            break;
        }

        // Process this chunk with retry logic for timeout errors
        let result: any = null;
        let lastError: any = null;
        const maxRetries = 1; // One retry for timeout errors

        try {

            for (let retry = 0; retry <= maxRetries; retry++) {
                try {
                    result = await syncDeclarationsForChunk(customsService, companyId, chunk.start, chunk.end);
                    lastError = null;
                    break; // Success, exit retry loop
                } catch (err: any) {
                    lastError = err;
                    // Retry on timeout errors, 400/500 errors, or network connection errors
                    const isTimeout = err.message?.includes('timeout') || err.code === 'ETIMEDOUT';
                    const is400 = err.response?.status === 400 || err.message?.includes('status code 400');
                    const is400ChannelTimeout = is400 && (
                        err.response?.data?.includes('Истекло время ожидания канала') ||
                        err.response?.data?.includes('время ожидания') ||
                        err.message?.includes('channel timeout') ||
                        err.message?.includes('SendTimeout')
                    );
                    const is500 = err.response?.status === 500 || err.message?.includes('status code 500');
                    // Network connection errors: ECONNRESET, ECONNREFUSED, ENOTFOUND, etc.
                    const isNetworkError = err.code === 'ECONNRESET' ||
                        err.code === 'ECONNREFUSED' ||
                        err.code === 'ENOTFOUND' ||
                        err.code === 'EAI_AGAIN' ||
                        err.message?.includes('ECONNRESET') ||
                        err.message?.includes('ECONNREFUSED') ||
                        err.message?.includes('socket hang up');
                    const shouldRetry = (isTimeout || is400ChannelTimeout || is500 || isNetworkError) && retry < maxRetries;

                    if (shouldRetry) {
                        let errorType = 'error';
                        if (isTimeout) errorType = 'timeout';
                        else if (is400ChannelTimeout) errorType = '400 channel timeout';
                        else if (is500) errorType = '500 error';
                        else if (isNetworkError) errorType = `network error (${err.code || 'connection reset'})`;

                        console.log(`${errorType.charAt(0).toUpperCase() + errorType.slice(1)} on chunk ${chunkNumber}, retrying... (attempt ${retry + 1}/${maxRetries + 1})`);

                        // Wait before retry: longer for 500/400 errors, even longer for network errors
                        let waitTime = 5000; // default 5 seconds
                        if (is500) waitTime = 8000; // 8 seconds for 500
                        else if (is400ChannelTimeout) waitTime = 12000; // 12 seconds for 400 channel timeout (longest)
                        else if (isNetworkError) waitTime = 10000; // 10 seconds for network errors
                        else if (isTimeout) waitTime = 5000; // 5 seconds for timeout

                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    } else {
                        throw err; // Re-throw if not retryable error or max retries reached
                    }
                }
            }

            if (lastError) {
                throw lastError; // If we still have an error after retries
            }

            // Check if chunk was successful
            if (result && !result.success) {
                // Check if there was an actual error (not just empty data)
                if (result.error) {
                    const errorMsg = `Chunk ${chunkNumber} failed: ${result.error}`;
                    failedChunks.push({
                        chunk: chunkNumber,
                        dateFrom: chunk.start,
                        dateTo: chunk.end,
                        error: errorMsg
                    });
                    console.warn(errorMsg);

                    // Save error to database
                    try {
                        if ('syncJobError' in db && db.syncJobError) {
                            await (db.syncJobError as any).create({
                                data: {
                                    syncJobId: jobId,
                                    chunkNumber: chunkNumber,
                                    dateFrom: chunk.start,
                                    dateTo: chunk.end,
                                    errorMessage: String(result.error).substring(0, 2000),
                                    errorCode: 'API_ERROR',
                                    retryAttempts: 0,
                                    isRetried: false
                                }
                            });
                        }
                    } catch (dbError: any) {
                        console.error(`Failed to save chunk error to database:`, dbError);
                    }
                } else {
                    // Empty period is not an error, just log info
                    console.log(`ℹ️ Chunk ${chunkNumber}: No data for period ${chunk.start.toLocaleDateString('uk-UA')} - ${chunk.end.toLocaleDateString('uk-UA')}`);
                }
            } else {
                // NOTE: we intentionally do NOT accumulate GUIDs in memory.
                // Declarations are persisted to DB inside syncDeclarationsForChunk,
                // and 61.1 processing will pick missing-summary declarations from DB in batches.
            }

            completedChunks++;

            // Update progress
            await (db.syncJob as any).update({
                where: { id: jobId },
                data: {
                    completedChunks60_1: completedChunks
                }
            });

            // Rate limiting: wait 2 seconds between chunks to avoid overloading API
            if (i < chunks.length - 1) { // Don't wait after last chunk
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Note: revalidatePath removed from background processing
            // It will be called at the end of syncAllPeriod or when job completes
        } catch (error: any) {
            const errorMsg = error.response?.data || error.message || 'Unknown error';
            const errorCode = error.response?.status || error.code || 'UNKNOWN';
            console.error(`Error processing chunk ${chunkNumber}/${chunks.length}:`, errorMsg);

            failedChunks.push({
                chunk: chunkNumber,
                dateFrom: chunk.start,
                dateTo: chunk.end,
                error: String(errorMsg)
            });

            // Save error to database
            try {
                if ('syncJobError' in db && db.syncJobError) {
                    await (db.syncJobError as any).create({
                        data: {
                            syncJobId: jobId,
                            chunkNumber: chunkNumber,
                            dateFrom: chunk.start,
                            dateTo: chunk.end,
                            errorMessage: String(errorMsg).substring(0, 2000), // Limit to 2000 chars
                            errorCode: String(errorCode),
                            retryAttempts: maxRetries,
                            isRetried: true
                        }
                    });
                }
            } catch (dbError: any) {
                console.error(`Failed to save chunk error to database:`, dbError);
            }

            completedChunks++; // Count as processed (even if failed)

            // Update progress
            await (db.syncJob as any).update({
                where: { id: jobId },
                data: {
                    completedChunks60_1: completedChunks
                }
            });

            // Continue with next chunk even if this one fails
            // Wait before next chunk to avoid rapid-fire errors
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    // After all 60.1 chunks are processed, update totalGuids and start 61.1 processing
    // Also update error message summary if there were errors (short summary for display during processing)
    const errorSummary = failedChunks.length > 0
        ? `Виявлено помилки в ${failedChunks.length} періодів з ${chunks.length}. Деталі будуть доступні після завершення.`
        : null;

    // Get job info for history
    const job = await (db.syncJob as any).findUnique({ where: { id: jobId } });

    // Preserve stage info if this is a staged sync
    let updatedErrorMessage = errorSummary;
    if (job?.errorMessage?.startsWith('STAGE:')) {
        // Keep stage info: "STAGE:1:Останній тиждень"
        // Add error summary if there are errors
        if (errorSummary) {
            updatedErrorMessage = `${job.errorMessage}|PROCESSING_61_1|${errorSummary}`;
        } else {
            updatedErrorMessage = `${job.errorMessage}|PROCESSING_61_1`;
        }
    }

    // totalGuids: compute cheaply from DB (distinct customsId in job period)
    const jobPeriodFrom = chunks[0]?.start;
    const jobPeriodTo = chunks[chunks.length - 1]?.end;
    let totalGuids = 0;
    try {
        if (jobPeriodFrom && jobPeriodTo) {
            const rows = await db.$queryRaw<Array<{ count: bigint | number }>>`
                SELECT COUNT(DISTINCT d."customsId") as count
                FROM "Declaration" d
                WHERE d."companyId" = ${companyId}
                  AND d."date" >= ${jobPeriodFrom}
                  AND d."date" <= ${jobPeriodTo}
                  AND d."customsId" IS NOT NULL
            `;
            totalGuids = Number(rows?.[0]?.count ?? 0);
        }
    } catch {
        // Best-effort; keep as 0 if counting fails
    }

    await (db.syncJob as any).update({
        where: { id: jobId },
        data: {
            totalGuids,
            errorMessage: updatedErrorMessage
        }
    });

    // Save sync history for 60.1 (lists)
    try {
        if ('syncHistory' in db && db.syncHistory && job) {
            const successChunks = chunks.length - failedChunks.length;
            const totalDeclarations = totalGuids;

            await (db.syncHistory as any).create({
                data: {
                    companyId: companyId,
                    type: "60.1",
                    status: failedChunks.length === 0 ? "success" : (successChunks > 0 ? "error" : "error"),
                    itemsCount: totalDeclarations, // Total declarations loaded
                    errorsCount: failedChunks.length, // Number of failed chunks
                    dateFrom: job.dateFrom,
                    dateTo: job.dateTo,
                    errorMessage: failedChunks.length > 0
                        ? `Завантаження всього періоду: успішно оброблено ${successChunks} з ${chunks.length} періодів, ${totalDeclarations} декларацій завантажено.`
                        : `Завантаження всього періоду: успішно завантажено ${totalDeclarations} декларацій за ${chunks.length} періодів.`
                }
            });
        }
    } catch (historyError: any) {
        console.warn("Failed to save sync history for 60.1:", historyError.message);
    }

    // Start processing 61.1 details in background by reading missing-summary declarations from DB in small batches.
    if (jobPeriodFrom && jobPeriodTo) {
        processDetails61_1FromDb(companyId, jobId, customsToken, edrpou, jobPeriodFrom, jobPeriodTo, stage)
            .catch((error: unknown) => {
                console.error("Error in 61.1 processing:", error);
            });
    } else {
        // No GUIDs to process, mark as completed
        // Count errors from database to update final error summary
        let errorCount = 0;
        try {
            if ('syncJobError' in db && db.syncJobError) {
                const errorCountResult = await (db.syncJobError as any).count({
                    where: { syncJobId: jobId }
                });
                errorCount = errorCountResult || 0;
            }
        } catch (e) {
            // Ignore errors when counting
        }

        const finalErrorSummary = errorCount > 0
            ? `Завершено з помилками: ${errorCount} періодів з ${chunks.length} не вдалося завантажити.`
            : null;

        // If this is a staged sync and not the final stage, preserve stage info for next stage button
        const jobBeforeUpdate = await (db.syncJob as any).findUnique({ where: { id: jobId } });
        let finalErrorMessage = finalErrorSummary;
        if (stage && stage < 5 && jobBeforeUpdate?.errorMessage?.startsWith('STAGE:')) {
            // Preserve stage info: "STAGE:1:Останній тиждень"
            // Add completion info: "STAGE:1:Останній тиждень|COMPLETED|NEXT:2"
            const stageInfo = jobBeforeUpdate.errorMessage;
            const nextStage = stage + 1;
            finalErrorMessage = `${stageInfo}|COMPLETED|NEXT:${nextStage}`;
        }

        await (db.syncJob as any).update({
            where: { id: jobId },
            data: {
                status: "completed",
                errorMessage: finalErrorMessage
            }
        });

        // Invalidate statistics cache after sync completion (both dashboard and archive)
        try {
            const { clearAllStatisticsCache } = await import("@/lib/statistics-cache");
            // Clear all cached statistics since we can't predict which filters might be affected
            // This ensures fresh data after sync, even if it means recalculating on next request
            clearAllStatisticsCache();
        } catch (e) {
            // Ignore errors when invalidating cache
        }

        // Save sync history for 60.1 (when no GUIDs to process)
        try {
            const job = await (db.syncJob as any).findUnique({ where: { id: jobId } });
            if (job && 'syncHistory' in db && db.syncHistory) {
                const successChunks = chunks.length - errorCount;

                await (db.syncHistory as any).create({
                    data: {
                        companyId: companyId,
                        type: "60.1",
                        status: errorCount === 0 ? "success" : (successChunks > 0 ? "error" : "error"),
                        itemsCount: 0, // No declarations found
                        errorsCount: errorCount,
                        dateFrom: job.dateFrom,
                        dateTo: job.dateTo,
                        errorMessage: errorCount > 0
                            ? `Завантаження всього періоду: оброблено ${successChunks} з ${chunks.length} періодів, декларацій не знайдено.`
                            : `Завантаження всього періоду: оброблено ${chunks.length} періодів, декларацій не знайдено.`
                    }
                });
            }
        } catch (historyError: any) {
            console.warn("Failed to save sync history for 60.1:", historyError.message);
        }
        // Note: revalidatePath removed from background processing
    }
}

/**
 * Process 61.1 details for all GUIDs sequentially
 */
async function processDetails61_1(
    companyId: string,
    jobId: string,
    guids: string[],
    customsToken: string,
    edrpou: string,
    stage?: number
) {
    if (!('syncJob' in db && db.syncJob)) return;

    const customsService = new CustomsService(customsToken, edrpou);
    let completed61_1 = 0;

    for (const guid of guids) {
        // Check if job was cancelled
        const job = await (db.syncJob as any).findUnique({ where: { id: jobId } });
        if (!job || job.status === "cancelled") {
            console.log("Sync job cancelled, stopping 61.1 processing");
            break;
        }

        try {
            // Check if declaration already has 61.1 data
            const declaration = await db.declaration.findFirst({
                where: {
                    companyId: companyId,
                    customsId: guid
                }
            });

            if (declaration) {
                // Check if already has 61.1 data
                let has61_1 = false;
                try {
                    const existingXmlData = declaration.xmlData || '';
                    if (existingXmlData.trim().startsWith('<') || existingXmlData.trim().startsWith('<?xml')) {
                        has61_1 = true; // Old format - has 61.1
                    } else {
                        const parsed = JSON.parse(existingXmlData);
                        if (parsed.data61_1) {
                            has61_1 = true; // Has 61.1 in JSON format
                        }
                    }
                } catch { }

                // Skip if already has 61.1 data
                if (has61_1) {
                    completed61_1++;
                    // Update progress after each item for better UI feedback
                    await (db.syncJob as any).update({
                        where: { id: jobId },
                        data: { completed61_1 }
                    });
                    continue;
                }

                // Fetch details
                const detailsResponse = await customsService.getDeclarationDetails(guid);

                if (detailsResponse.success && detailsResponse.data?.xml) {
                    let existingData: any = {};

                    try {
                        const existingXmlData = declaration.xmlData || '';
                        if (existingXmlData.trim().startsWith('<') || existingXmlData.trim().startsWith('<?xml')) {
                            existingData.data61_1 = existingXmlData;
                        } else {
                            const parsed = JSON.parse(existingXmlData);
                            if (parsed.data60_1) {
                                existingData.data60_1 = parsed.data60_1;
                            }
                            if (parsed.data61_1) {
                                existingData.data61_1 = parsed.data61_1;
                            }
                        }
                    } catch { }

                    existingData.data61_1 = detailsResponse.data.xml;

                    await db.declaration.update({
                        where: { id: declaration.id },
                        data: {
                            xmlData: JSON.stringify(existingData),
                            updatedAt: new Date()
                        }
                    });

                    await updateDeclarationSummary(declaration.id, JSON.stringify(existingData));
                    completed61_1++;
                }

                // Update progress after each item for better UI feedback
                // Since there's a 1-second delay between requests, this won't overload the DB
                await (db.syncJob as any).update({
                    where: { id: jobId },
                    data: { completed61_1 }
                });
            }

            // Rate limiting: wait 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
            console.error(`Error processing 61.1 for GUID ${guid}:`, error);
            // Continue with next GUID
        }
    }

    // Final progress update and mark as completed
    // Count errors from database to update final error summary
    let errorCount = 0;
    const job = await (db.syncJob as any).findUnique({ where: { id: jobId } });

    try {
        if (job && 'syncJobError' in db && db.syncJobError) {
            const errorCountResult = await (db.syncJobError as any).count({
                where: { syncJobId: jobId }
            });
            errorCount = errorCountResult || 0;
        }
    } catch (e) {
        // Ignore errors when counting
    }

    // If this is a staged sync and not the final stage, preserve stage info for next stage button
    let finalErrorMessage: string | null = errorCount > 0
        ? `Завершено з помилками: ${errorCount} періодів не вдалося завантажити.`
        : null;

    // Check if this is a staged sync (check job errorMessage for STAGE: prefix)
    // errorMessage format can be: "STAGE:1:Останній тиждень" or "STAGE:1:Останній тиждень|PROCESSING_61_1|error summary"
    if (job?.errorMessage?.includes('STAGE:')) {
        // Extract stage info from errorMessage - it might have PROCESSING_61_1 or error info
        const stageMatch = job.errorMessage.match(/STAGE:(\d+):([^|]+)/);
        if (stageMatch) {
            const stage = parseInt(stageMatch[1]);
            const stageName = stageMatch[2];
            if (stage < 5) {
                // Not final stage, preserve stage info and mark as completed
                const nextStage = stage + 1;
                finalErrorMessage = `STAGE:${stage}:${stageName}|COMPLETED|NEXT:${nextStage}`;
                if (errorCount > 0) {
                    finalErrorMessage += `|ERRORS:${errorCount}`;
                }
            } else {
                // Final stage, preserve stage info but mark as completed
                finalErrorMessage = `STAGE:${stage}:${stageName}|COMPLETED`;
                if (errorCount > 0) {
                    finalErrorMessage += `|ERRORS:${errorCount}`;
                } else if (finalErrorMessage === null) {
                    // If no errors and no summary, just mark as completed
                    finalErrorMessage = `STAGE:${stage}:${stageName}|COMPLETED`;
                }
            }
        }
    }

    await (db.syncJob as any).update({
        where: { id: jobId },
        data: {
            completed61_1: completed61_1,
            status: "completed",
            errorMessage: finalErrorMessage
        }
    });

    // Invalidate statistics cache after sync completion (both dashboard and archive)
    try {
        const { clearAllStatisticsCache } = await import("@/lib/statistics-cache");
        // Clear all cached statistics since we can't predict which filters might be affected
        // This ensures fresh data after sync, even if it means recalculating on next request
        clearAllStatisticsCache();
    } catch (e) {
        // Ignore errors when invalidating cache
    }

    // Save sync history for 61.1 (details) - only if there were GUIDs to process
    try {
        if (job && 'syncHistory' in db && db.syncHistory) {
            const totalGuids = job.totalGuids || 0;

            // Only create history entry if there were GUIDs to process (even if 0 were completed)
            if (totalGuids > 0) {
                const errorCount61_1 = totalGuids - completed61_1;

                await (db.syncHistory as any).create({
                    data: {
                        companyId: companyId,
                        type: "61.1",
                        status: errorCount61_1 === 0 && completed61_1 > 0 ? "success" : (errorCount61_1 > 0 ? "error" : "success"),
                        itemsCount: completed61_1, // Successfully loaded details
                        errorsCount: errorCount61_1, // Failed to load details
                        dateFrom: job.dateFrom,
                        dateTo: job.dateTo,
                        errorMessage: errorCount61_1 > 0
                            ? `Завантаження деталей для всього періоду: успішно завантажено ${completed61_1} з ${totalGuids} декларацій.`
                            : `Завантаження деталей для всього періоду: успішно завантажено ${completed61_1} декларацій.`
                    }
                });
            }
            // If totalGuids === 0, don't create 61.1 history entry (no details were needed)
        }
    } catch (historyError: any) {
        console.warn("Failed to save sync history for 61.1:", historyError.message);
    }
    // Note: revalidatePath will be called on client side when polling detects completion
}

/**
 * Sync declarations for a single chunk (helper for syncAllPeriod)
 */
async function syncDeclarationsForChunk(
    customsService: CustomsService,
    companyId: string,
    dateFrom: Date,
    dateTo: Date
): Promise<{ success: boolean; count: number; guids: string[]; error?: string }> {
    logMemory('60.1 chunk start');
    const response = await customsService.getDeclarationsList(dateFrom, dateTo);
    logMemory('60.1 after getDeclarationsList');

    if (!response.success || !response.data?.md) {
        // Return error message if there was an actual error, otherwise just empty data (204 No Content)
        return {
            success: false,
            count: 0,
            guids: [],
            error: response.error || undefined // Only include error if it exists
        };
    }

    const declarations = response.data.md;
    let count = 0;
    const guids: string[] = [];

    logMemory(`60.1 items=${Array.isArray(declarations) ? declarations.length : -1}`);

    for (const item of declarations) {
        let status = "PROCESSING";
        const ccdStatus = String(item.ccd_status || '').trim();
        if (ccdStatus === "R" || ccdStatus === "10" || ccdStatus === "11") {
            status = "CLEARED";
        } else if (ccdStatus === "N" || ccdStatus === "F" || ccdStatus === "90") {
            status = "REJECTED";
        }

        const data60_1 = item;

        const existing = await db.declaration.findFirst({
            where: {
                companyId: companyId,
                OR: [
                    { customsId: item.guid },
                    { mrn: item.MRN }
                ]
            },
            select: {
                id: true,
                date: true,
                declarantName: true,
                senderName: true,
                recipientName: true,
                summary: {
                    select: { id: true }
                }
            }
        });

        logMemory('60.1 after findFirst');

        const isNew = !existing;
        if (isNew) {
            count++;
        }

        if (existing) {
            let has61_1Data = false;

            // IMPORTANT: do not fetch/inspect xmlData here (it can be huge).
            // If summary exists, it means 61.1 was already processed for this declaration.
            if ((existing as any).summary?.id) {
                has61_1Data = true;
            }

            // Parse and validate date for update
            let declarationDate = existing.date;
            if (item.ccd_registered) {
                try {
                    // ccd_registered format: "20230414T153127" (YYYYMMDDThhmmss)
                    const dateStr = item.ccd_registered;
                    if (dateStr.length >= 8) {
                        const year = parseInt(dateStr.substring(0, 4));
                        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
                        const day = parseInt(dateStr.substring(6, 8));
                        const parsedDate = new Date(year, month, day);
                        if (!isNaN(parsedDate.getTime())) {
                            declarationDate = parsedDate;
                        }
                    }
                } catch (e) {
                    // If parsing fails, keep existing date
                }
            }

            // IMPORTANT: avoid JSON.parse/JSON.stringify of huge xmlData when 61.1 already exists.
            // If 61.1 exists, keep xmlData as-is and only update metadata.
            // If 61.1 doesn't exist, store only 60.1 to enable later 61.1 batch processing.
            if (has61_1Data) {
                await db.declaration.update({
                    where: { id: existing.id },
                    data: {
                        status: status,
                        date: declarationDate,
                        declarantName: item.ccd_decl_name || existing.declarantName,
                        senderName: item.ccd_sender_name || existing.senderName,
                        recipientName: item.ccd_recipient_name || existing.recipientName,
                        updatedAt: new Date()
                    }
                });
            } else {
                await db.declaration.update({
                    where: { id: existing.id },
                    data: {
                        xmlData: JSON.stringify({ data60_1: data60_1 }),
                        status: status,
                        date: declarationDate,
                        declarantName: item.ccd_decl_name || existing.declarantName,
                        senderName: item.ccd_sender_name || existing.senderName,
                        recipientName: item.ccd_recipient_name || existing.recipientName,
                        updatedAt: new Date()
                    }
                });
            }

            logMemory('60.1 after update');
        } else {
            // Parse and validate date
            let declarationDate = new Date();
            if (item.ccd_registered) {
                try {
                    // ccd_registered format: "20230414T153127" (YYYYMMDDThhmmss)
                    const dateStr = item.ccd_registered;
                    if (dateStr.length >= 8) {
                        const year = parseInt(dateStr.substring(0, 4));
                        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
                        const day = parseInt(dateStr.substring(6, 8));
                        const parsedDate = new Date(year, month, day);
                        if (!isNaN(parsedDate.getTime())) {
                            declarationDate = parsedDate;
                        }
                    }
                } catch (e) {
                    // If parsing fails, use current date
                    console.warn(`Failed to parse date ${item.ccd_registered}, using current date`);
                }
            }

            await db.declaration.create({
                data: {
                    companyId: companyId,
                    customsId: item.guid,
                    mrn: item.MRN,
                    xmlData: JSON.stringify({ data60_1: data60_1 }),
                    status: status,
                    date: declarationDate,
                    declarantName: item.ccd_decl_name,
                    senderName: item.ccd_sender_name,
                    recipientName: item.ccd_recipient_name
                }
            });

            logMemory('60.1 after create');
        }
    }

    logMemory('60.1 chunk done');
    return { success: true, count, guids };
}
