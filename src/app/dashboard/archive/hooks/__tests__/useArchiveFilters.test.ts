import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useArchiveFilters } from '../useArchiveFilters';
import { DeclarationWithRawData } from '../../types';

describe('useArchiveFilters', () => {
    const mockDeclaration60 = (id: string, status: string = 'CLEARED', mrn: string = 'MRN1', registered: string = '20250116T120000') => ({
        id,
        mrn,
        status: status as 'CLEARED' | 'PROCESSING' | 'REJECTED',
        customsId: `customs-${id}`,
        rawData: {
            MRN: mrn,
            ccd_registered: registered,
            ccd_status: status === 'CLEARED' ? 'R' : status,
            ccd_type: 'ІМ ЕЕ',
            ccd_07_01: '12345',
            trn_all: 'Автомобільний транспорт'
        }
    } as DeclarationWithRawData);

    const mockDeclaration61 = (id: string, consignor: string, consignee: string, invoiceValue: number = 1000, currency: string = 'USD') => ({
        id,
        mrn: `MRN-${id}`,
        status: 'CLEARED' as const,
        customsId: `customs-${id}`,
        xmlData: JSON.stringify({ data61_1: 'xml content' }),
        has61_1: true,
        rawData: {
            MRN: `MRN-${id}`,
            ccd_registered: '20250116T120000',
            ccd_status: 'R'
        },
        summary: {
            senderName: consignor,
            recipientName: consignee,
            invoiceValue,
            invoiceCurrency: currency,
            customsOffice: 'Митниця 1',
            contractHolder: 'Контрагент 1',
            declarationType: '01 / 02 / 03',
            totalItems: 1,
        },
        hsCodes: [{ hsCode: '12345678' }],
        extractedData: {
            ccd_registered: '20250116T120000',
            ccd_01_01: '01',
            ccd_01_02: '02',
            ccd_01_03: '03'
        }
    } as any);

    const defaultFilters = {
        status: 'all',
        dateFrom: '',
        dateTo: '',
        customsOffice: '',
        currency: 'all',
        invoiceValueFrom: '',
        invoiceValueTo: '',
        consignor: '',
        consignee: '',
        contractHolder: '',
        hsCode: '',
        declarationType: '',
        searchTerm: ''
    };

    describe('list60 filtering', () => {
        it('should filter by status', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED'),
                mockDeclaration60('2', 'PROCESSING'),
                mockDeclaration60('3', 'CLEARED')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: docs,
                declarationsWithDetails: [],
                activeTab: 'list60',
                filters: { ...defaultFilters, status: 'CLEARED' }
            }));

            expect(result.current.filteredDocs60.length).toBe(2);
            expect(result.current.filteredDocs60.every(d => d.status === 'CLEARED')).toBe(true);
        });

        it('should filter by searchTerm (MRN)', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED', 'MRN-123'),
                mockDeclaration60('2', 'CLEARED', 'MRN-456'),
                mockDeclaration60('3', 'CLEARED', 'MRN-789')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: docs,
                declarationsWithDetails: [],
                activeTab: 'list60',
                filters: { ...defaultFilters, searchTerm: 'MRN-123' }
            }));

            expect(result.current.filteredDocs60.length).toBe(1);
            expect(result.current.filteredDocs60[0].mrn).toBe('MRN-123');
        });

        it('should filter by date range', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED', 'MRN1', '20250115T120000'),
                mockDeclaration60('2', 'CLEARED', 'MRN2', '20250116T120000'),
                mockDeclaration60('3', 'CLEARED', 'MRN3', '20250117T120000')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: docs,
                declarationsWithDetails: [],
                activeTab: 'list60',
                filters: { ...defaultFilters, dateFrom: '2025-01-16', dateTo: '2025-01-17' }
            }));

            expect(result.current.filteredDocs60.length).toBe(2);
        });
    });

    describe('list61 filtering', () => {
        it('should filter by consignor', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1'),
                mockDeclaration61('2', 'Відправник Б', 'Отримувач 2'),
                mockDeclaration61('3', 'Відправник А', 'Отримувач 3')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { ...defaultFilters, consignor: 'Відправник А' }
            }));

            expect(result.current.filteredDocs61.length).toBe(2);
            expect(result.current.filteredDocs61.every(d => 
                d.summary?.senderName === 'Відправник А'
            )).toBe(true);
        });

        it('should filter by consignee', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник 1', 'Отримувач А'),
                mockDeclaration61('2', 'Відправник 2', 'Отримувач Б'),
                mockDeclaration61('3', 'Відправник 3', 'Отримувач А')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { ...defaultFilters, consignee: 'Отримувач А' }
            }));

            expect(result.current.filteredDocs61.length).toBe(2);
        });

        it('should filter by invoice value range', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1', 500),
                mockDeclaration61('2', 'Відправник Б', 'Отримувач 2', 1500),
                mockDeclaration61('3', 'Відправник В', 'Отримувач 3', 2500)
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { ...defaultFilters, invoiceValueFrom: '1000', invoiceValueTo: '2000' }
            }));

            expect(result.current.filteredDocs61.length).toBe(1);
            expect(result.current.filteredDocs61[0].summary.invoiceValue).toBe(1500);
        });

        it('should filter by currency', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1', 1000, 'USD'),
                mockDeclaration61('2', 'Відправник Б', 'Отримувач 2', 2000, 'EUR'),
                mockDeclaration61('3', 'Відправник В', 'Отримувач 3', 1500, 'USD')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { ...defaultFilters, currency: 'USD' }
            }));

            expect(result.current.filteredDocs61.length).toBe(2);
            expect(result.current.filteredDocs61.every(d => 
                d.summary?.invoiceCurrency === 'USD'
            )).toBe(true);
        });

        it('should filter by HS code', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1', 1000),
                mockDeclaration61('2', 'Відправник Б', 'Отримувач 2', 2000)
            ];
            docs[0].hsCodes = [{ hsCode: '12345678' }];
            docs[1].hsCodes = [{ hsCode: '87654321' }];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { ...defaultFilters, hsCode: '12345678' }
            }));

            expect(result.current.filteredDocs61.length).toBe(1);
        });

        it('should filter by customs office', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1', 1000),
                mockDeclaration61('2', 'Відправник Б', 'Отримувач 2', 2000)
            ];
            docs[0].summary.customsOffice = 'Митниця 1';
            docs[1].summary.customsOffice = 'Митниця 2';

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { ...defaultFilters, customsOffice: 'Митниця 1' }
            }));

            expect(result.current.filteredDocs61.length).toBe(1);
        });

        it('should keep docs without mappedData', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1'),
                { ...mockDeclaration61('2', 'Відправник Б', 'Отримувач 2'), summary: null }
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: defaultFilters
            }));

            expect(result.current.filteredDocs61.length).toBe(2);
        });

        it('should filter by declaration type', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1', 1000),
                mockDeclaration61('2', 'Відправник Б', 'Отримувач 2', 2000)
            ];
            docs[0].summary.declarationType = '01 / 02';
            docs[1].summary.declarationType = '03 / 04';

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { ...defaultFilters, declarationType: '01 / 02' }
            }));

            expect(result.current.filteredDocs61.length).toBe(1);
        });

        it('should combine multiple filters', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1', 1000, 'USD'),
                mockDeclaration61('2', 'Відправник А', 'Отримувач 2', 2000, 'EUR'),
                mockDeclaration61('3', 'Відправник Б', 'Отримувач 3', 1000, 'USD')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { 
                    ...defaultFilters, 
                    consignor: 'Відправник А',
                    currency: 'USD'
                }
            }));

            // Should match only first doc (consignor А and USD)
            expect(result.current.filteredDocs61.length).toBe(1);
            expect(result.current.filteredDocs61[0].id).toBe('1');
        });

        it('should be case-insensitive for text filters', () => {
            const docs = [
                mockDeclaration61('1', 'Відправник А', 'Отримувач 1'),
                mockDeclaration61('2', 'Відправник Б', 'Отримувач 2')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: docs,
                activeTab: 'list61',
                filters: { ...defaultFilters, consignor: 'відправник а' } // lowercase
            }));

            expect(result.current.filteredDocs61.length).toBe(1);
        });
    });

    describe('edge cases', () => {
        it('should handle empty arrays', () => {
            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: [],
                declarationsWithDetails: [],
                activeTab: 'list60',
                filters: defaultFilters
            }));

            expect(result.current.filteredDocs60.length).toBe(0);
        });

        it('should handle empty filters', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED'),
                mockDeclaration60('2', 'PROCESSING')
            ];

            const { result } = renderHook(() => useArchiveFilters({
                declarationsWithRawData: docs,
                declarationsWithDetails: [],
                activeTab: 'list60',
                filters: defaultFilters
            }));

            // All docs should pass through with empty filters
            expect(result.current.filteredDocs60.length).toBe(2);
        });
    });
});
