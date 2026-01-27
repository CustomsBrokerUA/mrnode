import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id?: string; // User ID
            companyId?: string | null; // Deprecated: залишено для зворотної сумісності
            activeCompanyId?: string | null;
            companies?: Array<{
                companyId: string;
                role: string;
            }>;
        } & DefaultSession["user"];
    }

    interface User {
        companyId?: string | null; // Deprecated: залишено для зворотної сумісності
        activeCompanyId?: string | null;
        companies?: Array<{
            companyId: string;
            role: string;
        }>;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        companyId?: string | null; // Deprecated: залишено для зворотної сумісності
        activeCompanyId?: string | null;
        companies?: Array<{
            companyId: string;
            role: string;
        }>;
    }
}
