'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import iconv from "iconv-lite";
import crypto from "crypto";

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

export async function getDeclarations() {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return [];
    }

    const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
    const access = await getActiveCompanyWithAccess();
    if (!access.success || !access.companyId) {
        return [];
    }

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

    // Load declarations from all companies the user has access to
    // Use relation query for better reliability (doesn't rely on IDs in session)
    const declarations = await db.declaration.findMany({
        where: {
            company: {
                userCompanies: {
                    some: {
                        user: {
                            email: session.user.email
                        },
                        isActive: true
                    }
                },
                // Also ensure company itself is not deleted
                deletedAt: null
            },
            ...eeExcludeClause
        },
        select: {
            id: true,
            customsId: true,
            mrn: true,
            status: true,
            date: true,
            updatedAt: true,
            companyId: true,
            summary: true,
            hsCodes: {
                select: {
                    hsCode: true
                }
            }
        } as any,
        orderBy: {
            date: 'desc'
        },
        take: Number(process.env.ARCHIVE_MAX_DECLARATIONS || 500),
    });

    return declarations.map((d: any) => ({ ...d, xmlData: null }));
}

/**
 * Get paginated declarations with filtering and sorting (server-side)
 * 
 * @param page - Current page (1-based)
 * @param pageSize - Number of items per page
 * @param filters - Filter options
 * @param sortColumn - Column to sort by
 * @param sortDirection - Sort direction ('asc' | 'desc')
 * @param activeTab - Active tab ('list60' | 'list61') - affects which data to load
 * @param companyIds - Optional array of company IDs to filter by (for multi-company view)
 * @returns Paginated declarations with total count
 */
export async function getDeclarationsPaginated(
    page: number = 1,
    pageSize: number = 20,
    filters: {
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        customsOffice?: string;
        currency?: string;
        invoiceValueFrom?: string;
        invoiceValueTo?: string;
        consignor?: string;
        consignee?: string;
        contractHolder?: string;
        hsCode?: string;
        declarationType?: string;
        searchTerm?: string;
    } = {},
    sortColumn: string | null = null,
    sortDirection: 'asc' | 'desc' = 'desc',
    activeTab: 'list60' | 'list61' = 'list60',
    companyIds?: string[]
) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { declarations: [], total: 0, page, pageSize, totalPages: 0 };
    }

    // Використовувати activeCompanyId замість user.company
    const { getActiveCompanyWithAccess, checkCompanyAccess } = await import("@/lib/company-access");
    const access = await getActiveCompanyWithAccess();

    if (!access.success || !access.companyId) {
        return { declarations: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const showEeDeclarations = await getShowEeDeclarationsForCompany(access.companyId);

    // Determine which companies to query
    let targetCompanyIds: string[];

    if (companyIds && companyIds.length > 0) {
        // Verify user has access to all requested companies
        const accessChecks = await Promise.all(
            companyIds.map(id => checkCompanyAccess(id))
        );

        const allowedIds = companyIds.filter((id, index) => accessChecks[index].success);

        if (allowedIds.length === 0) {
            return { declarations: [], total: 0, page, pageSize, totalPages: 0 };
        }

        targetCompanyIds = allowedIds;
    } else {
        // Default to active company only
        targetCompanyIds = [access.companyId];
    }

    // Build where clause for filtering
    const where: any = {
        companyId: targetCompanyIds.length === 1
            ? targetCompanyIds[0]
            : { in: targetCompanyIds }
    };

    // Build AND array for complex filters
    const andConditions: any[] = [];

    if (!showEeDeclarations) {
        andConditions.push({
            NOT: {
                summary: {
                    declarationType: {
                        endsWith: 'ЕЕ'
                    }
                }
            }
        });
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
        if (filters.status === 'cleared') {
            where.status = 'CLEARED';
        } else {
            where.status = filters.status;
        }
    }

    // Date range filter - check both date and summary.registeredDate
    if (filters.dateFrom || filters.dateTo) {
        const dateFilter: any = {};
        const summaryDateFilter: any = {};

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            dateFilter.gte = fromDate;
            summaryDateFilter.gte = fromDate;
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            dateFilter.lte = toDate;
            summaryDateFilter.lte = toDate;
        }

        // Use OR to match either date or summary.registeredDate
        andConditions.push({
            OR: [
                { date: dateFilter },
                { summary: { registeredDate: summaryDateFilter } }
            ]
        });
    }

    // Build summary filters
    const summaryFilters: any = {};

    // Customs office filter (from summary)
    if (filters.customsOffice) {
        summaryFilters.customsOffice = {
            contains: filters.customsOffice,
            mode: 'insensitive' as const
        };
    }

    // Currency filter (from summary)
    if (filters.currency && filters.currency !== 'all') {
        andConditions.push({
            OR: [
                { summary: { currency: filters.currency } },
                { summary: { invoiceCurrency: filters.currency } }
            ]
        });
    }

    // Invoice value range filter (from summary)
    if (filters.invoiceValueFrom || filters.invoiceValueTo) {
        const valueFilter: any = {};
        if (filters.invoiceValueFrom) {
            valueFilter.gte = parseFloat(filters.invoiceValueFrom);
        }
        if (filters.invoiceValueTo) {
            valueFilter.lte = parseFloat(filters.invoiceValueTo);
        }
        summaryFilters.invoiceValueUah = valueFilter;
    }

    // Consignor filter (from summary)
    if (filters.consignor) {
        summaryFilters.senderName = {
            contains: filters.consignor,
            mode: 'insensitive' as const
        };
    }

    // Consignee filter (from summary)
    if (filters.consignee) {
        summaryFilters.recipientName = {
            contains: filters.consignee,
            mode: 'insensitive' as const
        };
    }

    // Contract holder filter (from summary)
    if (filters.contractHolder) {
        summaryFilters.contractHolder = {
            contains: filters.contractHolder,
            mode: 'insensitive' as const
        };
    }

    // HS code filter (relation)
    if (filters.hsCode) {
        andConditions.push({
            hsCodes: {
                some: {
                    hsCode: {
                        contains: filters.hsCode,
                        mode: 'insensitive' as const
                    }
                }
            }
        });
    }

    // Declaration type filter (from summary)
    if (filters.declarationType) {
        const types = filters.declarationType.split(',').map(t => t.trim()).filter(Boolean);
        if (types.length > 0) {
            summaryFilters.declarationType = {
                in: types
            };
        }
    }

    // Add summary filters if any
    if (Object.keys(summaryFilters).length > 0) {
        andConditions.push({
            summary: summaryFilters
        });
    }

    // Search term filter (MRN, customsId)
    if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.trim();
        andConditions.push({
            OR: [
                { mrn: { contains: searchTerm, mode: 'insensitive' as const } },
                { customsId: { contains: searchTerm, mode: 'insensitive' as const } },
                { summary: { senderName: { contains: searchTerm, mode: 'insensitive' as const } } },
                { summary: { recipientName: { contains: searchTerm, mode: 'insensitive' as const } } },
                { summary: { contractHolder: { contains: searchTerm, mode: 'insensitive' as const } } },
                { summary: { customsOffice: { contains: searchTerm, mode: 'insensitive' as const } } },
                { summary: { declarationType: { contains: searchTerm, mode: 'insensitive' as const } } }
            ]
        });
    }

    // Combine all conditions with AND
    if (andConditions.length > 0) {
        const statusFilter = where.status ? { status: where.status } : null;
        const companyFilter = targetCompanyIds.length === 1
            ? { companyId: targetCompanyIds[0] }
            : { companyId: { in: targetCompanyIds } };

        where.AND = [
            companyFilter,
            ...(statusFilter ? [statusFilter] : []),
            ...andConditions
        ];
        delete where.status;
        delete where.companyId;
    }

    // Build orderBy clause
    let orderBy: any = { date: 'desc' }; // Default sort

    if (sortColumn) {
        switch (sortColumn) {
            case 'mdNumber':
                orderBy = { mrn: sortDirection };
                break;
            case 'registeredDate':
                // Sort by summary.registeredDate if available, otherwise by date
                orderBy = [
                    { summary: { registeredDate: sortDirection } },
                    { date: sortDirection }
                ];
                break;
            case 'status':
                orderBy = { status: sortDirection };
                break;
            case 'type':
                orderBy = { summary: { declarationType: sortDirection } };
                break;
            case 'consignor':
                orderBy = { summary: { senderName: sortDirection } };
                break;
            case 'consignee':
                orderBy = { summary: { recipientName: sortDirection } };
                break;
            case 'invoiceValue':
                orderBy = { summary: { invoiceValueUah: sortDirection } };
                break;
            case 'goodsCount':
                orderBy = { summary: { totalItems: sortDirection } };
                break;
            default:
                orderBy = { date: sortDirection };
        }
    }

    // Calculate skip
    const skip = (page - 1) * pageSize;

    // Get total count and declarations in parallel
    const [total, declarations] = await Promise.all([
        db.declaration.count({ where }),
        db.declaration.findMany({
            where,
            skip,
            take: pageSize,
            orderBy,
            select: {
                id: true,
                customsId: true,
                mrn: true,
                status: true,
                date: true,
                updatedAt: true,
                companyId: true,
                // xmlData is heavy; we need it mostly for list60 parsing.
                xmlData: activeTab === 'list60',
                summary: activeTab === 'list61' || !!filters.customsOffice || !!filters.currency ||
                    !!filters.invoiceValueFrom || !!filters.invoiceValueTo ||
                    !!filters.consignor || !!filters.consignee || !!filters.contractHolder || !!filters.declarationType ||
                    sortColumn === 'type' || sortColumn === 'consignor' ||
                    sortColumn === 'consignee' || sortColumn === 'invoiceValue' ||
                    sortColumn === 'goodsCount' || sortColumn === 'registeredDate',
                hsCodes: activeTab === 'list61' || !!filters.hsCode ? {
                    select: {
                        hsCode: true
                    }
                } : false,
            } as any
        })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
        declarations,
        total,
        page,
        pageSize,
        totalPages
    };
}

/**
 * Get archive statistics with filtering (server-side)
 * Calculates statistics for all declarations matching filters, not just current page
 * 
 * @param filters - Filter options (same as getDeclarationsPaginated)
 * @param activeTab - Active tab ('list60' | 'list61')
 * @returns Statistics object
 */
export async function getArchiveStatistics(
    filters: {
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        customsOffice?: string;
        currency?: string;
        invoiceValueFrom?: string;
        invoiceValueTo?: string;
        consignor?: string;
        consignee?: string;
        contractHolder?: string;
        hsCode?: string;
        declarationType?: string;
        searchTerm?: string;
    } = {},
    activeTab: 'list60' | 'list61' = 'list60',
    companyIds?: string[]
) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return null;
    }

    // Використовувати activeCompanyId замість user.company
    const { getActiveCompanyWithAccess, checkCompanyAccess } = await import("@/lib/company-access");
    const access = await getActiveCompanyWithAccess();

    if (!access.success || !access.companyId) {
        return null;
    }

    const showEeDeclarations = await getShowEeDeclarationsForCompany(access.companyId);

    // Determine which companies to query
    let targetCompanyIds: string[];

    if (companyIds && companyIds.length > 0) {
        // Verify user has access to all requested companies
        const accessChecks = await Promise.all(
            companyIds.map(id => checkCompanyAccess(id))
        );

        const allowedIds = companyIds.filter((id, index) => accessChecks[index].success);

        if (allowedIds.length === 0) {
            return null;
        }

        targetCompanyIds = allowedIds;
    } else {
        // Default to active company only
        targetCompanyIds = [access.companyId];
    }

    // Build where clause
    const where: any = {
        companyId: targetCompanyIds.length === 1
            ? targetCompanyIds[0]
            : { in: targetCompanyIds }
    };

    const baseDeclarationWhere: any = {
        companyId: targetCompanyIds.length === 1
            ? targetCompanyIds[0]
            : { in: targetCompanyIds }
    };

    const andConditions: any[] = [];

    if (!showEeDeclarations) {
        andConditions.push({
            NOT: {
                summary: {
                    declarationType: {
                        endsWith: 'ЕЕ'
                    }
                }
            }
        });
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
        if (filters.status === 'cleared') {
            where.status = 'CLEARED';
        } else {
            where.status = filters.status;
        }
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
        const dateFilter: any = {};
        const summaryDateFilter: any = {};

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            dateFilter.gte = fromDate;
            summaryDateFilter.gte = fromDate;
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            dateFilter.lte = toDate;
            summaryDateFilter.lte = toDate;
        }

        andConditions.push({
            OR: [
                { date: dateFilter },
                { summary: { registeredDate: summaryDateFilter } }
            ]
        });
    }

    // Build summary filters
    const summaryFilters: any = {};

    if (filters.customsOffice) {
        summaryFilters.customsOffice = {
            contains: filters.customsOffice,
            mode: 'insensitive' as const
        };
    }

    if (filters.currency && filters.currency !== 'all') {
        andConditions.push({
            OR: [
                { summary: { currency: filters.currency } },
                { summary: { invoiceCurrency: filters.currency } }
            ]
        });
    }

    if (filters.invoiceValueFrom || filters.invoiceValueTo) {
        const valueFilter: any = {};
        if (filters.invoiceValueFrom) {
            valueFilter.gte = parseFloat(filters.invoiceValueFrom);
        }
        if (filters.invoiceValueTo) {
            valueFilter.lte = parseFloat(filters.invoiceValueTo);
        }
        summaryFilters.invoiceValueUah = valueFilter;
    }

    if (filters.consignor) {
        summaryFilters.senderName = {
            contains: filters.consignor,
            mode: 'insensitive' as const
        };
    }

    if (filters.consignee) {
        summaryFilters.recipientName = {
            contains: filters.consignee,
            mode: 'insensitive' as const
        };
    }

    if (filters.declarationType) {
        const types = filters.declarationType.split(',').map(t => t.trim()).filter(Boolean);
        if (types.length > 0) {
            summaryFilters.declarationType = {
                in: types
            };
        }
    }

    if (Object.keys(summaryFilters).length > 0) {
        andConditions.push({
            summary: summaryFilters
        });
    }

    if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.trim();
        andConditions.push({
            OR: [
                { mrn: { contains: searchTerm, mode: 'insensitive' as const } },
                { customsId: { contains: searchTerm, mode: 'insensitive' as const } }
            ]
        });
    }

    if (andConditions.length > 0) {
        const statusFilter = where.status ? { status: where.status } : null;
        const companyFilter = targetCompanyIds.length === 1
            ? { companyId: targetCompanyIds[0] }
            : { companyId: { in: targetCompanyIds } };

        where.AND = [
            companyFilter,
            ...(statusFilter ? [statusFilter] : []),
            ...andConditions
        ];
        delete where.status;
        delete where.companyId;
    }

    // Try to get cached statistics first
    // Create unique cache key based on filters, tab and companyIds
    const { getCachedArchiveStatistics, setCachedArchiveStatistics } = await import("@/lib/statistics-cache");
    const filtersKey = JSON.stringify({ filters, companyIds: targetCompanyIds, showEeDeclarations });
    const cacheHash = crypto.createHash('sha256').update(filtersKey).digest('hex');
    const cacheKey = `stats_archive_${activeTab}_${cacheHash}`;
    const cached = getCachedArchiveStatistics(cacheKey);
    if (cached) {
        return cached;
    }

    // IMPORTANT: For DeclarationSummary aggregation we must apply summary field filters
    // directly on DeclarationSummary (not nested via Declaration.where.summary),
    // otherwise groupBy/aggregate won't match the filtered list.
    const summaryWhere: any = {
        declaration: baseDeclarationWhere,
    };

    if (!showEeDeclarations) {
        summaryWhere.NOT = { declarationType: { endsWith: 'ЕЕ' } };
    }

    // Apply summary-field filters directly
    if (filters.customsOffice) {
        summaryWhere.customsOffice = { contains: filters.customsOffice, mode: 'insensitive' as const };
    }

    if (filters.currency && filters.currency !== 'all') {
        summaryWhere.OR = [
            { currency: filters.currency },
            { invoiceCurrency: filters.currency }
        ];
    }

    if (filters.invoiceValueFrom || filters.invoiceValueTo) {
        const valueFilter: any = {};
        if (filters.invoiceValueFrom) valueFilter.gte = parseFloat(filters.invoiceValueFrom);
        if (filters.invoiceValueTo) valueFilter.lte = parseFloat(filters.invoiceValueTo);
        summaryWhere.invoiceValueUah = valueFilter;
    }

    if (filters.consignor) {
        summaryWhere.senderName = { contains: filters.consignor, mode: 'insensitive' as const };
    }

    if (filters.consignee) {
        summaryWhere.recipientName = { contains: filters.consignee, mode: 'insensitive' as const };
    }

    if (filters.contractHolder) {
        summaryWhere.contractHolder = { contains: filters.contractHolder, mode: 'insensitive' as const };
    }

    if (filters.declarationType) {
        const types = filters.declarationType.split(',').map(t => t.trim()).filter(Boolean);
        if (types.length > 0) {
            summaryWhere.declarationType = { in: types };
        }
    }

    // Apply declaration-side filters through relation
    if (filters.status && filters.status !== 'all') {
        summaryWhere.declaration.status = filters.status === 'cleared' ? 'CLEARED' : filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
        const dateFilter: any = {};
        const summaryDateFilter: any = {};

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            dateFilter.gte = fromDate;
            summaryDateFilter.gte = fromDate;
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            dateFilter.lte = toDate;
            summaryDateFilter.lte = toDate;
        }

        summaryWhere.OR = [
            ...(Array.isArray(summaryWhere.OR) ? summaryWhere.OR : []),
            { declaration: { date: dateFilter } },
            { registeredDate: summaryDateFilter },
        ];
    }

    if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.trim();

        const existingAnd = Array.isArray(summaryWhere.AND) ? summaryWhere.AND : [];
        summaryWhere.AND = [
            ...existingAnd,
            {
                OR: [
                    { declaration: { mrn: { contains: searchTerm, mode: 'insensitive' as const } } },
                    { declaration: { customsId: { contains: searchTerm, mode: 'insensitive' as const } } },
                    { senderName: { contains: searchTerm, mode: 'insensitive' as const } },
                    { recipientName: { contains: searchTerm, mode: 'insensitive' as const } },
                    { contractHolder: { contains: searchTerm, mode: 'insensitive' as const } },
                    { customsOffice: { contains: searchTerm, mode: 'insensitive' as const } },
                    { declarationType: { contains: searchTerm, mode: 'insensitive' as const } },
                ]
            }
        ];
    }

    if (filters.hsCode) {
        summaryWhere.declaration.hsCodes = {
            some: {
                hsCode: {
                    contains: filters.hsCode,
                    mode: 'insensitive' as const
                }
            }
        };
    }

    const [totals, statusGroups, topConsignors, topConsignees, topContractHolders, topDeclarationTypes, topCustomsOffices] = await Promise.all([
        db.declarationSummary.aggregate({
            where: summaryWhere,
            _count: { _all: true },
            _sum: {
                customsValue: true,
                invoiceValueUah: true,
                totalItems: true,
            },
        }),
        db.declaration.groupBy({
            by: ['status'],
            where,
            _count: { _all: true },
        }),
        db.declarationSummary.groupBy({
            by: ['senderName'],
            where: { ...summaryWhere, senderName: { not: null } },
            _count: { senderName: true },
            _sum: { customsValue: true },
            orderBy: { _count: { senderName: 'desc' } },
            take: 10,
        }),
        db.declarationSummary.groupBy({
            by: ['recipientName'],
            where: { ...summaryWhere, recipientName: { not: null } },
            _count: { recipientName: true },
            _sum: { customsValue: true },
            orderBy: { _count: { recipientName: 'desc' } },
            take: 10,
        }),
        db.declarationSummary.groupBy({
            by: ['contractHolder'],
            where: { ...summaryWhere, contractHolder: { not: null } },
            _count: { contractHolder: true },
            _sum: { customsValue: true },
            orderBy: { _count: { contractHolder: 'desc' } },
            take: 10,
        }),
        db.declarationSummary.groupBy({
            by: ['declarationType'],
            where: { ...summaryWhere, declarationType: { not: null } },
            _count: { declarationType: true },
            _sum: { customsValue: true },
            orderBy: { _count: { declarationType: 'desc' } },
            take: 10,
        }),
        db.declarationSummary.groupBy({
            by: ['customsOffice'],
            where: { ...summaryWhere, customsOffice: { not: null } },
            _count: { customsOffice: true },
            _sum: { customsValue: true },
            orderBy: { _count: { customsOffice: 'desc' } },
            take: 10,
        }),
    ]);

    const byStatus = {
        CLEARED: 0,
        PROCESSING: 0,
        REJECTED: 0,
    } as Record<'CLEARED' | 'PROCESSING' | 'REJECTED', number>;

    statusGroups.forEach(g => {
        const status = (g as any).status as keyof typeof byStatus;
        if (status in byStatus) {
            byStatus[status] = (g as any)._count?._all ?? 0;
        }
    });

    const companyIdArray = targetCompanyIds;

    const eeSql = showEeDeclarations
        ? Prisma.empty
        : Prisma.sql` AND (ds."declarationType" IS NULL OR ds."declarationType" NOT LIKE ${'%ЕЕ'})`;

    const statusSql = filters.status && filters.status !== 'all'
        ? Prisma.sql` AND d."status" = ${filters.status === 'cleared' ? 'CLEARED' : filters.status}`
        : Prisma.empty;

    const dateSql = (filters.dateFrom || filters.dateTo)
        ? Prisma.sql` AND (
            (d."date" >= ${filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00.000Z') : new Date('1970-01-01T00:00:00.000Z')} AND d."date" <= ${filters.dateTo ? new Date(filters.dateTo + 'T23:59:59.999Z') : new Date('2999-12-31T23:59:59.999Z')})
            OR
            (ds."registeredDate" >= ${filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00.000Z') : new Date('1970-01-01T00:00:00.000Z')} AND ds."registeredDate" <= ${filters.dateTo ? new Date(filters.dateTo + 'T23:59:59.999Z') : new Date('2999-12-31T23:59:59.999Z')})
        )`
        : Prisma.empty;

    const customsOfficeSql = filters.customsOffice
        ? Prisma.sql` AND ds."customsOffice" ILIKE ${'%' + filters.customsOffice + '%'}`
        : Prisma.empty;

    const currencySql = filters.currency && filters.currency !== 'all'
        ? Prisma.sql` AND (ds."currency" = ${filters.currency} OR ds."invoiceCurrency" = ${filters.currency})`
        : Prisma.empty;

    const invoiceFromSql = filters.invoiceValueFrom
        ? Prisma.sql` AND ds."invoiceValueUah" >= ${Number(filters.invoiceValueFrom)}`
        : Prisma.empty;

    const invoiceToSql = filters.invoiceValueTo
        ? Prisma.sql` AND ds."invoiceValueUah" <= ${Number(filters.invoiceValueTo)}`
        : Prisma.empty;

    const consignorSql = filters.consignor
        ? Prisma.sql` AND ds."senderName" ILIKE ${'%' + filters.consignor + '%'}`
        : Prisma.empty;

    const consigneeSql = filters.consignee
        ? Prisma.sql` AND ds."recipientName" ILIKE ${'%' + filters.consignee + '%'}`
        : Prisma.empty;

    const contractHolderSql = filters.contractHolder
        ? Prisma.sql` AND ds."contractHolder" ILIKE ${'%' + filters.contractHolder + '%'}`
        : Prisma.empty;

    const declarationTypeSql = filters.declarationType
        ? Prisma.sql` AND ds."declarationType" = ANY(${filters.declarationType.split(',').map(t => t.trim()).filter(Boolean)}::text[])`
        : Prisma.empty;

    const searchSql = filters.searchTerm
        ? Prisma.sql` AND (
            d."mrn" ILIKE ${'%' + filters.searchTerm.trim() + '%'}
            OR d."customsId" ILIKE ${'%' + filters.searchTerm.trim() + '%'}
            OR ds."senderName" ILIKE ${'%' + filters.searchTerm.trim() + '%'}
            OR ds."recipientName" ILIKE ${'%' + filters.searchTerm.trim() + '%'}
            OR ds."contractHolder" ILIKE ${'%' + filters.searchTerm.trim() + '%'}
            OR ds."customsOffice" ILIKE ${'%' + filters.searchTerm.trim() + '%'}
            OR ds."declarationType" ILIKE ${'%' + filters.searchTerm.trim() + '%'}
        )`
        : Prisma.empty;

    const hsCodeSql = filters.hsCode
        ? Prisma.sql` AND dh."hsCode" ILIKE ${'%' + filters.hsCode + '%'}`
        : Prisma.empty;

    const topHSCodes = await db.$queryRaw<
        Array<{ code: string; count: bigint | number; totalvalue: number | null }>
    >(Prisma.sql`
        SELECT
            dh."hsCode" as code,
            COUNT(*) as count,
            COALESCE(SUM(ds."customsValue"), 0) as totalValue
        FROM "DeclarationHsCode" dh
        JOIN "Declaration" d ON d."id" = dh."declarationId"
        LEFT JOIN "DeclarationSummary" ds ON ds."declarationId" = d."id"
        WHERE d."companyId" = ANY(${companyIdArray}::text[])
        ${eeSql}
        ${statusSql}
        ${dateSql}
        ${customsOfficeSql}
        ${currencySql}
        ${invoiceFromSql}
        ${invoiceToSql}
        ${consignorSql}
        ${consigneeSql}
        ${contractHolderSql}
        ${declarationTypeSql}
        ${searchSql}
        ${hsCodeSql}
        GROUP BY dh."hsCode"
        ORDER BY count DESC
        LIMIT 10;
    `);

    const stats = {
        total: totals._count?._all ?? 0,
        byStatus,
        totalCustomsValue: totals._sum?.customsValue ?? 0,
        totalInvoiceValue: totals._sum?.invoiceValueUah ?? 0,
        totalItems: totals._sum?.totalItems ?? 0,
        topConsignors: (topConsignors || [])
            .filter(x => x.senderName)
            .map((x: any) => ({
                name: x.senderName,
                count: x._count?.senderName ?? 0,
                totalValue: x._sum?.customsValue ?? 0,
            })),
        topConsignees: (topConsignees || [])
            .filter(x => x.recipientName)
            .map((x: any) => ({
                name: x.recipientName,
                count: x._count?.recipientName ?? 0,
                totalValue: x._sum?.customsValue ?? 0,
            })),
        topContractHolders: (topContractHolders || [])
            .filter(x => x.contractHolder)
            .map((x: any) => ({
                name: x.contractHolder,
                count: x._count?.contractHolder ?? 0,
                totalValue: x._sum?.customsValue ?? 0,
            })),
        topHSCodes: (topHSCodes || []).map((x: any) => ({
            code: x.code,
            count: Number(x.count),
            totalValue: Number(x.totalvalue ?? x.totalValue ?? 0),
        })),
        topDeclarationTypes: (topDeclarationTypes || [])
            .filter(x => x.declarationType)
            .map((x: any) => ({
                type: x.declarationType,
                count: x._count?.declarationType ?? 0,
                totalValue: x._sum?.customsValue ?? 0,
            })),
        topCustomsOffices: (topCustomsOffices || [])
            .filter(x => x.customsOffice)
            .map((x: any) => ({
                office: x.customsOffice,
                count: x._count?.customsOffice ?? 0,
                totalValue: x._sum?.customsValue ?? 0,
            })),
    };

    setCachedArchiveStatistics(cacheKey, stats);

    return stats;
}

// Helper function to decode windows-1251 text that was incorrectly saved
// When win1251 bytes are saved as JSON, each byte becomes a char with that code
// Example: "ІМ ЕЕ" (win1251: 0xC7 0xCC 0x20 0xC5 0xC5) becomes chars with codes 199, 204, 32, 197, 197
// We need to treat each char code as a win1251 byte and decode it
export async function decodeWindows1251Text(text: string | null | undefined): Promise<string> {
    if (!text) return '---';

    // Check if already correctly encoded
    if (/^[А-ЯЁа-яёІіЇїЄєҐґ\s\d]+$/.test(text)) {
        return text;
    }

    try {
        // Convert string to buffer treating each char code as a byte
        // This handles the case where win1251 bytes are stored as single-byte chars
        const bytes = Buffer.alloc(text.length);
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            // Treat char code as win1251 byte (0-255)
            // If char code is > 255, it's multi-byte UTF-8, but we want the byte value
            bytes[i] = charCode > 255 ? (charCode & 0xFF) : charCode;
        }

        // Decode as windows-1251 using iconv
        const decoded = iconv.decode(bytes, 'win1251');
        return decoded;
    } catch (error) {
        console.error("Decode error:", error, "for text:", text);
        return text;
    }
}

export async function deleteDeclaration(id: string) {
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

        // Verify that the declaration belongs to the user's company
        const declaration = await db.declaration.findFirst({
            where: {
                id: id,
                companyId: access.companyId
            }
        });

        if (!declaration) {
            return { error: "Декларацію не знайдено або немає доступу" };
        }

        await db.declaration.delete({
            where: { id: id }
        });

        revalidatePath("/dashboard/archive");
        return { success: true };
    } catch (error: any) {
        console.error("Delete declaration error:", error);
        return { error: "Помилка видалення: " + error.message };
    }
}

/**
 * Get loading status for periods (for status bar visualization)
 * Checks which periods have declarations loaded (60.1 only vs full 60.1+61.1)
 * 
 * @param periodDays - Number of days per period (default: 7 for weekly periods)
 * @returns Array of period status objects
 */
export async function getPeriodsLoadingStatus(periodDays: number = 7) {
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

        // Calculate date range: 1095 days ago to today
        const now = new Date();
        const dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);

        const dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - 1095);
        dateFrom.setHours(0, 0, 0, 0);

        // Split into periods
        const periods: Array<{ start: Date; end: Date }> = [];
        let currentStart = new Date(dateFrom);

        while (currentStart < dateTo) {
            const currentEnd = new Date(currentStart);
            currentEnd.setDate(currentEnd.getDate() + periodDays - 1);
            currentEnd.setHours(23, 59, 59, 999);

            if (currentEnd > dateTo) {
                currentEnd.setTime(dateTo.getTime());
            }

            periods.push({
                start: new Date(currentStart),
                end: new Date(currentEnd)
            });

            currentStart = new Date(currentEnd);
            currentStart.setDate(currentStart.getDate() + 1);
            currentStart.setHours(0, 0, 0, 0);
        }

        // Check status for each period
        const periodsStatus = await Promise.all(
            periods.map(async (period) => {
                // Check if there are any declarations in this period
                const declarationsCount = await db.declaration.count({
                    where: {
                        companyId: access.companyId,
                        date: {
                            gte: period.start,
                            lte: period.end
                        }
                    }
                });

                if (declarationsCount === 0) {
                    return {
                        start: period.start,
                        end: period.end,
                        status: 'empty' as const,
                        count: 0,
                        fullDataCount: 0
                    };
                }

                // Check how many have full data (61.1)
                // Full data means: xmlData contains data61_1 or summary exists
                const declarationsWithFullData = await db.declaration.findMany({
                    where: {
                        companyId: access.companyId,
                        date: {
                            gte: period.start,
                            lte: period.end
                        }
                    },
                    select: {
                        id: true,
                        xmlData: true,
                        summary: true
                    }
                });

                let fullDataCount = 0;
                for (const decl of declarationsWithFullData) {
                    // Check if has 61.1 data
                    let has61_1 = false;

                    if (decl.summary) {
                        has61_1 = true;
                    } else if (decl.xmlData) {
                        try {
                            const parsed = JSON.parse(decl.xmlData);
                            // Check if has data61_1 or mappedData structure indicates full data
                            if (parsed.data61_1 || (parsed.mappedData && typeof parsed.mappedData === 'object')) {
                                has61_1 = true;
                            }
                        } catch {
                            // If parsing fails, check if it's XML (old format with 61.1)
                            if (typeof decl.xmlData === 'string' && decl.xmlData.trim().startsWith('<?xml')) {
                                has61_1 = true;
                            }
                        }
                    }

                    if (has61_1) {
                        fullDataCount++;
                    }
                }

                return {
                    start: period.start,
                    end: period.end,
                    status: fullDataCount === declarationsCount ? 'full' as const :
                        fullDataCount > 0 ? 'partial' as const : 'list_only' as const,
                    count: declarationsCount,
                    fullDataCount: fullDataCount
                };
            })
        );

        return {
            success: true,
            periods: periodsStatus,
            periodDays: periodDays,
            totalPeriods: periodsStatus.length
        };
    } catch (error: any) {
        console.error("Error getting periods loading status:", error);
        return { error: error.message || "Помилка отримання статусу періодів" };
    }
}

export async function deleteDeclarationsByPeriod(dateFrom: Date, dateTo: Date) {
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

        // Ensure dateFrom starts at 00:00:00
        const startOfDay = new Date(dateFrom);
        startOfDay.setHours(0, 0, 0, 0);

        // Ensure dateTo ends at 23:59:59
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);

        const result = await db.declaration.deleteMany({
            where: {
                companyId: access.companyId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        revalidatePath("/dashboard/archive");
        return { success: true, count: result.count };
    } catch (error: any) {
        console.error("Delete declarations by period error:", error);
        return { error: "Помилка видалення: " + error.message };
    }
}

export async function deleteDeclarationsByIds(ids: string[]) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    if (!ids || ids.length === 0) {
        return { error: "Не вибрано декларацій для видалення" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();

        if (!access.success || !access.companyId) {
            return { error: "Активна компанія не встановлена" };
        }

        // Verify all declarations belong to the user's company
        const declarations = await db.declaration.findMany({
            where: {
                id: { in: ids },
                companyId: access.companyId
            }
        });

        if (declarations.length !== ids.length) {
            return { error: "Деякі декларації не знайдено або немає доступу" };
        }

        const result = await db.declaration.deleteMany({
            where: {
                id: { in: ids },
                companyId: access.companyId
            }
        });

        revalidatePath("/dashboard/archive");
        return { success: true, count: result.count };
    } catch (error: any) {
        console.error("Delete declarations by IDs error:", error);
        return { error: "Помилка видалення: " + error.message };
    }
}
