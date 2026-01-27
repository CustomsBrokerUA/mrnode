const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEMO_EMAIL = 'test@gmail.com';
const DEMO_COMPANY_NAME = 'ДЕМО: ТОВ "ТрансЛогістик Плюс"';
const DEMO_EDRPOU = '00000000';

async function setup() {
    console.log('🏗️  Updating demo account with realistic CCD mapping...');

    try {
        const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
        if (!user) {
            console.error('❌ User not found.');
            return;
        }

        const company = await prisma.company.findUnique({ where: { edrpou: DEMO_EDRPOU } });
        if (!company) {
            console.error('❌ Demo company not found.');
            return;
        }

        await prisma.declaration.deleteMany({ where: { companyId: company.id } });

        const statuses = ['CLEARED', 'CLEARED', 'PROCESSING', 'REJECTED'];
        const types = ['ІМ 40 ЕЕ', 'ІМ 40 ДЕ', 'ЕК 10 ЕЕ', 'ТР 80 ЕЕ'];
        const offices = ['UA100010', 'UA100060', 'UA500020', 'UA500040'];
        const shippers = [
            { name: 'Apple Inc.', addr: 'One Apple Park Way, Cupertino, CA' },
            { name: 'Samsung Electronics', addr: '129 Samsung-ro, Suwon-si, Gyeonggi-do' },
            { name: 'Logitech Europe S.A.', addr: 'EPFL - Quartier de l\'Innovation, Lausanne' },
            { name: 'BMW AG', addr: 'Petuelring 130, 80809 Munich, Germany' }
        ];
        const itemVariations = [
            { desc: 'Смартфон Apple iPhone 15 Pro Max 256GB', code: '8517130000' },
            { desc: 'Ноутбук Apple MacBook Air 13 M3', code: '8471300000' },
            { desc: 'Запчастини до двигунів внутрішнього згорання', code: '8409910000' },
            { desc: 'Планшетний комп\'ютер Samsung Galaxy Tab S9', code: '8471300000' }
        ];

        console.log(`📊 Generating 30 declarations with realistic XML mapping...`);

        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 60));

            const status = statuses[i % statuses.length];
            const type = types[i % types.length];
            const office = offices[i % offices.length];
            const shipper = shippers[i % shippers.length];
            const item = itemVariations[i % itemVariations.length];

            const val = Math.floor(Math.random() * 20000) + 500;
            const uahVal = val * 41.5;
            const mrn = `${Math.floor(Math.random() * 99)}UA${office.substring(2)}00${100000 + i}`;
            const guid = `GUID-DEMO-${i}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

            // Create XML structure that mapXmlToDeclaration expects
            const ccdXml = `<ccd>
                <guid>${guid}</guid>
                <MRN>${mrn}</MRN>
                <ccd_status>${status === 'CLEARED' ? 'R' : (status === 'REJECTED' ? 'N' : 'P')}</ccd_status>
                <ccd_registered>${date.toISOString().replace(/[-:T]/g, '').slice(0, 8)}T120000</ccd_registered>
                <ccd_type>${type}</ccd_type>
                <ccd_01_01>${type.split(' ')[0]}</ccd_01_01>
                <ccd_01_02>${type.split(' ')[1]}</ccd_01_02>
                <ccd_01_03>${type.split(' ')[2]}</ccd_01_03>
                
                <ccd_clients>
                    <ccd_cl_gr>2</ccd_cl_gr>
                    <ccd_cl_name>${shipper.name}</ccd_cl_name>
                    <ccd_cl_adr>${shipper.addr}</ccd_cl_adr>
                </ccd_clients>
                <ccd_clients>
                    <ccd_cl_gr>8</ccd_cl_gr>
                    <ccd_cl_name>${DEMO_COMPANY_NAME}</ccd_cl_name>
                    <ccd_cl_code>${DEMO_EDRPOU}</ccd_cl_code>
                </ccd_clients>
                <ccd_clients>
                    <ccd_cl_gr>9</ccd_cl_gr>
                    <ccd_cl_name>АТ "Ощадбанк"</ccd_cl_name>
                    <ccd_cl_adr>м. Київ, вул. Госпітальна, 12г</ccd_cl_adr>
                </ccd_clients>

                <ccd_goods>
                    <ccd_32_01>1</ccd_32_01>
                    <ccd_31_01>${item.desc}</ccd_31_01>
                    <ccd_33_01>${item.code}</ccd_33_01>
                    <ccd_35_01>15.5</ccd_35_01>
                    <ccd_38_01>14.2</ccd_38_01>
                    <ccd_42_01>${val}</ccd_42_01>
                    <ccd_42_02>${uahVal}</ccd_42_02>
                    <ccd_45_01>${uahVal * 1.1}</ccd_45_01>
                    <ccd_goods_pay>
                        <ccd_47_code>020</ccd_47_code>
                        <ccd_47_base>${uahVal}</ccd_47_base>
                        <ccd_47_tax>${uahVal * 0.1}</ccd_47_tax>
                        <ccd_47_cur>UAH</ccd_47_cur>
                    </ccd_goods_pay>
                    <ccd_goods_pay>
                        <ccd_47_code>028</ccd_47_code>
                        <ccd_47_base>${uahVal * 1.1}</ccd_47_base>
                        <ccd_47_tax>${uahVal * 1.1 * 0.2}</ccd_47_tax>
                        <ccd_47_cur>UAH</ccd_47_cur>
                    </ccd_goods_pay>
                </ccd_goods>

                <ccd_cmn_docs>
                    <ccd_doc_part>44</ccd_doc_part>
                    <ccd_doc_code>3010</ccd_doc_code>
                    <ccd_doc_name>ІНВОЙС №INV-${1000 + i}</ccd_doc_name>
                    <ccd_doc_date_beg>${date.toISOString().split('T')[0]}</ccd_doc_date_beg>
                </ccd_cmn_docs>
            </ccd>`;

            const xmlData = JSON.stringify({
                data60_1: {
                    guid: guid,
                    MRN: mrn,
                    ccd_registered: date.toISOString(),
                    ccd_status: status === 'CLEARED' ? 'R' : 'N',
                    ccd_type: type,
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
                    status: status,
                    xmlData: xmlData,
                    date: date,
                    declarantName: 'ТОВ "Митний Брокер Центр"',
                    senderName: shipper.name,
                    recipientName: DEMO_COMPANY_NAME,
                    summary: {
                        create: {
                            customsValue: uahVal * 1.1,
                            currency: 'USD',
                            totalItems: 1,
                            customsOffice: office,
                            declarantName: 'ТОВ "Митний Брокер Центр"',
                            senderName: shipper.name,
                            recipientName: DEMO_COMPANY_NAME,
                            declarationType: type,
                            registeredDate: date,
                            invoiceValue: val,
                            invoiceCurrency: 'USD',
                            invoiceValueUah: uahVal,
                            exchangeRate: 41.5,
                            transportDetails: 'Truck / Container'
                        }
                    }
                }
            });
        }

        console.log('✨ Success! XML generation updated to match real mapper logic.');

    } catch (error) {
        console.error('❌ Error updating demo mapping:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setup();
