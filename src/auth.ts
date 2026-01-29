import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const { handlers, auth, signIn, signOut } = NextAuth({
    trustHost: process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV === "production",
    ...authConfig,
    adapter: PrismaAdapter(db),
    session: { strategy: "jwt" },
    callbacks: {
        async jwt({ token, user, trigger }) {
            // Отримати userId з token або user (завжди перевіряти актуальність)
            const userId = user?.id || token.sub;
            if (!userId) return token;

            // Завжди брати актуальні дані з БД (не кешувати в токені)
            // Це забезпечує актуальність activeCompanyId навіть після зміни на іншій вкладці
            const dbUser = await db.user.findUnique({
                where: { id: userId },
                select: { 
                    companyId: true, // Deprecated: залишено для зворотної сумісності
                    activeCompanyId: true,
                    companies: {
                        where: { isActive: true },
                        select: { 
                            companyId: true, 
                            role: true,
                            company: {
                                select: {
                                    deletedAt: true,
                                }
                            }
                        }
                    }
                }
            });
            
            // Legacy support
            token.companyId = dbUser?.companyId || null;
            
            // New multi-company support - завжди брати з БД для актуальності
            token.activeCompanyId = dbUser?.activeCompanyId || null;
            
            // Filter out deleted companies
            const activeCompanies = dbUser?.companies
                .filter(uc => !uc.company.deletedAt)
                .map(uc => ({
                    companyId: uc.companyId,
                    role: uc.role,
                })) || [];
            
            token.companies = activeCompanies;
            
            // Якщо активна компанія видалена, скинути її
            if (token.activeCompanyId && !activeCompanies.some(c => c.companyId === token.activeCompanyId)) {
                token.activeCompanyId = null;
                // Оновити в БД
                await db.user.update({
                    where: { id: userId },
                    data: { activeCompanyId: null },
                });
            }
            
            return token;
        },
        async session({ session, token }) {
            // Add company data to session for client-side access
            if (session.user) {
                // Add user ID to session
                session.user.id = token.sub as string;
                
                // Legacy support
                session.user.companyId = token.companyId as string | null;
                
                // New multi-company support
                session.user.activeCompanyId = token.activeCompanyId as string | null;
                session.user.companies = token.companies as Array<{
                    companyId: string;
                    role: string;
                }>;
            }
            return session;
        }
    },
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await db.user.findUnique({ where: { email } });

                    if (!user) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
                    if (passwordsMatch) return user;
                }

                console.log("Invalid credentials");
                return null;
            }
        })
    ],
});
