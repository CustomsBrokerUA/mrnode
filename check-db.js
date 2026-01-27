const { PrismaClient } = require('@prisma/client');

async function main() {
    console.log('🔄 Attempting to connect to database...');
    console.log(`📡 URL: ${process.env.DATABASE_URL || 'Not set (using Prisma default)'}`);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: 'postgresql://postgres:postgres@127.0.0.1:5432/mrnode_db?schema=public',
            },
        },
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
        console.log('1. Ensure PostgreSQL service is RUNNING.');
        console.log('2. Check if host needs to be 127.0.0.1 instead of localhost.');
        console.log('3. Verify username/password in connection string.');
    } finally {
        await prisma.$disconnect();
    }
}

main();
