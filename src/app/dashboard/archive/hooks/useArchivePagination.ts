'use client';

import { useMemo } from 'react';
import { DeclarationWithRawData } from '../types';

interface UseArchivePaginationProps {
    sortedDocs: DeclarationWithRawData[];
    currentPage: number;
    itemsPerPage: number;
}

/**
 * Хук для пагінації декларацій.
 * Розраховує загальну кількість сторінок та повертає елементи для поточної сторінки.
 * 
 * **Особливості**:
 * - Підтримує налаштування кількості елементів на сторінці
 * - Автоматично обчислює загальну кількість сторінок
 * - Повертає лише елементи для поточної сторінки
 */
export function useArchivePagination({
    sortedDocs,
    currentPage,
    itemsPerPage
}: UseArchivePaginationProps) {
    
    const totalItems = sortedDocs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    const paginatedDocs = useMemo(() => {
        return sortedDocs.slice(startIndex, endIndex);
    }, [sortedDocs, startIndex, endIndex]);

    return {
        paginatedDocs,
        totalItems,
        totalPages,
        startIndex,
        endIndex
    };
}
