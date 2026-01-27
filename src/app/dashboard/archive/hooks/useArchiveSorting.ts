'use client';

import { useMemo } from 'react';
import { DeclarationWithRawData } from '../types';
import { getRawData, getMDNumber } from '../utils';

interface UseArchiveSortingProps {
    filteredDocs: DeclarationWithRawData[];
    activeTab: 'list60' | 'list61';
    sortColumn: string | null;
    sortDirection: 'asc' | 'desc';
}

/**
 * Хук для сортування декларацій.
 * 
 * **Підтримувані колонки для сортування**:
 * - `mdNumber`: Номер МД (рядкове порівняння)
 * - `registeredDate`: Дата реєстрації (порівняння дат)
 * - `status`: Статус (рядкове порівняння)
 * - `type`: Тип декларації (рядкове порівняння)
 * - `consignor`, `consignee`: Назви (рядкове порівняння, тільки list61)
 * - `invoiceValue`: Фактурна вартість (числове порівняння, тільки list61)
 * - `goodsCount`: Кількість товарів (числове порівняння, тільки list61)
 * - `transport`: Транспорт (рядкове порівняння, тільки list60)
 * 
 * **Особливості**:
 * - Підтримує напрямок сортування (asc/desc)
 * - Для list60: використовує rawData
 * - Для list61: використовує mappedData та extractedData
 * - Обробляє відсутні значення (сортує в кінець)
 * - Числові значення порівнюються як числа
 * - Рядкові значення порівнюються як рядки (case-insensitive)
 */
export function useArchiveSorting({
    filteredDocs,
    activeTab,
    sortColumn,
    sortDirection
}: UseArchiveSortingProps) {
    
    const sortedDocs = useMemo(() => {
        if (!sortColumn) return filteredDocs;
        
        return [...filteredDocs].sort((a, b) => {
            let aValue: any;
            let bValue: any;
            
            if (activeTab === 'list61' && 'mappedData' in a && 'mappedData' in b) {
                const mappedA = (a as any).mappedData;
                const mappedB = (b as any).mappedData;
                const extractedA = (a as any).extractedData;
                const extractedB = (b as any).extractedData;
                
                switch (sortColumn) {
                    case 'mdNumber':
                        aValue = getMDNumber(getRawData(a), a.mrn);
                        bValue = getMDNumber(getRawData(b), b.mrn);
                        break;
                    case 'registeredDate':
                        aValue = extractedA?.ccd_registered || getRawData(a)?.ccd_registered || '';
                        bValue = extractedB?.ccd_registered || getRawData(b)?.ccd_registered || '';
                        break;
                    case 'status':
                        aValue = getRawData(a)?.ccd_status || a.status;
                        bValue = getRawData(b)?.ccd_status || b.status;
                        break;
                    case 'type':
                        aValue = extractedA 
                            ? [extractedA.ccd_01_01, extractedA.ccd_01_02, extractedA.ccd_01_03].filter(Boolean).join(' ')
                            : (getRawData(a)?.ccd_type || '');
                        bValue = extractedB
                            ? [extractedB.ccd_01_01, extractedB.ccd_01_02, extractedB.ccd_01_03].filter(Boolean).join(' ')
                            : (getRawData(b)?.ccd_type || '');
                        break;
                    case 'consignor':
                        aValue = mappedA?.header?.consignor || '';
                        bValue = mappedB?.header?.consignor || '';
                        break;
                    case 'consignee':
                        aValue = mappedA?.header?.consignee || '';
                        bValue = mappedB?.header?.consignee || '';
                        break;
                    case 'invoiceValue':
                        aValue = mappedA?.header?.invoiceValue || 0;
                        bValue = mappedB?.header?.invoiceValue || 0;
                        break;
                    case 'goodsCount':
                        aValue = mappedA?.header?.totalItems || 0;
                        bValue = mappedB?.header?.totalItems || 0;
                        break;
                    default:
                        return 0;
                }
            } else {
                // For list60
                switch (sortColumn) {
                    case 'mdNumber':
                        aValue = getMDNumber(getRawData(a), a.mrn);
                        bValue = getMDNumber(getRawData(b), b.mrn);
                        break;
                    case 'registeredDate':
                        aValue = getRawData(a)?.ccd_registered || '';
                        bValue = getRawData(b)?.ccd_registered || '';
                        break;
                    case 'status':
                        aValue = getRawData(a)?.ccd_status || a.status;
                        bValue = getRawData(b)?.ccd_status || b.status;
                        break;
                    case 'type':
                        aValue = getRawData(a)?.ccd_type || '';
                        bValue = getRawData(b)?.ccd_type || '';
                        break;
                    case 'transport':
                        const trn_a = getRawData(a)?.trn_all;
                        const trn_b = getRawData(b)?.trn_all;
                        aValue = !trn_a 
                            ? ''
                            : typeof trn_a === 'string' 
                                ? trn_a.trim()
                                : Array.isArray(trn_a)
                                    ? trn_a.filter(Boolean).join(', ')
                                    : String(trn_a);
                        bValue = !trn_b 
                            ? ''
                            : typeof trn_b === 'string' 
                                ? trn_b.trim()
                                : Array.isArray(trn_b)
                                    ? trn_b.filter(Boolean).join(', ')
                                    : String(trn_b);
                        break;
                    default:
                        return 0;
                }
            }
            
            // Compare values
            if (aValue === bValue) return 0;
            
            // Handle null/undefined values - sort to end
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;
            
            // Handle numeric values
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            
            // Handle string values (case-insensitive)
            const aStr = String(aValue || '').toLowerCase();
            const bStr = String(bValue || '').toLowerCase();
            
            if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
            if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredDocs, sortColumn, sortDirection, activeTab]);

    return { sortedDocs };
}
