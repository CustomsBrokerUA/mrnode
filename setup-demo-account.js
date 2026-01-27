const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEMO_EMAIL = 'test@gmail.com';
const DEMO_PASS = '123456';
const DEMO_COMPANY_NAME = 'ДЕМО: ТОВ "ТрансЛогістик Плюс"';
const DEMO_EDRPOU = '00000000'; // Unique enough for demo

async function setup() {
    console.log('🏗️  Setting up demo account...');

    try {
        // 1. Create or Find User
        let user = await prisma.user.findUnique({
            where: { email: DEMO_EMAIL }
        });

        const passwordHash = await bcrypt.hash(DEMO_PASS, 10);

        if (!user) {
            console.log(`👤 Creating user ${DEMO_EMAIL}...`);
            user = await prisma.user.create({
                data: {
                    email: DEMO_EMAIL,
                    passwordHash,
                    fullName: 'Демо Користувач',
                    role: 'BROKER'
                }
            });
        } else {
            console.log(`👤 User ${DEMO_EMAIL} already exists, updating password and name...`);
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    fullName: 'Демо Користувач',
                    passwordHash
                }
            });
        }

        // 2. Create or Find Demo Company
        let company = await prisma.company.findUnique({
            where: { edrpou: DEMO_EDRPOU }
        });

        if (!company) {
            console.log(`🏢 Creating Demo Company...`);
            company = await prisma.company.create({
                data: {
                    name: DEMO_COMPANY_NAME,
                    edrpou: DEMO_EDRPOU,
                    customsToken: 'DEMO_TOKEN_ENCRYPTED',
                    isActive: true
                }
            });
        }

        // 3. Link User to Company
        const userCompany = await prisma.userCompany.upsert({
            where: {
                userId_companyId: {
                    userId: user.id,
                    companyId: company.id
                }
            },
            update: { role: 'OWNER', isActive: true },
            create: {
                userId: user.id,
                companyId: company.id,
                role: 'OWNER',
                isActive: true
            }
        });

        // 4. Set Active Company and Legacy Company ID
        await prisma.user.update({
            where: { id: user.id },
            data: {
                activeCompanyId: company.id,
                companyId: company.id // For legacy compatibility
            }
        });

        console.log(`✅ Demo User & Company linked.`);

        // 5. Clean and Generate Fake Data
        console.log(`🧹 Cleaning old demo data...`);
        await prisma.declaration.deleteMany({
            where: { companyId: company.id }
        });

        console.log(`📊 Generating 30 fake declarations...`);

        const statuses = ['CLEARED', 'CLEARED', 'CLEARED', 'PROCESSING', 'REJECTED'];
        const types = ['ІМ 40 ЕЕ', 'ІМ 40 ДЕ', 'ЕК 10 ЕЕ', 'ТР 80 ЕЕ'];
        const offices = ['UA100010', 'UA100060', 'UA500020', 'UA500040'];
        const currencies = ['USD', 'EUR', 'PLN', 'UAH'];
        const shippers = ['Apple Inc.', 'Samsung Electronics', 'DHL Logistics GmbH', 'Logitech Europe S.A.', 'BMW AG'];
        const recipients = ['ТОВ "Гаджет Стор"', 'ФОП Коваленко', 'ТОВ "Мобі Світ"', 'ПрАТ "Автотрейд"'];

        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 90)); // random date in last 90 days

            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const type = types[Math.floor(Math.random() * types.length)];
            const currency = currencies[Math.floor(Math.random() * currencies.length)];
            const shipper = shippers[Math.floor(Math.random() * shippers.length)];
            const recipient = recipients[Math.floor(Math.random() * shippers.length)]; // index reuse to keep it simple

            const invoiceValue = Math.floor(Math.random() * 50000) + 1000;
            const exchangeRate = currency === 'USD' ? 41.2 : currency === 'EUR' ? 44.5 : currency === 'PLN' ? 10.2 : 1.0;
            const invoiceValueUah = invoiceValue * exchangeRate;
            const customsValue = invoiceValueUah * 1.1; // roughly

            const decl = await prisma.declaration.create({
                data: {
                    companyId: company.id,
                    customsId: `GUID-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                    mrn: `${Math.floor(Math.random() * 99)}UA${offices[0].substring(2)}00${Math.floor(Math.random() * 900000) + 100000}`,
                    status: status,
                    date: date,
                    declarantName: 'Демо Декларант',
                    senderName: shipper,
                    recipientName: i % 2 === 0 ? DEMO_COMPANY_NAME : recipient,
                    summary: {
                        create: {
                            customsValue: customsValue,
                            currency: currency,
                            totalItems: Math.floor(Math.random() * 50) + 1,
                            customsOffice: offices[Math.floor(Math.random() * offices.length)],
                            declarantName: 'Демо Декларант',
                            senderName: shipper,
                            recipientName: i % 2 === 0 ? DEMO_COMPANY_NAME : recipient,
                            declarationType: type,
                            registeredDate: date,
                            invoiceValue: invoiceValue,
                            invoiceCurrency: currency,
                            invoiceValueUah: invoiceValueUah,
                            exchangeRate: exchangeRate,
                            transportDetails: 'Truck / Sea Container'
                        }
                    }
                }
            });
        }

        console.log('✨ Setup complete! User test@gmail.com is ready to explore.');
        console.log('👉 Password: 123456');

    } catch (error) {
        console.error('❌ Error setting up demo:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setup();
