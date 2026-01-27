const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugXml() {
    const declaration = await prisma.declaration.findFirst({
        where: { NOT: { xmlData: null } }
    });

    if (!declaration) {
        console.log("No declarations with XML found in DB.");
        return;
    }

    console.log("=== DECLARATION DEBUG ===");
    console.log("ID:", declaration.id);
    console.log("MRN:", declaration.mrn);
    console.log("CustomsID:", declaration.customsId);
    console.log("XML Data Snippet (first 2000 chars):");
    console.log(declaration.xmlData ? declaration.xmlData.substring(0, 2000) : "NULL");

    // Save locally for easier inspection if needed
    if (declaration.xmlData) {
        const fs = require('fs');
        fs.writeFileSync('sample_debug.xml', declaration.xmlData);
        console.log("\nFull XML saved to sample_debug.xml");
    }
}

debugXml()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
