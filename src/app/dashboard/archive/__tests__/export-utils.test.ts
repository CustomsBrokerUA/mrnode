import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToExcel } from '../export-utils';

// Mock XLSX
vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return {
    ...actual,
    utils: {
      ...actual.utils,
      book_new: vi.fn(() => ({})),
      aoa_to_sheet: vi.fn(() => ({})),
      book_append_sheet: vi.fn(),
    },
    writeFile: vi.fn(),
  };
});

// Mock alert
global.alert = vi.fn();

describe('Export Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

    describe('exportToExcel', () => {
        it('should show alert if no data to export', async () => {
            await exportToExcel([], 'list60');
            // Check that alert was called (text might be encoded)
            expect(global.alert).toHaveBeenCalled();
        });

    it('should create workbook for list60', async () => {
      const mockDocs = [
        {
          id: '1',
          mrn: 'MRN123',
          status: 'CLEARED',
          customsId: 'customs1',
          rawData: {
            MRN: 'MRN123',
            ccd_registered: '20250116T120000',
            ccd_status: 'R',
            ccd_type: 'ІМ ЕЕ',
            trn_all: 'Транспорт',
            guid: 'guid123',
          },
        },
      ];

      await exportToExcel(mockDocs as any, 'list60');

      const XLSX = await import('xlsx');
      expect(XLSX.utils.book_new).toHaveBeenCalled();
      expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled();
      expect(XLSX.utils.book_append_sheet).toHaveBeenCalled();
      expect(XLSX.writeFile).toHaveBeenCalled();
    });

    it('should create workbook for list61', async () => {
      const mockDocs = [
        {
          id: '1',
          mrn: 'MRN123',
          status: 'CLEARED',
          customsId: 'customs1',
          rawData: {
            MRN: 'MRN123',
            ccd_registered: '20250116T120000',
            ccd_status: 'R',
          },
          mappedData: {
            header: {
              consignor: 'Відправник',
              consignee: 'Отримувач',
              invoiceValue: 1000,
              invoiceCurrency: 'USD',
              customsOffice: 'Митниця',
              declarantName: 'Декларант',
            },
            goods: [{}, {}],
          },
          extractedData: {
            ccd_registered: '20250116T120000',
            ccd_01_01: '01',
            ccd_01_02: '02',
            ccd_01_03: '03',
          },
        },
      ];

      await exportToExcel(mockDocs as any, 'list61');

      const XLSX = await import('xlsx');
      expect(XLSX.utils.book_new).toHaveBeenCalled();
      expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled();
      expect(XLSX.utils.book_append_sheet).toHaveBeenCalled();
      expect(XLSX.writeFile).toHaveBeenCalled();
    });

        it('should handle errors gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const mockDocs = [{}];

            // Mock XLSX to throw error
            const XLSX = await import('xlsx');
            vi.mocked(XLSX.utils.book_new).mockImplementationOnce(() => {
                throw new Error('Test error');
            });

            await exportToExcel(mockDocs as any, 'list60');

            expect(consoleErrorSpy).toHaveBeenCalled();
            // Check that alert was called (text might be encoded)
            expect(global.alert).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
  });
});
