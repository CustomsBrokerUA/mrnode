/**
 * Базовий тип декларації з бази даних.
 * Містить основну інформацію про декларацію та опціональний summary.
 */
export type Declaration = {
    id: string;
    customsId: string | null;
    mrn: string | null;
    status: string;
    xmlData: string | null;
    date: Date;
    updatedAt: Date;
    companyId: string;
    hsCodes?: Array<{ hsCode: string }>;
    summary: {
        id: string;
        customsValue: number | null;
        currency: string | null;
        totalItems: number | null;
        customsOffice: string | null;
        declarantName: string | null;
        senderName: string | null;
        recipientName: string | null;
        declarationType: string | null;
        contractHolder: string | null;
        registeredDate: Date | null;
        invoiceValue: number | null;
        invoiceCurrency: string | null;
        invoiceValueUah: number | null;
        exchangeRate: number | null;
        transportDetails: string | null;
    } | null;
};

/**
 * Розширений тип декларації з rawData.
 * Використовується для списку 60.1, де потрібен швидкий доступ до полів без повного парсингу XML.
 */
export type DeclarationWithRawData = Declaration & {
    rawData: {
        MRN?: string;
        guid?: string;
        ccd_registered?: string;
        ccd_status?: string;
        ccd_type?: string;
        trn_all?: string;
        ccd_07_01?: string;
        ccd_07_02?: string;
        ccd_07_03?: string;
        ccd_01_01?: string;
        ccd_01_02?: string;
        ccd_01_03?: string;
    } | null;
};

/** Режим відображення декларацій: таблиця, картки або компактний список */
export type ViewMode = 'table' | 'cards' | 'compact';

/** Активна вкладка: список 60.1 (короткий) або список 61.1 (детальний) */
export type ActiveTab = 'list60' | 'list61';

/** Напрямок сортування: за зростанням або за спаданням */
export type SortDirection = 'asc' | 'desc';

/** Колонки для сортування */
export type SortColumn = 'mdNumber' | 'registeredDate' | 'status' | 'type' | 'consignor' | 'consignee' | 'invoiceValue' | 'goodsCount' | 'transport';
