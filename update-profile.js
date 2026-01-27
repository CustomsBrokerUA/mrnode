const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateProfile() {
    try {
        const user = await prisma.user.findFirst({
            include: { company: true }
        });

        if (!user) {
            console.log('❌ No user found');
            return;
        }

        console.log(`\n📝 Updating profile for: ${user.email}`);

        // Update fullName based on email or set a default
        const fullName = "Андрій Осташевський"; // You can change this

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { fullName: fullName }
        });

        console.log(`✅ Updated fullName to: ${updated.fullName}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateProfile();
