'use client';

import { useMemo, useEffect } from 'react';
import { DeclarationWithRawData } from '../types';
import { getRawData } from '../utils';
import {
    generateStatisticsHash,
    getCachedStatistics,
    setCachedStatistics
} from '../utils/statistics-cache';

interface UseArchiveStatisticsProps {
    filteredDocs: DeclarationWithRawData[];
    activeTab: 'list60' | 'list61';
}

/**
 * Хук для розрахунку статистики по деклараціях.
 * 
 * **Обчислювані метрики**:
 * - Загальна кількість декларацій
 * - Загальна митна вартість
 * - Загальна фактурна вартість
 * - Загальна кількість товарів
 * - Топ-10 відправників (з кількістю та сумою)
 * - Топ-10 отримувачів (з кількістю та сумою)
 * - Топ-10 договірних контрагентів
 * - Топ-10 кодів УКТЗЕД
 * - Топ-10 типів декларацій
 * - Топ-10 митниць
 */
export function useArchiveStatistics({
    filteredDocs,
    activeTab
}: UseArchiveStatisticsProps) {
    const statistics = useMemo(() => {
        // Генеруємо hash від ID декларацій та активного табу
        const ids = filteredDocs.map(doc => doc.id);
        const hash = generateStatisticsHash(ids, activeTab);

        // Перевіряємо кеш перед розрахунком
        const cached = getCachedStatistics(hash);
        if (cached) {
            return cached;
        }
        const stats = {
            total: filteredDocs.length,
            byStatus: {
                CLEARED: 0,
                PROCESSING: 0,
                REJECTED: 0,
            } as Record<'CLEARED' | 'PROCESSING' | 'REJECTED', number>,
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

        // Maps for grouping
        const consignorsMap = new Map<string, { count: number; totalValue: number }>();
        const consigneesMap = new Map<string, { count: number; totalValue: number }>();
        const contractHoldersMap = new Map<string, { count: number; totalValue: number }>();
        const hsCodesMap = new Map<string, { count: number; totalValue: number }>();
        const declarationTypesMap = new Map<string, { count: number; totalValue: number }>();
        const customsOfficesMap = new Map<string, { count: number; totalValue: number }>();

        filteredDocs.forEach(doc => {
            // Count by status
            if (doc.status && doc.status in stats.byStatus) {
                stats.byStatus[doc.status as 'CLEARED' | 'PROCESSING' | 'REJECTED'] += 1;
            }

            // Calculate customs value, invoice value, and total items
            let customsValue = 0;
            let invoiceValueUah = 0;
            let totalItems = 0;

            // Try to get from summary first
            if (doc.summary) {
                customsValue = doc.summary.customsValue || 0;
                invoiceValueUah = doc.summary.invoiceValueUah || 0;
                totalItems = doc.summary.totalItems || 0;
            }

            // Fallback to mappedData if summary is not available or has zero values
            if ((!doc.summary || customsValue === 0 || invoiceValueUah === 0 || totalItems === 0) && 'mappedData' in doc && doc.mappedData) {
                const mappedData = doc.mappedData as any;

                // Calculate total customs value from goods
                if (customsValue === 0 && mappedData.goods && Array.isArray(mappedData.goods)) {
                    customsValue = mappedData.goods.reduce((sum: number, good: any) => {
                        return sum + (good?.customsValue || 0);
                    }, 0);
                    // If goods don't have customsValue, try header.totalValue
                    if (customsValue === 0 && mappedData.header?.totalValue) {
                        customsValue = mappedData.header.totalValue;
                    }
                } else if (customsValue === 0 && mappedData.header?.totalValue) {
                    customsValue = mappedData.header.totalValue;
                }

                // Calculate total invoice value in UAH
                // IMPORTANT: for non-UAH invoice currency, some datasets fill ccd_42_02/ccd_22_03 with invoice-currency amounts.
                // In that case we must compute UAH via exchange rate and not trust invoiceValueUah fields.
                if (invoiceValueUah === 0) {
                    const invCur = String(mappedData.header?.invoiceCurrency || '').trim().toUpperCase();
                    const inv = Number(mappedData.header?.invoiceValue || 0) || 0;
                    const rate = Number(mappedData.header?.exchangeRate || 0) || 0;

                    if (invCur && invCur !== 'UAH' && invCur !== '980') {
                        if (inv > 0 && rate > 0) {
                            invoiceValueUah = inv * rate;
                        } else if (rate > 0 && mappedData.goods && Array.isArray(mappedData.goods)) {
                            const goodsComputed = mappedData.goods.reduce((sum: number, good: any) => {
                                const price = Number(good?.price || 0) || 0;
                                return sum + price * rate;
                            }, 0);
                            if (goodsComputed > 0) invoiceValueUah = goodsComputed;
                        }

                        if (invoiceValueUah === 0 && mappedData.goods && Array.isArray(mappedData.goods)) {
                            // Last resort: keep whatever is in invoiceValueUah fields (may be incorrect units)
                            invoiceValueUah = mappedData.goods.reduce((sum: number, good: any) => {
                                const v = Number(good?.invoiceValueUah || 0) || 0;
                                return sum + v;
                            }, 0);
                        }
                    } else {
                        // invoice currency is UAH: we can trust invoiceValueUah fields
                        if (mappedData.goods && Array.isArray(mappedData.goods)) {
                            invoiceValueUah = mappedData.goods.reduce((sum: number, good: any) => {
                                const v = Number(good?.invoiceValueUah || 0) || 0;
                                return sum + v;
                            }, 0);
                        }

                        if (invoiceValueUah === 0 && mappedData.header?.invoiceValueUah) {
                            invoiceValueUah = Number(mappedData.header.invoiceValueUah || 0) || 0;
                        }
                        if (invoiceValueUah === 0 && inv > 0 && rate > 0) {
                            invoiceValueUah = inv * rate;
                        }
                    }
                }

                // Calculate total items
                if (totalItems === 0) {
                    if (mappedData.header?.totalItems) {
                        totalItems = mappedData.header.totalItems;
                    } else if (mappedData.goods && Array.isArray(mappedData.goods)) {
                        totalItems = mappedData.goods.length;
                    }
                }
            }

            // Fallback for list60: parse XML directly if summary and mappedData are not available
            if ((!doc.summary || customsValue === 0 || invoiceValueUah === 0 || totalItems === 0) &&
                activeTab === 'list60' &&
                (!('mappedData' in doc) || !doc.mappedData) &&
                doc.xmlData) {
                try {
                    const trimmed = doc.xmlData.trim();
                    if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
                        // Parse XML for list60 (60.1 format)
                        const extractXmlField = (xml: string, fieldName: string): string | undefined => {
                            const regex = new RegExp(`<${fieldName}>([^]*)</${fieldName}>`, 'i');
                            const match = xml.match(regex);
                            return match ? match[1].trim() : undefined;
                        };

                        // Extract ccd_12_01 (total customs value)
                        if (customsValue === 0) {
                            const ccd12_01 = extractXmlField(trimmed, 'ccd_12_01');
                            if (ccd12_01) {
                                const parsed = parseFloat(ccd12_01.replace(',', '.'));
                                if (!isNaN(parsed)) {
                                    customsValue = parsed;
                                }
                            }
                        }

                        // Extract ccd_42_02 (invoice value in UAH) from goods
                        if (invoiceValueUah === 0) {
                            const goodsMatches = trimmed.matchAll(/<ccd_goods[^>]*>([^]*)<\/ccd_goods>/gi);
                            let totalInvoiceUah = 0;
                            for (const match of goodsMatches) {
                                const goodsContent = match[1];
                                const ccd42_02 = extractXmlField(goodsContent, 'ccd_42_02');
                                if (ccd42_02) {
                                    const parsed = parseFloat(ccd42_02.replace(',', '.'));
                                    if (!isNaN(parsed)) {
                                        totalInvoiceUah += parsed;
                                    }
                                }
                            }
                            if (totalInvoiceUah > 0) {
                                invoiceValueUah = totalInvoiceUah;
                            }
                        }

                        // Count goods items
                        if (totalItems === 0) {
                            const goodsMatches = trimmed.matchAll(/<ccd_goods[^>]*>([^]*)<\/ccd_goods>/gi);
                            let count = 0;
                            for (const _ of goodsMatches) {
                                count++;
                            }
                            if (count > 0) {
                                totalItems = count;
                            }
                        }
                    }
                } catch {
                    // Failed to parse XML
                }
            }

            // Sum values
            stats.totalCustomsValue += customsValue;
            stats.totalInvoiceValue += invoiceValueUah;
            stats.totalItems += totalItems;

            // Get customs value for grouping (used in both tabs)
            const customsValueForGrouping = customsValue;

            // Group by entities for list61 using DB-backed summary + hsCodes
            if (activeTab === 'list61' && doc.summary) {
                const summary = doc.summary;

                // Group by consignor
                if (summary.senderName) {
                    const name = summary.senderName;
                    const existing = consignorsMap.get(name) || { count: 0, totalValue: 0 };
                    consignorsMap.set(name, {
                        count: existing.count + 1,
                        totalValue: existing.totalValue + customsValueForGrouping
                    });
                }

                // Group by consignee
                if (summary.recipientName) {
                    const name = summary.recipientName;
                    const existing = consigneesMap.get(name) || { count: 0, totalValue: 0 };
                    consigneesMap.set(name, {
                        count: existing.count + 1,
                        totalValue: existing.totalValue + customsValueForGrouping
                    });
                }

                // Group by contract holder
                if (summary.contractHolder) {
                    const name = summary.contractHolder;
                    const existing = contractHoldersMap.get(name) || { count: 0, totalValue: 0 };
                    contractHoldersMap.set(name, {
                        count: existing.count + 1,
                        totalValue: existing.totalValue + customsValueForGrouping
                    });
                }

                // Group by HS codes (from denormalized relation)
                const hsCodes: string[] = Array.isArray((doc as any).hsCodes)
                    ? Array.from(
                        new Set(
                            (doc as any).hsCodes
                                .map((h: any) => String(h?.hsCode || '').trim())
                                .filter(Boolean)
                        )
                    )
                    : [];
                const perHsValue = hsCodes.length > 0 ? customsValueForGrouping / hsCodes.length : 0;
                hsCodes.forEach(code => {
                    const existing = hsCodesMap.get(code) || { count: 0, totalValue: 0 };
                    hsCodesMap.set(code, {
                        count: existing.count + 1,
                        totalValue: existing.totalValue + perHsValue
                    });
                });

                // Group by declaration type
                if (summary.declarationType) {
                    let type = summary.declarationType.trim()
                        .replace(/\s*\/\s*/g, ' / ')
                        .replace(/\s+/g, ' ');
                    if (type && type !== '---' && type !== 'N/A') {
                        const existing = declarationTypesMap.get(type) || { count: 0, totalValue: 0 };
                        declarationTypesMap.set(type, {
                            count: existing.count + 1,
                            totalValue: existing.totalValue + customsValueForGrouping
                        });
                    }
                }

                // Group by customs office
                if (summary.customsOffice) {
                    const office = summary.customsOffice.trim().replace(/\s+/g, ' ');
                    if (office && office !== '---' && office !== 'N/A') {
                        const existing = customsOfficesMap.get(office) || { count: 0, totalValue: 0 };
                        customsOfficesMap.set(office, {
                            count: existing.count + 1,
                            totalValue: existing.totalValue + customsValueForGrouping
                        });
                    }
                }
            }

            // For list60, group by customs office and declaration type from rawData
            // Only if this declaration doesn't have mappedData (to avoid duplicates)
            if (activeTab === 'list60' && !('mappedData' in doc && doc.mappedData)) {
                // Group by customs office from rawData
                const rawDataOffice = getRawData(doc)?.ccd_07_01;
                if (rawDataOffice) {
                    const office = rawDataOffice.trim().replace(/\s+/g, ' ');
                    if (office && office !== '---' && office !== 'N/A') {
                        const existing = customsOfficesMap.get(office) || { count: 0, totalValue: 0 };
                        customsOfficesMap.set(office, {
                            count: existing.count + 1,
                            totalValue: existing.totalValue + customsValueForGrouping
                        });
                    }
                }

                // Group by declaration type from rawData
                // Normalize format to match list61 format (with slashes)
                const type = getRawData(doc)?.ccd_type?.trim() ||
                    [getRawData(doc)?.ccd_01_01, getRawData(doc)?.ccd_01_02, getRawData(doc)?.ccd_01_03]
                        .filter(Boolean)
                        .join(' / ')
                        .trim()
                        .replace(/\s+/g, ' ');
                if (type && type !== '---' && type !== 'N/A') {
                    const existing = declarationTypesMap.get(type) || { count: 0, totalValue: 0 };
                    declarationTypesMap.set(type, {
                        count: existing.count + 1,
                        totalValue: existing.totalValue + customsValueForGrouping
                    });
                }
            }

        });

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

        // Зберігаємо в кеш перед поверненням
        setCachedStatistics(hash, stats, filteredDocs.length);

        return stats;
    }, [filteredDocs, activeTab]);

    return statistics;
}
