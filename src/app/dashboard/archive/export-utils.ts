import * as XLSX from 'xlsx';
import { getUSDExchangeRateForDate } from '@/lib/nbu-api';
import { mapXmlToDeclaration } from '@/lib/xml-mapper';
import { DeclarationWithRawData, ActiveTab } from './types';
import { getRawData, formatRegisteredDate, getMDNumber } from './utils';
import { statusLabels, DEFAULT_EXPORT_COLUMNS } from './constants';

type ExtendedExportProgress = {
    phase: 'fetching_details' | 'generating_rows' | 'writing_file';
    current: number;
    total: number;
};

function getXmlData61_1(xmlData: string | null | undefined): string | null {
    if (!xmlData) return null;

    const trimmed = xmlData.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object' && parsed.data61_1) {
                return String(parsed.data61_1);
            }
            return null;
        } catch {
            return null;
        }
    }

    if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
        return xmlData;
    }

    return null;
}

function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }
}

async function fetchDeclarationXmlData(id: string, signal?: AbortSignal): Promise<string | null> {
    throwIfAborted(signal);
    const res = await fetch(`/api/declarations/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        signal,
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') return null;
    return typeof (data as any).xmlData === 'string' ? (data as any).xmlData : null;
}

async function enrichDocsWith61Details(
    docs: any[],
    concurrency = 5,
    onProgress?: (p: ExtendedExportProgress) => void,
    signal?: AbortSignal
): Promise<any[]> {
    const result = [...docs];
    let cursor = 0;
    let done = 0;
    const total = result.length;

    async function worker() {
        while (cursor < result.length) {
            throwIfAborted(signal);
            const idx = cursor++;
            const doc = result[idx];

            const mappedData = (doc as any).mappedData;
            if (mappedData?.goods && mappedData.goods.length > 0) continue;

            const id = (doc as any).id as string | undefined;
            if (!id) continue;

            try {
                const xmlData = await fetchDeclarationXmlData(id, signal);
                const xml61 = getXmlData61_1(xmlData);
                if (!xml61) continue;

                const mapped = mapXmlToDeclaration(xml61);
                if (mapped) {
                    (result[idx] as any) = { ...doc, mappedData: mapped };
                }
            } catch {
                continue;
            } finally {
                done++;
                onProgress?.({ phase: 'fetching_details', current: done, total });
            }
        }
    }

    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    await Promise.all(workers);
    return result;
}

/**
 * Експортує декларації в Excel файл (базовий формат).
 * 
 * **Формати експорту:**
 * - **list60**: Короткий формат з базовими даними (7 колонок)
 *   - Номер МД, Дата реєстрації, Статус, Тип, Транспорт, GUID, MRN
 * 
 * - **list61**: Детальний формат з повною інформацією (13 колонок)
 *   - Номер МД, Дата реєстрації, Статус, Тип, Відправник, Отримувач,
 *     Фактурна вартість, Валюта, Кількість товарів, Митниця, Декларант, GUID, MRN
 * 
 * **Особливості:**
 * - Автоматично встановлює ширину колонок для зручного перегляду
 * - Генерує ім'я файлу з поточною датою
 * - Показує alert якщо немає даних для експорту
 * - Обробляє помилки та показує повідомлення користувачу
 * 
 * @param sortedDocs - Масив відсортованих декларацій для експорту
 * @param activeTab - Активна вкладка ('list60' або 'list61'), визначає формат експорту
 * @returns Promise, який виконується після створення файлу
 * 
 * @throws Показує alert при помилках, не кидає винятки
 * 
 * @example
 * ```ts
 * await exportToExcel(sortedDeclarations, 'list60');
 * // Створює файл: Декларації_Список_2025-01-16.xlsx
 * ```
 */
export async function exportToExcel(
    sortedDocs: any[],
    activeTab: ActiveTab,
    exportColumns?: { [key: string]: boolean },
    columnOrder?: string[]
): Promise<void> {
    try {
        if (sortedDocs.length === 0) {
            alert('Немає даних для експорту');
            return;
        }

        const rows: any[] = [];
        const columns = (exportColumns || DEFAULT_EXPORT_COLUMNS) as any;

        // Визначаємо послідовність колонок
        const allPossibleKeys = Object.keys(columns);
        const activeKeys = columnOrder
            ? columnOrder.filter(key => columns[key])
            : allPossibleKeys.filter(key => columns[key]);

        const columnMap: { [key: string]: string } = {
            mdNumber: 'Номер МД',
            registeredDate: 'Дата реєстрації',
            status: 'Статус',
            type: 'Тип',
            transport: 'Транспорт',
            consignor: 'Відправник',
            consignee: 'Отримувач',
            invoiceValue: 'Фактурна вартість',
            invoiceCurrency: 'Валюта',
            goodsCount: 'Кількість товарів',
            customsOffice: 'Митниця',
            declarantName: 'Декларант',
            guid: 'GUID',
            mrn: 'MRN'
        };

        const headers: string[] = activeKeys.map(key => columnMap[key] || key);
        rows.push(headers);

        sortedDocs.forEach(doc => {
            const row: any[] = [];
            const mappedData = (doc as any).mappedData;
            const extractedData = (doc as any).extractedData;

            const mdNumber = getMDNumber(getRawData(doc), doc.mrn);
            const registeredDateRaw = (activeTab === 'list61' && extractedData?.ccd_registered)
                ? extractedData.ccd_registered
                : getRawData(doc)?.ccd_registered;
            const registeredDate = formatRegisteredDate(registeredDateRaw);

            const status = getRawData(doc)?.ccd_status || doc.status;
            const statusText = status === 'R' ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || status);

            const type = (activeTab === 'list61' && extractedData)
                ? [extractedData.ccd_01_01, extractedData.ccd_01_02, extractedData.ccd_01_03].filter(Boolean).join(' ') || '---'
                : (getRawData(doc)?.ccd_type || '---');

            const trn_all = getRawData(doc)?.trn_all;
            let trn_all_str = '---';
            if (trn_all) {
                if (typeof trn_all === 'string') trn_all_str = trn_all.trim() || '---';
                else if (Array.isArray(trn_all)) trn_all_str = (trn_all as any[]).filter(Boolean).join(', ') || '---';
                else trn_all_str = String(trn_all) || '---';
            }

            activeKeys.forEach(key => {
                switch (key) {
                    case 'mdNumber': row.push(mdNumber); break;
                    case 'registeredDate': row.push(registeredDate); break;
                    case 'status': row.push(statusText); break;
                    case 'type': row.push(type); break;
                    case 'transport': row.push(trn_all_str); break;
                    case 'consignor': row.push(mappedData?.header?.consignor || '---'); break;
                    case 'consignee': row.push(mappedData?.header?.consignee || '---'); break;
                    case 'invoiceValue': row.push(mappedData?.header?.invoiceValue ? mappedData.header.invoiceValue.toLocaleString('uk-UA') : '---'); break;
                    case 'invoiceCurrency': row.push(mappedData?.header?.invoiceCurrency || '---'); break;
                    case 'goodsCount': row.push(mappedData?.goods?.length || 0); break;
                    case 'customsOffice': row.push(mappedData?.header?.customsOffice || '---'); break;
                    case 'declarantName': row.push(mappedData?.header?.declarantName || '---'); break;
                    case 'guid': row.push(getRawData(doc)?.guid || doc.customsId || '---'); break;
                    case 'mrn': row.push(getRawData(doc)?.MRN || doc.mrn || '---'); break;
                    default: row.push('---');
                }
            });
            rows.push(row);
        });

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Set column widths
        const colWidths = activeTab === 'list60'
            ? [{ wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 40 }, { wch: 20 }]
            : [{ wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 20 }];
        ws['!cols'] = colWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Декларації');

        // Generate filename with current date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `Декларації_${activeTab === 'list60' ? 'Список' : 'Деталі'}_${dateStr}.xlsx`;

        // Write file
        XLSX.writeFile(wb, filename);

    } catch (error) {
        console.error('Помилка експорту в Excel:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`Помилка при експорті в Excel. Спробуйте ще раз.\n${message}`);
    }
}

/**
 * Допоміжна функція для пошуку інформації про документ за його кодом.
 * Шукає спочатку в документах по товару, потім у документах по декларації.
 */
function findDocumentInfo(doc: any, goodsIndex: number | null, codes: number[]) {
    const mappedData = (doc as any).mappedData;
    const codesStr = codes.map(String);

    // 1. Шукаємо в документах по товару (якщо вказано товар)
    if (goodsIndex !== null && mappedData?.goods) {
        const good = mappedData.goods.find((g: any) => (g.index || 0) === goodsIndex || mappedData.goods.indexOf(g) + 1 === goodsIndex);
        if (good?.docs) {
            const found = good.docs.find((d: any) => codesStr.includes(String(d.code)));
            if (found) return { number: found.name || '---', date: found.dateBeg || '---' };
        }
    }

    // 2. Шукаємо в документах по всій декларації
    if (mappedData?.documents) {
        const found = mappedData.documents.find((d: any) => codesStr.includes(String(d.type)));
        if (found) return { number: found.number || '---', date: found.date || '---' };
    }

    return { number: '---', date: '---' };
}

export async function exportExtendedToExcel(
    sortedDocs: any[],
    activeTab: ActiveTab,
    exportColumns: { [key: string]: boolean },
    columnOrder?: string[]
): Promise<void> {
    try {
        const declarationsWithDetails = sortedDocs.filter(doc => {
            if (activeTab === 'list61') {
                return 'mappedData' in doc && (doc as any).mappedData !== null;
            }
            return false;
        });

        if (declarationsWithDetails.length === 0) {
            alert('Немає детальних даних для експорту. Переконайтеся, що ви на вкладці "Деталі (61.1)" та що декларації мають завантажені деталі.');
            return;
        }

        let usdRate: number | null = null;
        try {
            const firstDoc = declarationsWithDetails[0];
            const mappedData = (firstDoc as any).mappedData;
            const rateDate = mappedData?.header?.currencyRateDateRaw || mappedData?.header?.rawDate;
            if (rateDate) {
                usdRate = await getUSDExchangeRateForDate(rateDate);
            }
        } catch (error) {
            console.warn('Не вдалося завантажити курс USD:', error);
        }

        // Визначаємо послідовність колонок
        const allPossibleKeys = Object.keys(exportColumns);
        const activeKeys = columnOrder
            ? columnOrder.filter(key => exportColumns[key])
            : allPossibleKeys.filter(key => exportColumns[key]);

        const columnMap: { [key: string]: string } = {
            mdNumber: 'Номер МД',
            registeredDate: 'Дата реєстрації',
            status: 'Статус',
            type: 'Тип декларації',
            transport: 'Транспорт',
            consignor: 'Відправник',
            consignee: 'Отримувач',
            invoiceValue: 'Фактурна вартість (вал)',
            invoiceCurrency: 'Валюта контракту',
            goodsIndex: '№ товару',
            goodsDescription: 'Опис товару',
            goodsHSCode: 'Код УКТЗЕД',
            goodsPrice: 'Ціна товару (вал)',
            goodsInvoiceValueUah: 'Фактурна вартість грн',
            goodsInvoiceValueUsd: 'Фактурна вартість USD',
            goodsCustomsValue: 'Митна вартість грн',
            goodsPayments: 'Платежі по товару',
            customsOffice: 'Митниця',
            declarantName: 'Декларант',
            guid: 'GUID',
            mrn: 'MRN',
            invoiceNumber: '№ Інвойсу',
            invoiceDate: 'Дата інвойсу',
            cmrNumber: '№ CMR/Накладної',
            cmrDate: 'Дата CMR/Накладної',
            contractNumber: '№ Контракту',
            contractDate: 'Дата контракту',
            manufacturer: 'Виробник',
            invoiceValueCurrency: 'Фактурна вартість (валюта)',
            deliveryTermsIncoterms: 'Умови поставки (Інкотермс)',
            deliveryTermsDetails: 'Місце поставки',
            carrierName: 'Перевізник'
        };

        const headers: string[] = activeKeys.map(key => columnMap[key] || key);
        const rows: any[] = [headers];

        for (const doc of declarationsWithDetails) {
            const mappedData = (doc as any).mappedData;
            const extractedData = (doc as any).extractedData;

            const mdNumber = getMDNumber(getRawData(doc), doc.mrn);
            const registeredDate = extractedData?.ccd_registered
                ? formatRegisteredDate(extractedData.ccd_registered)
                : formatRegisteredDate(getRawData(doc)?.ccd_registered);

            const status = getRawData(doc)?.ccd_status || doc.status;
            const statusText = status === 'R' ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || status);

            const type = extractedData
                ? [extractedData.ccd_01_01, extractedData.ccd_01_02, extractedData.ccd_01_03].filter(Boolean).join(' ') || '---'
                : (getRawData(doc)?.ccd_type || '---');

            // Документи по всій декларації (якщо товарів нема)
            const globalInvoice = findDocumentInfo(doc, null, [380]);
            const globalCmr = findDocumentInfo(doc, null, [730]);
            const globalContract = findDocumentInfo(doc, null, [4100, 4104]);

            const carrier = mappedData?.clients?.find((c: any) => c.box === '50')?.name || '---';
            const transport = Array.isArray(mappedData?.transports)
                ? (mappedData.transports as any[])
                    .filter((t: any) => String(t?.box || '').trim() === '18')
                    .map((t: any) => String(t?.name || '').trim())
                    .filter((v: string) => v && v !== '---')
                    .join('/') || '---'
                : '---';

            if (!mappedData?.goods || mappedData.goods.length === 0) {
                const row: any[] = [];
                activeKeys.forEach(key => {
                    switch (key) {
                        case 'mdNumber': row.push(mdNumber); break;
                        case 'registeredDate': row.push(registeredDate); break;
                        case 'status': row.push(statusText); break;
                        case 'type': row.push(type); break;
                        case 'transport': row.push(transport); break;
                        case 'consignor': row.push(mappedData?.header?.consignor || '---'); break;
                        case 'consignee': row.push(mappedData?.header?.consignee || '---'); break;
                        case 'invoiceValue': row.push(mappedData?.header?.invoiceValue || 0); break;
                        case 'invoiceCurrency': row.push(mappedData?.header?.invoiceCurrency || '---'); break;
                        case 'customsOffice': row.push(mappedData?.header?.customsOffice || '---'); break;
                        case 'declarantName': row.push(mappedData?.header?.declarantName || '---'); break;
                        case 'guid': row.push(getRawData(doc)?.guid || doc.customsId || '---'); break;
                        case 'mrn': row.push(getRawData(doc)?.MRN || doc.mrn || '---'); break;
                        case 'invoiceNumber': row.push(globalInvoice.number); break;
                        case 'invoiceDate': row.push(globalInvoice.date); break;
                        case 'cmrNumber': row.push(globalCmr.number); break;
                        case 'cmrDate': row.push(globalCmr.date); break;
                        case 'contractNumber': row.push(globalContract.number); break;
                        case 'contractDate': row.push(globalContract.date); break;
                        case 'carrierName': row.push(carrier); break;
                        case 'deliveryTermsIncoterms': row.push(mappedData?.header?.deliveryTerms || '---'); break;
                        case 'deliveryTermsDetails': row.push(`${mappedData?.header?.deliveryPlace || ''} ${mappedData?.header?.deliveryCountryCode || ''}`.trim() || '---'); break;
                        default: row.push('---');
                    }
                });
                rows.push(row);
                continue;
            }

            mappedData.goods.forEach((good: any, index: number) => {
                const row: any[] = [];
                const goodsIdx = good.index || index + 1;
                const goodInvoice = findDocumentInfo(doc, goodsIdx, [380]);
                const goodCmr = findDocumentInfo(doc, goodsIdx, [730]);
                const goodContract = findDocumentInfo(doc, goodsIdx, [4100, 4104]);

                const manufacturer = good.producerName || '---';
                const invValCur = good.invoiceSpecification?.[0]?.sumCur || good.price || 0;

                activeKeys.forEach(key => {
                    switch (key) {
                        case 'mdNumber': row.push(mdNumber); break;
                        case 'registeredDate': row.push(registeredDate); break;
                        case 'status': row.push(statusText); break;
                        case 'type': row.push(type); break;
                        case 'transport': row.push(index === 0 ? transport : ''); break;
                        case 'consignor': row.push(mappedData?.header?.consignor || '---'); break;
                        case 'consignee': row.push(mappedData?.header?.consignee || '---'); break;
                        case 'invoiceValue': row.push(index === 0 ? (mappedData?.header?.invoiceValue || 0) : ''); break;
                        case 'invoiceCurrency': row.push(index === 0 ? (mappedData?.header?.invoiceCurrency || '---') : ''); break;
                        case 'goodsIndex': row.push(goodsIdx); break;
                        case 'goodsDescription': row.push(good.description || '---'); break;
                        case 'goodsHSCode': row.push(good.hsCode || '---'); break;
                        case 'goodsPrice': row.push(good.price || 0); break;
                        case 'goodsInvoiceValueUah': row.push((good.price || 0) * (mappedData?.header?.exchangeRate || 0)); break;
                        case 'goodsInvoiceValueUsd':
                            const valUah = (good.price || 0) * (mappedData?.header?.exchangeRate || 0);
                            row.push(usdRate && usdRate > 0 ? valUah / usdRate : 0);
                            break;
                        case 'goodsCustomsValue': row.push(good.customsValue || 0); break;
                        case 'goodsPayments':
                            row.push(good.payments?.map((p: any) => `${p.code || ''} ${p.char || ''}: ${(p.amount || 0).toLocaleString('uk-UA')}`).join('; ') || '---');
                            break;
                        case 'customsOffice': row.push(index === 0 ? (mappedData?.header?.customsOffice || '---') : ''); break;
                        case 'declarantName': row.push(index === 0 ? (mappedData?.header?.declarantName || '---') : ''); break;
                        case 'guid': row.push(index === 0 ? (getRawData(doc)?.guid || doc.customsId || '---') : ''); break;
                        case 'mrn': row.push(index === 0 ? (getRawData(doc)?.MRN || doc.mrn || '---') : ''); break;
                        case 'invoiceNumber': row.push(goodInvoice.number); break;
                        case 'invoiceDate': row.push(goodInvoice.date); break;
                        case 'cmrNumber': row.push(goodCmr.number); break;
                        case 'cmrDate': row.push(goodCmr.date); break;
                        case 'contractNumber': row.push(goodContract.number); break;
                        case 'contractDate': row.push(goodContract.date); break;
                        case 'manufacturer': row.push(manufacturer); break;
                        case 'invoiceValueCurrency': row.push(invValCur); break;
                        case 'deliveryTermsIncoterms': row.push(index === 0 ? (mappedData?.header?.deliveryTerms || '---') : ''); break;
                        case 'deliveryTermsDetails':
                            row.push(index === 0 ? (`${mappedData?.header?.deliveryPlace || ''} ${mappedData?.header?.deliveryCountryCode || ''}`.trim() || '---') : '');
                            break;
                        case 'carrierName': row.push(index === 0 ? carrier : ''); break;
                        default: row.push('---');
                    }
                });
                rows.push(row);
            });
        }

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Set column widths (approximate)
        const colWidths = headers.map(() => ({ wch: 20 }));
        ws['!cols'] = colWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Декларації детально');

        // Generate filename with current date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `Декларації_Розширений_${dateStr}.xlsx`;

        // Write file
        XLSX.writeFile(wb, filename);

    } catch (error) {
        console.error('Помилка розширеного експорту в Excel:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`Помилка при розширеному експорті в Excel. Спробуйте ще раз.\n${message}`);
    }
}



/**
 * Розширений експорт товарів в Excel (один рядок на товар).
 * 
 * Експортує детальну інформацію про кожен товар з декларацій.
 * Створює Excel файл де кожен рядок відповідає одному товару з повною інформацією
 * про декларацію та товар, включаючи розрахунки в USD та платежі.
 * 
 * **Експортуємі дані:**
 * - Інформація про декларацію: тип, MRN, дата оформлення, митниця
 * - Географічні дані: країна відправлення, походження, умови поставки
 * - Інформація про товар: номер, УКТЗЕД, опис, вага (брутто/нетто)
 * - Фінансові дані: фактурна вартість (в грн та USD), митна вартість
 * - Контрагент: ЄДРПОУ та назва контрактотримача (box 9)
 * - Платежі: динамічні колонки для кожного типу платежу
 * - Розрахунки: курс USD, митна вартість в USD за кг нетто
 * 
 * **Особливості:**
 * - Автоматично збирає всі унікальні коди платежів з усіх декларацій
 * - Створює окремі колонки для кожного типу платежу
 * - Розраховує USD вартість на основі курсу НБУ для дати завершення оформлення
 * - Використовує дату з протоколу "Завершення митного оформлення" або дату реєстрації
 * - Автоматична ширина колонок для зручного перегляду
 * 
 * @param sortedDocs - Масив відсортованих декларацій для експорту
 * @param activeTab - Активна вкладка (має бути 'list61' для деталей)
 * @returns Promise, який виконується після створення файлу
 * 
 * @throws Показує alert при помилках або відсутності даних
 * 
 * @example
 * ```ts
 * await exportExtendedGoodsToExcel(sortedDocs, 'list61');
 * // Створює файл: Розширений_експорт_2025-01-16.xlsx
 * // З колонками: декларація + товар + всі типи платежів
 * ```
 */
export async function exportExtendedGoodsToExcel(
    sortedDocs: any[],
    activeTab: ActiveTab,
    exportColumns?: { [key: string]: boolean },
    columnOrder?: string[],
    onProgress?: (p: ExtendedExportProgress) => void,
    signal?: AbortSignal
): Promise<void> {
    try {
        throwIfAborted(signal);
        if (activeTab !== 'list61') {
            alert('Розширений експорт доступний лише на вкладці "Деталі (61.1)"');
            return;
        }

        const docsToEnrich = sortedDocs.filter(d => typeof (d as any)?.id === 'string' && (d as any).id);
        const docsWithFullDetails = await enrichDocsWith61Details(docsToEnrich, 5, onProgress, signal);

        if (docsWithFullDetails.length === 0) {
            alert('Немає декларацій з деталями для розширеного експорту');
            return;
        }

        const columns = exportColumns || DEFAULT_EXPORT_COLUMNS;
        const allPossibleKeys = Object.keys(columns);
        const activeKeys = columnOrder
            ? columnOrder.filter(key => (columns as any)[key])
            : allPossibleKeys.filter(key => (columns as any)[key]);

        const columnMap: { [key: string]: string } = {
            mdNumber: 'Номер МД',
            registeredDate: 'Дата оформлення',
            status: 'Статус',
            type: 'Тип декларації',
            consignor: 'Відправник',
            consignee: 'Отримувач',
            invoiceValue: 'Фактурна вартість',
            invoiceCurrency: 'Валюта',
            goodsCount: 'Кількість товарів',
            customsOffice: 'Митниця',
            declarantName: 'Декларант',
            guid: 'GUID',
            mrn: 'Номер МРН',
            invoiceNumber: '№ Інвойсу',
            invoiceDate: 'Дата інвойсу',
            cmrNumber: '№ CMR/Накладної',
            cmrDate: 'Дата CMR/Накладної',
            contractNumber: '№ Контракту',
            contractDate: 'Дата контракту',
            manufacturer: 'Виробник',
            carrierName: 'Перевізник',
            deliveryTermsIncoterms: 'Умови поставки (Інкотермс)',
            deliveryTermsDetails: 'Місце поставки',
            goodsIndex: 'Номер товару в МД',
            goodsHSCode: 'Код УКТЗЕД товару',
            goodsDescription: 'Опис товару (графа 31)',
            goodsPrice: 'Фактурна вартість в валюті',
            goodsInvoiceValueUah: 'Фактурна вартість в грн',
            goodsInvoiceValueUsd: 'Фактурна вартість в дол',
            goodsCustomsValue: 'Митна вартість в грн',
            goodsPayments: 'Платежі по товару',
            invoiceValueCurrency: 'Фактурна вартість (валюта)',
            transport: 'Транспорт'
        };

        // Collect all unique payment codes across all declarations
        const allPaymentCodes = new Set<string>();
        docsWithFullDetails.forEach(doc => {
            const mappedData = (doc as any).mappedData;
            if (mappedData?.generalPayments) {
                mappedData.generalPayments.forEach((payment: any) => {
                    if (payment.code && payment.code !== '---') {
                        allPaymentCodes.add(payment.code);
                    }
                });
            }
        });
        const paymentCodes = Array.from(allPaymentCodes).sort();

        // Extra columns specific to this extended export mode
        const extraColumns = [
            { key: 'consigneeEdrpou', label: 'ЄДРПОУ контрактотримача' },
            { key: 'consigneeName', label: 'Назва контрактотримача' },
            { key: 'extraUnit', label: 'Дод. од. виміру' },
            { key: 'grossWeight', label: 'Вага брутто' },
            { key: 'netWeight', label: 'Вага нетто' },
            { key: 'usdRate', label: 'Курс дол' },
            { key: 'customsValueUsd', label: 'Митна вартість в дол' },
            { key: 'customsValueUsdPerKg', label: 'Митна вартість в дол за кг нетто' }
        ];

        const headers = [
            ...activeKeys.map(key => columnMap[key] || key),
            ...extraColumns.map(c => c.label),
            ...paymentCodes.map(code => `Платіж ${code}`)
        ];

        const rows: any[] = [headers];

        const totalDocsForRows = docsWithFullDetails.length;
        let docsDoneForRows = 0;

        for (const doc of docsWithFullDetails) {
            throwIfAborted(signal);
            const mappedData = (doc as any).mappedData;
            docsDoneForRows++;
            onProgress?.({ phase: 'generating_rows', current: docsDoneForRows, total: totalDocsForRows });
            if (!mappedData) continue;

            const header = mappedData.header;
            const extractedData = (doc as any).extractedData;

            let completionDate = '';
            let completionDateRaw = '';
            const completionProtocol = mappedData.protocol?.find((p: any) =>
                p.actionName && p.actionName.includes('Завершення митного оформлення')
            );
            if (completionProtocol && completionProtocol.serverDate) {
                completionDateRaw = completionProtocol.serverDate;
                completionDate = formatRegisteredDate(completionProtocol.serverDate);
            } else {
                completionDateRaw = extractedData?.ccd_registered || getRawData(doc)?.ccd_registered || '';
                completionDate = completionDateRaw ? formatRegisteredDate(completionDateRaw) : '---';
            }

            const declarationType = extractedData
                ? [extractedData.ccd_01_01, extractedData.ccd_01_02, extractedData.ccd_01_03].filter(Boolean).join(' ') || '---'
                : (getRawData(doc)?.ccd_type || '---');

            const mrn = doc.mrn || getRawData(doc)?.MRN || '---';
            const carrier = mappedData?.clients?.find((c: any) => c.box === '50')?.name || '---';
            const transport = Array.isArray(mappedData?.transports)
                ? (mappedData.transports as any[])
                    .filter((t: any) => String(t?.box || '').trim() === '18')
                    .map((t: any) => String(t?.name || '').trim())
                    .filter((v: string) => v && v !== '---')
                    .join('/') || '---'
                : '---';

            let usdRate = 0;
            const currencyRateDateRaw = header?.currencyRateDateRaw || completionDateRaw;
            if (currencyRateDateRaw) {
                try {
                    const rate = await getUSDExchangeRateForDate(currencyRateDateRaw);
                    if (rate) usdRate = rate;
                } catch {
                    // Failed to get rate, use 0
                }
            }

            if (!mappedData.goods || mappedData.goods.length === 0) {
                const row: any[] = [];
                activeKeys.forEach(key => {
                    throwIfAborted(signal);
                    switch (key) {
                        case 'mdNumber': row.push(getMDNumber(getRawData(doc), doc.mrn)); break;
                        case 'registeredDate': row.push(completionDate); break;
                        case 'status': row.push(header.status === 'R' ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || doc.status)); break;
                        case 'type': row.push(declarationType); break;
                        case 'transport': row.push(transport); break;
                        case 'consignor': row.push(header.consignor || '---'); break;
                        case 'consignee': row.push(header.consignee || '---'); break;
                        case 'invoiceValue': row.push(0); break;
                        case 'invoiceCurrency': row.push(header.invoiceCurrency || header.currency || '---'); break;
                        case 'goodsCount': row.push(0); break;
                        case 'customsOffice': row.push(header.customsOffice || '---'); break;
                        case 'declarantName': row.push(header.declarantName || '---'); break;
                        case 'guid': row.push(getRawData(doc)?.guid || doc.customsId || '---'); break;
                        case 'mrn': row.push(mrn); break;
                        case 'invoiceNumber': row.push(findDocumentInfo(doc, null, [380]).number); break;
                        case 'invoiceDate': row.push(findDocumentInfo(doc, null, [380]).date); break;
                        case 'cmrNumber': row.push(findDocumentInfo(doc, null, [730]).number); break;
                        case 'cmrDate': row.push(findDocumentInfo(doc, null, [730]).date); break;
                        case 'contractNumber': row.push(findDocumentInfo(doc, null, [4100, 4104]).number); break;
                        case 'contractDate': row.push(findDocumentInfo(doc, null, [4100, 4104]).date); break;
                        case 'manufacturer': row.push('---'); break;
                        case 'carrierName': row.push(carrier); break;
                        case 'deliveryTermsIncoterms': row.push(header.deliveryTerms || '---'); break;
                        case 'deliveryTermsDetails': row.push(`${header.deliveryPlace || ''} ${header.deliveryCountryCode || ''}`.trim() || '---'); break;
                        case 'goodsIndex': row.push(''); break;
                        case 'goodsHSCode': row.push('---'); break;
                        case 'goodsDescription': row.push('---'); break;
                        case 'goodsPrice': row.push(0); break;
                        case 'goodsInvoiceValueUah': row.push(0); break;
                        case 'goodsInvoiceValueUsd': row.push(0); break;
                        case 'goodsCustomsValue': row.push(0); break;
                        case 'goodsPayments': row.push('---'); break;
                        default: row.push('---');
                    }
                });
                row.push((mappedData.clients?.find((c: any) => c.box === '9')?.code) || '---');
                row.push((mappedData.clients?.find((c: any) => c.box === '9')?.name) || '---');
                row.push('---');
                row.push(0);
                row.push(0);
                row.push(usdRate > 0 ? usdRate : '---');
                row.push(0);
                row.push(0);
                paymentCodes.forEach(() => row.push('0.00'));
                rows.push(row);
                continue;
            }

            for (const goods of mappedData.goods) {
                throwIfAborted(signal);
                if (!goods) continue;

                const producerName = goods.producerName || '---';
                const goodsIdx = goods.index || mappedData.goods.indexOf(goods) + 1;
                const docInvoice = findDocumentInfo(doc, goodsIdx, [380]);
                const docCmr = findDocumentInfo(doc, goodsIdx, [730]);
                const docContract = findDocumentInfo(doc, goodsIdx, [4100, 4104]);

                const invoiceValueInCurrency = goods.price || 0;
                const declarationExchangeRate = header.exchangeRate || 0;
                const invoiceValueUah = invoiceValueInCurrency * declarationExchangeRate;
                const invoiceValueUsd = usdRate > 0 ? invoiceValueUah / usdRate : 0;
                const customsValueUah = goods.customsValue || 0;
                const customsValueUsd = usdRate > 0 ? customsValueUah / usdRate : 0;
                const netWeight = goods.netWeight || 0;
                const customsValueUsdPerKg = netWeight > 0 ? customsValueUsd / netWeight : 0;

                const row: any[] = [];

                // Base dynamic columns
                activeKeys.forEach(key => {
                    switch (key) {
                        case 'mdNumber': row.push(getMDNumber(getRawData(doc), doc.mrn)); break;
                        case 'registeredDate': row.push(completionDate); break;
                        case 'status': row.push(header.status === 'R' ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || doc.status)); break;
                        case 'type': row.push(declarationType); break;
                        case 'transport': row.push(transport); break;
                        case 'consignor': row.push(header.consignor || '---'); break;
                        case 'consignee': row.push(header.consignee || '---'); break;
                        case 'invoiceValue': row.push(invoiceValueUah); break;
                        case 'invoiceCurrency': row.push(header.invoiceCurrency || header.currency || '---'); break;
                        case 'goodsCount': row.push(mappedData.goods.length); break;
                        case 'customsOffice': row.push(header.customsOffice || '---'); break;
                        case 'declarantName': row.push(header.declarantName || '---'); break;
                        case 'guid': row.push(getRawData(doc)?.guid || doc.customsId || '---'); break;
                        case 'mrn': row.push(mrn); break;
                        case 'invoiceNumber': row.push(docInvoice.number); break;
                        case 'invoiceDate': row.push(docInvoice.date); break;
                        case 'cmrNumber': row.push(docCmr.number); break;
                        case 'cmrDate': row.push(docCmr.date); break;
                        case 'contractNumber': row.push(docContract.number); break;
                        case 'contractDate': row.push(docContract.date); break;
                        case 'manufacturer': row.push(producerName); break;
                        case 'carrierName': row.push(carrier); break;
                        case 'deliveryTermsIncoterms': row.push(header.deliveryTerms || '---'); break;
                        case 'deliveryTermsDetails': row.push(`${header.deliveryPlace || ''} ${header.deliveryCountryCode || ''}`.trim() || '---'); break;
                        case 'goodsIndex': row.push(goodsIdx); break;
                        case 'goodsHSCode': row.push(goods.hsCode || '---'); break;
                        case 'goodsDescription': row.push(goods.description || '---'); break;
                        case 'goodsPrice': row.push(invoiceValueInCurrency); break;
                        case 'goodsInvoiceValueUah': row.push(invoiceValueUah); break;
                        case 'goodsInvoiceValueUsd': row.push(invoiceValueUsd); break;
                        case 'goodsCustomsValue': row.push(customsValueUah); break;
                        case 'goodsPayments': row.push(goods.payments?.map((p: any) => `${p.code || ''} ${p.char || ''}: ${(p.amount || 0).toLocaleString('uk-UA')}`).join('; ') || '---'); break;
                        default: row.push('---');
                    }
                });

                // Extra fixed columns for this mode
                row.push((mappedData.clients?.find((c: any) => c.box === '9')?.code) || '---');
                row.push((mappedData.clients?.find((c: any) => c.box === '9')?.name) || '---');
                row.push(goods.addUnitCode || '---');
                row.push(goods.grossWeight || 0);
                row.push(goods.netWeight || 0);
                row.push(usdRate > 0 ? usdRate : '---');
                row.push(customsValueUsd);
                row.push(customsValueUsdPerKg);

                // Payment columns
                const paymentMap = new Map<string, number>();
                if (mappedData.generalPayments) {
                    mappedData.generalPayments.forEach((payment: any) => {
                        throwIfAborted(signal);
                        if (payment.code && payment.code !== '---') {
                            const existing = paymentMap.get(payment.code) || 0;
                            paymentMap.set(payment.code, existing + (payment.amount || 0));
                        }
                    });
                }

                paymentCodes.forEach(code => {
                    throwIfAborted(signal);
                    row.push(paymentMap.get(code)?.toFixed(2) || '0.00');
                });

                rows.push(row);
            }
        }

        if (rows.length <= 1) {
            alert('Немає даних по товарах для розширеного експорту');
            return;
        }

        onProgress?.({ phase: 'writing_file', current: 1, total: 1 });

        throwIfAborted(signal);

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Set column widths
        const colWidths = headers.map(() => ({ wch: 20 }));
        ws['!cols'] = colWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Товари');

        // Generate filename with current date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const filename = `Розширений_експорт_${dateStr}.xlsx`;

        // Write file
        XLSX.writeFile(wb, filename);

    } catch (error) {
        if ((error as any)?.name === 'AbortError') {
            return;
        }
        console.error('Помилка розширеного експорту в Excel:', error);
        alert('Помилка при розширеному експорті в Excel. Спробуйте ще раз.');
    }
}
