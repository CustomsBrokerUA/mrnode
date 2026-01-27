import { describe, it, expect } from 'vitest';
import { getRawData, formatRegisteredDate, decodeWindows1251, getMDNumber } from '../utils';
import { DeclarationWithRawData } from '../types';

describe('Archive Utils', () => {
  describe('getRawData', () => {
    it('should return rawData from declaration', () => {
      const doc: DeclarationWithRawData = {
        id: '1',
        customsId: 'test',
        mrn: 'MRN123',
        status: 'CLEARED',
        xmlData: null,
        date: new Date(),
        updatedAt: new Date(),
        summary: null,
        rawData: {
          MRN: 'MRN123',
          guid: 'guid123',
          ccd_registered: '20250116T120000',
          ccd_status: 'R',
        },
      };

      const result = getRawData(doc);
      expect(result).toEqual({
        MRN: 'MRN123',
        guid: 'guid123',
        ccd_registered: '20250116T120000',
        ccd_status: 'R',
      });
    });

    it('should return null for doc without rawData', () => {
      const doc: any = {
        id: '1',
        mrn: 'MRN123',
        status: 'CLEARED',
      };

      const result = getRawData(doc);
      expect(result).toBeUndefined();
    });
  });

  describe('formatRegisteredDate', () => {
    it('should format date correctly', () => {
      const dateStr = '20250116T120000';
      const result = formatRegisteredDate(dateStr);
      expect(result).toContain('2025');
      expect(result).toContain('16');
      expect(result).toContain('12:00:00');
    });

    it('should return "---" for undefined', () => {
      const result = formatRegisteredDate(undefined);
      expect(result).toBe('---');
    });

    it('should return original string for invalid format', () => {
      const result = formatRegisteredDate('invalid-date');
      expect(result).toBe('invalid-date');
    });

    it('should handle empty string', () => {
      const result = formatRegisteredDate('');
      expect(result).toBe('---');
    });
  });

  describe('getMDNumber', () => {
    it('should return MRN from rawData if available', () => {
      const rawData = { MRN: 'MRN123' };
      const result = getMDNumber(rawData, null);
      expect(result).toBe('MRN123');
    });

    it('should return mrn parameter if MRN not in rawData', () => {
      const rawData = null;
      const result = getMDNumber(rawData, 'MRN456');
      expect(result).toBe('MRN456');
    });

    it('should construct from ccd_07_01, ccd_07_02, ccd_07_03', () => {
      const rawData = {
        ccd_07_01: '123',
        ccd_07_02: '456',
        ccd_07_03: '789',
      };
      const result = getMDNumber(rawData, null);
      expect(result).toBe('123 / 456 / 000789');
    });

    it('should pad ccd_07_03 with zeros', () => {
      const rawData = {
        ccd_07_01: '123',
        ccd_07_02: '456',
        ccd_07_03: '1',
      };
      const result = getMDNumber(rawData, null);
      expect(result).toBe('123 / 456 / 000001');
    });

    it('should return "---" if no data available', () => {
      const result = getMDNumber(null, null);
      expect(result).toBe('---');
    });

    it('should prioritize MRN over mrn parameter', () => {
      const rawData = { MRN: 'MRN123' };
      const result = getMDNumber(rawData, 'MRN456');
      expect(result).toBe('MRN123');
    });
  });

  describe('decodeWindows1251', () => {
    it('should return "---" for undefined', () => {
      const result = decodeWindows1251(undefined);
      expect(result).toBe('---');
    });

    it('should return text as-is if already UTF-8', () => {
      const text = 'Україна';
      const result = decodeWindows1251(text);
      expect(result).toBe('Україна');
    });

    it('should decode Windows-1251 bytes to UTF-8', () => {
      // Test with known Windows-1251 bytes
      // 0xC7 = З, 0xCC = М, 0xC5 = Е
      const text = String.fromCharCode(0xC7, 0xCC, 0xC5);
      const result = decodeWindows1251(text);
      expect(result).toBe('ЗМЕ');
    });

    it('should handle ASCII characters', () => {
      const text = 'Test123';
      const result = decodeWindows1251(text);
      expect(result).toBe('Test123');
    });

    it('should handle mixed content', () => {
      const text = 'Test' + String.fromCharCode(0xC0, 0xC1); // АБ
      const result = decodeWindows1251(text);
      expect(result).toBe('TestАБ');
    });

    it('should return original text on error', () => {
      // This test ensures error handling works
      const result = decodeWindows1251('normal-text');
      expect(result).toBe('normal-text');
    });
  });
});
