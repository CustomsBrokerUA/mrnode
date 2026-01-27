'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { getSyncJobStatus } from '@/actions/sync';

interface SyncJobStatus {
    id: string;
    status: 'processing' | 'completed' | 'cancelled' | 'error';
    totalChunks60_1: number;
    completedChunks60_1: number;
    totalGuids: number;
    completed61_1: number;
    dateFrom: Date;
    dateTo: Date;
    errorMessage?: string | null;
}

interface SyncStatusContextType {
    syncJobStatus: SyncJobStatus | null;
    isLoading: boolean;
    checkStatus: () => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusContextType | undefined>(undefined);

export function SyncStatusProvider({ children }: { children: React.ReactNode }) {
    const [syncJobStatus, setSyncJobStatus] = useState<SyncJobStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const checkStatus = async () => {
        setIsLoading(true);
        try {
            const result = await getSyncJobStatus();
            if (result.success) {
                if (result.job && result.job.status === 'processing') {
                    setSyncJobStatus(result.job);
                } else {
                    // Update status to completed/error/cancelled so UI can show it
                    if (result.job) {
                        setSyncJobStatus(result.job);
                    }

                    // Only clear if job is completed/cancelled/error
                    if (result.job?.status === 'completed' || result.job?.status === 'cancelled' || result.job?.status === 'error') {
                        // Keep status for a few seconds to show completion, then clear
                        setTimeout(() => {
                            setSyncJobStatus(null);
                        }, 5000);
                    } else {
                        setSyncJobStatus(null);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking sync status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Check status on mount
    useEffect(() => {
        checkStatus();
    }, []);

    // Set up polling when job is processing
    useEffect(() => {
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Start polling if job is processing
        if (syncJobStatus?.status === 'processing') {
            intervalRef.current = setInterval(() => {
                checkStatus();
            }, 2000); // Check every 2 seconds
        } else {
            // Also check periodically if no active job (to catch new jobs started elsewhere)
            intervalRef.current = setInterval(() => {
                checkStatus();
            }, 10000); // Check every 10 seconds when no active job
        }

        // Cleanup on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [syncJobStatus?.status]); // eslint-disable-line react-hooks/exhaustive-deps

    const value = useMemo(() => ({
        syncJobStatus,
        isLoading,
        checkStatus
    }), [syncJobStatus, isLoading]);

    return (
        <SyncStatusContext.Provider value={value}>
            {children}
        </SyncStatusContext.Provider>
    );
}

export function useSyncStatus() {
    const context = useContext(SyncStatusContext);
    if (context === undefined) {
        throw new Error('useSyncStatus must be used within a SyncStatusProvider');
    }
    return context;
}
