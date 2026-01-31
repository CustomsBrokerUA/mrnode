import "dotenv/config";
import { PrismaClient } from "@prisma/client";

declare global {
    var prisma: PrismaClient | undefined;
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
}

export const db = globalThis.prisma || new PrismaClient({
    datasources: {
        db: {
            url: DATABASE_URL,
        },
    },
});

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
