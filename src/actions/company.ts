'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from 'zod';

// Schema for updating customs token
const UpdateCustomsTokenSchema = z.object({
    customsToken: z.string().min(1, "Токен не може бути порожнім"),
});

/**
 * Update company customs token
 */
export async function updateCustomsToken(formData: FormData) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();
        
        if (!access.success || !access.companyId) {
            return { error: "Активна компанія не встановлена або недоступна" };
        }

        // Тільки OWNER та MEMBER можуть оновлювати токен
        if (access.role !== 'OWNER' && access.role !== 'MEMBER') {
            return { error: "Недостатньо прав для оновлення токену" };
        }

        const customsToken = formData.get('customsToken') as string;

        // Validate input
        const validatedFields = UpdateCustomsTokenSchema.safeParse({ customsToken });
        
        if (!validatedFields.success) {
            return { 
                error: validatedFields.error.errors[0]?.message || "Помилка валідації" 
            };
        }

        // Шифрувати токен
        const { encrypt } = await import("@/lib/crypto");
        const encryptedToken = await encrypt(validatedFields.data.customsToken);

        // Update company token
        await db.company.update({
            where: { id: access.companyId },
            data: {
                customsToken: encryptedToken,
            }
        });

        revalidatePath("/dashboard/settings");
        return { success: true, message: "Токен митниці успішно оновлено" };

    } catch (error: any) {
        console.error("Error updating customs token:", error);
        return { error: "Помилка оновлення токену: " + (error.message || "Невідома помилка") };
    }
}

/**
 * Get company info (for settings page)
 */
export async function getCompanyInfo() {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return null;
    }

    try {
        // Використовувати activeCompanyId замість user.company
        const { getActiveCompanyWithAccess } = await import("@/lib/company-access");
        const access = await getActiveCompanyWithAccess();
        
        if (!access.success || !access.companyId) {
            return null;
        }

        const company = await db.company.findUnique({
            where: { id: access.companyId },
            select: {
                id: true,
                name: true,
                edrpou: true,
                customsToken: true,
                isActive: true,
                createdAt: true,
            }
        });

        if (!company) {
            return null;
        }

        return {
            id: company.id,
            name: company.name,
            edrpou: company.edrpou,
            hasToken: !!company.customsToken,
            isActive: company.isActive,
            createdAt: company.createdAt,
        };
    } catch (error: any) {
        console.error("Error getting company info:", error);
        return null;
    }
}
