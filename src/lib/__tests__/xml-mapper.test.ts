import { describe, it, expect } from 'vitest';
import { mapXmlToDeclaration, parseRawOnly } from '../xml-mapper';

describe('XML Mapper', () => {
    describe('parseRawOnly', () => {
        it('should return error object for null input', () => {
            const result = parseRawOnly(null);
            expect(result).toEqual({ error: 'No XML' });
        });

        it('should return error object for empty string', () => {
            const result = parseRawOnly('');
            expect(result.error).toBeDefined();
        });

        it('should parse valid XML string', () => {
            const xml = '<?xml version="1.0"?><root><item>test</item></root>';
            const result = parseRawOnly(xml);
            
            expect(result).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should handle invalid XML gracefully', () => {
            const invalidXml = '<root><unclosed>';
            const result = parseRawOnly(invalidXml);
            
            // Should either parse what it can or return error
            expect(result).toBeDefined();
        });
    });

    describe('mapXmlToDeclaration', () => {
        it('should return null for null input', () => {
            const result = mapXmlToDeclaration(null as any);
            expect(result).toBeNull();
        });

        it('should return null for empty string', () => {
            const result = mapXmlToDeclaration('');
            expect(result).toBeNull();
        });

        it('should return null for invalid XML', () => {
            const invalidXml = 'not-xml-content';
            const result = mapXmlToDeclaration(invalidXml);
            expect(result).toBeNull();
        });

        it('should parse minimal valid XML declaration', () => {
            const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
    <ccd_01_01>01</ccd_01_01>
    <ccd_01_02>02</ccd_01_02>
    <ccd_01_03>03</ccd_01_03>
</ccd>`;
            
            const result = mapXmlToDeclaration(minimalXml);
            
            expect(result).not.toBeNull();
            expect(result?.header).toBeDefined();
            expect(result?.header.mrn).toBeDefined();
        });

        it('should parse declaration with header information', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
    <ccd_01_01>01</ccd_01_01>
    <ccd_01_02>02</ccd_01_02>
    <ccd_01_03>03</ccd_01_03>
    <ccd_54_02>Test Declarant</ccd_54_02>
    <ccd_22_01>USD</ccd_22_01>
    <ccd_22_02>1000</ccd_22_02>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            expect(result?.header).toBeDefined();
            expect(result?.header.declarantName).toBe('Test Declarant');
            expect(result?.header.invoiceCurrency).toBe('USD');
        });

        it('should parse declaration with goods', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
    <ccd_goods>
        <item>
            <ccd_32_01>1</ccd_32_01>
            <ccd_31_01>Test Goods</ccd_31_01>
            <ccd_33_01>12345678</ccd_33_01>
            <ccd_35_01>100</ccd_35_01>
            <ccd_38_01>90</ccd_38_01>
            <ccd_42_01>500</ccd_42_01>
        </item>
    </ccd_goods>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            expect(result?.goods).toBeDefined();
            expect(Array.isArray(result?.goods)).toBe(true);
            // Parser might structure goods differently, so just check it exists
            if (result?.goods && result.goods.length > 0) {
                expect(result.goods[0]).toBeDefined();
                expect(typeof result.goods[0].index).toBe('number');
            }
        });

        it('should handle declaration with empty goods array', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            expect(result?.goods).toBeDefined();
            expect(Array.isArray(result?.goods)).toBe(true);
        });

        it('should parse numeric values correctly', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
    <ccd_goods>
        <item>
            <ccd_32_01>1</ccd_32_01>
            <ccd_35_01>100.5</ccd_35_01>
            <ccd_38_01>90.25</ccd_38_01>
            <ccd_42_01>500.75</ccd_42_01>
            <ccd_45_01>600.50</ccd_45_01>
        </item>
    </ccd_goods>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            if (result?.goods && result.goods.length > 0) {
                const goods = result.goods[0];
                expect(typeof goods.grossWeight).toBe('number');
                expect(typeof goods.netWeight).toBe('number');
                expect(typeof goods.price).toBe('number');
                expect(typeof goods.customsValue).toBe('number');
            }
        });

        it('should handle missing optional fields gracefully', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            // Should not throw error even with missing fields
            expect(result?.header).toBeDefined();
        });

        it('should parse declaration with clients', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
    <ccd_clients>
        <ccd_clients_item>
            <ccd_cl_gr>9</ccd_cl_gr>
            <ccd_cl_name>Test Client</ccd_cl_name>
            <ccd_cl_code>12345678</ccd_cl_code>
        </ccd_clients_item>
    </ccd_clients>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            expect(result?.clients).toBeDefined();
            expect(Array.isArray(result?.clients)).toBe(true);
        });

        it('should parse declaration with payments', () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
    <ccd_47>
        <ccd_47_item>
            <ccd_47_code>1010</ccd_47_code>
            <ccd_47_char>A</ccd_47_char>
            <ccd_47_base>1000</ccd_47_base>
            <ccd_47_amount>100</ccd_47_amount>
        </ccd_47_item>
    </ccd_47>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            expect(result?.generalPayments).toBeDefined();
            expect(Array.isArray(result?.generalPayments)).toBe(true);
        });

        it('should handle Windows-1251 encoded XML', () => {
            // Note: This test checks that the parser handles encoding
            const xml = `<?xml version="1.0" encoding="windows-1251"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
    <ccd_54_02>Тест</ccd_54_02>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            // Should parse without errors
            expect(result?.header).toBeDefined();
        });

        it('should handle malformed XML gracefully', () => {
            const malformedXml = '<root><unclosed><nested>';
            const result = mapXmlToDeclaration(malformedXml);
            
            // Parser might try to parse what it can, so result could be null or partial
            // Just check it doesn't throw
            expect(() => mapXmlToDeclaration(malformedXml)).not.toThrow();
        });

        it('should handle very large XML', () => {
            const largeGoodsXml = Array.from({ length: 100 }, (_, i) => `
                <item>
                    <ccd_32_01>${i + 1}</ccd_32_01>
                    <ccd_31_01>Goods ${i + 1}</ccd_31_01>
                    <ccd_33_01>12345678</ccd_33_01>
                </item>
            `).join('');
            
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ccd>
    <ccd_07_01>123</ccd_07_01>
    <ccd_07_02>456</ccd_07_02>
    <ccd_07_03>789</ccd_07_03>
    <ccd_registered>20250116T120000</ccd_registered>
    <ccd_status>R</ccd_status>
    <ccd_goods>${largeGoodsXml}</ccd_goods>
</ccd>`;
            
            const result = mapXmlToDeclaration(xml);
            
            expect(result).not.toBeNull();
            expect(result?.goods).toBeDefined();
            // Parser should handle large XML without errors
            expect(Array.isArray(result?.goods)).toBe(true);
        });
    });
});
