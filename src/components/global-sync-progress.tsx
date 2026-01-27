'use client';

import React, { useMemo, useRef } from 'react';
import { useSyncStatus } from '@/contexts/sync-status-context';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cancelSyncJob } from '@/actions/sync';
import { useRouter } from 'next/navigation';

export default function GlobalSyncProgress() {
    const { syncJobStatus } = useSyncStatus();
    const router = useRouter();
    const startTime60_1Ref = useRef<number | null>(null);
    const startTime61_1Ref = useRef<number | null>(null);
    const previousProgress60_1Ref = useRef<number>(0);
    const previousProgress61_1Ref = useRef<number>(0);

    // Format time duration
    const formatDuration = (seconds: number): string => {
        if (seconds < 60) {
            return `${Math.round(seconds)} сек`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.round(seconds % 60);
            return `${minutes} хв ${secs > 0 ? `${secs} сек` : ''}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours} год ${minutes > 0 ? `${minutes} хв` : ''}`;
        }
    };

    // Calculate ETA for 60.1
    const eta60_1 = useMemo(() => {
        if (!syncJobStatus || syncJobStatus.status !== "processing" || syncJobStatus.totalChunks60_1 === 0) {
            return null;
        }

        const completed = syncJobStatus.completedChunks60_1;
        const total = syncJobStatus.totalChunks60_1;
        const remaining = total - completed;

        if (remaining <= 0) return null;

        const now = Date.now();

        if (startTime60_1Ref.current === null && completed > 0) {
            startTime60_1Ref.current = now;
            previousProgress60_1Ref.current = completed;
            return null;
        }

        if (completed < previousProgress60_1Ref.current) {
            startTime60_1Ref.current = now;
            previousProgress60_1Ref.current = completed;
            return null;
        }

        previousProgress60_1Ref.current = completed;

        if (!startTime60_1Ref.current || completed === 0) return null;

        const elapsed = (now - startTime60_1Ref.current) / 1000;
        if (elapsed < 5) return null; // Need at least 5 seconds of data

        const rate = completed / elapsed;
        if (rate <= 0) return null;

        const etaSeconds = remaining / rate;
        return formatDuration(etaSeconds);
    }, [syncJobStatus?.completedChunks60_1, syncJobStatus?.totalChunks60_1, syncJobStatus?.status]);

    // Calculate ETA for 61.1
    const eta61_1 = useMemo(() => {
        if (!syncJobStatus || syncJobStatus.status !== "processing" || syncJobStatus.totalGuids === 0) {
            return null;
        }

        const completed = syncJobStatus.completed61_1;
        const total = syncJobStatus.totalGuids;
        const remaining = total - completed;

        if (remaining <= 0) return null;

        const now = Date.now();

        if (startTime61_1Ref.current === null && completed > 0) {
            startTime61_1Ref.current = now;
            previousProgress61_1Ref.current = completed;
            return null;
        }

        if (completed < previousProgress61_1Ref.current) {
            startTime61_1Ref.current = now;
            previousProgress61_1Ref.current = completed;
            return null;
        }

        previousProgress61_1Ref.current = completed;

        if (!startTime61_1Ref.current || completed === 0) return null;

        const elapsed = (now - startTime61_1Ref.current) / 1000;
        if (elapsed < 5) return null;

        const rate = completed / elapsed;
        if (rate <= 0) return null;

        const etaSeconds = remaining / rate;
        return formatDuration(etaSeconds);
    }, [syncJobStatus?.completed61_1, syncJobStatus?.totalGuids, syncJobStatus?.status]);

    // Reset tracking when job changes
    React.useEffect(() => {
        if (syncJobStatus?.status === "processing") {
            if (syncJobStatus.completedChunks60_1 === 0) {
                startTime60_1Ref.current = null;
                previousProgress60_1Ref.current = 0;
            }
            if (syncJobStatus.completedChunks60_1 === syncJobStatus.totalChunks60_1 &&
                syncJobStatus.completed61_1 === 0 &&
                syncJobStatus.totalGuids > 0) {
                startTime61_1Ref.current = null;
                previousProgress61_1Ref.current = 0;
            }
        } else {
            startTime60_1Ref.current = null;
            startTime61_1Ref.current = null;
            previousProgress60_1Ref.current = 0;
            previousProgress61_1Ref.current = 0;
        }
    }, [syncJobStatus?.status, syncJobStatus?.completedChunks60_1, syncJobStatus?.completed61_1]);

    // Trigger refresh when job completes
    const prevStatusRef = useRef<string | undefined>(undefined);
    React.useEffect(() => {
        const currentStatus = syncJobStatus?.status;
        if (prevStatusRef.current === 'processing' && currentStatus === 'completed') {
            router.refresh();
        }
        prevStatusRef.current = currentStatus;
    }, [syncJobStatus?.status, router]);

    const handleCancel = async () => {
        if (!confirm("Скасувати завантаження?")) return;
        try {
            await cancelSyncJob();
            router.refresh();
        } catch (error) {
            console.error('Error cancelling sync:', error);
        }
    };

    if (!syncJobStatus || syncJobStatus.status === 'completed' || syncJobStatus.status === 'cancelled' || syncJobStatus.status === 'error') {
        return null;
    }

    const progress60_1 = syncJobStatus.totalChunks60_1 > 0
        ? (syncJobStatus.completedChunks60_1 / syncJobStatus.totalChunks60_1) * 100
        : 0;

    const progress61_1 = syncJobStatus.totalGuids > 0
        ? (syncJobStatus.completed61_1 / syncJobStatus.totalGuids) * 100
        : 0;

    const is61_1Active = syncJobStatus.completedChunks60_1 === syncJobStatus.totalChunks60_1 && syncJobStatus.totalGuids > 0;

    return (
        <div className="fixed top-16 left-0 right-0 lg:left-64 z-40 bg-white border-b border-slate-200 shadow-md">
            <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
                <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-brand-teal animate-spin" />
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-900">
                                Синхронізація активна
                            </span>
                            <div className="flex items-center gap-4">
                                {eta60_1 && !is61_1Active && (
                                    <span className="text-slate-500">Залишилось: {eta60_1}</span>
                                )}
                                {eta61_1 && is61_1Active && (
                                    <span className="text-slate-500">Залишилось: {eta61_1}</span>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancel}
                                    className="h-7 px-2 text-xs"
                                >
                                    <X className="w-4 h-4 mr-1" />
                                    Скасувати
                                </Button>
                            </div>
                        </div>

                        {/* Progress for 60.1 */}
                        {!is61_1Active && syncJobStatus.totalChunks60_1 > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span>Завантаження списків (60.1)</span>
                                    <span>{syncJobStatus.completedChunks60_1} / {syncJobStatus.totalChunks60_1}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-brand-teal rounded-full transition-all duration-300 animate-shimmer"
                                        style={{ width: `${progress60_1}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Progress for 61.1 */}
                        {is61_1Active && syncJobStatus.totalGuids > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span>Завантаження деталей (61.1)</span>
                                    <span>{syncJobStatus.completed61_1} / {syncJobStatus.totalGuids}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-brand-blue rounded-full transition-all duration-300 animate-shimmer"
                                        style={{ width: `${progress61_1}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
