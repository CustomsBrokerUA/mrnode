'use client';

import React from 'react';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';
import { DEFAULT_STATS_SETTINGS } from '../../constants';

interface StatisticsSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    statsSettings: { [key: string]: boolean };
    onSettingsChange: (settings: { [key: string]: boolean }) => void;
}

/**
 * Модальне вікно для налаштування відображення статистики.
 * Дозволяє вибрати, які метрики показувати в статистичній панелі.
 */
export default function StatisticsSettingsModal({
    isOpen,
    onClose,
    statsSettings,
    onSettingsChange
}: StatisticsSettingsModalProps) {
    if (!isOpen) return null;

    const handleSettingChange = (key: string, checked: boolean) => {
        const newSettings = { ...statsSettings, [key]: checked };
        onSettingsChange(newSettings);
        if (typeof window !== 'undefined') {
            localStorage.setItem('statsSettings', JSON.stringify(newSettings));
        }
    };

    const settingsLabels: { [key: string]: string } = {
        total: 'Всього декларацій',
        byStatus: 'Статистика по статусам',
        customsValue: 'Митна вартість',
        invoiceValue: 'Фактурна вартість',
        totalItems: 'Загальна кількість товарів',
        topConsignors: 'Топ-10 відправників',
        topConsignees: 'Топ-10 отримувачів',
        topContractHolders: 'Топ-10 контрактотримачів',
        topHSCodes: 'Топ-10 кодів УКТЗЕД',
        topDeclarationTypes: 'Топ-10 типів декларацій',
        topCustomsOffices: 'Топ-10 митниць',
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
            <div 
                className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">
                            Налаштування статистики
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Виберіть метрики для відображення
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="gap-1"
                    >
                        <X className="w-4 h-4" />
                        Закрити
                    </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                        <div className="space-y-3">
                            {Object.keys(DEFAULT_STATS_SETTINGS).map((key) => (
                                <label key={key} className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={statsSettings[key] ?? DEFAULT_STATS_SETTINGS[key as keyof typeof DEFAULT_STATS_SETTINGS]}
                                        onChange={(e) => handleSettingChange(key, e.target.checked)}
                                        className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                    />
                                    <span className="text-sm font-medium text-slate-900">
                                        {settingsLabels[key] || key}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        Закрити
                    </Button>
                </div>
            </div>
        </div>
    );
}
