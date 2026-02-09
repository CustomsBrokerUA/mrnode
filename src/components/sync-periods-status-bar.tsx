'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Download, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { getPeriodsLoadingStatus } from '@/actions/declarations';
import { useSyncStatus } from '@/contexts/sync-status-context';

type PeriodStatus = 'empty' | 'list_only' | 'partial' | 'full';

interface PeriodInfo {
    start: Date;
    end: Date;
    status: PeriodStatus;
    count: number;
    fullDataCount: number;
}

interface PeriodsStatusResponse {
    success?: boolean;
    error?: string;
    periods?: PeriodInfo[];
    periodDays?: number;
    totalPeriods?: number;
}

export default function SyncPeriodsStatusBar() {
    const [periodsStatus, setPeriodsStatus] = useState<PeriodInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [periodDays, setPeriodDays] = useState(7);
    const [selectedPeriodDays, setSelectedPeriodDays] = useState(7);
    const { syncJobStatus } = useSyncStatus();

    const loadPeriodsStatus = async (days: number = 7) => {
        setIsLoading(true);
        try {
            const result: PeriodsStatusResponse = await getPeriodsLoadingStatus(days);
            if (result.success && result.periods) {
                // Convert date strings to Date objects if needed
                const periods = result.periods.map(p => ({
                    ...p,
                    start: new Date(p.start),
                    end: new Date(p.end)
                }));
                setPeriodsStatus(periods);
                setPeriodDays(result.periodDays || days);
            } else if (result.error) {
                console.error("Error loading periods status:", result.error);
            }
        } catch (error) {
            console.error("Error loading periods status:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPeriodsStatus(selectedPeriodDays);
    }, [selectedPeriodDays]);

    // Reload when the user returns to the tab/window (e.g. after deleting or re-syncing).
    useEffect(() => {
        const onFocus = () => {
            loadPeriodsStatus(selectedPeriodDays);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadPeriodsStatus(selectedPeriodDays);
            }
        };

        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [selectedPeriodDays]);

    // Reload status when sync job completes
    useEffect(() => {
        if (syncJobStatus?.status === 'completed') {
            // Wait a bit for database to be updated, then reload
            const timeout = setTimeout(() => {
                loadPeriodsStatus(selectedPeriodDays);
            }, 2000);
            return () => clearTimeout(timeout);
        }
    }, [syncJobStatus?.status, selectedPeriodDays]);

    const getStatusColor = (status: PeriodStatus) => {
        switch (status) {
            case 'full':
                return 'bg-green-500';
            case 'partial':
                return 'bg-yellow-500';
            case 'list_only':
                return 'bg-blue-500';
            case 'empty':
            default:
                return 'bg-slate-200';
        }
    };

    const getStatusLabel = (status: PeriodStatus) => {
        switch (status) {
            case 'full':
                return 'Повні дані';
            case 'partial':
                return 'Частково';
            case 'list_only':
                return 'Тільки список';
            case 'empty':
            default:
                return 'Немає даних';
        }
    };

    const getStatusIcon = (status: PeriodStatus) => {
        switch (status) {
            case 'full':
                return <CheckCircle2 className="w-3 h-3 text-white" />;
            case 'partial':
                return <AlertCircle className="w-3 h-3 text-white" />;
            case 'list_only':
                return <Download className="w-3 h-3 text-white" />;
            case 'empty':
            default:
                return null;
        }
    };

    const totalPeriods = periodsStatus.length;
    const emptyPeriods = periodsStatus.filter(p => p.status === 'empty').length;
    const listOnlyPeriods = periodsStatus.filter(p => p.status === 'list_only').length;
    const partialPeriods = periodsStatus.filter(p => p.status === 'partial').length;
    const fullPeriods = periodsStatus.filter(p => p.status === 'full').length;

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Завантаження статусу періодів...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-600" />
                    <h3 className="font-semibold text-slate-900">Статус завантаження періодів</h3>
                </div>
                
                {/* Period size selector */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Групування:</span>
                    <select
                        value={selectedPeriodDays}
                        onChange={(e) => setSelectedPeriodDays(parseInt(e.target.value))}
                        className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-900 font-medium"
                    >
                        <option value="7" className="text-slate-900">Тиждень (7 днів)</option>
                        <option value="30" className="text-slate-900">Місяць (30 днів)</option>
                        <option value="90" className="text-slate-900">Квартал (90 днів)</option>
                    </select>
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="font-semibold text-slate-900">{totalPeriods - emptyPeriods}</div>
                    <div className="text-slate-600">Завантажено</div>
                </div>
                <div className="bg-green-50 rounded p-2 text-center">
                    <div className="font-semibold text-green-700">{fullPeriods}</div>
                    <div className="text-green-600">Повні дані</div>
                </div>
                <div className="bg-blue-50 rounded p-2 text-center">
                    <div className="font-semibold text-blue-700">{listOnlyPeriods}</div>
                    <div className="text-blue-600">Тільки список</div>
                </div>
                <div className="bg-slate-100 rounded p-2 text-center">
                    <div className="font-semibold text-slate-700">{emptyPeriods}</div>
                    <div className="text-slate-600">Порожні</div>
                </div>
            </div>

            {/* Timeline visualization */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                    <span>Візуалізація періодів (поточний + 3 попередні роки):</span>
                    <button
                        onClick={() => loadPeriodsStatus(selectedPeriodDays)}
                        className="text-blue-600 hover:text-blue-700 underline"
                    >
                        Оновити
                    </button>
                </div>
                
                {/* Timeline with wrapping */}
                <div className="pb-2">
                    <div className="flex flex-wrap gap-1">
                        {periodsStatus.map((period, index) => {
                            const tooltip = `${new Date(period.start).toLocaleDateString('uk-UA')} - ${new Date(period.end).toLocaleDateString('uk-UA')}\n${getStatusLabel(period.status)}\n${period.count} декларацій${period.status === 'partial' || period.status === 'full' ? `, ${period.fullDataCount} з повними даними` : ''}`;
                            const key = `${new Date(period.start).toISOString()}_${new Date(period.end).toISOString()}`;
                            
                            return (
                                <div
                                    key={key}
                                    title={tooltip}
                                    className={`${getStatusColor(period.status)} h-8 w-8 rounded flex items-center justify-center cursor-help transition-all hover:scale-110 hover:shadow-md ${
                                        period.status === 'empty' ? 'opacity-40' : ''
                                    }`}
                                    style={{
                                        minWidth: '32px',
                                        flexShrink: 0
                                    }}
                                >
                                    {getStatusIcon(period.status)}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-slate-600">Повні дані (60.1 + 61.1)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span className="text-slate-600">Частково (деякі з 61.1)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className="text-slate-600">Тільки список (60.1)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-slate-200 rounded"></div>
                        <span className="text-slate-600">Немає даних</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
