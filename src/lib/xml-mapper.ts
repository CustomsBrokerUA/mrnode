import { XMLParser } from "fast-xml-parser";

export interface MappedGoods {
    index: number;          // ccd_32_01
    description: string;    // ccd_31_01
    containersCount: string; // ccd_31_02
    packagesCount: string;  // ccd_31_03
    packageType: string;    // ccd_31_03p
    additionalUnits: string; // ccd_31_04
    energyMonth: string;    // ccd_31_05
    hsCode: string;         // ccd_33_01
    originCountry: string;  // ccd_34_01
    grossWeight: number;    // ccd_35_01
    netWeight: number;      // ccd_38_01
    price: number;          // ccd_42_01 (Invoice value in currency)
    invoiceValueUah: number; // ccd_42_02
    customsValue: number;    // ccd_45_01
    statisticalValue: number; // ccd_46_01
    guaranteeCode: string;   // ccd_43_01
    prefDuty: string;       // ccd_36_02
    prefExcise: string;     // ccd_36_03
    prefVat: string;        // ccd_36_04
    procedure: string;      // ccd_37_01
    prevProcedure: string;  // ccd_37_02
    procFeatures: string;   // ccd_37_03
    addProcFeature: string; // ccd_37_04
    quota: string;          // ccd_39_01
    addUnitCode: string;    // ccd_41_01
    addClassification: string; // ccd_33_02
    exportControl: string;   // ccd_33_03
    completeness: string;    // ccd_31_06
    storageTerm: string;     // ccd_term
    netWeightClean: number;  // ccd_31_38
    guaranteeRelease: string; // ccd_43_02
    dccMethod: string;       // ccd_dcc_method
    specification: string;   // ccd_inv_pos
    docsCount: number;       // Summary count
    paymentsCount: number;   // Summary of ccd_goods_pay
    prevDocsCount: number;   // Summary of ccd_goods_prv
    containers: MappedGoodsContainer[]; // ccd_goods_cont
    returns: MappedGoodsBack[];         // ccd_goods_back
    dccDistributions: MappedGoodsDcc[]; // ccd_goods_dcc
    docs: MappedGoodsDoc[];             // ccd_goods_docs
    packaging: MappedGoodsPack[];       // ccd_goods_pack
    payments: MappedGoodsPayment[];     // ccd_goods_pay
    prevDocs: MappedGoodsPrevDoc[];     // ccd_goods_prv
    producerName: string;   // ccd_inv_prod_name
    invoiceSpecification: MappedInvoicePosition[]; // ccd_inv_pos (Specification)
}

export interface MappedInvoicePosition {
    pos: string;        // ccd_inv_pos
    name: string;       // ccd_inv_name
    article: string;    // ccd_inv_art
    packaging: string;  // ccd_inv_pack
    price: number;      // ccd_inv_price
    sumCur: number;     // ccd_inv_sum_cur
    sumUah: number;     // ccd_inv_sum
    weightGross: number; // ccd_inv_wb
    weightNet: number;   // ccd_inv_wn
    trademark: string;   // ccd_inv_tm
    producerName: string; // ccd_inv_prod_name
    producerCountry: string; // ccd_inv_prod_cnt_
    qty: number;        // ccd_inv_qty
    unit: string;       // ccd_inv_unit
    qty2: number;       // ccd_inv_qty2
    unit2: string;      // ccd_inv_unit2
    details: MappedSpecDetail[]; // ccd_inv_det
    prevDeclarations: MappedSpecPrevDoc[]; // ccd_inv_prv
}

export interface MappedSpecDetail {
    code: string;       // ccd_id_code
    value: string;      // ccd_id_value
}

export interface MappedSpecPrevDoc {
    mrn: string;        // ccd_ir_07_01 / 02 / 03
    goodsNum: string;   // ccd_ir_32_01
    pos: string;        // ccd_ir_pos
    weightGross: number; // ccd_ir_wb
    weightNet: number;   // ccd_ir_wn
    qty: number;        // ccd_ir_qty
    unit: string;       // ccd_ir_unit
}

export interface MappedGoodsPrevDoc {
    code: string;       // ccd_doc_code
    name: string;       // ccd_doc_name
    date: string;       // ccd_doc_date_beg
    goodsNum: string;   // ccd_doc_goods
    writeOff: string;   // ccd_doc_wn
    unit: string;       // ccd_doc_unit
    qty: number;        // ccd_doc_qty
}

export interface MappedGoodsPayment {
    code: string;       // ccd_47_code
    char: string;       // ccd_47_char
    base: number;       // ccd_47_base
    baseType: string;   // ccd_47_base_type
    tax: number;        // ccd_47_tax
    taxType: string;    // ccd_47_tax_type
    taxDiv: number;     // ccd_47_tax_div
    sum: number;        // ccd_47_sum
    method: string;     // ccd_47_sp
    currency: string;   // ccd_47_cur
    isHidden: boolean;  // ccd_47_hidden
}

export interface MappedGoodsDoc {
    part: string;     // ccd_doc_part
    code: string;     // ccd_doc_code
    name: string;     // ccd_doc_name
    dateBeg: string;  // ccd_doc_date_beg
    dateEnd: string;  // ccd_doc_date_end
    goodsNum: string; // ccd_doc_goods
    unit: string;     // ccd_doc_unit
    qty: number;      // ccd_doc_qty
}

export interface MappedGoodsPack {
    code: string;     // ccd_pk_code
    qty: number;      // ccd_pk_qty
    text: string;     // ccd_pk_text
}

export interface MappedGoodsBack {
    box: string;     // ccd_bk_gr
    content: string; // ccd_bk_content
}

export interface MappedGoodsContainer {
    type: string;    // ccd_cnt_type
    name: string;    // ccd_cnt_name
    isPart: string;  // ccd_cnt_ispart
}

export interface MappedGoodsDcc {
    code: string;    // ccd_dcc_code
    currency: string; // ccd_dcc_cur
    rate: number;    // ccd_dcc_cur_rate
    price: number;   // ccd_dcc_price
    quantity: number; // ccd_dcc_quant
    unit: string;    // ccd_dcc_unit
    sumCur: number;  // ccd_dcc_sum_cur
    sumUah: number;  // ccd_dcc_sum
}

export interface MappedProtocol {
    code: string;       // pr_code
    userCode: string;   // pr_user
    userName: string;   // pr_pib
    inspectorId: string; // pr_ksiva
    date: string;       // pr_date
    serverDate: string; // pr_srv_date
    actionName: string; // proc_name
    inspectorCardIns: string; // pr_ksiva_ins
}

export interface MappedTax {
    code: string;
    base: number;
    rate: string;
    amount: number;
    paymentMethod: string;
}

export interface MappedGeneralPayment {
    code: string;           // ccd_pay_code
    method: string;         // ccd_pay_sp
    amount: number;         // ccd_pay_sum
    currency: string;       // ccd_pay_cur
    bankDetails: string;    // ccd_pay_bank
    date: string;           // ccd_48_01
    promissoryNoteDate: string; // ccd_48_02
    docNumber: string;      // ccd_ndoc
    payer: string;          // ccd_payer
    penaltyCode: string;    // ccd_pay_code_sub (AK only)
    direction: string;      // ccd_pay_dir (AK only)
    correctionBasis: string; // ccd_pay_src (AK only)
}

export interface MappedDocument {
    boxPart: string;    // ccd_doc_part (Box 44 section)
    type: string;       // ccd_doc_code
    number: string;     // ccd_doc_nom or ccd_doc_name
    date: string;       // ccd_doc_dat or ccd_doc_date_beg
    expiryDate: string; // ccd_doc_date_end
}

export interface MappedPaymentDocument {
    code: string;       // ccd_pd_code or p_doc_code
    method: string;     // ccd_pd_sp
    payerCode: string;  // ccd_pd_payer
    number: string;     // ccd_pd_number or p_doc_nom
    date: string;       // ccd_pd_date or p_doc_dat
    promissoryNoteDate: string; // ccd_pd_end
    amount: number;     // ccd_pd_sum
    currency: string;   // ccd_pd_cur
    boxPart: string;    // p_doc_part
}

export interface MappedBank {
    box: string;        // ccd_bn_gr
    pos: string;        // ccd_bn_pos
    clientBox: string;  // ccd_cl_gr
    clientPos: string;  // ccd_cl_pos
    country: string;    // ccd_bn_cnt
    name: string;       // ccd_bn_name
    address: string;    // ccd_bn_adr
    edrpou: string;     // ccd_bn_code
    mfo: string;        // ccd_bn_mfo
    account: string;    // ccd_bn_acnt
    bic: string;        // ccd_bn_bic
    iban: string;       // ccd_bn_iban
}

export interface MappedClient {
    box: string;        // ccd_cl_gr
    pos: string;        // ccd_cl_pos
    country: string;    // ccd_cl_cnt
    code: string;       // ccd_cl_code
    vat: string;        // ccd_cl_vat
    name: string;       // ccd_cl_name
    address: string;    // ccd_cl_adr
    uori: string;       // ccd_cl_uori
    tel: string;        // ccd_cl_tel
    ownershipForm: string; // ccd_cl_01
    ownershipType: string; // ccd_cl_02
    enterpriseType: string; // ccd_cl_03
    govOwnershipForm: string; // ccd_cl_04
    admTerrStructure: string; // ccd_cl_05
}

export interface MappedAfc {
    typeCode: string; // ccd_afc_code (1 - value, 2 - weight)
    currency: string;
    sumCur: number;
    sumUah: number;
    rate: number;
}

export interface MappedDcc {
    code: string;       // ccd_dcc_code
    distType: string;   // ccd_dcc_dist
    currency: string;   // ccd_dcc_cur
    rate: number;       // ccd_dcc_cur_rate
    sumCur: number;     // ccd_dcc_sum_cur
    sumUah: number;     // ccd_dcc_sum
}

export interface MappedLicense {
    box: string;        // ccd_lic_gr
    pos: string;        // ccd_lic_pos
    type: string;       // ccd_lic_type
    number: string;     // ccd_lic_num
    date: string;       // ccd_lic_date
    gkType: string;     // ccd_lic_gk_type
}

export interface MappedBack {
    box: string; // ccd_bk_gr
    content: string; // ccd_back_content
}

export interface MappedObligation {
    type: string;       // ccd_obl_type
    subjectType: string; // ccd_obl_subj
    country: string;    // ccd_obl_cnt
    passportSeries: string; // ccd_obl_pas_ser
    passportNumber: string; // ccd_obl_pas_num
    surname: string;    // ccd_obl_surname
    name: string;       // ccd_obl_name
    patronymic: string; // ccd_obl_patr
    expiryDate: string; // ccd_obl_exp
}

export interface MappedTransport {
    box: string;        // ccd_trn_gr
    name: string;       // ccd_trn_name
    countryCode: string; // ccd_trn_cnt
}

export interface MappedDeclaration {
    header: {
        mrn: string;
        type: string;
        date: string;
        rawDate: string;
        customsOffice: string;
        internalNumber: string;
        consignor: string;
        consignee: string;
        contractHolder: string; // Graph 9 - Financial responsible person
        deliveryTerms: string;
        deliveryPlace: string;
        deliveryCountryCode: string;
        paymentForm: string;
        totalValue: number;
        currency: string;
        displayStatus: string;
        packagesCount: string;
        containersIndicator: string; // ccd_19_01
        originCountryCode: string;
        destCountryCode: string;
        totalItems: number;
        invoiceValue: number;
        invoiceCurrency: string;
        invoiceValueUah: number;
        exchangeRate: number;
        transportCount: string;
        transportDetails: string;
        transactionCharacter: string;
        transactionCurrency: string;
        borderTransportMode: string;
        inlandTransportMode: string;
        transshipmentCustoms: string;
        borderCustoms: string;
        inspectionPlace: string;
        deferredPaymentDate: string;
        trDeliveryDate: string;
        guaranteeAmount: number;
        guaranteeDoc: string;
        deliveryDate: string;
        guaranteeCode: string;
        destCustoms: string;
        fillingPlace: string;
        declarantName: string;
        fillingDate: string;
        declarantId: string;
        declarantPosition: string;
        declarantPhone: string;
        eCertNumber: string;
        md8Sheets: string;
        extMovement: string;
        intMovement: string;
        obligation50: string;
        custDest: string;
        mdNumberPart1: string; // ccd_07_01
        mdNumberPart2: string; // ccd_07_02
        mdNumberPart3: string; // ccd_07_03
    };
    goods: MappedGoods[];
    taxes: MappedTax[];
    generalPayments: MappedGeneralPayment[];
    protocol: MappedProtocol[];
    documents: MappedDocument[];
    banks: MappedBank[];
    clients: MappedClient[];
    paymentDocs: MappedPaymentDocument[];
    invoiceCosts: MappedAfc[];
    dccCosts: MappedDcc[];
    licenses: MappedLicense[];
    backContent: MappedBack[];
    obligations: MappedObligation[];
    transports: MappedTransport[];
}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
});

/**
 * Форматує дату з різних форматів у формат DD.MM.YYYY або DD.MM.YYYY HH:MM:SS.
 * 
 * Підтримувані формати:
 * - YYYYMMDDTHHMMSS (формат митниці, наприклад: 20250116T120000)
 * - YYYYMMDD (формат без часу)
 * - YYYY-MM-DD (стандартний ISO формат)
 * 
 * @param val - Значення дати (string, number або об'єкт Date)
 * @returns Відформатована дата у вигляді "DD.MM.YYYY" або "DD.MM.YYYY HH:MM:SS"
 * 
 * @example
 * ```ts
 * formatDate('20250116T120000') // "16.01.2025 12:00:00"
 * formatDate('20250116') // "16.01.2025"
 * formatDate('2025-01-16') // "16.01.2025"
 * ```
 */
function formatDate(val: any): string {
    const s = String(val || '');
    // Handle YYYYMMDDTHHMMSS (Custom Customs Format)
    if (/^\d{8}T\d{6}$/.test(s)) {
        return `${s.substring(6, 8)}.${s.substring(4, 6)}.${s.substring(0, 4)} ${s.substring(9, 11)}:${s.substring(11, 13)}:${s.substring(13, 15)}`;
    }
    // Handle YYYYMMDD
    if (/^\d{8}$/.test(s)) {
        return `${s.substring(6, 8)}.${s.substring(4, 6)}.${s.substring(0, 4)}`;
    }
    // Handle YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const parts = s.split('-');
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return s || '---';
}

/**
 * Безпечно конвертує значення з XML (які можуть бути об'єктами при вкладеності) у рядки для UI,
 * щоб запобігти падінням React.
 * 
 * Особливості:
 * - Обробляє null/undefined (повертає defaultVal)
 * - Конвертує об'єкти в рядки (об'єднує значення через кому)
 * - Спеціальна обробка об'єктів з полями ccd_obl_* (для відображення обов'язків)
 * - Завжди повертає рядок (незалежно від типу вхідних даних)
 * 
 * @param val - Значення для конвертації (може бути будь-яким типом)
 * @param defaultVal - Значення за замовчуванням, якщо val порожнє (за замовчуванням: '---')
 * @returns Рядкове представлення значення
 * 
 * @example
 * ```ts
 * safeStringify('text') // "text"
 * safeStringify(null) // "---"
 * safeStringify({ ccd_obl_surname: 'Іванов', ccd_obl_name: 'Іван' }) // "Іванов Іван"
 * safeStringify({ a: 1, b: 2 }) // "1, 2"
 * ```
 */
function safeStringify(val: any, defaultVal: string = '---'): string {
    if (val === null || val === undefined) return defaultVal;
    if (typeof val === 'object') {
        const parts = [];
        if (val.ccd_obl_surname) parts.push(val.ccd_obl_surname);
        if (val.ccd_obl_name) parts.push(val.ccd_obl_name);
        if (val.ccd_obl_type) parts.push(`(${val.ccd_obl_type})`);
        if (parts.length > 0) return parts.join(' ').trim();

        return Object.values(val)
            .filter(v => typeof v !== 'object')
            .join(', ') || defaultVal;
    }
    return String(val);
}

/**
 * Конвертує значення в число, обробляючи різні формати (коми, крапки, порожні значення).
 * 
 * Особливості:
 * - Замінює коми на крапки (європейський формат)
 * - Повертає 0 для порожніх або невалідних значень
 * - Безпечна обробка null/undefined
 * 
 * @param val - Значення для конвертації
 * @returns Число (0 для невалідних значень)
 * 
 * @example
 * ```ts
 * parseToNum('123,45') // 123.45
 * parseToNum('123.45') // 123.45
 * parseToNum(null) // 0
 * parseToNum('') // 0
 * ```
 */
function parseToNum(val: any): number {
    return parseFloat(String(val || '0').replace(',', '.'));
}

/**
 * Парсить XML декларацію митниці та конвертує її у структурований об'єкт.
 * 
 * Ця функція є основною для перетворення сирого XML від митниці у зручну для відображення структуру.
 * Обробляє всі основні секції декларації: header, goods, taxes, payments, documents, clients та інші.
 * 
 * **Обробляє:**
 * - Статуси декларацій (R=Оформлена, N=Анульована, F=Відкликана)
 * - Товари з специфікаціями, платежами та документами
 * - Учасників (відправник, отримувач, договірний контрагент)
 * - Платежі та податки
 * - Протоколи та документи
 * - Банківські реквізити
 * - Транспорт та інші деталі
 * 
 * **Особливості парсингу:**
 * - Автоматичне виявлення кореневого елемента XML
 * - Обробка як масивів, так і одиночних об'єктів для повторюваних елементів
 * - Безпечна конвертація типів (рядки, числа, дати)
 * - Виправлення форматів дат
 * - Обробка вкладених структур (специфікації товарів, документи)
 * 
 * @param xmlString - XML рядок декларації (може бути null)
 * @returns Структурований об'єкт декларації або null при помилці парсингу
 * 
 * @throws Не кидає помилки, але повертає null при помилках парсингу (логуються в console.error)
 * 
 * @example
 * ```ts
 * const xml = '<ccd><MRN>123/456/001</MRN><ccd_status>R</ccd_status>...</ccd>';
 * const declaration = mapXmlToDeclaration(xml);
 * if (declaration) {
 *   console.log(declaration.header.mrn); // "123/456/001"
 *   console.log(declaration.goods.length); // кількість товарів
 * }
 * ```
 */
export function mapXmlToDeclaration(xmlString: string | null): MappedDeclaration | null {
    if (!xmlString) return null;

    try {
        const jsonObj = parser.parse(xmlString);
        const rootKey = Object.keys(jsonObj).find(k => !k.startsWith('?')) || Object.keys(jsonObj)[0];
        const data = jsonObj[rootKey];

        if (!data) return null;

        const ccd = data;

        // Collections wrapper
        const asArray = (val: any) => {
            if (!val) return [];
            return Array.isArray(val) ? val : [val];
        };

        // Status Decoding
        const rawStatus = String(ccd.ccd_status || 'R').trim();
        const statusMap: Record<string, string> = {
            'R': 'Оформлена',
            'N': 'Анульована',
            'F': 'Відкликана/Відмовлена'
        };
        const displayStatus = statusMap[rawStatus] || rawStatus;

        // MRN
        const mrn = ccd.MRN || `${ccd.ccd_07_01 || ''}/${ccd.ccd_07_02 || ''}/${ccd.ccd_07_03 || ''}`;

        // Participants Mapping (Batch 9)
        const clientsArray = asArray(ccd.ccd_clients || ccd.ccd_client);
        const clients: MappedClient[] = clientsArray.map((c: any) => ({
            box: safeStringify(c.ccd_cl_gr),
            pos: safeStringify(c.ccd_cl_pos),
            country: safeStringify(c.ccd_cl_cnt),
            code: safeStringify(c.ccd_cl_code),
            vat: safeStringify(c.ccd_cl_vat),
            name: safeStringify(c.ccd_cl_name),
            address: safeStringify(c.ccd_cl_adr),
            uori: safeStringify(c.ccd_cl_uori),
            tel: safeStringify(c.ccd_cl_tel),
            ownershipForm: safeStringify(c.ccd_cl_01),
            ownershipType: safeStringify(c.ccd_cl_02),
            enterpriseType: safeStringify(c.ccd_cl_03),
            govOwnershipForm: safeStringify(c.ccd_cl_04),
            admTerrStructure: safeStringify(c.ccd_cl_05),
        }));

        // Consignor/Consignee/ContractHolder for Header
        let consignor = 'Не вказано';
        let consignee = 'Не вказано';
        let contractHolder = 'Не вказано';
        const sender = clients.find((c: MappedClient) => c.box === '2');
        if (sender) consignor = sender.name || 'N/A';
        const receiver = clients.find((c: MappedClient) => c.box === '8');
        if (receiver) consignee = receiver.name || 'N/A';
        const contractHolderClient = clients.find((c: MappedClient) => c.box === '9');
        if (contractHolderClient) contractHolder = contractHolderClient.name || 'N/A';

        // Collect documents from first item (for promoting to global list)
        let firstItemDocs: any[] = [];

        // Goods Mapping (Batch 15-27)
        const allTopLevelSpec = asArray(ccd.ccd_inv_pos || ccd.ccd_invpos || ccd.ccd_inv_spec);

        const goods: MappedGoods[] = asArray(ccd.ccd_goods).map((g: any, index: number) => {
            const goodsIndex = parseInt(g.ccd_32_01) || index + 1;

            // Try to get spec from goods item, or from top level if linked
            let rawSpec = asArray(g.ccd_inv_pos || g.ccd_invpos || g.ccd_inv_spec);
            if (rawSpec.length === 0) {
                rawSpec = allTopLevelSpec.filter((ip: any) =>
                    safeStringify(ip.ccd_32_01) === goodsIndex.toString() ||
                    safeStringify(ip.ccd_inv_g) === goodsIndex.toString()
                );
            }

            const mappedDocs = asArray(g.ccd_cmn_docs || g.ccd_goods_docs || g.ccd_goods_doc).map((d: any) => ({
                part: safeStringify(d.ccd_doc_part),
                code: safeStringify(d.ccd_doc_code),
                name: safeStringify(d.ccd_doc_name),
                dateBeg: formatDate(d.ccd_doc_date_beg),
                dateEnd: formatDate(d.ccd_doc_date_end),
                goodsNum: safeStringify(d.ccd_doc_goods),
                unit: safeStringify(d.ccd_doc_unit),
                qty: parseToNum(d.ccd_doc_qty),
            }));

            if (goodsIndex === 1) {
                firstItemDocs = mappedDocs;
            }

            return {
                index: goodsIndex,
                description: safeStringify(g.ccd_31_01) || 'Опис відсутній',
                containersCount: safeStringify(g.ccd_31_02),
                packagesCount: safeStringify(g.ccd_31_03),
                packageType: safeStringify(g.ccd_31_03p),
                additionalUnits: safeStringify(g.ccd_31_04),
                energyMonth: safeStringify(g.ccd_31_05),
                hsCode: g.ccd_33_01 || 'N/A',
                originCountry: safeStringify(g.ccd_34_01),
                grossWeight: parseToNum(g.ccd_35_01),
                netWeight: parseToNum(g.ccd_38_01),
                price: parseToNum(g.ccd_42_01),
                invoiceValueUah: parseToNum(g.ccd_42_02),
                customsValue: parseToNum(g.ccd_45_01),
                statisticalValue: parseToNum(g.ccd_46_01),
                guaranteeCode: safeStringify(g.ccd_43_01),
                prefDuty: safeStringify(g.ccd_36_02),
                prefExcise: safeStringify(g.ccd_36_03),
                prefVat: safeStringify(g.ccd_36_04),
                procedure: safeStringify(g.ccd_37_01),
                prevProcedure: safeStringify(g.ccd_37_02),
                procFeatures: safeStringify(g.ccd_37_03),
                addProcFeature: safeStringify(g.ccd_37_04),
                quota: safeStringify(g.ccd_39_01),
                addUnitCode: safeStringify(g.ccd_41_01),
                addClassification: safeStringify(g.ccd_33_02),
                exportControl: safeStringify(g.ccd_33_03),
                completeness: safeStringify(g.ccd_31_06),
                storageTerm: safeStringify(g.ccd_term),
                netWeightClean: parseToNum(g.ccd_31_38),
                guaranteeRelease: safeStringify(g.ccd_43_02),
                dccMethod: safeStringify(g.ccd_dcc_method),
                specification: safeStringify(g.ccd_inv_pos),
                docsCount: mappedDocs.length,
                paymentsCount: asArray(g.ccd_goods_pay).length,
                prevDocsCount: asArray(g.ccd_goods_prv).length,
                containers: asArray(g.ccd_goods_cont).map((c: any) => ({
                    type: safeStringify(c.ccd_cnt_type),
                    name: safeStringify(c.ccd_cnt_name),
                    isPart: safeStringify(c.ccd_cnt_ispart),
                })),
                returns: asArray(g.ccd_goods_back).map((b: any) => ({
                    box: safeStringify(b.ccd_bk_gr),
                    content: safeStringify(b.ccd_bk_content),
                })),
                dccDistributions: asArray(g.ccd_goods_dcc).map((d: any) => ({
                    code: safeStringify(d.ccd_dcc_code),
                    currency: safeStringify(d.ccd_dcc_cur),
                    rate: parseToNum(d.ccd_dcc_cur_rate),
                    price: parseToNum(d.ccd_dcc_price),
                    quantity: parseToNum(d.ccd_dcc_quant),
                    unit: safeStringify(d.ccd_dcc_unit),
                    sumCur: parseToNum(d.ccd_dcc_sum_cur),
                    sumUah: parseToNum(d.ccd_dcc_sum),
                })),
                docs: mappedDocs,
                packaging: asArray(g.ccd_goods_pack).map((p: any) => ({
                    code: safeStringify(p.ccd_pk_code),
                    qty: parseToNum(p.ccd_pk_qty),
                    text: safeStringify(p.ccd_pk_text),
                })),
                payments: asArray(g.ccd_goods_pay).map((p: any) => ({
                    code: safeStringify(p.ccd_47_code),
                    char: safeStringify(p.ccd_47_char),
                    base: parseToNum(p.ccd_47_base),
                    baseType: safeStringify(p.ccd_47_base_type),
                    tax: parseToNum(p.ccd_47_tax),
                    taxType: safeStringify(p.ccd_47_tax_type),
                    taxDiv: parseToNum(p.ccd_47_tax_div),
                    sum: parseToNum(p.ccd_47_sum),
                    method: safeStringify(p.ccd_47_sp),
                    currency: safeStringify(p.ccd_47_cur),
                    isHidden: safeStringify(p.ccd_47_hidden) === '1',
                })),
                prevDocs: asArray(g.ccd_goods_prv).map((pd: any) => ({
                    code: safeStringify(pd.ccd_doc_code),
                    name: safeStringify(pd.ccd_doc_name),
                    date: formatDate(pd.ccd_doc_date_beg),
                    goodsNum: safeStringify(pd.ccd_doc_goods),
                    writeOff: safeStringify(pd.ccd_doc_wn),
                    unit: safeStringify(pd.ccd_doc_unit),
                    qty: parseToNum(pd.ccd_doc_qty),
                })),
                producerName: safeStringify(g.ccd_inv_prod_name || g.ccd_inv_prod_name_ || g.ccd_inv_producer || rawSpec.map((ip: any) => ip.ccd_inv_prod_name || ip.ccd_inv_prod_name_ || ip.ccd_inv_producer).filter(Boolean).join(', ')),
                invoiceSpecification: rawSpec.map((ip: any) => {
                    const sCur = parseToNum(ip.ccd_inv_sum_cur || ip.ccd_inv_sumcur);
                    const sUah = parseToNum(ip.ccd_inv_sum || ip.ccd_inv_sumuah || ip.ccd_inv_sum_uah);

                    return {
                        pos: safeStringify(ip.ccd_inv_pos),
                        name: safeStringify(ip.ccd_inv_name),
                        article: safeStringify(ip.ccd_inv_art || ip.ccd_inv_article),
                        packaging: safeStringify(ip.ccd_inv_pack),
                        price: parseToNum(ip.ccd_inv_price),
                        sumCur: sCur,
                        sumUah: sUah || (sCur * parseToNum(ccd.ccd_23_01 || 1)),
                        weightGross: parseToNum(ip.ccd_inv_wb || ip.ccd_inv_gross),
                        weightNet: parseToNum(ip.ccd_inv_wn || ip.ccd_inv_net),
                        trademark: safeStringify(ip.ccd_inv_tm || ip.ccd_inv_trademark),
                        producerName: safeStringify(ip.ccd_inv_prod_name || ip.ccd_inv_prod_name_ || ip.ccd_inv_producer),
                        producerCountry: safeStringify(ip.ccd_inv_prod_cnt || ip.ccd_inv_prod_cnt_ || ip.ccd_inv_cnt || ip.ccd_inv_prod_country),
                        qty: parseToNum(ip.ccd_inv_qty || ip.ccd_inv_quant || ip.ccd_inv_qnt),
                        unit: safeStringify(ip.ccd_inv_unit),
                        qty2: parseToNum(ip.ccd_inv_qty2 || ip.ccd_inv_qnt2),
                        unit2: safeStringify(ip.ccd_inv_unit2),
                        details: asArray(ip.ccd_inv_det).map((d: any) => ({
                            code: safeStringify(d.ccd_id_code),
                            value: safeStringify(d.ccd_id_value),
                        })),
                        prevDeclarations: asArray(ip.ccd_inv_prv).map((pd: any) => ({
                            mrn: `${safeStringify(pd.ccd_ir_07_01)}/${safeStringify(pd.ccd_ir_07_02)}/${safeStringify(pd.ccd_ir_07_03)}`,
                            goodsNum: safeStringify(pd.ccd_ir_32_01),
                            pos: safeStringify(pd.ccd_ir_pos),
                            weightGross: parseToNum(pd.ccd_ir_wb),
                            weightNet: parseToNum(pd.ccd_ir_wn),
                            qty: parseToNum(pd.ccd_ir_qty),
                            unit: safeStringify(pd.ccd_ir_unit),
                        })),
                    };
                }),
            };
        });

        // Protocol
        const protocol: MappedProtocol[] = asArray(ccd.ccd_proc).map((p: any) => ({
            code: safeStringify(p.pr_code),
            userCode: safeStringify(p.pr_user),
            userName: safeStringify(p.pr_pib || 'Митниця'),
            inspectorId: safeStringify(p.pr_ksiva),
            date: formatDate(p.pr_date),
            serverDate: safeStringify(p.pr_srv_date || p.pr_date), // pr_srv_date або fallback на pr_date
            actionName: safeStringify(p.proc_name || 'Дія'),
            inspectorCardIns: safeStringify(p.pr_ksiva_ins),
        }));

        // Box 47 Taxes
        const taxes: MappedTax[] = asArray(ccd.ccd_payments || ccd.ccd_payment)
            .filter((t: any) => t.ccd_pay_base !== undefined)
            .map((t: any) => ({
                code: safeStringify(t.ccd_pay_code),
                base: parseToNum(t.ccd_pay_base),
                rate: safeStringify(t.ccd_pay_rate || '0'),
                amount: parseToNum(t.ccd_pay_sum),
                paymentMethod: safeStringify(t.ccd_pay_sp),
            }));

        // Box B General Payments
        const generalPayments: MappedGeneralPayment[] = asArray(ccd.ccd_payments || ccd.ccd_payment)
            .filter((t: any) => t.ccd_ndoc !== undefined || t.ccd_payer !== undefined || t.ccd_pay_bank !== undefined)
            .map((t: any) => ({
                code: safeStringify(t.ccd_pay_code),
                method: safeStringify(t.ccd_pay_sp),
                amount: parseToNum(t.ccd_pay_sum),
                currency: safeStringify(t.ccd_pay_cur),
                bankDetails: safeStringify(t.ccd_pay_bank),
                date: formatDate(t.ccd_48_01),
                promissoryNoteDate: formatDate(t.ccd_48_02),
                docNumber: safeStringify(t.ccd_ndoc),
                payer: safeStringify(t.ccd_payer),
                penaltyCode: safeStringify(t.ccd_pay_code_sub),
                direction: safeStringify(t.ccd_pay_dir),
                correctionBasis: safeStringify(t.ccd_pay_src),
            }));

        // Documents (Global + First Item Goods Docs promoted)
        const globalDocsArray = asArray(ccd.ccd_cmn_docs || ccd.ccd_cmn_doc);
        const globalDocs: MappedDocument[] = globalDocsArray.map((d: any) => ({
            boxPart: safeStringify(d.ccd_doc_part),
            type: safeStringify(d.ccd_doc_code),
            number: safeStringify(d.ccd_doc_name || d.ccd_doc_nom),
            date: formatDate(d.ccd_doc_date_beg || d.ccd_doc_dat),
            expiryDate: formatDate(d.ccd_doc_date_end),
        }));

        // Promotion logic: Add documents from the first goods item to the global list if they are not already there
        const promotedDocs: MappedDocument[] = firstItemDocs.map(d => ({
            boxPart: d.part,
            type: d.code,
            number: d.name,
            date: d.dateBeg,
            expiryDate: d.dateEnd,
        }));

        // Combine and Filter Duplicates (by number)
        const allDocuments = [...globalDocs];
        promotedDocs.forEach(pd => {
            if (!allDocuments.some(ad => ad.number === pd.number && ad.type === pd.type)) {
                allDocuments.push(pd);
            }
        });
        const documents = allDocuments;

        // Banks
        const banks: MappedBank[] = asArray(ccd.ccd_bank).map((b: any) => ({
            box: safeStringify(b.ccd_bn_gr),
            pos: safeStringify(b.ccd_bn_pos),
            clientBox: safeStringify(b.ccd_cl_gr),
            clientPos: safeStringify(b.ccd_cl_pos),
            country: safeStringify(b.ccd_bn_cnt),
            name: safeStringify(b.ccd_bn_name || b.ccd_bnk_name),
            address: safeStringify(b.ccd_bn_adr),
            edrpou: safeStringify(b.ccd_bn_code || b.ccd_bnk_code),
            mfo: safeStringify(b.ccd_bn_mfo || b.ccd_bnk_mfo),
            account: safeStringify(b.ccd_bn_acnt || b.ccd_bnk_acc),
            bic: safeStringify(b.ccd_bn_bic),
            iban: safeStringify(b.ccd_bn_iban),
        }));

        // Payment Docs
        const paymentDocs: MappedPaymentDocument[] = asArray(ccd.ccd_pay_docs).map((d: any) => ({
            code: safeStringify(d.ccd_pd_code || d.p_doc_code),
            method: safeStringify(d.ccd_pd_sp),
            payerCode: safeStringify(d.ccd_pd_payer),
            number: safeStringify(d.ccd_pd_number || d.p_doc_nom),
            date: formatDate(d.ccd_pd_date || d.p_doc_dat),
            promissoryNoteDate: formatDate(d.ccd_pd_end),
            amount: parseToNum(d.ccd_pd_sum),
            currency: safeStringify(d.ccd_pd_cur),
            boxPart: safeStringify(d.p_doc_part),
        }));

        // Costs (AFC)
        const invoiceCosts: MappedAfc[] = asArray(ccd.ccd_afc).map((a: any) => ({
            typeCode: safeStringify(a.ccd_afc_code),
            currency: safeStringify(a.ccd_afc_cur),
            sumCur: parseToNum(a.ccd_afc_sum_cur),
            sumUah: parseToNum(a.ccd_afc_sum),
            rate: parseToNum(a.ccd_afc_cur_rate),
        }));

        // DCC Mapping
        const dccCosts: MappedDcc[] = asArray(ccd.ccd_dcc).map((d: any) => ({
            code: safeStringify(d.ccd_dcc_code),
            distType: safeStringify(d.ccd_dcc_dist),
            currency: safeStringify(d.ccd_dcc_cur),
            rate: parseToNum(d.ccd_dcc_cur_rate),
            sumCur: parseToNum(d.ccd_dcc_sum_cur),
            sumUah: parseToNum(d.ccd_dcc_sum),
        }));

        // Licenses Mapping
        const licenses: MappedLicense[] = asArray(ccd.ccd_licences || ccd.ccd_license).map((l: any) => ({
            box: safeStringify(l.ccd_lic_gr),
            pos: safeStringify(l.ccd_lic_pos),
            type: safeStringify(l.ccd_lic_type),
            number: safeStringify(l.ccd_lic_num),
            date: formatDate(l.ccd_lic_date),
            gkType: safeStringify(l.ccd_lic_gk_type),
        }));

        // Obligations Mapping
        const obligations: MappedObligation[] = asArray(ccd.ccd_int_obl).map((o: any) => ({
            type: safeStringify(o.ccd_obl_type),
            subjectType: safeStringify(o.ccd_obl_subj),
            country: safeStringify(o.ccd_obl_cnt),
            passportSeries: safeStringify(o.ccd_obl_pas_ser),
            passportNumber: safeStringify(o.ccd_obl_pas_num),
            surname: safeStringify(o.ccd_obl_surname),
            name: safeStringify(o.ccd_obl_name),
            patronymic: safeStringify(o.ccd_obl_patr),
            expiryDate: formatDate(o.ccd_obl_exp),
        }));

        // Transport Detailed Mapping
        const transports: MappedTransport[] = asArray(ccd.ccd_transport).map((t: any) => ({
            box: safeStringify(t.ccd_trn_gr),
            name: safeStringify(t.ccd_trn_name),
            countryCode: safeStringify(t.ccd_trn_cnt),
        }));

        // Back Content
        const backContent: MappedBack[] = asArray(ccd.ccd_back).map((b: any) => ({
            box: safeStringify(b.ccd_bk_gr),
            content: safeStringify(b.ccd_back_content),
        }));

        return {
            header: {
                mrn: mrn === '//' ? 'N/A' : mrn,
                type: safeStringify(`${ccd.ccd_01_01 || ''} / ${ccd.ccd_01_02 || ''} / ${ccd.ccd_01_03 || ''}`.trim()),
                date: formatDate(ccd.version_start),
                rawDate: safeStringify(ccd.ccd_registered || ccd.version_start), // Original date for exchange rate calculation (ccd_registered)
                customsOffice: safeStringify(ccd.ccd_07_01),
                internalNumber: safeStringify(ccd.ccd_07_04),
                consignor,
                consignee,
                contractHolder,
                deliveryTerms: safeStringify(ccd.ccd_20_01),
                deliveryPlace: safeStringify(ccd.ccd_20_02),
                deliveryCountryCode: safeStringify(ccd.ccd_20_cnt),
                paymentForm: safeStringify(ccd.ccd_20_03),
                totalValue: parseToNum(ccd.ccd_12_01),
                currency: safeStringify(ccd.ccd_22_cur || 'UAH'),
                displayStatus,
                packagesCount: safeStringify(ccd.ccd_06_01 || '0'),
                originCountryCode: safeStringify(ccd.ccd_15_01),
                destCountryCode: safeStringify(ccd.ccd_17_01),
                totalItems: parseInt(ccd.ccd_05_01 || '0'),
                invoiceValue: parseToNum(ccd.ccd_22_02),
                invoiceCurrency: safeStringify(ccd.ccd_22_01),
                invoiceValueUah: parseToNum(ccd.ccd_22_03),
                exchangeRate: parseToNum(ccd.ccd_23_01),
                transportCount: safeStringify(ccd.ccd_21_01 || '0'),
                containersIndicator: safeStringify(ccd.ccd_19_01 || '0'),
                transportDetails: transports
                    .map(t => `${t.name} (${t.countryCode})`)
                    .filter(val => val.length > 4)
                    .join(', ') || safeStringify(ccd.ccd_21_04),
                transactionCharacter: safeStringify(ccd.ccd_24_01),
                transactionCurrency: safeStringify(ccd.ccd_24_02),
                borderTransportMode: safeStringify(ccd.ccd_25_01),
                inlandTransportMode: safeStringify(ccd.ccd_26_01),
                transshipmentCustoms: safeStringify(ccd.ccd_27_01),
                borderCustoms: safeStringify(ccd.ccd_29_01),
                inspectionPlace: safeStringify(ccd.ccd_30_01),
                deferredPaymentDate: formatDate(ccd.ccd_48_01),
                trDeliveryDate: formatDate(ccd.ccd_51_01),
                guaranteeAmount: parseToNum(ccd.ccd_51_02),
                guaranteeDoc: safeStringify(ccd.ccd_51_03),
                deliveryDate: formatDate(ccd.ccd_52_01),
                guaranteeCode: safeStringify(ccd.ccd_52_02),
                destCustoms: safeStringify(ccd.ccd_53_01),
                fillingPlace: safeStringify(ccd.ccd_54_01),
                declarantName: safeStringify(ccd.ccd_54_02),
                fillingDate: formatDate(ccd.ccd_54_03),
                declarantId: safeStringify(ccd.ccd_54_04),
                declarantPosition: safeStringify(ccd.ccd_54_05),
                declarantPhone: safeStringify(ccd.ccd_54_06),
                eCertNumber: safeStringify(ccd.ccd_54_07),
                md8Sheets: safeStringify(ccd.ccd_04_02 || '0'),
                extMovement: safeStringify(ccd.ccd_ext_mov),
                intMovement: safeStringify(ccd.ccd_int_mov),
                obligation50: safeStringify(ccd.ccd_int_obl),
                custDest: safeStringify(ccd.ccd_cust_dest),
                mdNumberPart1: safeStringify(ccd.ccd_07_01),
                mdNumberPart2: safeStringify(ccd.ccd_07_02),
                mdNumberPart3: safeStringify(ccd.ccd_07_03),
            },
            goods,
            taxes,
            generalPayments,
            protocol,
            documents,
            banks,
            clients,
            paymentDocs,
            invoiceCosts,
            dccCosts,
            licenses,
            backContent,
            obligations,
            transports,
        };
    } catch (err) {
        console.error("XML Mapping Error:", err);
        return null;
    }
}

/**
 * Простий парсер XML, який повертає сирий JSON об'єкт без структурування.
 * 
 * Використовується для швидкого доступу до сирих даних XML без повної обробки.
 * Корисно для діагностики або доступу до нестандартних полів.
 * 
 * @param xmlString - XML рядок для парсингу
 * @returns JSON об'єкт з розпарсеними даними або об'єкт з помилкою { error: string }
 * 
 * @example
 * ```ts
 * const raw = parseRawOnly('<ccd><field>value</field></ccd>');
 * console.log(raw.ccd.field); // "value"
 * 
 * const error = parseRawOnly(null);
 * console.log(error.error); // "No XML"
 * ```
 */
export function parseRawOnly(xmlString: string | null): any {
    if (!xmlString) return { error: "No XML" };
    try {
        const jsonObj = parser.parse(xmlString);
        return jsonObj[Object.keys(jsonObj).find(k => !k.startsWith('?')) || ''] || jsonObj;
    } catch (err: any) {
        return { error: err.message };
    }
}
