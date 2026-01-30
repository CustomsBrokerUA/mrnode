'use server';

import { db } from "@/lib/db";
import { auth } from "@/auth";
import {
    getCachedCompanyStatistics,
    setCachedCompanyStatistics
} from "@/lib/statistics-cache";

async function getShowEeDeclarationsForCompany(companyId: string): Promise<boolean> {
    try {
        const company = await db.company.findUnique({
            where: { id: companyId },
            select: { syncSettings: true }
        });
        return (company?.syncSettings as any)?.showEeDeclarations === true;
    } catch {
        return false;
    }
}

export async function getDeclarationById(id: string) {
    const session = await auth();
    if (!session?.user?.email) return null;

    const declaration = await db.declaration.findFirst({
        where: {
            id: id,
            company: {
                userCompanies: {
                    some: {
                        user: {
                            email: session.user.email
                        }
                    }
                },
                deletedAt: null
            }
        }
    });

    return declaration;
}

export async function getDashboardAnalytics(params?: {
    companyIds?: string[];
    dateFrom?: string;
    dateTo?: string;
}) {
    const session = await auth();
    if (!session?.user?.email) return null;

    const { companyIds, dateFrom, dateTo } = params || {};

    const { getActiveCompanyWithAccess, checkCompanyAccess } = await import("@/lib/company-access");
    const access = await getActiveCompanyWithAccess();

    if (!access.success || !access.companyId) {
        return null;
    }

    let targetCompanyIds: string[];

    if (companyIds && companyIds.length > 0) {
        const validIds = companyIds.filter(id => id && id.trim() !== '');
        if (validIds.length === 0) {
            targetCompanyIds = [access.companyId];
        } else {
            const accessChecks = await Promise.all(
                validIds.map(id => checkCompanyAccess(id))
            );
            targetCompanyIds = validIds.filter((id, index) => accessChecks[index].success);
        }
    } else {
        targetCompanyIds = [access.companyId];
    }

    if (targetCompanyIds.length === 0) {
        return null;
    }

    // Use active company settings for EE visibility (single toggle for current context)
    const showEeDeclarations = await getShowEeDeclarationsForCompany(access.companyId);

    const eeExcludeClause = showEeDeclarations
        ? {}
        : {
            NOT: {
                summary: {
                    declarationType: {
                        endsWith: 'ЕЕ'
                    }
                }
            }
        };

    // Try to get cached statistics only for default load
    if (!companyIds && !dateFrom && !dateTo && targetCompanyIds.length === 1) {
        const cached = getCachedCompanyStatistics(`${targetCompanyIds[0]}_${showEeDeclarations ? 'ee1' : 'ee0'}`);
        if (cached) return cached;
    }

    // Date filters for Registered Date in Summary
    const where: any = {
        companyId: targetCompanyIds.length === 1
            ? targetCompanyIds[0]
            : { in: targetCompanyIds },
        ...eeExcludeClause,
    };

    if (dateFrom || dateTo) {
        where.summary = {
            registeredDate: {
                ...(dateFrom && { gte: new Date(dateFrom) }),
                ...(dateTo && { lte: new Date(dateTo) }),
            }
        };
    }

    // OPTIMIZATION: Use Aggregate for main metrics
    const [statsAggregate, totalCount] = await Promise.all([
        db.declarationSummary.aggregate({
            _sum: {
                customsValue: true,
                invoiceValueUah: true,
                totalItems: true,
            },
            where: {
                declaration: where
            }
        }),
        db.declaration.count({ where })
    ]);

    const totalCustomsValue = statsAggregate._sum.customsValue || 0;
    const totalInvoiceValueUah = statsAggregate._sum.invoiceValueUah || 0;
    const totalItems = statsAggregate._sum.totalItems || 0;
    const avgCustomsValue = totalCount > 0 ? totalCustomsValue / totalCount : 0;

    // Fetch minimal data for trends and top lists to avoid heavy load
    const declarations = await db.declaration.findMany({
        where,
        select: {
            id: true,
            senderName: true,
            recipientName: true,
            summary: {
                select: {
                    customsOffice: true,
                    declarationType: true,
                    registeredDate: true,
                    customsValue: true,
                    senderName: true,
                    recipientName: true,
                }
            }
        },
        orderBy: { date: 'desc' }
    });

    // Calculate trends
    const trends = calculateTrends(declarations, dateFrom, dateTo);

    // Top lists
    const topConsignors = calculateTopList(declarations, 'senderName');
    const topConsignees = calculateTopList(declarations, 'recipientName');
    const topCustomsOffices = calculateTopList(declarations, 'customsOffice');
    const topDeclarationTypes = calculateTopList(declarations, 'declarationType');

    // Comparison (current period vs previous period) - FIX: Added await
    const comparison = await calculateComparison(
        { count: totalCount, value: totalCustomsValue },
        dateFrom,
        dateTo,
        targetCompanyIds
    );

    const analytics = {
        total: totalCount,
        totalCustomsValue,
        totalInvoiceValueUah,
        avgCustomsValue,
        totalItems,
        trends,
        topConsignors,
        topConsignees,
        topCustomsOffices,
        topDeclarationTypes,
        comparison,
    };

    // Cache for default view only
    if (!companyIds && !dateFrom && !dateTo && targetCompanyIds.length === 1) {
        setCachedCompanyStatistics(`${targetCompanyIds[0]}_${showEeDeclarations ? 'ee1' : 'ee0'}`, analytics);
    }

    return analytics;
}

/**
 * Розраховує тренди за період (по днях).
 */
function calculateTrends(declarations: any[], dateFrom?: string, dateTo?: string) {
    const trendsMap = new Map<string, { count: number; customsValue: number }>();

    const end = dateTo ? new Date(dateTo) : new Date();
    const start = dateFrom ? new Date(dateFrom) : new Date(new Date().setDate(end.getDate() - 30));

    const normalizedStart = new Date(start);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(end);
    normalizedEnd.setHours(23, 59, 59, 999);

    const diffTime = Math.abs(normalizedEnd.getTime() - normalizedStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Adaptive grouping: by month if more than 90 days
    const isMonthly = diffDays > 90;

    if (isMonthly) {
        // Initialize months in range
        let current = new Date(normalizedStart.getFullYear(), normalizedStart.getMonth(), 1);
        const limit = new Date(normalizedEnd.getFullYear(), normalizedEnd.getMonth(), 1);

        while (current <= limit) {
            const dateKey = current.toISOString().split('T')[0]; // YYYY-MM-01
            trendsMap.set(dateKey, { count: 0, customsValue: 0 });
            current.setMonth(current.getMonth() + 1);
        }
    } else {
        // Initialize days in range
        for (let i = 0; i < diffDays; i++) {
            const date = new Date(normalizedStart);
            date.setDate(date.getDate() + i);
            const dateKey = date.toISOString().split('T')[0];
            trendsMap.set(dateKey, { count: 0, customsValue: 0 });
        }
    }

    // Fill with actual data
    declarations.forEach((d) => {
        const declarationDate = d.summary?.registeredDate
            ? new Date(d.summary.registeredDate)
            : null;

        if (declarationDate) {
            let dateKey: string;
            if (isMonthly) {
                // Use 1st day of the month as key
                const monthDate = new Date(declarationDate.getFullYear(), declarationDate.getMonth(), 1);
                dateKey = monthDate.toISOString().split('T')[0];
            } else {
                declarationDate.setHours(0, 0, 0, 0);
                dateKey = declarationDate.toISOString().split('T')[0];
            }

            const trend = trendsMap.get(dateKey);
            if (trend) {
                trend.count++;
                trend.customsValue += d.summary?.customsValue || 0;
            }
        }
    });

    return Array.from(trendsMap.entries())
        .map(([date, data]) => ({
            date,
            ...data,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Розраховує топ-10 список за полем.
 */
function calculateTopList(
    declarations: any[],
    field: 'senderName' | 'recipientName' | 'customsOffice' | 'declarationType'
) {
    const map = new Map<string, { count: number; totalValue: number }>();

    declarations.forEach((d) => {
        let value: string | null = null;

        if (field === 'senderName') {
            value = d.senderName || d.summary?.senderName || null;
        } else if (field === 'recipientName') {
            value = d.recipientName || d.summary?.recipientName || null;
        } else if (field === 'customsOffice') {
            value = d.summary?.customsOffice || null;
        } else if (field === 'declarationType') {
            value = d.summary?.declarationType || null;
        }

        if (value && value.trim() && value !== '---' && value !== 'N/A') {
            const existing = map.get(value) || { count: 0, totalValue: 0 };
            const customsValue = d.summary?.customsValue || 0;
            map.set(value, {
                count: existing.count + 1,
                totalValue: existing.totalValue + customsValue,
            });
        }
    });

    if (field === 'customsOffice') {
        return Array.from(map.entries())
            .map(([office, data]) => ({ office, ...data }))
            .sort((a, b) => b.totalValue - a.totalValue) // Sort by value usually better
            .slice(0, 10);
    } else if (field === 'declarationType') {
        return Array.from(map.entries())
            .map(([type, data]) => ({ type, ...data }))
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 10);
    } else {
        return Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 10);
    }
}

/**
 * Розраховує порівняння з попереднім періодом.
 */
async function calculateComparison(
    currentStats: { count: number; value: number },
    dateFrom?: string,
    dateTo?: string,
    targetCompanyIds: string[] = []
) {
    const end = dateTo ? new Date(dateTo) : new Date();
    const start = dateFrom ? new Date(dateFrom) : new Date(new Date().setDate(end.getDate() - 30));

    const diffTime = Math.abs(end.getTime() - start.getTime());

    // Previous period of same duration
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - diffTime);

    // OPTIMIZATION: Use aggregate for previous period too
    const prevStats = await db.declarationSummary.aggregate({
        _count: true,
        _sum: {
            customsValue: true
        },
        where: {
            declaration: {
                companyId: targetCompanyIds.length === 1
                    ? targetCompanyIds[0]
                    : { in: targetCompanyIds }
            },
            registeredDate: {
                gte: prevStart,
                lte: prevEnd,
            }
        }
    });

    const thisPeriodCount = currentStats.count;
    const lastPeriodCount = prevStats._count || 0;
    const countChange = lastPeriodCount > 0
        ? Math.round(((thisPeriodCount - lastPeriodCount) / lastPeriodCount) * 100)
        : 0;

    const thisPeriodValue = currentStats.value;
    const lastPeriodValue = prevStats._sum.customsValue || 0;
    const valueChange = lastPeriodValue > 0
        ? Math.round(((thisPeriodValue - lastPeriodValue) / lastPeriodValue) * 100)
        : 0;

    return {
        thisPeriodCount,
        lastPeriodCount,
        countChange,
        thisPeriodValue,
        lastPeriodValue,
        valueChange,
    };
}
