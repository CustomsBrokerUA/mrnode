'use client';

import { useMemo } from 'react';
import { DeclarationWithRawData } from '../types';
import { getRawData, getMDNumber } from '../utils';
import { filterDeclarations60, FilterOptions } from '../filter-utils';

interface FilterState extends FilterOptions {
    status: string;
    dateFrom: string;
    dateTo: string;
    customsOffice: string;
    currency: string;
    invoiceValueFrom: string;
    invoiceValueTo: string;
    consignor: string;
    consignee: string;
    contractHolder: string;
    hsCode: string;
    declarationType: string;
    searchTerm: string;
}

interface UseArchiveFiltersProps {
    declarationsWithRawData: DeclarationWithRawData[];
    declarationsWithDetails: any[];
    activeTab: 'list60' | 'list61';
    filters: FilterState;
}

/**
 * Хук для фільтрації декларацій.
 * 
 * Підтримує фільтрацію як для списку 60.1 (короткий формат), так і для списку 61.1 (детальний формат).
 * 
 * **Для list60:**
 * - Використовує функцію `filterDeclarations60` з `filter-utils.ts`
 * - Фільтри: статус, діапазон дат, митниця, тип декларації, пошуковий термін
 * 
 * **Для list61:**
 * - Розширена логіка фільтрації з урахуванням `mappedData`
 * - Додаткові фільтри: відправник, отримувач, договірний контрагент, валюта,
 *   діапазон фактурної вартості, код УКТЗЕД, митниця
 * - Автоматично виключає документи без `mappedData` або з невалідним `xmlData`
 * 
 * **Особливості:**
 * - Фільтри застосовуються послідовно (AND логіка)
 * - Текстові фільтри регістронезалежні та підтримують частковий пошук
 * - Числові фільтри підтримують діапазони (від/до)
 * - Автоматична перевірка валідності даних перед фільтрацією
 * 
 * @param declarationsWithRawData - Декларації з rawData для list60
 * @param declarationsWithDetails - Декларації з mappedData для list61
 * @param activeTab - Активна вкладка ('list60' | 'list61')
 * @param filters - Об'єкт з параметрами фільтрації
 * @returns Об'єкт з відфільтрованими даними:
 *   - filteredDocs: відфільтровані декларації для активного табу
 *   - filteredDocs60: відфільтровані декларації для list60
 *   - filteredDocs61: відфільтровані декларації для list61
 * 
 * @example
 * ```ts
 * const { filteredDocs } = useArchiveFilters({
 *   declarationsWithRawData: docs60,
 *   declarationsWithDetails: docs61,
 *   activeTab: 'list60',
 *   filters: {
 *     status: 'CLEARED',
 *     dateFrom: '2025-01-01',
 *     searchTerm: 'MRN123'
 *   }
 * });
 * ```
 */
export function useArchiveFilters({
    declarationsWithRawData,
    declarationsWithDetails,
    activeTab,
    filters
}: UseArchiveFiltersProps) {
    
    // Filter for list60 (using existing utility function)
    const filteredDocs60 = useMemo(() => {
        const filterOptions: FilterOptions = {
            status: filters.status,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
            customsOffice: filters.customsOffice || undefined,
            declarationType: filters.declarationType || undefined,
            searchTerm: filters.searchTerm || undefined,
        };
        
        return filterDeclarations60(declarationsWithRawData, filterOptions);
    }, [declarationsWithRawData, filters.status, filters.dateFrom, filters.dateTo, filters.customsOffice, filters.declarationType, filters.searchTerm]);

    // Filter for list61 (extended logic with mappedData)
    const filteredDocs61 = useMemo(() => {
        let filtered = declarationsWithDetails.filter(doc => {
            // For list61 we keep declarations even if 61.1 details are not ready yet.
            return true;
        });
        
        // Status filter
        if (filters.status !== 'all') {
            if (filters.status === 'cleared') {
                filtered = filtered.filter(doc => {
                    return getRawData(doc)?.ccd_status === 'R';
                });
            } else {
                filtered = filtered.filter(doc => doc.status === filters.status);
            }
        }
        
        // Date range filter
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(doc => {
                const extractedData = (doc as any).extractedData;
                const registeredDate = extractedData?.ccd_registered || getRawData(doc)?.ccd_registered || '';
                if (!registeredDate) return false;
                const docDate = new Date(registeredDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
                return docDate >= fromDate;
            });
        }
        
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(doc => {
                const extractedData = (doc as any).extractedData;
                const registeredDate = extractedData?.ccd_registered || getRawData(doc)?.ccd_registered || '';
                if (!registeredDate) return false;
                const docDate = new Date(registeredDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
                return docDate <= toDate;
            });
        }
        
        // Customs office filter
        if (filters.customsOffice) {
            filtered = filtered.filter(doc => {
                const office = doc.summary?.customsOffice || '';
                return office.toLowerCase().includes(filters.customsOffice.toLowerCase());
            });
        }
        
        // Currency filter
        if (filters.currency !== 'all') {
            filtered = filtered.filter(doc => {
                return doc.summary?.invoiceCurrency === filters.currency;
            });
        }
        
        // Invoice value range filter
        if (filters.invoiceValueFrom) {
            const fromValue = parseFloat(filters.invoiceValueFrom);
            if (!isNaN(fromValue)) {
                filtered = filtered.filter(doc => {
                    const value = doc.summary?.invoiceValue || 0;
                    return value >= fromValue;
                });
            }
        }
        
        if (filters.invoiceValueTo) {
            const toValue = parseFloat(filters.invoiceValueTo);
            if (!isNaN(toValue)) {
                filtered = filtered.filter(doc => {
                    const value = doc.summary?.invoiceValue || 0;
                    return value <= toValue;
                });
            }
        }
        
        // Consignor filter
        if (filters.consignor) {
            const searchTerms = String(filters.consignor).split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
            filtered = filtered.filter(doc => {
                const consignor = (doc.summary?.senderName || '').toLowerCase();
                return searchTerms.some(term => consignor.includes(term));
            });
        }
        
        // Consignee filter
        if (filters.consignee) {
            const searchTerms = String(filters.consignee).split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
            filtered = filtered.filter(doc => {
                const consignee = (doc.summary?.recipientName || '').toLowerCase();
                return searchTerms.some(term => consignee.includes(term));
            });
        }
        
        // Contract holder filter
        if (filters.contractHolder) {
            const searchTerms = String(filters.contractHolder).split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
            filtered = filtered.filter(doc => {
                const contractHolder = (doc.summary?.contractHolder || '').toLowerCase();
                return searchTerms.some(term => contractHolder.includes(term));
            });
        }
        
        // HS Code filter
        if (filters.hsCode) {
            const searchTerms = String(filters.hsCode).split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
            filtered = filtered.filter(doc => {
                const codes: string[] = Array.isArray((doc as any).hsCodes)
                    ? (doc as any).hsCodes.map((h: any) => String(h?.hsCode || '').toLowerCase()).filter(Boolean)
                    : [];
                if (codes.length === 0) return false;
                return searchTerms.some(term => codes.some(code => code.includes(term)));
            });
        }
        
        // Declaration type filter
        if (filters.declarationType) {
            const searchTerms = String(filters.declarationType).split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
            filtered = filtered.filter(doc => {
                const declarationType = (doc.summary?.declarationType || '').toLowerCase();
                return searchTerms.some(term => declarationType.includes(term));
            });
        }
        
        // Search filter
        if (filters.searchTerm) {
            const search = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(doc => {
                const mdNumber = getMDNumber(getRawData(doc), doc.mrn);
                const consignor = doc.summary?.senderName || '';
                const consignee = doc.summary?.recipientName || '';
                const invoiceValue = doc.summary?.invoiceValue?.toString() || '';
                const invoiceCurrency = doc.summary?.invoiceCurrency || '';
                const goodsCount = doc.summary?.totalItems?.toString() || '';
                
                return (
                    doc.mrn?.toLowerCase().includes(search) ||
                    doc.customsId?.toLowerCase().includes(search) ||
                    mdNumber.toLowerCase().includes(search) ||
                    consignor.toLowerCase().includes(search) ||
                    consignee.toLowerCase().includes(search) ||
                    invoiceValue.includes(search) ||
                    invoiceCurrency.toLowerCase().includes(search) ||
                    goodsCount.includes(search) ||
                    getRawData(doc)?.ccd_type?.toLowerCase().includes(search) ||
                    String(getRawData(doc)?.trn_all || '').toLowerCase().includes(search)
                );
            });
        }
        
        return filtered;
    }, [
        declarationsWithDetails,
        filters.status,
        filters.dateFrom,
        filters.dateTo,
        filters.customsOffice,
        filters.currency,
        filters.invoiceValueFrom,
        filters.invoiceValueTo,
        filters.consignor,
        filters.consignee,
        filters.contractHolder,
        filters.hsCode,
        filters.declarationType,
        filters.searchTerm
    ]);

    // Return appropriate filtered list based on active tab
    const filteredDocs = activeTab === 'list60' ? filteredDocs60 : filteredDocs61;

    return {
        filteredDocs,
        filteredDocs60,
        filteredDocs61
    };
}
