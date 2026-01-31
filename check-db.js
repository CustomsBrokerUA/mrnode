const { PrismaClient } = require('@prisma/client');

async function main() {
    console.log('🔄 Attempting to connect to database...');
    console.log(`📡 URL: ${process.env.DATABASE_URL || 'Not set'}`);

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is not set. Aborting.');
        process.exit(1);
    }

    const prisma = new PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
    });

    try {
        await prisma.$connect();
        console.log('✅ Connection successful!');

        // Try a simple query
        const userCount = await prisma.user.count();
        console.log(`📊 Current user count: ${userCount}`);

    } catch (e) {
        console.error('❌ Connection failed!');
        console.error('---------------------------------------------------');
        console.error('Error name:', e.name);
        console.error('Error message:', e.message);
        if (e.code) console.error('Error code:', e.code);
        console.error('---------------------------------------------------');
        console.log('💡 Diagnosis tips:');
        console.log('1. Verify DATABASE_URL is correct and reachable from this machine.');
        console.log('2. If using Render Postgres, ensure you use the EXTERNAL host (not internal dpg-...) and include sslmode=require if needed.');
        console.log('3. Verify username/password in connection string.');
    } finally {
        await prisma.$disconnect();
    }
}

main();
