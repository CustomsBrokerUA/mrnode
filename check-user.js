const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
    try {
        const users = await prisma.user.findMany({
            include: {
                activeCompany: true,
                companies: {
                    include: { company: true }
                }
            }
        });

        console.log('\n📊 User Data (Multi-Company Ready):');
        users.forEach(u => {
            console.log(`\n👤 Email: ${u.email}`);
            console.log(`   Full Name: ${u.fullName || '❌ NOT SET'}`);
            console.log(`   Active Company: ${u.activeCompany?.name || '❌ NOT SET'}`);

            if (u.companies.length > 0) {
                console.log(`   Total Companies: ${u.companies.length}`);
                u.companies.forEach(uc => {
                    console.log(`     - ${uc.company.name} (${uc.role})`);
                });
            } else {
                console.log(`   Total Companies: 0`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
