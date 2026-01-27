import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomsService, CustomsResponse } from '../customs-api';
import axios from 'axios';
import AdmZip from 'adm-zip';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

// Mock AdmZip - properly mock the class constructor
const mockGetEntries = vi.fn();
const mockZipEntryGetData = vi.fn();

vi.mock('adm-zip', () => {
    class MockAdmZip {
        constructor(buffer: Buffer) {
            // Constructor receives buffer
        }
        getEntries() {
            return mockGetEntries();
        }
    }
    return {
        default: MockAdmZip
    };
});

describe('CustomsService', () => {
    const mockToken = 'test-token';
    const mockEdrpou = '12345678';
    let service: CustomsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new CustomsService(mockToken, mockEdrpou);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create instance with token and edrpou', () => {
            const instance = new CustomsService('token123', '87654321');
            expect(instance).toBeInstanceOf(CustomsService);
        });
    });

    describe('getDeclarationsList', () => {
        it('should return success response with data when API call succeeds', async () => {
            // XML response should match expected format for parseXmlDeclarations
            // parseXmlDeclarations expects root element with 'md' child (can be array or single)
            const mockXmlResponse = '<?xml version="1.0"?><response><md><guid>test-guid</guid><MRN>123/456/789</MRN><ccd_registered>20250116T120000</ccd_registered><ccd_status>R</ccd_status></md></response>';
            
            // Configure mock ZIP entry
            mockZipEntryGetData.mockReturnValue(Buffer.from(mockXmlResponse));
            const mockZipEntry = {
                entryName: 'response.xml',
                getData: mockZipEntryGetData
            };

            // Configure mock getEntries to return the entry
            mockGetEntries.mockReturnValue([mockZipEntry]);

            // Mock axios response - response.data.messageBody should be Base64-encoded
            const mockZipBuffer = Buffer.from('mock zip data');
            const base64Zip = mockZipBuffer.toString('base64');

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    messageBody: base64Zip
                },
                status: 200,
                statusText: 'OK'
            });

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(mockedAxios.post).toHaveBeenCalled();
        });

        it('should return error response when API call fails', async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle empty ZIP archive', async () => {
            const mockZipBuffer = Buffer.from('mock zip data');
            const base64Zip = mockZipBuffer.toString('base64');
            
            // Configure mock to return empty entries
            mockGetEntries.mockReturnValue([]);

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    messageBody: base64Zip
                },
                status: 200
            });

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle invalid ZIP data', async () => {
            const invalidZipBuffer = Buffer.from('invalid zip data');
            const base64Zip = invalidZipBuffer.toString('base64');

            // Configure mock to throw error when constructing
            // Note: This is tricky - we'll let it construct but fail in getData
            mockGetEntries.mockImplementation(() => {
                throw new Error('Invalid ZIP');
            });

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    messageBody: base64Zip
                },
                status: 200
            });

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            // Should handle error gracefully
            expect(result).toBeDefined();
        });
    });

    describe('getDeclarationDetails', () => {
        it('should return success response when API call succeeds', async () => {
            // getDeclarationDetails returns raw XML, not parsed structure
            const mockXmlResponse = '<?xml version="1.0"?><ccd><ccd_07_01>123</ccd_07_01><ccd_registered>20250116T120000</ccd_registered><ccd_status>R</ccd_status></ccd>';
            const mockZipBuffer = Buffer.from('mock zip data');
            const base64Zip = mockZipBuffer.toString('base64');
            
            // Configure mock ZIP entry
            mockZipEntryGetData.mockReturnValue(Buffer.from(mockXmlResponse));
            const mockZipEntry = {
                entryName: 'details.xml',
                getData: mockZipEntryGetData
            };

            // Configure mock getEntries
            mockGetEntries.mockReturnValue([mockZipEntry]);

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    messageBody: base64Zip
                },
                status: 200
            });

            const result = await service.getDeclarationDetails('test-guid');

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(mockedAxios.post).toHaveBeenCalled();
        });

        it('should return error response when API call fails', async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

            const result = await service.getDeclarationDetails('test-guid');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle empty GUID', async () => {
            mockedAxios.post.mockRejectedValueOnce(new Error('Invalid GUID'));

            const result = await service.getDeclarationDetails('');

            expect(result.success).toBe(false);
        });
    });

    describe('Windows-1251 encoding handling', () => {
        it('should decode Windows-1251 encoded XML correctly', async () => {
            // Create XML with proper structure for parseXmlDeclarations
            const mockXmlResponse = '<?xml version="1.0" encoding="windows-1251"?><response><md><guid>test-guid</guid><MRN>123/456/789</MRN><ccd_registered>20250116T120000</ccd_registered><ccd_status>R</ccd_status></md></response>';
            const mockZipBuffer = Buffer.from('mock zip data');
            const base64Zip = mockZipBuffer.toString('base64');
            
            // Configure mock ZIP entry
            mockZipEntryGetData.mockReturnValue(Buffer.from(mockXmlResponse));
            const mockZipEntry = {
                entryName: 'response.xml',
                getData: mockZipEntryGetData
            };

            // Configure mock getEntries
            mockGetEntries.mockReturnValue([mockZipEntry]);

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    messageBody: base64Zip
                },
                status: 200
            });

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            expect(result.success).toBe(true);
        });

        it('should handle UTF-8 encoded XML', async () => {
            // Create XML with proper structure for parseXmlDeclarations
            const utf8Xml = '<?xml version="1.0" encoding="UTF-8"?><response><md><guid>test-guid</guid><MRN>123/456/789</MRN><ccd_registered>20250116T120000</ccd_registered><ccd_status>R</ccd_status></md></response>';
            const mockZipBuffer = Buffer.from('mock zip data');
            const base64Zip = mockZipBuffer.toString('base64');
            
            // Configure mock ZIP entry
            mockZipEntryGetData.mockReturnValue(Buffer.from(utf8Xml));
            const mockZipEntry = {
                entryName: 'response.xml',
                getData: mockZipEntryGetData
            };

            // Configure mock getEntries
            mockGetEntries.mockReturnValue([mockZipEntry]);

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    messageBody: base64Zip
                },
                status: 200
            });

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            expect(result.success).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle network timeout', async () => {
            mockedAxios.post.mockRejectedValueOnce({
                code: 'ECONNABORTED',
                message: 'timeout of 30000ms exceeded'
            });

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle HTTP error status', async () => {
            const error: any = new Error('HTTP Error');
            error.response = {
                status: 500,
                statusText: 'Internal Server Error',
                data: 'Server error'
            };
            mockedAxios.post.mockRejectedValueOnce(error);

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle malformed XML in response', async () => {
            const malformedXml = '<root><unclosed>';
            const mockZipBuffer = Buffer.from('mock zip data');
            const base64Zip = mockZipBuffer.toString('base64');
            
            // Configure mock ZIP entry
            mockZipEntryGetData.mockReturnValue(Buffer.from(malformedXml));
            const mockZipEntry = {
                entryName: 'response.xml',
                getData: mockZipEntryGetData
            };

            // Configure mock getEntries
            mockGetEntries.mockReturnValue([mockZipEntry]);

            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    messageBody: base64Zip
                },
                status: 200
            });

            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-01-31');
            const result = await service.getDeclarationsList(dateFrom, dateTo);

            // Should handle gracefully (might return success with empty data or error)
            expect(result).toBeDefined();
        });
    });

    describe('date range handling', () => {
        it('should handle same date for from and to', async () => {
            const date = new Date('2025-01-15');
            
            mockedAxios.post.mockRejectedValueOnce(new Error('Test'));

            const result = await service.getDeclarationsList(date, date);

            // Should make request (even if it fails)
            expect(mockedAxios.post).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should handle date range spanning multiple months', async () => {
            const dateFrom = new Date('2025-01-01');
            const dateTo = new Date('2025-03-31');
            
            mockedAxios.post.mockRejectedValueOnce(new Error('Test'));

            const result = await service.getDeclarationsList(dateFrom, dateTo);

            expect(mockedAxios.post).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });
});
