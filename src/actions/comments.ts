'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getCommentsByDeclarationId(declarationId: string) {
    try {
        const comments = await db.declarationComment.findMany({
            where: {
                declarationId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        return { success: true, data: comments };
    } catch (error) {
        console.error('Error fetching comments:', error);
        return { success: false, error: 'Помилка завантаження коментарів' };
    }
}

export async function createComment(declarationId: string, text: string) {
    try {
        if (!text || text.trim().length === 0) {
            return { success: false, error: 'Коментар не може бути порожнім' };
        }
        
        const comment = await db.declarationComment.create({
            data: {
                declarationId,
                text: text.trim()
            }
        });
        
        revalidatePath(`/dashboard/archive/${declarationId}`);
        
        return { success: true, data: comment };
    } catch (error) {
        console.error('Error creating comment:', error);
        return { success: false, error: 'Помилка створення коментаря' };
    }
}

export async function updateComment(commentId: string, text: string) {
    try {
        if (!text || text.trim().length === 0) {
            return { success: false, error: 'Коментар не може бути порожнім' };
        }
        
        const comment = await db.declarationComment.update({
            where: { id: commentId },
            data: {
                text: text.trim(),
                updatedAt: new Date()
            }
        });
        
        revalidatePath(`/dashboard/archive/${comment.declarationId}`);
        
        return { success: true, data: comment };
    } catch (error) {
        console.error('Error updating comment:', error);
        return { success: false, error: 'Помилка оновлення коментаря' };
    }
}

export async function deleteComment(commentId: string) {
    try {
        const comment = await db.declarationComment.findUnique({
            where: { id: commentId },
            select: { declarationId: true }
        });
        
        if (!comment) {
            return { success: false, error: 'Коментар не знайдено' };
        }
        
        await db.declarationComment.delete({
            where: { id: commentId }
        });
        
        revalidatePath(`/dashboard/archive/${comment.declarationId}`);
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting comment:', error);
        return { success: false, error: 'Помилка видалення коментаря' };
    }
}
