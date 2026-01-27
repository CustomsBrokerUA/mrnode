import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useArchiveSorting } from '../useArchiveSorting';
import React from 'react';
import { DeclarationWithRawData } from '../../types';

describe('useArchiveSorting', () => {
    const mockDeclaration60 = (id: string, mrn: string, registered: string, status: string = 'CLEARED') => ({
        id,
        mrn,
        status,
        customsId: `customs-${id}`,
        rawData: {
            MRN: mrn,
            ccd_registered: registered,
            ccd_status: status,
            ccd_type: 'ІМ ЕЕ',
            trn_all: 'Автомобільний транспорт'
        }
    } as DeclarationWithRawData);

    const mockDeclaration61 = (id: string, mrn: string, consignor: string, invoiceValue: number) => ({
        id,
        mrn,
        status: 'CLEARED' as const,
        customsId: `customs-${id}`,
        rawData: {
            MRN: mrn,
            ccd_registered: '20250116T120000',
            ccd_status: 'R'
        },
        mappedData: {
            header: {
                mrn,
                consignor,
                consignee: 'Отримувач',
                invoiceValue,
                invoiceCurrency: 'USD'
            },
            goods: []
        },
        extractedData: {
            ccd_registered: '20250116T120000',
            ccd_01_01: '01',
            ccd_01_02: '02',
            ccd_01_03: '03'
        }
    } as any);

    describe('list60 sorting', () => {
        it('should return unsorted docs when sortColumn is null', () => {
            const docs = [
                mockDeclaration60('1', 'MRN1', '20250116T120000'),
                mockDeclaration60('2', 'MRN2', '20250115T120000')
            ];

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list60',
                sortColumn: null,
                sortDirection: 'asc'
            }));

            expect(result.current.sortedDocs).toEqual(docs);
        });

        it('should sort by mdNumber ascending', () => {
            const docs = [
                mockDeclaration60('1', '123/456/002', '20250116T120000'),
                mockDeclaration60('2', '123/456/001', '20250116T120000'),
                mockDeclaration60('3', '123/456/003', '20250116T120000')
            ];

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list60',
                sortColumn: 'mdNumber',
                sortDirection: 'asc'
            }));

            const sorted = result.current.sortedDocs;
            expect(sorted[0].mrn).toBe('123/456/001');
            expect(sorted[1].mrn).toBe('123/456/002');
            expect(sorted[2].mrn).toBe('123/456/003');
        });

        it('should sort by mdNumber descending', () => {
            const docs = [
                mockDeclaration60('1', '123/456/001', '20250116T120000'),
                mockDeclaration60('2', '123/456/003', '20250116T120000'),
                mockDeclaration60('3', '123/456/002', '20250116T120000')
            ];

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list60',
                sortColumn: 'mdNumber',
                sortDirection: 'desc'
            }));

            const sorted = result.current.sortedDocs;
            expect(sorted[0].mrn).toBe('123/456/003');
            expect(sorted[1].mrn).toBe('123/456/002');
            expect(sorted[2].mrn).toBe('123/456/001');
        });

        it('should sort by registeredDate ascending', () => {
            const docs = [
                mockDeclaration60('1', 'MRN1', '20250116T120000'),
                mockDeclaration60('2', 'MRN2', '20250114T120000'),
                mockDeclaration60('3', 'MRN3', '20250115T120000')
            ];

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list60',
                sortColumn: 'registeredDate',
                sortDirection: 'asc'
            }));

            const sorted = result.current.sortedDocs;
            expect(sorted[0].id).toBe('2');
            expect(sorted[1].id).toBe('3');
            expect(sorted[2].id).toBe('1');
        });

        it('should sort by transport', () => {
            const docs = [
                mockDeclaration60('1', 'MRN1', '20250116T120000', 'CLEARED'),
                mockDeclaration60('2', 'MRN2', '20250116T120000', 'CLEARED'),
            ];
            docs[0].rawData!.trn_all = 'Залізничний транспорт';
            docs[1].rawData!.trn_all = 'Автомобільний транспорт';

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list60',
                sortColumn: 'transport',
                sortDirection: 'asc'
            }));

            const sorted = result.current.sortedDocs;
            expect(sorted[0].rawData!.trn_all).toBe('Автомобільний транспорт');
            expect(sorted[1].rawData!.trn_all).toBe('Залізничний транспорт');
        });
    });

    describe('list61 sorting', () => {
        it('should sort by consignor ascending', () => {
            const docs = [
                mockDeclaration61('1', 'MRN1', 'Відправник Б', 1000),
                mockDeclaration61('2', 'MRN2', 'Відправник А', 2000),
                mockDeclaration61('3', 'MRN3', 'Відправник В', 1500)
            ];

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list61',
                sortColumn: 'consignor',
                sortDirection: 'asc'
            }));

            const sorted = result.current.sortedDocs;
            expect(sorted[0].mappedData.header.consignor).toBe('Відправник А');
            expect(sorted[1].mappedData.header.consignor).toBe('Відправник Б');
            expect(sorted[2].mappedData.header.consignor).toBe('Відправник В');
        });

        it('should sort by invoiceValue descending', () => {
            const docs = [
                mockDeclaration61('1', 'MRN1', 'Відправник А', 500),
                mockDeclaration61('2', 'MRN2', 'Відправник Б', 2000),
                mockDeclaration61('3', 'MRN3', 'Відправник В', 1000)
            ];

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list61',
                sortColumn: 'invoiceValue',
                sortDirection: 'desc'
            }));

            const sorted = result.current.sortedDocs;
            expect(sorted[0].mappedData.header.invoiceValue).toBe(2000);
            expect(sorted[1].mappedData.header.invoiceValue).toBe(1000);
            expect(sorted[2].mappedData.header.invoiceValue).toBe(500);
        });

        it('should sort by goodsCount', () => {
            const docs = [
                mockDeclaration61('1', 'MRN1', 'Відправник А', 1000),
                mockDeclaration61('2', 'MRN2', 'Відправник Б', 2000),
                mockDeclaration61('3', 'MRN3', 'Відправник В', 1500)
            ];
            docs[0].mappedData.goods = [{}, {}]; // 2 goods
            docs[1].mappedData.goods = [{}]; // 1 good
            docs[2].mappedData.goods = [{}, {}, {}]; // 3 goods

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list61',
                sortColumn: 'goodsCount',
                sortDirection: 'asc'
            }));

            const sorted = result.current.sortedDocs;
            expect(sorted[0].mappedData.goods.length).toBe(1);
            expect(sorted[1].mappedData.goods.length).toBe(2);
            expect(sorted[2].mappedData.goods.length).toBe(3);
        });

        it('should handle empty strings (sorted as regular strings)', () => {
            const docs = [
                mockDeclaration61('1', 'MRN1', 'Відправник А', 1000),
                mockDeclaration61('2', 'MRN2', '', 2000), // empty consignor
                mockDeclaration61('3', 'MRN3', 'Відправник Б', 1500)
            ];

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list61',
                sortColumn: 'consignor',
                sortDirection: 'asc'
            }));

            const sorted = result.current.sortedDocs;
            // Empty string sorts first in ascending order (before any non-empty string)
            expect(sorted[0].mappedData.header.consignor).toBe('');
            expect(sorted[1].mappedData.header.consignor).toBe('Відправник А');
            expect(sorted[2].mappedData.header.consignor).toBe('Відправник Б');
        });

        it('should handle numeric comparison correctly', () => {
            const docs = [
                mockDeclaration61('1', 'MRN1', 'Відправник А', 100),
                mockDeclaration61('2', 'MRN2', 'Відправник Б', 2000),
                mockDeclaration61('3', 'MRN3', 'Відправник В', 50)
            ];

            const { result } = renderHook(() => useArchiveSorting({
                filteredDocs: docs,
                activeTab: 'list61',
                sortColumn: 'invoiceValue',
                sortDirection: 'asc'
            }));

            const sorted = result.current.sortedDocs;
            expect(sorted[0].mappedData.header.invoiceValue).toBe(50);
            expect(sorted[1].mappedData.header.invoiceValue).toBe(100);
            expect(sorted[2].mappedData.header.invoiceValue).toBe(2000);
        });
    });
});
