'use client';

/**
 * Компонент для відображення статистики по деклараціях.
 * 
 * **Функціональність**:
 * - Відображає загальну статистику (кількість, статуси, вартості)
 * - Показує топ-10 списки (відправники, отримувачі, коди УКТЗЕД, тощо)
 * - Дозволяє фільтрувати по кліку на елементи топ-10 списків
 * - Підтримує налаштування видимості блоків статистики
 * - Обробляє hydration issues (показує "---" до монтування)
 * 
 * **Особливості**:
 * - Використовує CSS `hidden` клас для контролю видимості (уникає hydration проблем)
 * - Форматує грошові суми в українській локалі
 * - Підтримує клік по елементам для швидкого фільтрування
 * - Адаптивна сітка (1-4 колонки залежно від розміру екрану)
 */

import React from 'react';
import { Button } from '@/components/ui';
import { BarChart3, Settings, FileSpreadsheet } from 'lucide-react';
import { statusStyles } from '../constants';

/**
 * Структура статистики по деклараціях.
 */
interface Statistics {
    total: number;
    totalCustomsValue: number;
    totalInvoiceValue: number;
    totalItems: number;
    topConsignors: Array<{ name: string; count: number; totalValue: number }>;
    topConsignees: Array<{ name: string; count: number; totalValue: number }>;
    topContractHolders: Array<{ name: string; count: number; totalValue: number }>;
    topHSCodes: Array<{ code: string; count: number; totalValue: number }>;
    topDeclarationTypes: Array<{ type: string; count: number; totalValue: number }>;
    topCustomsOffices: Array<{ office: string; count: number; totalValue: number }>;
}

/**
 * Props для компонента ArchiveStatistics.
 */
interface ArchiveStatisticsProps {
    /** Об'єкт зі статистикою по деклараціях */
    statistics: Statistics;
    /** Налаштування видимості блоків статистики */
    statsSettings: { [key: string]: boolean };
    /** Чи компонент вже змонтований (для уникнення hydration проблем) */
    isMounted: boolean;
    /** Callback для відкриття налаштувань статистики */
    onSettingsClick: () => void;
    /** Callback для фільтрації по типу декларації (опціонально) */
    onFilterByType?: (type: string) => void;
    /** Callback для фільтрації по митниці (опціонально) */
    onFilterByOffice?: (office: string) => void;
    /** Callback для фільтрації по відправнику (опціонально) */
    onFilterByConsignor?: (name: string) => void;
    /** Callback для фільтрації по отримувачу (опціонально) */
    onFilterByConsignee?: (name: string) => void;
    /** Callback для фільтрації по контрактотримачу (опціонально) */
    onFilterByContractHolder?: (name: string) => void;
    /** Callback для фільтрації по коду УКТЗЕД (опціонально) */
    onFilterByHSCode?: (code: string) => void;
}

/**
 * Компонент відображення статистики по митних деклараціях.
 * 
 * @param props - Props компонента
 * @returns JSX елемент зі статистикою
 */
export default function ArchiveStatistics({
    statistics,
    statsSettings,
    isMounted,
    onSettingsClick,
    onFilterByType,
    onFilterByOffice,
    onFilterByConsignor,
    onFilterByConsignee,
    onFilterByContractHolder,
    onFilterByHSCode,
}: ArchiveStatisticsProps) {
    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Статистика</h2>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={onSettingsClick}
                >
                    <Settings className="w-4 h-4" />
                    Налаштування
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total */}
                {statsSettings.total && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Всього декларацій</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{statistics.total}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Customs Value */}
                {statsSettings.customsValue && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Митна вартість</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">
                                    {!isMounted ? (
                                        '---'
                                    ) : statistics.totalCustomsValue > 0
                                        ? new Intl.NumberFormat('uk-UA', {
                                            style: 'currency',
                                            currency: 'UAH',
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        }).format(statistics.totalCustomsValue)
                                        : '---'
                                    }
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <span className="text-purple-600 font-bold text-lg">₴</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Invoice Value */}
                {statsSettings.invoiceValue && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Фактурна вартість</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">
                                    {!isMounted ? (
                                        '---'
                                    ) : statistics.totalInvoiceValue > 0
                                        ? new Intl.NumberFormat('uk-UA', {
                                            style: 'currency',
                                            currency: 'UAH',
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        }).format(statistics.totalInvoiceValue)
                                        : '---'
                                    }
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                                <span className="text-amber-600 font-bold text-lg">$</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Total Items */}
                {statsSettings.totalItems && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Всього товарів</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{statistics.totalItems}</p>
                            </div>
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <span className="text-indigo-600 font-bold text-lg">📦</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Top Entities Statistics */}
            {(
                ((statsSettings.topConsignors ?? true) && statistics.topConsignors?.length > 0) ||
                ((statsSettings.topConsignees ?? true) && statistics.topConsignees?.length > 0) ||
                ((statsSettings.topContractHolders ?? true) && statistics.topContractHolders?.length > 0) ||
                ((statsSettings.topHSCodes ?? true) && statistics.topHSCodes?.length > 0) ||
                ((statsSettings.topDeclarationTypes ?? true) && statistics.topDeclarationTypes?.length > 0) ||
                ((statsSettings.topCustomsOffices ?? true) && statistics.topCustomsOffices?.length > 0)
            ) && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Топ суб'єктів, кодів та параметрів</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Top Declaration Types */}
                            {(statsSettings.topDeclarationTypes ?? true) && statistics.topDeclarationTypes?.length > 0 && (
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Топ-10 типів декларацій</h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {statistics.topDeclarationTypes.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between text-xs hover:bg-slate-100 rounded px-2 py-1 cursor-pointer transition-colors"
                                                onClick={() => onFilterByType?.(String(item.type || ''))}
                                                title="Клікніть для фільтрації"
                                            >
                                                <span className="text-slate-700 font-mono flex-1" title={item.type}>
                                                    {idx + 1}. {item.type}
                                                </span>
                                                <span className="text-slate-500 ml-2">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Customs Offices */}
                            {(statsSettings.topCustomsOffices ?? true) && statistics.topCustomsOffices?.length > 0 && (
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Топ-10 митниць</h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {statistics.topCustomsOffices.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between text-xs hover:bg-slate-100 rounded px-2 py-1 cursor-pointer transition-colors"
                                                onClick={() => onFilterByOffice?.(String(item.office || ''))}
                                                title="Клікніть для фільтрації"
                                            >
                                                <span className="text-slate-700 font-mono flex-1" title={item.office}>
                                                    {idx + 1}. {item.office}
                                                </span>
                                                <span className="text-slate-500 ml-2">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Consignors */}
                            {(statsSettings.topConsignors ?? true) && statistics.topConsignors?.length > 0 && (
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Топ-10 відправників</h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {statistics.topConsignors.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between text-xs hover:bg-slate-100 rounded px-2 py-1 cursor-pointer transition-colors"
                                                onClick={() => onFilterByConsignor?.(item.name)}
                                                title="Клікніть для фільтрації"
                                            >
                                                <span className="text-slate-700 flex-1 truncate" title={item.name}>
                                                    {idx + 1}. {item.name}
                                                </span>
                                                <span className="text-slate-500 ml-2">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Consignees */}
                            {(statsSettings.topConsignees ?? true) && statistics.topConsignees?.length > 0 && (
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Топ-10 отримувачів</h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {statistics.topConsignees.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between text-xs hover:bg-slate-100 rounded px-2 py-1 cursor-pointer transition-colors"
                                                onClick={() => onFilterByConsignee?.(item.name)}
                                                title="Клікніть для фільтрації"
                                            >
                                                <span className="text-slate-700 flex-1 truncate" title={item.name}>
                                                    {idx + 1}. {item.name}
                                                </span>
                                                <span className="text-slate-500 ml-2">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top Contract Holders */}
                            {(statsSettings.topContractHolders ?? true) && statistics.topContractHolders?.length > 0 && (
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Топ-10 договірних контрагентів</h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {statistics.topContractHolders.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between text-xs hover:bg-slate-100 rounded px-2 py-1 cursor-pointer transition-colors"
                                                onClick={() => onFilterByContractHolder?.(item.name)}
                                                title="Клікніть для фільтрації"
                                            >
                                                <span className="text-slate-700 flex-1 truncate" title={item.name}>
                                                    {idx + 1}. {item.name}
                                                </span>
                                                <span className="text-slate-500 ml-2">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Top HS Codes */}
                            {(statsSettings.topHSCodes ?? true) && statistics.topHSCodes?.length > 0 && (
                                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                                    <h4 className="text-xs font-semibold text-slate-600 uppercase mb-2">Топ-10 кодів УКТЗЕД</h4>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {statistics.topHSCodes.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between text-xs hover:bg-slate-100 rounded px-2 py-1 cursor-pointer transition-colors"
                                                onClick={() => onFilterByHSCode?.(String(item.code || ''))}
                                                title="Клікніть для фільтрації"
                                            >
                                                <span className="text-slate-700 font-mono flex-1" title={String(item.code)}>
                                                    {idx + 1}. {item.code}
                                                </span>
                                                <span className="text-slate-500 ml-2">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
        </div>
    );
}
