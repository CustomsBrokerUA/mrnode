'use client';

import { useState, useCallback } from 'react';
import { DeclarationWithRawData } from '../types';

interface UseArchiveSelectionProps {
    paginatedDocs: DeclarationWithRawData[];
}

/**
 * Хук для управління виділенням декларацій.
 * 
 * **Функціонал:**
 * - Виділення/зняття виділення всіх декларацій на поточній сторінці
 * - Виділення/зняття виділення окремої декларації
 * - Отримання стану виділення
 * 
 * **Повертає:**
 * - `selectedIds` - Set з ID виділених декларацій
 * - `handleSelectAll` - функція для виділення/зняття виділення всіх
 * - `handleSelectOne` - функція для виділення/зняття виділення однієї
 * - `clearSelection` - функція для очищення виділення
 */
export function useArchiveSelection({ paginatedDocs }: UseArchiveSelectionProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(paginatedDocs.map(doc => doc.id)));
        } else {
            setSelectedIds(new Set());
        }
    }, [paginatedDocs]);

    const handleSelectOne = useCallback((id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const newSelected = new Set(prev);
            if (checked) {
                newSelected.add(id);
            } else {
                newSelected.delete(id);
            }
            return newSelected;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    return {
        selectedIds,
        handleSelectAll,
        handleSelectOne,
        clearSelection
    };
}
