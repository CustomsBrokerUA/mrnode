'use server';

import { auth } from "@/auth"; // Corrected path
import { db } from "@/lib/db";     // Adjust path as necessary
import { revalidatePath } from "next/cache";

/**
 * Get unread notifications for the current user
 */
export async function getUserNotifications() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { notifications: [] };
        }

        const notifications = await db.notification.findMany({
            where: {
                userId: session.user.id,
                read: false,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 20,
        });

        return { notifications };
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return { notifications: [] };
    }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { error: "Not authorized" };
        }

        await db.notification.update({
            where: {
                id: notificationId,
                userId: session.user.id, // Security check
            },
            data: {
                read: true,
            },
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return { error: "Failed to update notification" };
    }
}

/**
 * Clear all notifications for the current user
 */
export async function clearAllNotifications() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { error: "Not authorized" };
        }

        await db.notification.updateMany({
            where: {
                userId: session.user.id,
                read: false,
            },
            data: {
                read: true,
            },
        });

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error clearing notifications:", error);
        return { error: "Failed to clear notifications" };
    }
}
