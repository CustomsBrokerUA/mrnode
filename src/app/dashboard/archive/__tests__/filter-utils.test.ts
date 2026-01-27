import { describe, it, expect } from 'vitest';
import { filterDeclarations60, FilterOptions } from '../filter-utils';
import { DeclarationWithRawData } from '../types';

describe('Filter Utils', () => {
  const createMockDeclaration = (overrides: Partial<DeclarationWithRawData> = {}): DeclarationWithRawData => ({
    id: '1',
    customsId: 'customs1',
    mrn: 'MRN123',
    status: 'CLEARED',
    xmlData: null,
    date: new Date('2025-01-16'),
    updatedAt: new Date(),
    summary: null,
    rawData: {
      MRN: 'MRN123',
      guid: 'guid123',
      ccd_registered: '20250116T120000',
      ccd_status: 'R',
      ccd_type: 'ІМ ЕЕ',
      trn_all: 'Транспорт',
      ccd_07_01: 'Митниця1',
      ccd_01_01: '01',
      ccd_01_02: '02',
      ccd_01_03: '03',
    },
    ...overrides,
  });

  describe('filterDeclarations60', () => {
    it('should return all declarations when no filters applied', () => {
      const declarations = [
        createMockDeclaration({ id: '1' }),
        createMockDeclaration({ id: '2' }),
      ];
      const filters: FilterOptions = {};
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(2);
    });

    it('should filter by cleared status', () => {
      const declarations = [
        createMockDeclaration({ id: '1', rawData: { ccd_status: 'R' } }),
        createMockDeclaration({ id: '2', rawData: { ccd_status: 'N' } }),
      ];
      const filters: FilterOptions = { status: 'cleared' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by status', () => {
      const declarations = [
        createMockDeclaration({ id: '1', status: 'PROCESSING' }),
        createMockDeclaration({ id: '2', status: 'REJECTED' }),
      ];
      const filters: FilterOptions = { status: 'PROCESSING' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by date from', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          rawData: { ccd_registered: '20250115T120000' },
        }),
        createMockDeclaration({
          id: '2',
          rawData: { ccd_registered: '20250117T120000' },
        }),
      ];
      const filters: FilterOptions = { dateFrom: '2025-01-16' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should filter by date to', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          rawData: { ccd_registered: '20250115T120000' },
        }),
        createMockDeclaration({
          id: '2',
          rawData: { ccd_registered: '20250117T120000' },
        }),
      ];
      const filters: FilterOptions = { dateTo: '2025-01-16' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by customs office', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          rawData: { ccd_07_01: 'Митниця1' },
        }),
        createMockDeclaration({
          id: '2',
          rawData: { ccd_07_01: 'Митниця2' },
        }),
      ];
      const filters: FilterOptions = { customsOffice: 'Митниця1' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by declaration type', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          rawData: { ccd_type: 'ІМ ЕЕ' },
        }),
        createMockDeclaration({
          id: '2',
          rawData: { ccd_type: 'ЕК ЕЕ' },
        }),
      ];
      const filters: FilterOptions = { declarationType: 'ІМ' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by declaration type from parts', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          rawData: {
            ccd_01_01: '01',
            ccd_01_02: '02',
            ccd_01_03: '03',
          },
        }),
        createMockDeclaration({
          id: '2',
          rawData: {
            ccd_01_01: '04',
            ccd_01_02: '05',
            ccd_01_03: '06',
          },
        }),
      ];
      const filters: FilterOptions = { declarationType: '01' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by search term (MRN)', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          mrn: 'MRN123',
          rawData: { MRN: 'MRN123', ccd_registered: '20250116T120000', ccd_status: 'R' },
        }),
        createMockDeclaration({
          id: '2',
          mrn: 'MRN456',
          rawData: { MRN: 'MRN456', ccd_registered: '20250116T120000', ccd_status: 'R' },
        }),
      ];
      const filters: FilterOptions = { searchTerm: 'MRN123' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by search term (GUID)', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          rawData: { guid: 'guid123' },
        }),
        createMockDeclaration({
          id: '2',
          rawData: { guid: 'guid456' },
        }),
      ];
      const filters: FilterOptions = { searchTerm: 'guid123' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should filter by search term (type)', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          rawData: { ccd_type: 'ІМ ЕЕ' },
        }),
        createMockDeclaration({
          id: '2',
          rawData: { ccd_type: 'ЕК ЕЕ' },
        }),
      ];
      const filters: FilterOptions = { searchTerm: 'ІМ' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should apply multiple filters', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          status: 'PROCESSING',
          rawData: {
            ccd_status: 'N',
            ccd_07_01: 'Митниця1',
            ccd_registered: '20250116T120000',
          },
        }),
        createMockDeclaration({
          id: '2',
          status: 'PROCESSING',
          rawData: {
            ccd_status: 'N',
            ccd_07_01: 'Митниця2',
            ccd_registered: '20250116T120000',
          },
        }),
      ];
      const filters: FilterOptions = {
        status: 'PROCESSING',
        customsOffice: 'Митниця1',
      };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should handle case-insensitive search', () => {
      const declarations = [
        createMockDeclaration({
          id: '1',
          mrn: 'MRN123',
        }),
      ];
      const filters: FilterOptions = { searchTerm: 'mrn123' };
      const result = filterDeclarations60(declarations, filters);
      expect(result).toHaveLength(1);
    });
  });
});
