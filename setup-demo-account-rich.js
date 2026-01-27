const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEMO_EMAIL = 'test@gmail.com';
const DEMO_COMPANY_NAME = 'ДЕМО: ТОВ "ТрансЛогістик Плюс"';
const DEMO_EDRPOU = '00000000';

async function setup() {
    console.log('🏗️  Generating ULTRA-RICH demo data...');

    try {
        const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
        const company = await prisma.company.findUnique({ where: { edrpou: DEMO_EDRPOU } });
        if (!user || !company) return console.error('❌ Run basic setup first.');

        await prisma.declaration.deleteMany({ where: { companyId: company.id } });

        const shippers = [
            { name: 'Apple Distribution International Ltd.', addr: 'Hollyhill Industrial Estate, Cork, Ireland', country: 'IE' },
            { name: 'Samsung Electronics Poland Sp. z o.o.', addr: 'ul. Postępu 14, 02-676 Warsaw, Poland', country: 'PL' },
            { name: 'DHL Global Forwarding GmbH', addr: 'Düsseldorf, Germany', country: 'DE' },
            { name: 'Robert Bosch GmbH', addr: 'Stuttgart-Feuerbach, Germany', country: 'DE' }
        ];

        const goodsLibrary = [
            { desc: 'Смартфони Apple iPhone 15 Pro, моделі A3106, в асортименті кольорів', code: '8517130000', weight: 0.18, price: 950 },
            { desc: 'Ноутбуки Apple MacBook Pro 14 (M3 Pro chip), 18GB RAM, 512GB SSD', code: '8471300000', weight: 1.6, price: 1850 },
            { desc: 'Маніпулятори типу "миша"無 дротові, мультимедійні, модель MX Master 3S', code: '8471607000', weight: 0.25, price: 65 },
            { desc: 'Частини до обладнання для сортування: вал приводний сталевий', code: '8474909000', weight: 14.5, price: 420 },
            { desc: 'Промислові контролери: модулі вводу-виводу для систем автоматизації', code: '8537109100', weight: 0.8, price: 310 }
        ];

        const offices = ['UA100010', 'UA100060', 'UA500020', 'UA500040'];
        const incoterms = ['DAP', 'FCA', 'CIF', 'EXW'];

        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 90));
            const dateStr = date.toISOString().replace(/[-:T]/g, '').slice(0, 8) + 'T100000';
            const shortDate = date.toISOString().split('T')[0];

            const shipper = shippers[i % shippers.length];
            const office = offices[i % offices.length];
            const term = incoterms[i % incoterms.length];

            // 1-4 items per declaration
            const itemsCount = Math.floor(Math.random() * 3) + 1;
            let totalInvoice = 0;
            let totalWeightNet = 0;
            let totalWeightGross = 0;
            let goodsXml = '';

            for (let j = 0; j < itemsCount; j++) {
                const g = goodsLibrary[(i + j) % goodsLibrary.length];
                const qty = Math.floor(Math.random() * 50) + 1;
                const itemInvoice = g.price * qty;
                const itemNet = g.weight * qty;
                const itemGross = itemNet * 1.15;
                const itemUah = itemInvoice * 41.6;

                totalInvoice += itemInvoice;
                totalWeightNet += itemNet;
                totalWeightGross += itemGross;

                goodsXml += `
                <ccd_goods>
                    <ccd_32_01>${j + 1}</ccd_32_01>
                    <ccd_31_01>${g.desc} - ${qty} шт.</ccd_31_01>
                    <ccd_33_01>${g.code}</ccd_33_01>
                    <ccd_35_01>${itemGross.toFixed(2)}</ccd_35_01>
                    <ccd_38_01>${itemNet.toFixed(2)}</ccd_38_01>
                    <ccd_42_01>${itemInvoice.toFixed(2)}</ccd_42_01>
                    <ccd_42_02>${itemUah.toFixed(2)}</ccd_42_02>
                    <ccd_45_01>${(itemUah * 1.05).toFixed(2)}</ccd_45_01>
                    <ccd_goods_pay>
                        <ccd_47_code>020</ccd_47_code>
                        <ccd_47_base>${itemUah.toFixed(2)}</ccd_47_base>
                        <ccd_47_tax>${(itemUah * 0.1).toFixed(2)}</ccd_47_tax>
                        <ccd_47_sp>01</ccd_47_sp>
                    </ccd_goods_pay>
                    <ccd_goods_pay>
                        <ccd_47_code>028</ccd_47_code>
                        <ccd_47_base>${(itemUah * 1.1).toFixed(2)}</ccd_47_base>
                        <ccd_47_tax>${(itemUah * 1.1 * 0.2).toFixed(2)}</ccd_47_tax>
                        <ccd_47_sp>01</ccd_47_sp>
                    </ccd_goods_pay>
                    <ccd_goods_docs>
                        <ccd_doc_part>44</ccd_doc_part>
                        <ccd_doc_code>0002</ccd_doc_code>
                        <ccd_doc_name>Специфікація до інвойсу №${100 + i}</ccd_doc_name>
                    </ccd_goods_docs>
                </ccd_goods>`;
            }

            const mrn = `${Math.floor(Math.random() * 99)}UA${office.substring(2)}00${200000 + i}`;
            const guid = `GUID-RICH-DEMO-${i}`;

            const ccdXml = `<ccd>
                <guid>${guid}</guid>
                <MRN>${mrn}</MRN>
                <ccd_status>R</ccd_status>
                <ccd_registered>${dateStr}</ccd_registered>
                <version_start>${shortDate}</version_start>
                <ccd_01_01>ІМ</ccd_01_01>
                <ccd_01_02>40</ccd_01_02>
                <ccd_01_03>ДЕ</ccd_01_03>
                <ccd_07_01>${office}</ccd_07_01>
                <ccd_07_04>MD-${i + 1000}</ccd_07_04>
                <ccd_12_01>${(totalInvoice * 41.6 * 1.05).toFixed(2)}</ccd_12_01>
                <ccd_22_cur>USD</ccd_22_cur>
                <ccd_22_01>USD</ccd_22_01>
                <ccd_22_02>${totalInvoice.toFixed(2)}</ccd_22_02>
                <ccd_22_03>${(totalInvoice * 41.6).toFixed(2)}</ccd_22_03>
                <ccd_23_01>41.6023</ccd_23_01>
                <ccd_20_01>${term}</ccd_20_01>
                <ccd_20_02>KYYIV</ccd_20_02>
                <ccd_20_cnt>UA</ccd_20_cnt>
                <ccd_05_01>${itemsCount}</ccd_05_01>
                <ccd_06_01>${Math.floor(totalWeightNet / 5) + 1}</ccd_06_01>
                
                <ccd_clients>
                    <ccd_cl_gr>2</ccd_cl_gr>
                    <ccd_cl_name>${shipper.name}</ccd_cl_name>
                    <ccd_cl_adr>${shipper.addr}, ${shipper.country}</ccd_cl_adr>
                    <ccd_cl_cnt>${shipper.country}</ccd_cl_cnt>
                </ccd_clients>
                <ccd_clients>
                    <ccd_cl_gr>8</ccd_cl_gr>
                    <ccd_cl_name>${DEMO_COMPANY_NAME}</ccd_cl_name>
                    <ccd_cl_adr>01001, м. Київ, вул. Хрещатик, 1</ccd_cl_adr>
                    <ccd_cl_code>38612543</ccd_cl_code>
                </ccd_clients>
                <ccd_clients>
                    <ccd_cl_gr>14</ccd_cl_gr>
                    <ccd_cl_name>ТОВ "Митний Брокер Центр"</ccd_cl_name>
                    <ccd_cl_code>25123456</ccd_cl_code>
                </ccd_clients>

                ${goodsXml}

                <ccd_cmn_docs>
                    <ccd_doc_part>44</ccd_doc_part>
                    <ccd_doc_code>3010</ccd_doc_code>
                    <ccd_doc_name>Інвойс №INV-${1000 + i}</ccd_doc_name>
                    <ccd_doc_date_beg>${shortDate}</ccd_doc_date_beg>
                </ccd_cmn_docs>
                <ccd_cmn_docs>
                    <ccd_doc_part>44</ccd_doc_part>
                    <ccd_doc_code>3004</ccd_doc_code>
                    <ccd_doc_name>CMR №CMR-TX-${20000 + i}</ccd_doc_name>
                    <ccd_doc_date_beg>${shortDate}</ccd_doc_date_beg>
                </ccd_cmn_docs>
                <ccd_cmn_docs>
                    <ccd_doc_part>44</ccd_doc_part>
                    <ccd_doc_code>9001</ccd_doc_code>
                    <ccd_doc_name>Зовнішньоекономічний контракт №CONT-2024/01</ccd_doc_name>
                    <ccd_doc_date_beg>2024-01-10</ccd_doc_date_beg>
                </ccd_cmn_docs>

                <ccd_transport>
                    <ccd_trn_gr>18</ccd_trn_gr>
                    <ccd_trn_name>AA 1234 BB / TR 5678 CC</ccd_trn_name>
                    <ccd_trn_cnt>UA</ccd_trn_cnt>
                </ccd_transport>

                <ccd_proc>
                    <pr_code>28</pr_code>
                    <pr_pib>Головний інспектор Коваленко О.М.</pr_pib>
                    <pr_date>${dateStr}</pr_date>
                    <proc_name>Випуск товарів у вільний обіг дозволено</proc_name>
                </ccd_proc>
            </ccd>`;

            const xmlData = JSON.stringify({
                data60_1: {
                    guid: guid,
                    MRN: mrn,
                    ccd_registered: dateStr,
                    ccd_status: 'R',
                    ccd_type: 'ІМ 40 ДЕ',
                    consignor_name: shipper.name,
                    consignee_name: DEMO_COMPANY_NAME
                },
                data61_1: ccdXml
            });

            await prisma.declaration.create({
                data: {
                    companyId: company.id,
                    customsId: guid,
                    mrn: mrn,
                    status: 'CLEARED',
                    xmlData: xmlData,
                    date: date,
                    declarantName: 'ТОВ "Митний Брокер Центр"',
                    senderName: shipper.name,
                    recipientName: DEMO_COMPANY_NAME,
                    summary: {
                        create: {
                            customsValue: totalInvoice * 41.6 * 1.05,
                            currency: 'USD',
                            totalItems: itemsCount,
                            customsOffice: office,
                            declarantName: 'ТОВ "Митний Брокер Центр"',
                            senderName: shipper.name,
                            recipientName: DEMO_COMPANY_NAME,
                            declarationType: 'ІМ 40 ДЕ',
                            registeredDate: date,
                            invoiceValue: totalInvoice,
                            invoiceCurrency: 'USD',
                            invoiceValueUah: totalInvoice * 41.6,
                            exchangeRate: 41.6,
                            transportDetails: 'AA 1234 BB / TR 5678 CC'
                        }
                    }
                }
            });
        }

        console.log('✨ SUCCESS! Your demo database is now ULTRA-RICH with realistic declarations.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setup();
