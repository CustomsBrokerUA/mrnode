'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import iconv from "iconv-lite";

export async function getDeclarations() {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return [];
    }

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
            }
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
        }
    });

    return declarations;
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
                { customsId: { contains: searchTerm, mode: 'insensitive' as const } }
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
            // Load summary only for list61 or when needed for filters
            include: {
                summary: activeTab === 'list61' || !!filters.customsOffice || !!filters.currency ||
                    !!filters.invoiceValueFrom || !!filters.invoiceValueTo ||
                    !!filters.consignor || !!filters.consignee || !!filters.declarationType ||
                    sortColumn === 'type' || sortColumn === 'consignor' ||
                    sortColumn === 'consignee' || sortColumn === 'invoiceValue' ||
                    sortColumn === 'goodsCount' || sortColumn === 'registeredDate'
                ,
                hsCodes: activeTab === 'list61'
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

    const andConditions: any[] = [];

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
    const filtersKey = JSON.stringify({ filters, companyIds: targetCompanyIds });
    const cacheKey = `stats_archive_${activeTab}_${Buffer.from(filtersKey).toString('base64').substring(0, 50)}`;
    const cached = getCachedArchiveStatistics(cacheKey);
    if (cached) {
        return cached;
    }

    // Load all matching declarations with summary for statistics calculation
    // Limit to 50000 to avoid memory issues (statistics are still useful)
    const declarations = await db.declaration.findMany({
        where,
        take: 50000, // Increased limit for better statistics
        include: {
            summary: true
        }
    });

    // Calculate statistics (similar to useArchiveStatistics hook logic)
    const stats = {
        total: declarations.length,
        byStatus: {
            CLEARED: 0,
            PROCESSING: 0,
            REJECTED: 0,
        },
        totalCustomsValue: 0,
        totalInvoiceValue: 0,
        totalItems: 0,
        topConsignors: [] as Array<{ name: string; count: number; totalValue: number }>,
        topConsignees: [] as Array<{ name: string; count: number; totalValue: number }>,
        topContractHolders: [] as Array<{ name: string; count: number; totalValue: number }>,
        topHSCodes: [] as Array<{ code: string; count: number; totalValue: number }>,
        topDeclarationTypes: [] as Array<{ type: string; count: number; totalValue: number }>,
        topCustomsOffices: [] as Array<{ office: string; count: number; totalValue: number }>,
    };

    const consignorsMap = new Map<string, { count: number; totalValue: number }>();
    const consigneesMap = new Map<string, { count: number; totalValue: number }>();
    const contractHoldersMap = new Map<string, { count: number; totalValue: number }>();
    const hsCodesMap = new Map<string, { count: number; totalValue: number }>();
    const declarationTypesMap = new Map<string, { count: number; totalValue: number }>();
    const customsOfficesMap = new Map<string, { count: number; totalValue: number }>();

    // Parse XML and calculate statistics
    for (const doc of declarations) {
        // Count by status
        if (doc.status === 'CLEARED') stats.byStatus.CLEARED++;
        else if (doc.status === 'REJECTED') stats.byStatus.REJECTED++;
        else stats.byStatus.PROCESSING++;

        // Sum values from summary
        if (doc.summary) {
            if (doc.summary.customsValue) {
                stats.totalCustomsValue += doc.summary.customsValue;
            }
            if (doc.summary.invoiceValueUah) {
                stats.totalInvoiceValue += doc.summary.invoiceValueUah;
            }
            if (doc.summary.totalItems) {
                stats.totalItems += doc.summary.totalItems;
            }
        }

        const customsValue = doc.summary?.customsValue || 0;

        // For list61, parse XML to get mappedData for top lists
        if (activeTab === 'list61' && doc.xmlData) {
            try {
                let xmlForMapping: string | null = null;
                const trimmed = doc.xmlData.trim();

                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    const parsed = JSON.parse(doc.xmlData);
                    if (parsed && typeof parsed === 'object' && parsed.data61_1) {
                        xmlForMapping = parsed.data61_1;
                    }
                } else if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
                    xmlForMapping = doc.xmlData;
                }

                if (xmlForMapping) {
                    // Extract basic data from XML using regex (simple parsing)
                    const extractField = (xml: string, fieldName: string): string | undefined => {
                        // Use [^] instead of [\s\S] for better compatibility
                        const pattern = `<${fieldName}>([^]*?)<\\/${fieldName}>`;
                        const match = xml.match(new RegExp(pattern, 'i'));
                        return match ? match[1].trim() : undefined;
                    };

                    // Extract clients from XML and find by box (ccd_cl_gr)
                    // Clients are in ccd_clients or ccd_client array
                    // Box value is stored in ccd_cl_gr field, name in ccd_cl_name
                    const extractClientByBox = (xml: string, boxValue: string): string | undefined => {
                        // Try to find ccd_client or ccd_clients elements
                        // Look for ccd_cl_gr field matching boxValue, then extract name from ccd_cl_name
                        const clientPatterns = [
                            /<ccd_client[^>]*>([^]*?)<\/ccd_client>/gi,
                            /<ccd_clients[^>]*>([^]*?)<\/ccd_clients>/gi
                        ];

                        for (const clientPattern of clientPatterns) {
                            const clientMatches = xml.matchAll(clientPattern);
                            for (const clientMatch of clientMatches) {
                                const clientContent = clientMatch[1];
                                // Check if this client has the right box value (ccd_cl_gr)
                                const boxMatch = clientContent.match(/<ccd_cl_gr>([^]*?)<\/ccd_cl_gr>/i);
                                if (boxMatch && boxMatch[1].trim() === boxValue) {
                                    // Found matching client, extract name from ccd_cl_name
                                    const nameMatch = clientContent.match(/<ccd_cl_name>([^]*?)<\/ccd_cl_name>/i);
                                    if (nameMatch) {
                                        const name = nameMatch[1].trim();
                                        if (name && name !== 'N/A' && name !== '---' && name !== 'Не вказано' && name.length > 0) {
                                            return name;
                                        }
                                    }
                                    // Fallback to other name fields if ccd_cl_name not found
                                    const fallbackPatterns = [
                                        /<ccd_name>([^]*?)<\/ccd_name>/i,
                                        /<ccd_02_01>([^]*?)<\/ccd_02_01>/i,
                                        /<name>([^]*?)<\/name>/i
                                    ];

                                    for (const namePattern of fallbackPatterns) {
                                        const fallbackMatch = clientContent.match(namePattern);
                                        if (fallbackMatch) {
                                            const name = fallbackMatch[1].trim();
                                            if (name && name !== 'N/A' && name !== '---' && name !== 'Не вказано' && name.length > 0) {
                                                return name;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return undefined;
                    };

                    const consignor = extractField(xmlForMapping, 'consignor') ||
                        extractClientByBox(xmlForMapping, '2')?.trim() ||
                        doc.summary?.senderName;
                    const consignee = extractField(xmlForMapping, 'consignee') ||
                        extractClientByBox(xmlForMapping, '8')?.trim() ||
                        doc.summary?.recipientName;
                    const contractHolder = extractField(xmlForMapping, 'contractHolder') ||
                        extractClientByBox(xmlForMapping, '9')?.trim();
                    const customsOffice = extractField(xmlForMapping, 'customsOffice') ||
                        extractField(xmlForMapping, 'ccd_07_01') ||
                        doc.summary?.customsOffice;
                    const declarationType = extractField(xmlForMapping, 'ccd_type') || doc.summary?.declarationType;

                    // Group by entities
                    if (consignor && consignor !== 'N/A' && consignor !== 'Не вказано') {
                        const existing = consignorsMap.get(consignor) || { count: 0, totalValue: 0 };
                        consignorsMap.set(consignor, {
                            count: existing.count + 1,
                            totalValue: existing.totalValue + customsValue
                        });
                    }

                    if (consignee && consignee !== 'N/A' && consignee !== 'Не вказано') {
                        const existing = consigneesMap.get(consignee) || { count: 0, totalValue: 0 };
                        consigneesMap.set(consignee, {
                            count: existing.count + 1,
                            totalValue: existing.totalValue + customsValue
                        });
                    }

                    if (contractHolder && contractHolder !== 'N/A' && contractHolder !== 'Не вказано') {
                        const existing = contractHoldersMap.get(contractHolder) || { count: 0, totalValue: 0 };
                        contractHoldersMap.set(contractHolder, {
                            count: existing.count + 1,
                            totalValue: existing.totalValue + customsValue
                        });
                    }

                    if (customsOffice && customsOffice !== 'N/A' && customsOffice !== '---') {
                        const existing = customsOfficesMap.get(customsOffice) || { count: 0, totalValue: 0 };
                        customsOfficesMap.set(customsOffice, {
                            count: existing.count + 1,
                            totalValue: existing.totalValue + customsValue
                        });
                    }

                    if (declarationType && declarationType !== 'N/A' && declarationType !== '---') {
                        const existing = declarationTypesMap.get(declarationType) || { count: 0, totalValue: 0 };
                        declarationTypesMap.set(declarationType, {
                            count: existing.count + 1,
                            totalValue: existing.totalValue + customsValue
                        });
                    }

                    // HS Codes from goods - search for ccd_33_01 in goods items
                    // Use [^] instead of [\s\S] for better compatibility
                    const goodsMatches = xmlForMapping.matchAll(/<ccd_goods[^>]*>([^]*?)<\/ccd_goods>/gi);
                    for (const match of goodsMatches) {
                        const goodsContent = match[1];
                        // Try multiple field names for HS code
                        const hsCode = extractField(goodsContent, 'hsCode') ||
                            extractField(goodsContent, 'ccd_33_01') ||
                            extractField(goodsContent, 'ccd_33_01_01');

                        if (hsCode && hsCode !== 'N/A' && hsCode.trim()) {
                            const existing = hsCodesMap.get(hsCode.trim()) || { count: 0, totalValue: 0 };
                            // Try to get customs value from goods
                            const goodValue = parseFloat(
                                extractField(goodsContent, 'customsValue') ||
                                extractField(goodsContent, 'ccd_42_02') ||
                                '0'
                            );
                            hsCodesMap.set(hsCode.trim(), {
                                count: existing.count + 1,
                                totalValue: existing.totalValue + (goodValue || customsValue)
                            });
                        }
                    }
                }
            } catch {
                // Failed to parse XML, use summary data
            }
        }

        // For list60 or when XML parsing fails, use summary data
        if (activeTab === 'list60' || !doc.xmlData) {
            if (doc.summary?.customsOffice) {
                const existing = customsOfficesMap.get(doc.summary.customsOffice) || { count: 0, totalValue: 0 };
                customsOfficesMap.set(doc.summary.customsOffice, {
                    count: existing.count + 1,
                    totalValue: existing.totalValue + customsValue
                });
            }

            if (doc.summary?.declarationType) {
                const existing = declarationTypesMap.get(doc.summary.declarationType) || { count: 0, totalValue: 0 };
                declarationTypesMap.set(doc.summary.declarationType, {
                    count: existing.count + 1,
                    totalValue: existing.totalValue + customsValue
                });
            }
        }
    }

    // Convert maps to sorted arrays (top 10)
    stats.topConsignors = Array.from(consignorsMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    stats.topConsignees = Array.from(consigneesMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    stats.topContractHolders = Array.from(contractHoldersMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    stats.topHSCodes = Array.from(hsCodesMap.entries())
        .map(([code, data]) => ({ code, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    stats.topDeclarationTypes = Array.from(declarationTypesMap.entries())
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    stats.topCustomsOffices = Array.from(customsOfficesMap.entries())
        .map(([office, data]) => ({ office, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Cache the statistics
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
