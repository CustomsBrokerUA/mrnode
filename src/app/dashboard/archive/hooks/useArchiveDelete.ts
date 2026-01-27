'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDeclaration, deleteDeclarationsByIds, deleteDeclarationsByPeriod } from '@/actions/declarations';

/**
 * Хук для управління видаленням декларацій.
 * 
 * **Функціонал:**
 * - Видалення однієї декларації
 * - Видалення вибраних декларацій (за ID)
 * - Видалення декларацій за періодом
 * - Управління станом завантаження під час видалення
 * 
 * **Повертає:**
 * - `isDeleting` - чи виконується видалення
 * - `handleDeleteOne` - функція для видалення однієї декларації
 * - `handleDeleteSelected` - функція для видалення вибраних
 * - `handleDeleteByPeriod` - функція для видалення за періодом
 */
export function useArchiveDelete() {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteOne = useCallback(async (id: string, mdNumber: string, onClearSelection?: () => void) => {
        if (!confirm(`Ви впевнені, що хочете видалити декларацію ${mdNumber}? Цю дію неможливо скасувати.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteDeclaration(id);
            if (result.error) {
                alert(`Помилка: ${result.error}`);
            } else {
                router.refresh();
            }
        } catch (error) {
            alert("Помилка при видаленні");
        } finally {
            setIsDeleting(false);
        }
    }, [router]);

    const handleDeleteSelected = useCallback(async (
        selectedIds: Set<string>,
        onClearSelection: () => void
    ) => {
        if (selectedIds.size === 0) return;
        
        if (!confirm(`Ви впевнені, що хочете видалити ${selectedIds.size} декларацій? Цю дію неможливо скасувати.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteDeclarationsByIds(Array.from(selectedIds));
            if (result.error) {
                alert(`Помилка: ${result.error}`);
            } else {
                onClearSelection();
                router.refresh();
            }
        } catch (error) {
            alert("Помилка при видаленні");
        } finally {
            setIsDeleting(false);
        }
    }, [router]);

    const handleDeleteByPeriod = useCallback(async (
        dateFrom: string,
        dateTo: string,
        onSuccess?: () => void
    ) => {
        if (!dateFrom || !dateTo) {
            alert("Будь ласка, вкажіть період");
            return;
        }

        const from = new Date(dateFrom);
        const to = new Date(dateTo);

        if (from > to) {
            alert("Дата початку не може бути пізніше дати кінця");
            return;
        }

        if (!confirm(`Ви впевнені, що хочете видалити всі декларації з ${dateFrom} по ${dateTo}? Цю дію неможливо скасувати.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteDeclarationsByPeriod(from, to);
            if (result.error) {
                alert(`Помилка: ${result.error}`);
            } else {
                alert(`Видалено ${result.count || 0} декларацій`);
                if (onSuccess) {
                    onSuccess();
                }
                router.refresh();
            }
        } catch (error) {
            alert("Помилка при видаленні");
        } finally {
            setIsDeleting(false);
        }
    }, [router]);

    return {
        isDeleting,
        handleDeleteOne,
        handleDeleteSelected,
        handleDeleteByPeriod
    };
}
