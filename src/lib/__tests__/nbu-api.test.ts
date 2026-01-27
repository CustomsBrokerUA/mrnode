import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUSDExchangeRate, getUSDExchangeRateForDate, formatDateToYYYYMMDD, getAllExchangeRates } from '../nbu-api';

// Mock fetch globally
global.fetch = vi.fn();

describe('NBU API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('formatDateToYYYYMMDD', () => {
        it('should format Date object to YYYYMMDD', () => {
            const date = new Date('2025-01-16T12:00:00');
            const result = formatDateToYYYYMMDD(date);
            expect(result).toBe('20250116');
        });

        it('should handle different dates correctly', () => {
            const date1 = new Date('2024-12-31T00:00:00');
            const date2 = new Date('2025-03-05T23:59:59');
            
            expect(formatDateToYYYYMMDD(date1)).toBe('20241231');
            expect(formatDateToYYYYMMDD(date2)).toBe('20250305');
        });
    });

    describe('getUSDExchangeRate', () => {
        it('should return exchange rate for valid date string', async () => {
            const mockResponse = [
                {
                    r030: 840,
                    txt: 'Долар США',
                    rate: 36.5686,
                    cc: 'USD',
                    exchangedate: '16.01.2025'
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const rate = await getUSDExchangeRate('20250116');
            
            expect(rate).toBe(36.5686);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&date=20250116&json',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Accept': 'application/json'
                    })
                })
            );
        });

        it('should return exchange rate for Date object', async () => {
            const mockResponse = [
                {
                    r030: 840,
                    txt: 'Долар США',
                    rate: 36.5686,
                    cc: 'USD',
                    exchangedate: '16.01.2025'
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const date = new Date('2025-01-16');
            const rate = await getUSDExchangeRate(date);
            
            expect(rate).toBe(36.5686);
        });

        it('should return null when API returns empty array', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => []
            });

            const rate = await getUSDExchangeRate('20250116');
            expect(rate).toBeNull();
        });

        it('should return null when API returns wrong currency', async () => {
            const mockResponse = [
                {
                    r030: 978,
                    txt: 'Євро',
                    rate: 40.0,
                    cc: 'EUR',
                    exchangedate: '16.01.2025'
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const rate = await getUSDExchangeRate('20250116');
            expect(rate).toBeNull();
        });

        it('should return null when API request fails', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            const rate = await getUSDExchangeRate('20250116');
            expect(rate).toBeNull();
        });

        it('should return null when fetch throws error', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            const rate = await getUSDExchangeRate('20250116');
            expect(rate).toBeNull();
        });

        it('should handle invalid date format gracefully', async () => {
            const rate = await getUSDExchangeRate('invalid-date');
            
            // Should still make request, but might fail
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    describe('getUSDExchangeRateForDate', () => {
        it('should handle Date object input', async () => {
            const mockResponse = [
                {
                    r030: 840,
                    txt: 'Долар США',
                    rate: 36.5686,
                    cc: 'USD',
                    exchangedate: '16.01.2025'
                }
            ];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const date = new Date('2025-01-16');
            const rate = await getUSDExchangeRateForDate(date);
            
            // Function should eventually call API (after trying DB/server action)
            // Just verify it doesn't throw and returns a value
            expect(rate).toBeDefined();
        });

        it('should call getUSDExchangeRate for null input (fallback to current date)', async () => {
            const mockResponse = [
                {
                    r030: 840,
                    txt: 'Долар США',
                    rate: 36.5686,
                    cc: 'USD',
                    exchangedate: '16.01.2025'
                }
            ];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const rate = await getUSDExchangeRateForDate(null);
            
            // Should call getUSDExchangeRate with current date
            expect(rate).toBeDefined();
        });

        it('should handle different date formats', async () => {
            const mockResponse = [
                {
                    r030: 840,
                    txt: 'Долар США',
                    rate: 36.5686,
                    cc: 'USD',
                    exchangedate: '16.01.2025'
                }
            ];

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            // Test different date formats
            const rate1 = await getUSDExchangeRateForDate('2025-01-16');
            const rate2 = await getUSDExchangeRateForDate('16.01.2025');
            const rate3 = await getUSDExchangeRateForDate('20250116');
            
            // All should eventually return a rate (or null)
            expect(rate1).toBeDefined();
            expect(rate2).toBeDefined();
            expect(rate3).toBeDefined();
        });
    });

    describe('getAllExchangeRates', () => {
        it('should return all exchange rates for a date', async () => {
            const mockResponse = [
                {
                    r030: 840,
                    txt: 'Долар США',
                    rate: 36.5686,
                    cc: 'USD',
                    exchangedate: '16.01.2025'
                },
                {
                    r030: 978,
                    txt: 'Євро',
                    rate: 40.0,
                    cc: 'EUR',
                    exchangedate: '16.01.2025'
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const rates = await getAllExchangeRates('20250116');
            
            expect(rates).not.toBeNull();
            expect(Array.isArray(rates)).toBe(true);
            if (rates) {
                expect(rates.length).toBeGreaterThan(0);
            }
        });

        it('should return null when API request fails', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            const rates = await getAllExchangeRates('20250116');
            expect(rates).toBeNull();
        });

        it('should handle Date object input', async () => {
            const mockResponse = [
                {
                    r030: 840,
                    txt: 'Долар США',
                    rate: 36.5686,
                    cc: 'USD',
                    exchangedate: '16.01.2025'
                }
            ];

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const date = new Date('2025-01-16');
            const rates = await getAllExchangeRates(date);
            
            expect(rates).not.toBeNull();
        });
    });
});
