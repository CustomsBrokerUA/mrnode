'use server';

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export async function getUserProfile() {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return null;
    }

    const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: {
            fullName: true,
            email: true,
            createdAt: true,
            activeCompanyId: true,
            activeCompany: {
                select: {
                    id: true,
                    name: true,
                    edrpou: true
                }
            },
            company: { // Legacy support
                select: {
                    id: true,
                    name: true,
                    edrpou: true
                }
            }
        }
    });

    if (!user) return null;

    // Normalize for the client: use activeCompany if available, otherwise legacy company
    const normalizedUser = {
        ...user,
        company: user.activeCompany || user.company
    };

    return normalizedUser;
}

// Schema for updating profile
const UpdateProfileSchema = z.object({
    fullName: z.string().min(1, "Ім'я не може бути порожнім").max(100, "Ім'я занадто довге").optional(),
});

// Schema for changing password
const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(6, "Пароль має містити мінімум 6 символів"),
    newPassword: z.string().min(6, "Новий пароль має містити мінімум 6 символів"),
    confirmPassword: z.string().min(6, "Підтвердження пароля має містити мінімум 6 символів"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Паролі не співпадають",
    path: ["confirmPassword"],
});

/**
 * Update user profile (fullName)
 */
export async function updateUserProfile(formData: FormData) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        const fullName = formData.get('fullName') as string | null;

        // Validate input
        const validatedFields = UpdateProfileSchema.safeParse({ fullName });

        if (!validatedFields.success) {
            return {
                error: validatedFields.error.issues[0]?.message || "Помилка валідації"
            };
        }

        // Update user profile
        await db.user.update({
            where: { email: session.user.email },
            data: {
                fullName: validatedFields.data.fullName || null,
            }
        });

        revalidatePath("/dashboard/settings");
        return { success: true, message: "Профіль успішно оновлено" };

    } catch (error: any) {
        console.error("Error updating profile:", error);
        return { error: "Помилка оновлення профілю: " + (error.message || "Невідома помилка") };
    }
}

/**
 * Change user password
 */
export async function changeUserPassword(formData: FormData) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    try {
        const currentPassword = formData.get('currentPassword') as string;
        const newPassword = formData.get('newPassword') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        // Validate input
        const validatedFields = ChangePasswordSchema.safeParse({
            currentPassword,
            newPassword,
            confirmPassword
        });

        if (!validatedFields.success) {
            return {
                error: validatedFields.error.issues[0]?.message || "Помилка валідації"
            };
        }

        // Get current user to verify password
        const user = await db.user.findUnique({
            where: { email: session.user.email },
            select: { passwordHash: true }
        });

        if (!user) {
            return { error: "Користувача не знайдено" };
        }

        // Verify current password
        const passwordsMatch = await bcrypt.compare(validatedFields.data.currentPassword, user.passwordHash);

        if (!passwordsMatch) {
            return { error: "Поточний пароль невірний" };
        }

        // Check if new password is different from current
        const newPasswordMatches = await bcrypt.compare(validatedFields.data.newPassword, user.passwordHash);

        if (newPasswordMatches) {
            return { error: "Новий пароль має відрізнятись від поточного" };
        }

        // Hash and update password
        const hashedPassword = await bcrypt.hash(validatedFields.data.newPassword, 10);

        await db.user.update({
            where: { email: session.user.email },
            data: {
                passwordHash: hashedPassword,
            }
        });

        revalidatePath("/dashboard/settings");
        return { success: true, message: "Пароль успішно змінено" };

    } catch (error: any) {
        console.error("Error changing password:", error);
        return { error: "Помилка зміни пароля: " + (error.message || "Невідома помилка") };
    }
}

/**
 * Delete user account
 */
export async function deleteAccount(formData: FormData) {
    const session = await auth();

    if (!session || !session.user || !session.user.email) {
        return { error: "Неавторизований доступ" };
    }

    if (session.user.email === 'test@gmail.com') {
        return { error: "Демонстраційний акаунт не можна видалити" };
    }

    try {
        const password = formData.get('password') as string;
        const deleteData = formData.get('deleteData') === 'true';

        // 1. Verify password
        const user = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, passwordHash: true }
        });

        if (!user) return { error: "Користувача не знайдено" };

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
            return { error: "Невірний пароль" };
        }

        // 2. Handle data deletion if requested
        if (deleteData) {
            // Find all companies where this user is the ONLY owner
            const userCompanies = await db.userCompany.findMany({
                where: { userId: user.id, role: 'OWNER' },
                select: { companyId: true }
            });

            for (const uc of userCompanies) {
                const otherOwnersCount = await db.userCompany.count({
                    where: {
                        companyId: uc.companyId,
                        role: 'OWNER',
                        userId: { not: user.id }
                    }
                });

                // If user is the only owner, delete the company and its declarations
                if (otherOwnersCount === 0) {
                    // Manual delete declarations (since schema doesn't have cascade on this relation)
                    await db.declaration.deleteMany({
                        where: { companyId: uc.companyId }
                    });

                    // Delete the company (cascades to summary, syncHistory, syncJobs, userCompany)
                    await db.company.delete({
                        where: { id: uc.companyId }
                    });
                }
            }
        }

        // 3. Delete the user
        // Cascades to userCompany relations and notifications
        await db.user.delete({
            where: { id: user.id }
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error deleting account:", error);
        return { error: "Помилка видалення акаунту. Спробуйте пізніше." };
    }
}
