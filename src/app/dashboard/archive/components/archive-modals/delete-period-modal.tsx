'use client';

import React from 'react';
import { Button, Input } from '@/components/ui';

interface DeletePeriodModalProps {
    isOpen: boolean;
    onClose: () => void;
    deletePeriodFrom: string;
    deletePeriodTo: string;
    onPeriodFromChange: (value: string) => void;
    onPeriodToChange: (value: string) => void;
    onDelete: () => void;
    isDeleting: boolean;
}

/**
 * Модальне вікно для видалення декларацій за періодом.
 */
export default function DeletePeriodModal({
    isOpen,
    onClose,
    deletePeriodFrom,
    deletePeriodTo,
    onPeriodFromChange,
    onPeriodToChange,
    onDelete,
    isDeleting
}: DeletePeriodModalProps) {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl max-w-md w-full m-4" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Видалити декларації за період</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Дата початку
                            </label>
                            <Input
                                type="date"
                                value={deletePeriodFrom}
                                onChange={(e) => onPeriodFromChange(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Дата кінця
                            </label>
                            <Input
                                type="date"
                                value={deletePeriodTo}
                                onChange={(e) => onPeriodToChange(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                            <p className="text-sm text-yellow-800">
                                ⚠️ Увага: Всі декларації в межах вказаного періоду будуть видалені безповоротно.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isDeleting}
                        >
                            Скасувати
                        </Button>
                        <Button
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={onDelete}
                            disabled={isDeleting || !deletePeriodFrom || !deletePeriodTo}
                        >
                            {isDeleting ? "Видалення..." : "Видалити"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
