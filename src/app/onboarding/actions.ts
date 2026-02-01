'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { encrypt } from "@/lib/crypto";

export async function saveProfileData(prevState: any, formData: FormData) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    const firstName = (formData.get("firstName") as string | null)?.trim() || "";
    const lastName = (formData.get("lastName") as string | null)?.trim() || "";

    const fullName = `${firstName} ${lastName}`.trim();

    if (!fullName) {
        return { error: "Ім'я та прізвище є обов'язковими" };
    }

    try {
        await db.user.update({
            where: { email: session.user.email },
            data: {
                fullName,
            }
        });

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/settings");
        return { success: true };
    } catch (error: any) {
        console.error("Onboarding Profile Error:", error);
        return { error: "Помилка збереження профілю: " + (error.message || "Невідома помилка") };
    }
}

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
        let userId = session.user.id;
        if (!userId) {
            const userByEmail = await db.user.findUnique({
                where: { email: session.user.email },
                select: { id: true }
            });
            userId = userByEmail?.id;
        }

        if (!userId) {
            return { error: "Неавторизований доступ" };
        }

        const existingCompany = await db.company.findUnique({
            where: { edrpou: edrpou },
            select: { id: true, customsToken: true }
        });

        const encryptedToken = await encrypt(token);

        const company = existingCompany
            ? await db.company.update({
                where: { id: existingCompany.id },
                data: existingCompany.customsToken
                    ? {}
                    : { customsToken: encryptedToken },
                select: { id: true }
            })
            : await db.company.create({
                data: {
                    name: companyName,
                    edrpou: edrpou,
                    customsToken: encryptedToken,
                },
                select: { id: true }
            });

        await db.userCompany.upsert({
            where: {
                userId_companyId: {
                    userId: userId,
                    companyId: company.id,
                }
            },
            update: {
                isActive: true,
            },
            create: {
                userId: userId,
                companyId: company.id,
                role: existingCompany ? 'MEMBER' : 'OWNER',
                isActive: true,
            }
        });

        await db.user.update({
            where: { id: userId },
            data: {
                activeCompanyId: company.id,
                companyId: company.id,
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
