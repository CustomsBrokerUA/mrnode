'use server';

import { db } from "@/lib/db";
import { mapXmlToDeclaration } from "@/lib/xml-mapper";

/**
 * Create or update declaration summary from XML data
 */
export async function updateDeclarationSummary(declarationId: string, xmlData: string | null) {
    if (!xmlData) {
        // Delete summary if no XML data
        await db.declarationSummary.deleteMany({
            where: { declarationId }
        });

        // Delete HS codes if no XML data
        await db.declarationHsCode.deleteMany({
            where: { declarationId }
        });
        return;
    }

    try {
        // Try to extract XML for mapping
        let xmlForMapping: string | null = null;
        const trimmed = xmlData.trim();

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            const parsed = JSON.parse(xmlData);
            if (parsed && typeof parsed === 'object' && parsed.data61_1) {
                xmlForMapping = parsed.data61_1;
            } else if (parsed && typeof parsed === 'object' && parsed.data60_1) {
                // For 60.1, we can extract basic info but not full details
                xmlForMapping = null; // Will use basic parsing
            }
        } else if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
            xmlForMapping = xmlData;
        }

        // If we have 61.1 XML, parse it fully
        if (xmlForMapping) {
            const mapped = mapXmlToDeclaration(xmlForMapping);
            
            if (mapped) {
                const normalizeHsCode = (val: unknown) => {
                    const s = String(val || '').trim();
                    if (!s) return null;
                    const digitsOnly = s.replace(/\D/g, '');
                    if (!digitsOnly) return null;
                    return digitsOnly;
                };

                const normalizeBox = (val: unknown) => {
                    const s = String(val ?? '').trim();
                    if (!s) return '';
                    const digits = s.replace(/\D/g, '');
                    return digits.replace(/^0+/, '') || digits;
                };

                const hsCodes = Array.from(
                    new Set(
                        (mapped.goods || [])
                            .map(g => normalizeHsCode((g as any)?.hsCode))
                            .filter(Boolean) as string[]
                    )
                );

                const computeInvoiceValueUah = () => {
                    const header: any = mapped.header || {};
                    const goods: any[] = Array.isArray(mapped.goods) ? mapped.goods : [];

                    const num = (v: any) => {
                        const n = Number(v || 0);
                        return Number.isFinite(n) ? n : 0;
                    };

                    // IMPORTANT: rely only on invoiceCurrency for UAH trust.
                    // header.currency (ccd_22_cur) may be UAH by default and does not necessarily represent invoice currency.
                    const invoiceCurrency = String(header.invoiceCurrency || '').trim().toUpperCase();

                    const headerInvoice = num(header.invoiceValue);
                    const rate = num(header.exchangeRate);

                    // If invoice currency is NOT UAH, some datasets still populate ccd_22_03 / ccd_42_02 with amounts
                    // that are actually in invoice currency (not UAH). In that case we must compute UAH via exchange rate.
                    if (invoiceCurrency && invoiceCurrency !== 'UAH' && invoiceCurrency !== '980') {
                        if (headerInvoice > 0 && rate > 0) return headerInvoice * rate;

                        if (rate > 0) {
                            const goodsComputedSum = goods.reduce((sum, g) => sum + num(g?.price) * rate, 0);
                            if (goodsComputedSum > 0) return goodsComputedSum;
                        }

                        // As a last resort, keep whatever is in goods invoiceValueUah, but it's potentially not UAH.
                        const goodsInvoiceUahSum = goods.reduce((sum, g) => sum + num(g?.invoiceValueUah), 0);
                        if (goodsInvoiceUahSum > 0) return goodsInvoiceUahSum;

                        return 0;
                    }

                    // ccd_22_03 is not reliably UAH in some datasets; only trust it when invoice currency is UAH
                    const headerInvoiceUah = num(header.invoiceValueUah);
                    if (headerInvoiceUah > 0 && (invoiceCurrency === 'UAH' || invoiceCurrency === '980')) return headerInvoiceUah;

                    const goodsInvoiceUahSum = goods.reduce((sum, g) => sum + num(g?.invoiceValueUah), 0);
                    if (goodsInvoiceUahSum > 0) return goodsInvoiceUahSum;
                    if (headerInvoice > 0 && rate > 0) return headerInvoice * rate;

                    if (rate > 0) {
                        const goodsComputedSum = goods.reduce((sum, g) => sum + num(g?.price) * rate, 0);
                        if (goodsComputedSum > 0) return goodsComputedSum;
                    }

                    return 0;
                };

                const computedInvoiceValueUah = computeInvoiceValueUah();

                // Extract registered date from XML
                let registeredDate: Date | null = null;
                try {
                    const ccdRegisteredMatch = xmlForMapping.match(/<ccd_registered>([\s\S]*?)<\/ccd_registered>/i);
                    if (ccdRegisteredMatch && ccdRegisteredMatch[1]) {
                        const dateStr = ccdRegisteredMatch[1].trim();
                        registeredDate = new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
                    }
                } catch {
                    // Failed to parse date
                }

                const summaryData = {
                    customsValue: mapped.header.totalValue || null,
                    currency: mapped.header.currency || null,
                    totalItems: mapped.header.totalItems || null,
                    customsOffice: mapped.header.customsOffice || null,
                    declarantName: mapped.header.declarantName || null,
                    representativeName: (mapped.clients || []).find((c: any) => normalizeBox(c?.box) === '14')?.name || null,
                    senderName: mapped.header.consignor || null,
                    recipientName: mapped.header.consignee || null,
                    carrierName: (mapped.clients || []).find((c: any) => normalizeBox(c?.box) === '50')?.name || null,
                    declarationType: mapped.header.type || null,
                    contractHolder: mapped.header.contractHolder || null,
                    registeredDate: registeredDate || null,
                    invoiceValue: mapped.header.invoiceValue || null,
                    invoiceCurrency: mapped.header.invoiceCurrency || null,
                    invoiceValueUah: computedInvoiceValueUah > 0 ? computedInvoiceValueUah : null,
                    exchangeRate: mapped.header.exchangeRate || null,
                    transportDetails: mapped.header.transportDetails || null,
                    bankName: (mapped.banks || []).find((b: any) => String(b?.name || '').trim() && String(b?.name || '').trim() !== '---')?.name || null,
                };

                // Upsert summary + sync HS codes atomically
                await db.$transaction([
                    db.declarationSummary.upsert({
                        where: { declarationId },
                        create: {
                            declarationId,
                            ...summaryData,
                        },
                        update: summaryData,
                    }),
                    db.declarationHsCode.deleteMany({
                        where: { declarationId }
                    }),
                    ...(hsCodes.length > 0
                        ? [
                            db.declarationHsCode.createMany({
                                data: hsCodes.map(hsCode => ({ declarationId, hsCode })),
                                skipDuplicates: true,
                            })
                        ]
                        : [])
                ]);
                return;
            }
        }

        // For 60.1 data or if parsing failed, try to extract basic fields
        // This is a fallback - we'll extract what we can from JSON or basic XML
        let basicData: any = {};
        
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(xmlData);
                if (parsed.data60_1) {
                    // Try to extract basic fields from 60.1 JSON
                    const data60 = parsed.data60_1;
                    basicData = {
                        declarationType: data60.ccd_type || null,
                        customsOffice: data60.ccd_07_01 || null,
                        registeredDate: data60.ccd_registered ? new Date(data60.ccd_registered.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')) : null,
                        transportDetails: data60.trn_all || null, // Extract trn_all from 60.1
                    };
                }
            } catch {
                // Failed to parse
            }
        }

        // Upsert with basic data or delete if nothing useful
        if (Object.keys(basicData).length > 0) {
            await db.declarationSummary.upsert({
                where: { declarationId },
                create: {
                    declarationId,
                    ...basicData
                },
                update: basicData
            });
        } else {
            // Delete summary if we can't extract useful data
            await db.declarationSummary.deleteMany({
                where: { declarationId }
            });
        }

        // For 60.1/basic data we don't have reliable HS codes - keep table empty
        await db.declarationHsCode.deleteMany({
            where: { declarationId }
        });
    } catch (error) {
        // If parsing fails, delete summary
        await db.declarationSummary.deleteMany({
            where: { declarationId }
        });

        // If parsing fails, delete HS codes
        await db.declarationHsCode.deleteMany({
            where: { declarationId }
        });
    }
}

/**
 * Update summaries for all declarations (useful for migration)
 */
export async function updateAllDeclarationSummaries(companyId: string) {
    const declarations = await db.declaration.findMany({
        where: { companyId },
        select: {
            id: true,
            xmlData: true
        }
    });

    let updated = 0;
    for (const declaration of declarations) {
        try {
            await updateDeclarationSummary(declaration.id, declaration.xmlData);
            updated++;
        } catch (error) {
            console.error(`Failed to update summary for declaration ${declaration.id}:`, error);
        }
    }

    return { success: true, updated };
}
