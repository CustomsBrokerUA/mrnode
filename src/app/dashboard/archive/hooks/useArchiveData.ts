'use client';

import { useMemo } from 'react';
import { Declaration, DeclarationWithRawData } from '../types';
import { mapXmlToDeclaration } from '@/lib/xml-mapper';
import { formatRegisteredDate } from '../utils';

/**
 * Хук для парсингу та обробки даних декларацій.
 * 
 * Виконує наступні задачі:
 * 1. Парсить xmlData для отримання rawData (60.1 формат)
 * 2. Парсить xmlData для отримання mappedData (61.1 формат)
 * 3. Обробляє різні формати зберігання даних (JSON з data60_1/data61_1, XML, summary fallback)
 * 
 * @param declarations - Масив декларацій з БД
 * @param activeTab - Активна вкладка ('list60' | 'list61')
 * @returns Об'єкт з обробленими даними:
 *   - declarationsWithRawData: для list60 (короткий формат)
 *   - declarationsWithDetails: для list61 (детальний формат з mappedData)
 */
export function useArchiveData(
    declarations: Declaration[],
    activeTab: 'list60' | 'list61'
) {
    // Parse raw data from xmlData or use cached summary for list60
    const declarationsWithRawData = useMemo(() => {
        return declarations.map(doc => {
            if (!doc.xmlData) {
                return {
                    ...doc,
                    rawData: null
                } as DeclarationWithRawData;
            }

            try {
                const trimmed = doc.xmlData.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    const parsed = JSON.parse(doc.xmlData);
                    
                    if (parsed && typeof parsed === 'object' && (parsed.data60_1 || parsed.data61_1)) {
                        const data60_1 = parsed.data60_1 || {};
                        
                        // Construct ccd_type from parts if needed
                        let ccd_type = data60_1.ccd_type;
                        if (!ccd_type && (data60_1.ccd_01_01 || data60_1.ccd_01_02 || data60_1.ccd_01_03)) {
                            const parts = [
                                data60_1.ccd_01_01?.trim(),
                                data60_1.ccd_01_02?.trim(),
                                data60_1.ccd_01_03?.trim()
                            ].filter(Boolean);
                            ccd_type = parts.length > 0 ? parts.join(' ') : undefined;
                        }
                        
                        const rawData: any = {
                            guid: data60_1.guid,
                            MRN: data60_1.MRN,
                            ccd_registered: data60_1.ccd_registered,
                            ccd_status: data60_1.ccd_status,
                            ccd_type: ccd_type,
                            trn_all: data60_1.trn_all,
                            ccd_07_01: data60_1.ccd_07_01,
                            ccd_07_02: data60_1.ccd_07_02,
                            ccd_07_03: data60_1.ccd_07_03,
                            ccd_01_01: data60_1.ccd_01_01,
                            ccd_01_02: data60_1.ccd_01_02,
                            ccd_01_03: data60_1.ccd_01_03,
                        };
                        
                        return {
                            ...doc,
                            rawData: rawData
                        } as DeclarationWithRawData;
                    }
                }
            } catch {
                // Failed to parse, will fall through to summary
            }
            
            // Fallback: use cached summary data
            if (doc.summary) {
                const summary = doc.summary;
                
                let ccd_registered: string | undefined;
                if (summary.registeredDate) {
                    const date = new Date(summary.registeredDate);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    ccd_registered = `${year}${month}${day}T${hours}${minutes}${seconds}`;
                }
                
                const rawData: any = {
                    guid: doc.customsId || undefined,
                    MRN: doc.mrn || undefined,
                    ccd_registered: ccd_registered,
                    ccd_status: doc.status === 'CLEARED' ? 'R' : (doc.status === 'REJECTED' ? 'N' : undefined),
                    ccd_type: summary.declarationType || undefined,
                    trn_all: undefined,
                    ccd_07_01: summary.customsOffice || undefined,
                };
                
                if (summary.declarationType) {
                    const parts = summary.declarationType.split(/[\/\s]+/).map(p => p.trim()).filter(Boolean);
                    if (parts.length >= 1) rawData.ccd_01_01 = parts[0];
                    if (parts.length >= 2) rawData.ccd_01_02 = parts[1];
                    if (parts.length >= 3) rawData.ccd_01_03 = parts[2];
                }
                
                return {
                    ...doc,
                    rawData
                } as DeclarationWithRawData;
            }
            
            // Final fallback: try XML parsing
            try {
                const trimmed = doc.xmlData.trim();
                
                // For XML, extract basic fields using regex
                if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
                    const extractXmlField = (xml: string, fieldName: string): string | undefined => {
                        const regex = new RegExp(`<${fieldName}>([\\s\\S]*?)<\\/${fieldName}>`, 'i');
                        const match = xml.match(regex);
                        return match ? match[1].trim() : undefined;
                    };

                    let ccd_type = extractXmlField(trimmed, 'ccd_type');
                    if (!ccd_type) {
                        const ccd_01_01 = extractXmlField(trimmed, 'ccd_01_01');
                        const ccd_01_02 = extractXmlField(trimmed, 'ccd_01_02');
                        const ccd_01_03 = extractXmlField(trimmed, 'ccd_01_03');
                        if (ccd_01_01 || ccd_01_02 || ccd_01_03) {
                            const parts = [ccd_01_01, ccd_01_02, ccd_01_03].filter(Boolean);
                            ccd_type = parts.length > 0 ? parts.join(' ') : undefined;
                        }
                    }

                    let trn_all = extractXmlField(trimmed, 'trn_all');
                    if (!trn_all) {
                        const transportMatches = trimmed.matchAll(/<ccd_transport[^>]*>([\s\S]*?)<\/ccd_transport>/gi);
                        const transportNames: string[] = [];
                        for (const match of transportMatches) {
                            const transportContent = match[1];
                            const trnName = extractXmlField(transportContent, 'ccd_trn_name') || 
                                          extractXmlField(transportContent, 'trn_name');
                            if (trnName) transportNames.push(trnName);
                        }
                        if (transportNames.length > 0) {
                            trn_all = transportNames.join(', ');
                        }
                    }

                    const rawData: any = {
                        guid: extractXmlField(trimmed, 'guid'),
                        MRN: extractXmlField(trimmed, 'MRN'),
                        ccd_registered: extractXmlField(trimmed, 'ccd_registered'),
                        ccd_status: extractXmlField(trimmed, 'ccd_status'),
                        ccd_type: ccd_type,
                        trn_all: trn_all,
                        ccd_07_01: extractXmlField(trimmed, 'ccd_07_01'),
                        ccd_07_02: extractXmlField(trimmed, 'ccd_07_02'),
                        ccd_07_03: extractXmlField(trimmed, 'ccd_07_03'),
                    };

                    return {
                        ...doc,
                        rawData: rawData
                    } as DeclarationWithRawData;
                }
            } catch {
                // Failed to parse
            }
            
            return {
                ...doc,
                rawData: null
            } as DeclarationWithRawData;
        });
    }, [declarations]);

    // Parse declarations with 61.1 details for list61
    const declarationsWithDetails = useMemo(() => {
        if (activeTab !== 'list61') return [];
        
        return declarations.map(doc => {
            if (!doc.xmlData) {
                return { ...doc, mappedData: null };
            }
            
            let has61_1Data = false;
            let xmlForMapping: string | null = null;
            
            try {
                const trimmed = doc.xmlData.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    const parsed = JSON.parse(doc.xmlData);
                    if (parsed && typeof parsed === 'object' && parsed.data61_1) {
                        has61_1Data = true;
                        xmlForMapping = parsed.data61_1;
                    }
                } else if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
                    has61_1Data = true;
                    xmlForMapping = doc.xmlData;
                }
            } catch {
                has61_1Data = false;
            }
            
            if (!has61_1Data || !xmlForMapping) {
                return { ...doc, mappedData: null };
            }
            
            // Parse XML using mapXmlToDeclaration
            try {
                const mapped = mapXmlToDeclaration(xmlForMapping);
                
                if (mapped) {
                    // Extract ccd_registered from XML
                    let ccdRegistered: string | undefined;
                    try {
                        const ccdRegisteredMatch = xmlForMapping.match(/<ccd_registered>([\s\S]*?)<\/ccd_registered>/i);
                        if (ccdRegisteredMatch && ccdRegisteredMatch[1]) {
                            ccdRegistered = ccdRegisteredMatch[1].trim();
                        } else if (mapped?.header?.rawDate) {
                            ccdRegistered = mapped.header.rawDate;
                        }
                    } catch {
                        // Failed to extract
                    }
                    
                    // Extract ccd_01_01, ccd_01_02, ccd_01_03 from XML
                    let ccd01_01: string | undefined;
                    let ccd01_02: string | undefined;
                    let ccd01_03: string | undefined;
                    try {
                        const ccd01_01Match = xmlForMapping.match(/<ccd_01_01>([\s\S]*?)<\/ccd_01_01>/i);
                        if (ccd01_01Match && ccd01_01Match[1]) {
                            ccd01_01 = ccd01_01Match[1].trim();
                        }
                        const ccd01_02Match = xmlForMapping.match(/<ccd_01_02>([\s\S]*?)<\/ccd_01_02>/i);
                        if (ccd01_02Match && ccd01_02Match[1]) {
                            ccd01_02 = ccd01_02Match[1].trim();
                        }
                        const ccd01_03Match = xmlForMapping.match(/<ccd_01_03>([\s\S]*?)<\/ccd_01_03>/i);
                        if (ccd01_03Match && ccd01_03Match[1]) {
                            ccd01_03 = ccd01_03Match[1].trim();
                        }
                    } catch {
                        // Failed to extract
                    }
                    
                    return {
                        ...doc,
                        mappedData: mapped,
                        extractedData: {
                            ccd_registered: ccdRegistered,
                            ccd_01_01: ccd01_01,
                            ccd_01_02: ccd01_02,
                            ccd_01_03: ccd01_03,
                        }
                    };
                }
            } catch {
                // Failed to parse XML, will try summary fallback
            }
            
            // Fallback to summary if XML parsing failed
            if (doc.summary) {
                const summary = doc.summary;
                
                let ccdRegistered: string | undefined;
                if (summary.registeredDate) {
                    const date = new Date(summary.registeredDate);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    ccdRegistered = `${year}${month}${day}T${hours}${minutes}${seconds}`;
                }
                
                const mappedData = {
                    header: {
                        mrn: doc.mrn || 'N/A',
                        type: summary.declarationType || '---',
                        date: ccdRegistered ? formatRegisteredDate(ccdRegistered) : '',
                        rawDate: ccdRegistered || '',
                        customsOffice: summary.customsOffice || '',
                        consignor: summary.senderName || '',
                        consignee: summary.recipientName || '',
                        contractHolder: '',
                        invoiceValue: summary.invoiceValue || 0,
                        invoiceCurrency: summary.invoiceCurrency || '',
                        totalValue: summary.customsValue || 0,
                        currency: summary.currency || '',
                        exchangeRate: summary.exchangeRate || 0,
                        transportDetails: summary.transportDetails || '',
                        declarantName: summary.declarantName || '',
                    },
                    goods: []
                };
                
                let ccd01_01: string | undefined;
                let ccd01_02: string | undefined;
                let ccd01_03: string | undefined;
                if (summary.declarationType) {
                    const parts = summary.declarationType.split(/[\/\s]+/).map(p => p.trim()).filter(Boolean);
                    if (parts.length >= 1) ccd01_01 = parts[0];
                    if (parts.length >= 2) ccd01_02 = parts[1];
                    if (parts.length >= 3) ccd01_03 = parts[2];
                }
                
                return {
                    ...doc,
                    mappedData,
                    extractedData: {
                        ccd_registered: ccdRegistered,
                        ccd_01_01: ccd01_01,
                        ccd_01_02: ccd01_02,
                        ccd_01_03: ccd01_03,
                    }
                };
            }

            return { ...doc, mappedData: null };
        });
    }, [declarations, activeTab]);

    return {
        declarationsWithRawData,
        declarationsWithDetails
    };
}
