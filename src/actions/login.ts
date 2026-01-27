'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { LoginSchema } from '@/schemas';
import { db } from '@/lib/db';

export const login = async (values: z.infer<typeof LoginSchema>) => {
    const validatedFields = LoginSchema.safeParse(values);

    if (!validatedFields.success) {
        return { error: "Invalid fields!" };
    }

    const { email, password } = validatedFields.data;

    try {
        // Check if user has a company before redirecting
        const user = await db.user.findUnique({
            where: { email },
            select: {
                companyId: true,
                activeCompanyId: true,
                companies: {
                    select: { id: true },
                    take: 1
                }
            }
        });

        const hasCompany = user?.companyId || user?.activeCompanyId || (user?.companies && user.companies.length > 0);
        const redirectPath = hasCompany ? "/dashboard" : "/onboarding";

        await signIn("credentials", {
            email,
            password,
            redirectTo: redirectPath,
        });
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { error: "Invalid credentials!" };
                default:
                    return { error: "Something went wrong!" };
            }
        }
        throw error;
    }
};

export const loginAsDemo = async () => {
    try {
        await signIn("credentials", {
            email: "test@gmail.com",
            password: "123456",
            redirectTo: "/dashboard",
        });
    } catch (error) {
        if (error instanceof AuthError) {
            return { error: "Демо-доступ тимчасово недоступний." };
        }
        throw error;
    }
};
