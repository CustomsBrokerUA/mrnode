import { DeclarationWithRawData } from './types';
import { getRawData, formatRegisteredDate } from './utils';

/**
 * Опції фільтрації для декларацій.
 * Всі поля опціональні - якщо поле не вказано, фільтр не застосовується.
 */
export interface FilterOptions {
    /** Статус декларації: 'all', 'cleared', 'PROCESSING', 'REJECTED' */
    status?: string;
    /** Дата початку періоду (формат: YYYY-MM-DD) */
    dateFrom?: string;
    /** Дата кінця періоду (формат: YYYY-MM-DD) */
    dateTo?: string;
    /** Код або назва митниці (частковий пошук) */
    customsOffice?: string;
    /** Валюта (наразі не використовується в list60) */
    currency?: string;
    /** Мінімальна фактурна вартість (наразі не використовується в list60) */
    invoiceValueFrom?: string;
    /** Максимальна фактурна вартість (наразі не використовується в list60) */
    invoiceValueTo?: string;
    /** Назва відправника (наразі не використовується в list60) */
    consignor?: string;
    /** Назва отримувача (наразі не використовується в list60) */
    consignee?: string;
    /** Назва договірного контрагента (наразі не використовується в list60) */
    contractHolder?: string;
    /** Код УКТЗЕД (наразі не використовується в list60) */
    hsCode?: string;
    /** Тип декларації (підтримує множинні значення через кому, наприклад: "ІМ,ЕК") */
    declarationType?: string;
    /** Текстовий пошук по MRN, GUID, типу, транспорту (регістронезалежний) */
    searchTerm?: string;
}

/**
 * Фільтрує декларації для списку 60.1 (короткий формат) на основі заданих критеріїв.
 * 
 * **Підтримувані фільтри**:
 * - Статус (включаючи спеціальний статус "cleared" для статусу 'R')
 * - Діапазон дат (від/до)
 * - Тип декларації (підтримує множинні значення через кому)
 * - Митниця (частковий пошук)
 * - Текстовий пошук (MRN, GUID, тип, транспорт)
 * 
 * **Особливості**:
 * - Фільтри застосовуються послідовно (AND логіка)
 * - Пошук регістронезалежний
 * - Тип декларації може бути заданий як повний рядок або з частин (ccd_01_01, ccd_01_02, ccd_01_03)
 * - Дата береться з `ccd_registered` або fallback на `doc.date`
 * 
 * @param declarations - Масив декларацій для фільтрації
 * @param filters - Об'єкт з опціями фільтрації
 * @returns Відфільтрований масив декларацій
 * 
 * @example
 * ```ts
 * const filtered = filterDeclarations60(declarations, {
 *   status: 'cleared',
 *   dateFrom: '2025-01-01',
 *   customsOffice: 'Митниця1',
 *   searchTerm: 'MRN123'
 * });
 * ```
 */
export function filterDeclarations60(
    declarations: DeclarationWithRawData[],
    filters: FilterOptions
): DeclarationWithRawData[] {
    let filtered = [...declarations];

    // Status filter
    if (filters.status && filters.status !== 'all') {
        if (filters.status === 'cleared') {
            filtered = filtered.filter(doc => getRawData(doc)?.ccd_status === 'R');
        } else {
            filtered = filtered.filter(doc => doc.status === filters.status);
        }
    }

    // Date range filter
    if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(doc => {
            const rawData = getRawData(doc);
            const docDate = rawData?.ccd_registered
                ? new Date(rawData.ccd_registered.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'))
                : doc.date;
            return docDate >= fromDate;
        });
    }

    if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(doc => {
            const rawData = getRawData(doc);
            const docDate = rawData?.ccd_registered
                ? new Date(rawData.ccd_registered.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'))
                : doc.date;
            return docDate <= toDate;
        });
    }

    // Declaration type filter
    if (filters.declarationType) {
        const searchTerms = String(filters.declarationType).split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
        filtered = filtered.filter(doc => {
            const type = getRawData(doc)?.ccd_type?.toLowerCase() || '';
            if (type && searchTerms.some(term => type.includes(term))) {
                return true;
            }
            const typeParts = [
                getRawData(doc)?.ccd_01_01,
                getRawData(doc)?.ccd_01_02,
                getRawData(doc)?.ccd_01_03
            ].filter(Boolean).join(' ').toLowerCase();
            return typeParts && searchTerms.some(term => typeParts.includes(term));
        });
    }

    // Customs office filter
    if (filters.customsOffice) {
        filtered = filtered.filter(doc => {
            const office = getRawData(doc)?.ccd_07_01?.toLowerCase() || '';
            return office && office.includes(filters.customsOffice!.toLowerCase());
        });
    }

    // Search filter
    if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(doc => {
            const mdNumber = getRawData(doc)?.MRN || doc.mrn || '';
            return (
                doc.mrn?.toLowerCase().includes(search) ||
                doc.customsId?.toLowerCase().includes(search) ||
                mdNumber.toLowerCase().includes(search) ||
                getRawData(doc)?.guid?.toLowerCase().includes(search) ||
                getRawData(doc)?.ccd_type?.toLowerCase().includes(search) ||
                (typeof getRawData(doc)?.trn_all === 'string' 
                    ? getRawData(doc)?.trn_all.toLowerCase().includes(search)
                    : Array.isArray(getRawData(doc)?.trn_all)
                        ? getRawData(doc)?.trn_all.some((t: any) => String(t).toLowerCase().includes(search))
                        : String(getRawData(doc)?.trn_all || '').toLowerCase().includes(search))
            );
        });
    }

    return filtered;
}
