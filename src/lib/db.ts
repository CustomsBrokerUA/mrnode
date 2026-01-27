import "dotenv/config";
import { PrismaClient } from "@prisma/client";

declare global {
    var prisma: PrismaClient | undefined;
}

// Fallback is purely for local dev debugging if .env fails to load in Turbopack context
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/mrnode_db?schema=public";

export const db = globalThis.prisma || new PrismaClient({
    datasources: {
        db: {
            url: DATABASE_URL,
        },
    },
});

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
