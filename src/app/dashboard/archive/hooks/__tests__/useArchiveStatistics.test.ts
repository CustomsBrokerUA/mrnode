import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useArchiveStatistics } from '../useArchiveStatistics';
import { DeclarationWithRawData } from '../../types';
import { clearStatisticsCache } from '../../utils/statistics-cache';

describe('useArchiveStatistics', () => {
    // Important: useArchiveStatistics memoizes results via a shared module cache.
    // Clear between tests so repeated IDs don't cause cross-test pollution.
    beforeEach(() => {
        clearStatisticsCache();
    });

    const mockDeclaration60 = (id: string, status: string = 'CLEARED', summary?: any) => ({
        id,
        mrn: `MRN-${id}`,
        status: status as 'CLEARED' | 'PROCESSING' | 'REJECTED',
        customsId: `customs-${id}`,
        rawData: {
            MRN: `MRN-${id}`,
            ccd_registered: '20250116T120000',
            ccd_status: status === 'CLEARED' ? 'R' : status,
            ccd_type: 'ІМ ЕЕ'
        },
        summary
    } as DeclarationWithRawData);

    const mockDeclaration61 = (id: string, status: string, consignor: string, consignee: string, customsValue: number, hsCodes?: string[], customsOffice: string = 'Митниця 1') => ({
        id,
        mrn: `MRN-${id}`,
        status: status as 'CLEARED' | 'PROCESSING' | 'REJECTED',
        customsId: `customs-${id}`,
        rawData: {
            MRN: `MRN-${id}`,
            ccd_registered: '20250116T120000',
            ccd_status: status === 'CLEARED' ? 'R' : status
        },
        summary: {
            customsValue,
            invoiceValueUah: customsValue * 36.5,
            totalItems: 2,
            senderName: consignor,
            recipientName: consignee,
            customsOffice,
            declarationType: 'ІМ / 40 / ЕЕ',
        },
        hsCodes: (hsCodes || ['12345678', '87654321']).map(hsCode => ({ hsCode })),
    } as any);

    describe('basic statistics', () => {
        it('should count total declarations', () => {
            const docs = [
                mockDeclaration60('1'),
                mockDeclaration60('2'),
                mockDeclaration60('3')
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list60'
            }));

            expect(result.current.total).toBe(3);
        });

        it('should count by status', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED'),
                mockDeclaration60('2', 'CLEARED'),
                mockDeclaration60('3', 'PROCESSING'),
                mockDeclaration60('4', 'REJECTED'),
                mockDeclaration60('5', 'PROCESSING')
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list60'
            }));

            expect(result.current.byStatus.CLEARED).toBe(2);
            expect(result.current.byStatus.PROCESSING).toBe(2);
            expect(result.current.byStatus.REJECTED).toBe(1);
        });
    });

    describe('summary values', () => {
        it('should sum customs value from summary', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED', { customsValue: 1000 }),
                mockDeclaration60('2', 'CLEARED', { customsValue: 2000 }),
                mockDeclaration60('3', 'CLEARED', { customsValue: 1500 })
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list60'
            }));

            expect(result.current.totalCustomsValue).toBe(4500);
        });

        it('should sum invoice value from summary', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED', { invoiceValueUah: 36500 }),
                mockDeclaration60('2', 'CLEARED', { invoiceValueUah: 73000 }),
                mockDeclaration60('3', 'CLEARED', { invoiceValueUah: 54750 })
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list60'
            }));

            expect(result.current.totalInvoiceValue).toBe(164250);
        });

        it('should sum total items from summary', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED', { totalItems: 5 }),
                mockDeclaration60('2', 'CLEARED', { totalItems: 3 }),
                mockDeclaration60('3', 'CLEARED', { totalItems: 7 })
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list60'
            }));

            expect(result.current.totalItems).toBe(15);
        });

        it('should handle missing summary gracefully', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED', { customsValue: 1000 }),
                mockDeclaration60('2', 'CLEARED'), // no summary
                mockDeclaration60('3', 'CLEARED', { customsValue: 500 })
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list60'
            }));

            expect(result.current.totalCustomsValue).toBe(1500);
        });
    });

    describe('list61 top lists', () => {
        it('should calculate top consignors', () => {
            const docs = [
                mockDeclaration61('1', 'CLEARED', 'Відправник А', 'Отримувач 1', 1000),
                mockDeclaration61('2', 'CLEARED', 'Відправник А', 'Отримувач 2', 2000),
                mockDeclaration61('3', 'CLEARED', 'Відправник Б', 'Отримувач 3', 1500),
                mockDeclaration61('4', 'CLEARED', 'Відправник А', 'Отримувач 4', 500)
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list61'
            }));

            const topConsignors = result.current.topConsignors;
            expect(topConsignors.length).toBeGreaterThan(0);
            
            const consignorA = topConsignors.find((c: { name: string; count: number; totalValue: number }) => c.name === 'Відправник А');
            expect(consignorA).toBeDefined();
            expect(consignorA?.count).toBe(3);
            expect(consignorA?.totalValue).toBe(3500); // 1000 + 2000 + 500
        });

        it('should calculate top consignees', () => {
            const docs = [
                mockDeclaration61('1', 'CLEARED', 'Відправник 1', 'Отримувач А', 1000),
                mockDeclaration61('2', 'CLEARED', 'Відправник 2', 'Отримувач А', 2000),
                mockDeclaration61('3', 'CLEARED', 'Відправник 3', 'Отримувач Б', 1500)
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list61'
            }));

            const topConsignees = result.current.topConsignees;
            const consigneeA = topConsignees.find((c: { name: string; count: number; totalValue: number }) => c.name === 'Отримувач А');
            expect(consigneeA).toBeDefined();
            expect(consigneeA?.count).toBe(2);
        });

        it('should calculate top HSCodes', () => {
            const docs = [
                mockDeclaration61('1', 'CLEARED', 'Відправник А', 'Отримувач 1', 1000, ['12345678', '87654321']),
                mockDeclaration61('2', 'CLEARED', 'Відправник Б', 'Отримувач 2', 2000, ['12345678', '11111111'])
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list61'
            }));

            const topHSCodes = result.current.topHSCodes;
            const code12345678 = topHSCodes.find((c: { code: string; count: number; totalValue: number }) => c.code === '12345678');
            expect(code12345678).toBeDefined();
            expect(code12345678?.count).toBe(2);
            expect(code12345678?.totalValue).toBe(1500); // (1000/2) + (2000/2)
        });

        it('should calculate top customs offices', () => {
            const docs = [
                mockDeclaration61('1', 'CLEARED', 'Відправник А', 'Отримувач 1', 1000, ['12345678'], 'Митниця 1'),
                mockDeclaration61('2', 'CLEARED', 'Відправник Б', 'Отримувач 2', 2000, ['87654321'], 'Митниця 1'),
                mockDeclaration61('3', 'CLEARED', 'Відправник В', 'Отримувач 3', 1500, ['11111111'], 'Митниця 2')
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list61'
            }));

            const topCustomsOffices = result.current.topCustomsOffices;
            const office1 = topCustomsOffices.find((o: { office: string; count: number; totalValue: number }) => o.office === 'Митниця 1');
            expect(office1).toBeDefined();
            expect(office1?.count).toBe(2);
        });

        it('should limit top lists to 10 items', () => {
            const docs = Array.from({ length: 15 }, (_, i) => 
                mockDeclaration61(
                    String(i + 1), 
                    'CLEARED', 
                    `Відправник ${i + 1}`, 
                    'Отримувач',
                    1000
                )
            );

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list61'
            }));

            expect(result.current.topConsignors.length).toBeLessThanOrEqual(10);
            expect(result.current.topConsignees.length).toBeLessThanOrEqual(10);
        });
    });

    describe('empty data handling', () => {
        it('should handle empty docs array', () => {
            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: [],
                activeTab: 'list60'
            }));

            expect(result.current.total).toBe(0);
            expect(result.current.byStatus.CLEARED).toBe(0);
            expect(result.current.totalCustomsValue).toBe(0);
            expect(result.current.topConsignors.length).toBe(0);
        });

        it('should handle docs without mappedData for list61', () => {
            const docs = [
                mockDeclaration60('1', 'CLEARED', { customsValue: 1000 })
            ];

            const { result } = renderHook(() => useArchiveStatistics({
                filteredDocs: docs,
                activeTab: 'list61'
            }));

            // Should not throw and should return valid statistics
            expect(result.current.total).toBe(1);
            expect(result.current.totalCustomsValue).toBe(1000);
        });
    });
});
