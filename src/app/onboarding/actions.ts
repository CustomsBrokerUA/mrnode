'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function saveCompanyData(prevState: any, formData: FormData) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    const companyName = formData.get("companyName") as string;
    const edrpou = formData.get("edrpou") as string;
    const token = formData.get("token") as string;

    if (!companyName || !edrpou || !token) {
        return { error: "Всі поля є обов'язковими" };
    }

    try {
        // 1. Create Company
        // Note: In a real app we would encrypt the token here.
        // 1. Create or Update Company
        // Note: In a real app we would encrypt the token here.
        const company = await db.company.upsert({
            where: { edrpou: edrpou },
            update: {
                name: companyName,
                customsToken: token
            },
            create: {
                name: companyName,
                edrpou: edrpou,
                customsToken: token, // TODO: Encrypt
            }
        });

        // 2. Link User to Company
        await db.user.update({
            where: { email: session.user.email },
            data: {
                companyId: company.id,
                // Optionally update profile fields using other form data if we had them passed here
                // For now assuming role etc were handled or defaulted
            }
        });

        revalidatePath("/dashboard");
        return { success: true };

    } catch (error: any) {
        console.error("Onboarding Error:", error);
        if (error.code === 'P2002') {
            return { error: "Компанія з таким ЄДРПОУ вже існує" };
        }
        return { error: "Помилка збереження даних: " + error.message };
    }
}
