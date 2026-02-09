'use client';

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Label } from "@/components/ui";
import { RefreshCw, DownloadCloud, Clock, CheckCircle2, AlertCircle, Play, CheckSquare, Square, ChevronDown, Calendar } from "lucide-react";
import { syncDeclarations, getDeclarationsWithoutDetails, fetchDeclarationDetail, getSyncHistory, syncAllPeriod, syncAllPeriodStaged, getSyncJobStatus, cancelSyncJob } from "@/actions/sync";
import SyncPeriodsStatusBar from "@/components/sync-periods-status-bar";

type SyncHistoryItem = {
    id: string;
    type: string;
    date: string;
    status: string;
    items: number;
    errors?: number;
    dateFrom?: string;
    dateTo?: string;
    errorMessage?: string;
};

type DeclarationWithoutDetails = {
    id: string;
    customsId: string | null;
    mrn: string | null;
    status: string;
    date: Date;
};

export default function SyncPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentAction, setCurrentAction] = useState("");
    const [history, setHistory] = useState<SyncHistoryItem[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    
    // Sync all period state
    const [isSyncAllPeriodActive, setIsSyncAllPeriodActive] = useState(false);
    const [syncJobStatus, setSyncJobStatus] = useState<any>(null);
    
    // ETA tracking refs
    const startTime60_1Ref = useRef<number | null>(null);
    const startTime61_1Ref = useRef<number | null>(null);
    const previousProgress60_1Ref = useRef<number>(0);
    const previousProgress61_1Ref = useRef<number>(0);
    
    // Declarations without 61.1 details
    const [declarationsWithoutDetails, setDeclarationsWithoutDetails] = useState<DeclarationWithoutDetails[]>([]);
    const [selectedGuids, setSelectedGuids] = useState<Set<string>>(new Set());
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isLoadingList, setIsLoadingList] = useState(false);
    
    // Stage selection dropdown
    const [showStageDropdown, setShowStageDropdown] = useState(false);

    // Load declarations without details
    const loadDeclarationsWithoutDetails = async () => {
        setIsLoadingList(true);
        try {
            const result = await getDeclarationsWithoutDetails();
            if (result.error) {
                alert(result.error);
            } else if (result.success) {
                setDeclarationsWithoutDetails(result.declarations || []);
            }
        } catch (e) {
            console.error("Error loading declarations:", e);
        } finally {
            setIsLoadingList(false);
        }
    };

    // Load sync history (limited to 4 most recent entries)
    const loadSyncHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const result = await getSyncHistory(4);
            if (result.error) {
                console.error("Error loading sync history:", result.error);
            } else if (result.success && result.history) {
                // Ensure we only display up to 4 entries
                setHistory(result.history.slice(0, 4));
            }
        } catch (e) {
            console.error("Error loading sync history:", e);
        } finally {
            setIsLoadingHistory(false);
        }
    };

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

    // Calculate ETA for 60.1 (chunks)
    const eta60_1 = useMemo(() => {
        if (!syncJobStatus || syncJobStatus.status !== "processing" || syncJobStatus.totalChunks60_1 === 0) {
            return null;
        }
        
        const completed = syncJobStatus.completedChunks60_1;
        const total = syncJobStatus.totalChunks60_1;
        const remaining = total - completed;
        
        if (remaining <= 0) return null;
        
        const now = Date.now();
        
        // Initialize start time on first progress
        if (startTime60_1Ref.current === null && completed > 0) {
            startTime60_1Ref.current = now;
            previousProgress60_1Ref.current = completed;
            return null; // Need at least one update to calculate
        }
        
        // Reset if progress decreased (new job started)
        if (completed < previousProgress60_1Ref.current) {
            startTime60_1Ref.current = now;
            previousProgress60_1Ref.current = completed;
            return null;
        }
        
        // Update tracking
        previousProgress60_1Ref.current = completed;
        
        if (!startTime60_1Ref.current || completed === 0) return null;
        
        // Calculate rate: items per second
        const elapsed = (now - startTime60_1Ref.current) / 1000; // seconds
        const rate = completed / elapsed; // chunks per second
        
        if (rate <= 0) return null;
        
        // Calculate ETA
        const etaSeconds = remaining / rate;
        return formatDuration(etaSeconds);
    }, [syncJobStatus?.completedChunks60_1, syncJobStatus?.totalChunks60_1, syncJobStatus?.status]);

    // Calculate ETA for 61.1 (GUIDs)
    const eta61_1 = useMemo(() => {
        if (!syncJobStatus || syncJobStatus.status !== "processing" || syncJobStatus.totalGuids === 0) {
            return null;
        }
        
        const completed = syncJobStatus.completed61_1;
        const total = syncJobStatus.totalGuids;
        const remaining = total - completed;
        
        if (remaining <= 0) return null;
        
        const now = Date.now();
        
        // Initialize start time on first progress (only when 60.1 is done and 61.1 starts)
        if (startTime61_1Ref.current === null && completed > 0) {
            startTime61_1Ref.current = now;
            previousProgress61_1Ref.current = completed;
            return null; // Need at least one update to calculate
        }
        
        // Reset if progress decreased (new job started)
        if (completed < previousProgress61_1Ref.current) {
            startTime61_1Ref.current = now;
            previousProgress61_1Ref.current = completed;
            return null;
        }
        
        // Update tracking
        previousProgress61_1Ref.current = completed;
        
        if (!startTime61_1Ref.current || completed === 0) return null;
        
        // Calculate rate: items per second
        const elapsed = (now - startTime61_1Ref.current) / 1000; // seconds
        const rate = completed / elapsed; // GUIDs per second
        
        if (rate <= 0) return null;
        
        // Calculate ETA
        const etaSeconds = remaining / rate;
        return formatDuration(etaSeconds);
    }, [syncJobStatus?.completed61_1, syncJobStatus?.totalGuids, syncJobStatus?.status]);

    // Reset ETA tracking when job starts or completes
    useEffect(() => {
        if (syncJobStatus?.status === "processing") {
            // Reset 60.1 tracking if starting fresh
            if (syncJobStatus.completedChunks60_1 === 0) {
                startTime60_1Ref.current = null;
                previousProgress60_1Ref.current = 0;
            }
            // Reset 61.1 tracking when 60.1 is done and 61.1 starts
            if (syncJobStatus.completedChunks60_1 === syncJobStatus.totalChunks60_1 && 
                syncJobStatus.completed61_1 === 0 && 
                syncJobStatus.totalGuids > 0) {
                startTime61_1Ref.current = null;
                previousProgress61_1Ref.current = 0;
            }
        } else if (syncJobStatus?.status === "completed" || syncJobStatus?.status === "cancelled") {
            // Reset all tracking when job is done
            startTime60_1Ref.current = null;
            startTime61_1Ref.current = null;
            previousProgress60_1Ref.current = 0;
            previousProgress61_1Ref.current = 0;
        }
    }, [syncJobStatus?.status, syncJobStatus?.completedChunks60_1, syncJobStatus?.completed61_1]);

    // Check sync job status
    const checkSyncJobStatus = async () => {
        try {
            const result = await getSyncJobStatus();
            if (result.success) {
                if (result.job) {
                    setSyncJobStatus(result.job);
                    
                    // Only set isSyncAllPeriodActive to true if job is actually processing
                    // For completed/cancelled jobs, set it to false immediately
                    if (result.job.status === "processing") {
                        setIsSyncAllPeriodActive(true);
                    } else {
                        // Job is completed, cancelled, or error - unlock buttons
                        setIsSyncAllPeriodActive(false);
                        await loadSyncHistory();
                    }
                } else {
                    // No active job - unlock buttons
                    setSyncJobStatus(null);
                    setIsSyncAllPeriodActive(false);
                }
            }
        } catch (e) {
            console.error("Error checking sync job status:", e);
            // On error, unlock buttons
            setIsSyncAllPeriodActive(false);
        }
    };

    // Run sync all period (legacy - full period at once)
    const runSyncAllPeriod = async () => {
        if (!confirm("Запустити завантаження всього доступного періоду (поточний та повністю 3 попередні роки, з 1 січня)?\n\nЦе може зайняти багато часу (години) і буде працювати у фоновому режимі.")) {
            return;
        }

        setIsSyncAllPeriodActive(true);
        setSyncJobStatus(null);

        try {
            const result = await syncAllPeriod();
            
            if (result.error) {
                alert(result.error);
                setIsSyncAllPeriodActive(false);
            } else if (result.success) {
                // Start polling for status
                await checkSyncJobStatus();
            }
        } catch (e) {
            console.error("Error starting sync all period:", e);
            const errorMessage = e instanceof Error
                ? e.message
                : typeof e === 'string'
                    ? e
                    : JSON.stringify(e);
            alert(`Помилка запуску завантаження: ${errorMessage}`);
            setIsSyncAllPeriodActive(false);
        }
    };

    // Run staged sync (поетапне завантаження)
    const runStagedSync = async (stage: number = 1) => {
        setIsSyncAllPeriodActive(true);
        setSyncJobStatus(null);

        try {
            const result = await syncAllPeriodStaged(stage);
            
            if (result.error) {
                alert(result.error);
                setIsSyncAllPeriodActive(false);
            } else if (result.success) {
                // Start polling for status
                await checkSyncJobStatus();
            }
        } catch (e) {
            console.error("Error starting staged sync:", e);
            const errorMessage = e instanceof Error
                ? e.message
                : typeof e === 'string'
                    ? e
                    : JSON.stringify(e);
            alert(`Помилка запуску завантаження: ${errorMessage}`);
            setIsSyncAllPeriodActive(false);
        }
    };


    // Parse stage info from syncJobStatus (memoized to update when syncJobStatus changes)
    const stageInfo = useMemo(() => {
        // Check if errorMessage contains STAGE: info (might be at start or after other info)
        if (!syncJobStatus?.errorMessage || !syncJobStatus.errorMessage.includes('STAGE:')) {
            return null;
        }
        
        const stageMatch = syncJobStatus.errorMessage.match(/STAGE:(\d+):([^|]+)/);
        const nextMatch = syncJobStatus.errorMessage.match(/NEXT:(\d+)/);
        const isCompleted = syncJobStatus.errorMessage.includes('COMPLETED');
        
        if (stageMatch) {
            return {
                stage: parseInt(stageMatch[1]),
                stageName: stageMatch[2],
                nextStage: nextMatch ? parseInt(nextMatch[1]) : undefined,
                isCompleted: isCompleted
            };
        }
        
        return null;
    }, [syncJobStatus?.errorMessage]);

    // Check if staged sync is active (only when processing, not after completion)
    const isStagedSyncActive = useMemo(() => {
        return syncJobStatus?.status === "processing" && stageInfo !== null;
    }, [syncJobStatus?.status, stageInfo]);
    
    // Debug: log stage info for troubleshooting
    useEffect(() => {
        if (syncJobStatus?.status === "completed" && syncJobStatus?.errorMessage) {
            console.log('Sync job completed. errorMessage:', syncJobStatus.errorMessage);
            console.log('Parsed stageInfo:', stageInfo);
        }
    }, [syncJobStatus?.status, syncJobStatus?.errorMessage, stageInfo]);

    // Cancel sync all period
    const handleCancelSyncAllPeriod = async () => {
        if (!confirm("Скасувати завантаження всього періоду?")) {
            return;
        }

        try {
            const result = await cancelSyncJob();
            if (result.error) {
                alert(result.error);
            } else {
                setIsSyncAllPeriodActive(false);
                setSyncJobStatus(null);
                await loadSyncHistory();
            }
        } catch (e) {
            console.error("Error cancelling sync job:", e);
            alert("Помилка скасування");
        }
    };

    // State for 61.1 progress
    const [detailsProgress, setDetailsProgress] = useState({ current: 0, total: 0 });
    const [canCancelDetails, setCanCancelDetails] = useState(false);
    const [isCancelled, setIsCancelled] = useState(false);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isCancelledRef = useRef(false);

    // Cancel 61.1 download
    const cancelDetailsDownload = () => {
        isCancelledRef.current = true;
        setIsCancelled(true);
        
        // Clear progress interval
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        
        // Update UI to show cancellation
        setCurrentAction("Завантаження скасовано");
        setProgress(0);
        setIsLoadingDetails(false);
        setCanCancelDetails(false);
        
        // Reset after 2 seconds
        setTimeout(() => {
            setCurrentAction("");
            setDetailsProgress({ current: 0, total: 0 });
            setIsCancelled(false);
            isCancelledRef.current = false;
        }, 2000);
    };

    // Fetch 61.1 details for selected declarations
    const fetchSelectedDetails = async () => {
        if (selectedGuids.size === 0) {
            alert("Виберіть хоча б одну декларацію для завантаження деталей");
            return;
        }

        // Reset cancellation flag
        isCancelledRef.current = false;
        setIsCancelled(false);

        // Clear any existing interval first
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }

        setIsLoadingDetails(true);
        setCanCancelDetails(true);
        const totalGuids = selectedGuids.size;
        setDetailsProgress({ current: 0, total: totalGuids });
        setCurrentAction(`Завантаження деталей 61.1...`);
        setProgress(0);

        try {
            const guids = Array.from(selectedGuids);
            
            // Process each GUID individually to allow cancellation
            let successCount = 0;
            let errorCount = 0;
            let processedCount = 0;
            
            for (const guid of guids) {
                // Check if cancelled before each request
                if (isCancelledRef.current) {
                    // User cancelled, stop processing
                    setCurrentAction(`Завантаження скасовано (оброблено ${processedCount} з ${totalGuids})`);
                    break;
                }
                
                // Update progress
                processedCount++;
                const progressPercent = Math.min(Math.round((processedCount / totalGuids) * 90), 90);
                setProgress(progressPercent);
                setDetailsProgress({ current: processedCount, total: totalGuids });
                setCurrentAction(`Завантаження деталей 61.1: ${processedCount} з ${totalGuids}`);
                
                // Fetch details for this GUID
                const result = await fetchDeclarationDetail(guid);
                
                // Check if cancelled after request (in case user cancelled during request)
                if (isCancelledRef.current) {
                    setCurrentAction(`Завантаження скасовано (оброблено ${processedCount} з ${totalGuids})`);
                    break;
                }
                
                if (result.success && result.count > 0) {
                    successCount++;
                } else {
                    errorCount++;
                }
                
                // Rate limiting: wait 1 second between requests (matching server-side rate limit)
                // But check cancellation during wait
                for (let i = 0; i < 10; i++) {
                    if (isCancelledRef.current) {
                        setCurrentAction(`Завантаження скасовано (оброблено ${processedCount} з ${totalGuids})`);
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Check if cancelled before final processing
            if (isCancelledRef.current) {
                // User cancelled, don't show success message or reload
                return;
            }
            
            // Set final progress
            const actualCount = successCount;
            setProgress(100);
            setDetailsProgress({ current: totalGuids, total: totalGuids });
            setCurrentAction(`Завантаження завершено: ${actualCount} з ${totalGuids}`);
            
            // Show results and reload
            if (errorCount > 0) {
                alert(`Завантажено деталі для ${actualCount} декларацій. Помилок: ${errorCount}`);
            } else {
                alert(`Успішно завантажено деталі для ${actualCount} декларацій`);
            }
            
            setSelectedGuids(new Set());
            // Reload the list and history
            await loadDeclarationsWithoutDetails();
            await loadSyncHistory();
        } catch (e) {
            // Only show error if not cancelled
            if (!isCancelledRef.current) {
                console.error("Error fetching details:", e);
                alert("Помилка при завантаженні деталей");
            }
        } finally {
            // Only reset if not cancelled (cancellation handles its own cleanup)
            if (!isCancelledRef.current) {
                // Clear any remaining intervals
                if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                }
                setIsLoadingDetails(false);
                setCanCancelDetails(false);
                setCurrentAction("");
                setProgress(0);
                setDetailsProgress({ current: 0, total: 0 });
            }
        }
    };

    const runSync = async () => {
        // Validate period
        const start = new Date(dateFrom);
        const end = new Date(dateTo);
        const now = new Date();
        
        // Validate: period cannot exceed 45 days (API limitation)
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 45) {
            alert("Вибачте, але період не може перевищувати 45 днів (обмеження API митниці).");
            return;
        }

        if (start > end) {
            alert("Дата початку не може бути пізніше дати кінця.");
            return;
        }

        // Validate: start date cannot be earlier than Jan 1 of (current year - 3)
        const maxAllowedDate = new Date(now.getFullYear() - 3, 0, 1);
        maxAllowedDate.setHours(0, 0, 0, 0);

        if (start < maxAllowedDate) {
            const maxAllowedDateStr = maxAllowedDate.toLocaleDateString('uk-UA');
            alert(`Дата початку не може бути раніше ${maxAllowedDateStr}.\n\nДоступний період: поточний та повністю 3 попередні роки (з 1 січня).`);
            return;
        }

        setIsLoading(true);
        setCurrentAction(`Ініціалізація 60.1...`);
        setProgress(10);

        setCurrentAction("З'єднання з сервером...");
        setProgress(30);

        try {
            const result = await syncDeclarations("60.1", start, end);

            setProgress(80);

            if (result.error) {
                const newEntry = {
                    id: Date.now(),
                    type: "60.1",
                    date: new Date().toLocaleString('uk-UA'),
                    status: "error",
                    items: 0
                };
                alert(result.error); // Simple feedback for now
            } else {
                setCurrentAction("Збереження даних...");
                // Reload declarations without details after sync
                await loadDeclarationsWithoutDetails();
            }
            // Reload history to show new entry
            await loadSyncHistory();
        } catch (e) {
        } finally {
            setIsLoading(false);
            setProgress(100);
            setTimeout(() => {
                setCurrentAction("");
                setProgress(0);
            }, 2000);
        }
    }

    // Ref for status polling interval
    const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Load list and history on mount
    useEffect(() => {
        loadDeclarationsWithoutDetails();
        loadSyncHistory();
        checkSyncJobStatus();
    }, []); // Run once on mount

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showStageDropdown && !(event.target as Element).closest('.stage-dropdown-container')) {
                setShowStageDropdown(false);
            }
        };
        
        if (showStageDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showStageDropdown]);

    // Set up polling for sync job status (only when job is active)
    useEffect(() => {
        // Clear any existing interval
        if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
        }

        // Only start polling if job is actively processing
        if (syncJobStatus?.status === "processing") {
            statusIntervalRef.current = setInterval(() => {
                checkSyncJobStatus();
            }, 3000); // Check every 3 seconds
        }

        // Cleanup on unmount or when dependencies change
        return () => {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
                statusIntervalRef.current = null;
            }
        };
    }, [syncJobStatus?.status]); // Re-run only when status changes

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Центр Синхронізації</h1>
                <p className="text-slate-500">Керування обміном даними з Державною Митною Службою</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Control Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-brand-teal/20 shadow-lg shadow-brand-teal/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <RefreshCw className={`w-5 h-5 text-brand-teal ${isLoading ? 'animate-spin' : ''}`} />
                                Запуск Синхронізації
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Date Selection */}
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Дата початку</Label>
                                    <Input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Дата кінця</Label>
                                    <Input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-4 pt-4">
                                <button
                                    onClick={() => runSync()}
                                    disabled={isLoading || isSyncAllPeriodActive || isStagedSyncActive}
                                    className="w-full flex flex-col items-center justify-center p-6 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="w-12 h-12 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center text-white mb-3 shadow-md group-hover:scale-110 transition-transform">
                                        <DownloadCloud className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Запит 60.1 (Список)</h3>
                                    <p className="text-xs text-center text-slate-500 mt-1">
                                        Завантаження списку МД за період
                                    </p>
                                </button>
                                
                                {/* Поетапне завантаження з вибором етапу */}
                                <div className="space-y-3">
                                    <div className="relative stage-dropdown-container">
                                        <button
                                            onClick={() => setShowStageDropdown(!showStageDropdown)}
                                            disabled={isLoading || isSyncAllPeriodActive || isStagedSyncActive}
                                            className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border-2 border-green-300 dark:border-green-700 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                                                    <DownloadCloud className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="font-bold text-slate-900 text-sm">Завантажити за період</h3>
                                                    <p className="text-xs text-slate-600">Оберіть період для завантаження</p>
                                                </div>
                                            </div>
                                            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${showStageDropdown ? 'rotate-180' : ''}`} />
                                        </button>
                                        
                                        {/* Dropdown menu */}
                                        {showStageDropdown && !isLoading && !isSyncAllPeriodActive && !isStagedSyncActive && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-green-200 rounded-xl shadow-lg z-10 overflow-hidden">
                                                <button
                                                    onClick={() => {
                                                        runStagedSync(1);
                                                        setShowStageDropdown(false);
                                                    }}
                                                    className="w-full flex items-center justify-between p-3 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors border-b border-slate-100 dark:border-slate-700"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                            <span className="text-xs font-bold text-green-700">1</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-semibold text-slate-900">Останній тиждень</p>
                                                            <p className="text-xs text-slate-500">7 днів</p>
                                                        </div>
                                                    </div>
                                                </button>
                                                
                                                <button
                                                    onClick={() => {
                                                        runStagedSync(2);
                                                        setShowStageDropdown(false);
                                                    }}
                                                    className="w-full flex items-center justify-between p-3 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors border-b border-slate-100 dark:border-slate-700"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                            <span className="text-xs font-bold text-green-700">2</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-semibold text-slate-900">Останній місяць</p>
                                                            <p className="text-xs text-slate-500">30 днів</p>
                                                        </div>
                                                    </div>
                                                </button>
                                                
                                                <button
                                                    onClick={() => {
                                                        runStagedSync(3);
                                                        setShowStageDropdown(false);
                                                    }}
                                                    className="w-full flex items-center justify-between p-3 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors border-b border-slate-100 dark:border-slate-700"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                            <span className="text-xs font-bold text-green-700">3</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-semibold text-slate-900">Останній квартал</p>
                                                            <p className="text-xs text-slate-500">90 днів</p>
                                                        </div>
                                                    </div>
                                                </button>
                                                
                                                <button
                                                    onClick={() => {
                                                        runStagedSync(4);
                                                        setShowStageDropdown(false);
                                                    }}
                                                    className="w-full flex items-center justify-between p-3 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors border-b border-slate-100 dark:border-slate-700"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                            <span className="text-xs font-bold text-green-700">4</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-semibold text-slate-900">Останній рік</p>
                                                            <p className="text-xs text-slate-500">365 днів</p>
                                                        </div>
                                                    </div>
                                                </button>
                                                
                                                <button
                                                    onClick={() => {
                                                        runStagedSync(5);
                                                        setShowStageDropdown(false);
                                                    }}
                                                    className="w-full flex items-center justify-between p-3 hover:bg-green-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                                            <span className="text-xs font-bold text-green-700">5</span>
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-semibold text-slate-900">Весь період</p>
                                                            <p className="text-xs text-slate-500">Поточний + 3 попередні роки</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Info about stages */}
                                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 space-y-2">
                                        <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
                                            💡 <strong>Рекомендовано:</strong> Почніть з тижня або місяця, щоб швидко побачити дані та ознайомитись з функціоналом
                                        </p>
                                        <div className="border-t border-blue-200 pt-2 mt-2">
                                            <p className="text-xs text-blue-700 text-center">
                                                ⏱️ <strong>Швидкість завантаження:</strong> в середньому 30-50 декларацій за хвилину
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Завантажити весь період одразу - більш виділена */}
                                <button
                                    onClick={() => runSyncAllPeriod()}
                                    disabled={isLoading || isSyncAllPeriodActive || isStagedSyncActive}
                                    className="w-full flex flex-col items-center justify-center p-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 hover:from-orange-100 hover:to-red-100 dark:hover:from-orange-900/50 dark:hover:to-red-900/50 border-2 border-orange-300 dark:border-orange-700 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                >
                                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 dark:from-orange-600 dark:to-red-600 rounded-full flex items-center justify-center text-white mb-3 shadow-lg group-hover:scale-110 transition-transform">
                                        <DownloadCloud className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Завантажити весь період одразу</h3>
                                    <p className="text-xs text-center text-slate-600 dark:text-slate-300 mt-1 max-w-xs">
                                        Автоматичне завантаження: поточний та повністю 3 попередні роки (з 1 січня)
                                    </p>
                                </button>
                            </div>

                            {/* Progress Bar for Sync All Period */}
                            {(isSyncAllPeriodActive || (syncJobStatus && syncJobStatus.status === "completed")) && syncJobStatus && (
                                <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2 border-t border-green-200 mt-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                                                <span>
                                                    {stageInfo ? `Етап ${stageInfo.stage}: ${stageInfo.stageName}` : "Завантаження всього періоду"}
                                                </span>
                                                {syncJobStatus.status === "processing" && (
                                                    <RefreshCw className="w-3 h-3 animate-spin inline-block ml-2" />
                                                )}
                                            </div>
                                        </div>
                                        {syncJobStatus.status === "processing" && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCancelSyncAllPeriod}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-4"
                                            >
                                                Скасувати
                                            </Button>
                                        )}
                                    </div>
                                    
                                    {/* Progress for 60.1 (Lists) */}
                                    {syncJobStatus.totalChunks60_1 > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-medium text-slate-600">
                                                <span>Завантаження списків (60.1)</span>
                                                <span>
                                                    {syncJobStatus.completedChunks60_1} з {syncJobStatus.totalChunks60_1} періодів
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                                    style={{ width: `${Math.round((syncJobStatus.completedChunks60_1 / syncJobStatus.totalChunks60_1) * 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <p className="text-slate-500">
                                                    Прогрес: {Math.round((syncJobStatus.completedChunks60_1 / syncJobStatus.totalChunks60_1) * 100)}%
                                                </p>
                                                {eta60_1 && (
                                                    <p className="text-slate-600 font-medium flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Залишилось: ~{eta60_1}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Progress for 61.1 (Details) */}
                                    {syncJobStatus.totalGuids > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-medium text-slate-600">
                                                <span>Завантаження деталей (61.1)</span>
                                                <span>
                                                    {syncJobStatus.completed61_1} з {syncJobStatus.totalGuids} декларацій
                                                </span>
                                            </div>
                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 transition-all duration-300 ease-out"
                                                    style={{ width: `${Math.round((syncJobStatus.completed61_1 / syncJobStatus.totalGuids) * 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <p className="text-slate-500">
                                                    Прогрес: {Math.round((syncJobStatus.completed61_1 / syncJobStatus.totalGuids) * 100)}%
                                                </p>
                                                {eta61_1 && (
                                                    <p className="text-slate-600 font-medium flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Залишилось: ~{eta61_1}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {syncJobStatus.status === "completed" && (
                                        <div className="space-y-3">
                                            <p className="text-xs text-green-600 text-center font-medium">
                                                ✅ Завантаження завершено!
                                            </p>
                                        </div>
                                    )}
                                    {syncJobStatus.status === "cancelled" && (
                                        <p className="text-xs text-orange-600 text-center font-medium">
                                            ⚠️ Завантаження скасовано
                                        </p>
                                    )}
                                    {syncJobStatus.status === "error" && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-red-600 text-center font-medium">
                                                ❌ Помилка завантаження
                                            </p>
                                            {syncJobStatus.errorMessage && (
                                                <p className="text-xs text-red-500 text-left bg-red-50 p-2 rounded border border-red-200">
                                                    {syncJobStatus.errorMessage}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {/* Show short message during processing, full details only after completion */}
                                    {syncJobStatus.errorMessage && syncJobStatus.status === "processing" && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-orange-600 text-center font-medium">
                                                ⚠️ Є помилки під час завантаження
                                            </p>
                                            <p className="text-xs text-orange-500 text-left bg-orange-50 p-2 rounded border border-orange-200">
                                                {syncJobStatus.errorMessage}
                                            </p>
                                            <p className="text-xs text-slate-400 text-center italic">
                                                Детальна інформація буде доступна після завершення синхронізації
                                            </p>
                                        </div>
                                    )}
                                    
                                    {/* Detailed errors list - only show after completion */}
                                    {syncJobStatus.errors && syncJobStatus.errors.length > 0 && (syncJobStatus.status === "completed" || syncJobStatus.status === "error") && (
                                        <div className="space-y-2 mt-4 border-t border-slate-200 pt-4">
                                            <p className="text-xs font-semibold text-slate-700 text-center">
                                                📋 Деталі помилок ({syncJobStatus.errors.length} періодів)
                                            </p>
                                            <div className="max-h-64 overflow-y-auto space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
                                                {syncJobStatus.errors.map((err: any, idx: number) => (
                                                    <div key={idx} className="bg-white rounded border border-red-100 p-2 text-xs">
                                                        <div className="font-semibold text-red-700 mb-1">
                                                            Період {idx + 1}: {new Date(err.dateFrom).toLocaleDateString('uk-UA')} - {new Date(err.dateTo).toLocaleDateString('uk-UA')}
                                                        </div>
                                                        <div className="text-slate-600 mb-1">
                                                            {err.errorMessage}
                                                        </div>
                                                        {err.errorCode && (
                                                            <div className="text-slate-400 text-[10px]">
                                                                Код помилки: {err.errorCode}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-xs text-slate-500 text-center italic">
                                                Рекомендація: Спробуйте завантажити дані за цими періодами вручну через "Запит 60.1"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Progress Bar for 60.1 (Visible only when loading 60.1) */}
                            {isLoading && !isLoadingDetails && (
                                <div className="space-y-2 pt-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between text-xs font-medium text-slate-600">
                                        <span>{currentAction}</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand-blue transition-all duration-300 ease-out"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Progress Bar for 61.1 Details (Visible only when loading details or cancelled) */}
                            {((isLoadingDetails && detailsProgress.total > 0) || (isCancelled && currentAction === "Завантаження скасовано")) && (
                                <div className="space-y-2 pt-4 animate-in fade-in slide-in-from-top-2 border-t border-slate-200 mt-4">
                                    <div className="flex justify-between text-xs font-medium text-slate-600">
                                        <span className={isCancelled ? "text-orange-600" : ""}>{currentAction}</span>
                                        {!isCancelled && detailsProgress.total > 0 && (
                                            <span>{detailsProgress.current} з {detailsProgress.total}</span>
                                        )}
                                    </div>
                                    {!isCancelled && detailsProgress.total > 0 && (
                                        <>
                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                                    style={{ width: `${Math.round((detailsProgress.current / detailsProgress.total) * 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 text-center">
                                                Прогрес: {Math.round((detailsProgress.current / detailsProgress.total) * 100)}%
                                            </p>
                                        </>
                                    )}
                                    {isCancelled && (
                                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-orange-400 transition-all duration-300 ease-out"
                                                style={{ width: "100%" }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Declarations without details */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-orange-500" />
                                    МД без деталей (61.1)
                                </CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadDeclarationsWithoutDetails}
                                    disabled={isLoadingList}
                                >
                                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingList ? 'animate-spin' : ''}`} />
                                    Оновити
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingList ? (
                                <div className="text-center py-8 text-slate-500">Завантаження...</div>
                            ) : declarationsWithoutDetails.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    Всі декларації мають деталі 61.1
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-slate-600">
                                            Знайдено {declarationsWithoutDetails.length} декларацій без деталей
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    if (selectedGuids.size === declarationsWithoutDetails.length) {
                                                        setSelectedGuids(new Set());
                                                    } else {
                                                        const allGuids = new Set(
                                                            declarationsWithoutDetails
                                                                .filter(d => d.customsId)
                                                                .map(d => d.customsId!)
                                                        );
                                                        setSelectedGuids(allGuids);
                                                    }
                                                }}
                                            >
                                                {selectedGuids.size === declarationsWithoutDetails.filter(d => d.customsId).length
                                                    ? 'Зняти вибір'
                                                    : 'Вибрати всі'}
                                            </Button>
                                            {isLoadingDetails && canCancelDetails && !isCancelled && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={cancelDetailsDownload}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    Скасувати
                                                </Button>
                                            )}
                                            <Button
                                                onClick={fetchSelectedDetails}
                                                disabled={isLoadingDetails || selectedGuids.size === 0}
                                                size="sm"
                                            >
                                                {isLoadingDetails ? (
                                                    <>
                                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                        Завантаження...
                                                    </>
                                                ) : (
                                                    <>
                                                        <DownloadCloud className="w-4 h-4 mr-2" />
                                                        Завантажити деталі ({selectedGuids.size})
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto space-y-2">
                                        {declarationsWithoutDetails.map((decl) => {
                                            const isSelected = decl.customsId && selectedGuids.has(decl.customsId);
                                            return (
                                                <div
                                                    key={decl.id}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                                        isSelected
                                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
                                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            if (!decl.customsId) return;
                                                            const newSelected = new Set(selectedGuids);
                                                            if (newSelected.has(decl.customsId)) {
                                                                newSelected.delete(decl.customsId);
                                                            } else {
                                                                newSelected.add(decl.customsId);
                                                            }
                                                            setSelectedGuids(newSelected);
                                                        }}
                                                        disabled={!decl.customsId}
                                                        className="flex-shrink-0"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare className="w-5 h-5 text-blue-600" />
                                                        ) : (
                                                            <Square className="w-5 h-5 text-slate-400" />
                                                        )}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 truncate">
                                                            {decl.mrn || decl.customsId || 'Без номера'}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {new Date(decl.date).toLocaleDateString('uk-UA')}
                                                        </p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                                        decl.status === 'CLEARED' ? 'bg-green-100 text-green-700' :
                                                        decl.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {decl.status === 'CLEARED' ? 'Оформлена' :
                                                        decl.status === 'REJECTED' ? 'Відхилена' : 'В роботі'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Periods Status Bar */}
                    <SyncPeriodsStatusBar />

                    {/* API Status Info */}
                    <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-sm flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div>
                            <p className="text-white font-medium mb-1">Інформація щодо лімітів ДМСУ</p>
                            <ul className="space-y-1 list-disc list-inside">
                                <li>Митниця дозволяє робити запит 60.1 не частіше ніж раз на 15 хвилин.</li>
                                <li>Максимальний період запиту: 45 днів (обмеження API митниці).</li>
                                <li>Максимальний доступний період: поточний та повністю 3 попередні роки (з 1 січня).</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* History Sidebar */}
                <div>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-slate-400" />
                                    Історія запитів
                                </div>
                                {history.length > 0 && (
                                    <span className="text-xs text-slate-400 font-normal">
                                        Останні {history.length}
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoadingHistory ? (
                                <div className="text-center py-8 text-slate-500">Завантаження історії...</div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    Історія синхронізацій порожня
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {history.map((item) => (
                                        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                            <div className={`mt-1 w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-green-500' :
                                                item.status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
                                                }`} />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.type}</p>
                                                <p className="text-xs text-slate-500">{item.date}</p>
                                                {item.dateFrom && item.dateTo && (
                                                    <p className="text-xs text-slate-400">
                                                        Період: {item.dateFrom} - {item.dateTo}
                                                    </p>
                                                )}
                                                {item.status === 'success' && item.items > 0 && (
                                                    <span className="inline-flex items-center text-[10px] text-green-600 dark:text-green-300 font-medium bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                                        +{item.items} МД
                                                        {item.errors && item.errors > 0 && (
                                                            <span className="ml-1 text-orange-600">
                                                                ({item.errors} помилок)
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                                {item.status === 'error' && (
                                                    <span className="inline-flex items-center text-[10px] text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                                                        Помилка{item.errors && item.errors > 0 ? ` (${item.errors} помилок)` : ''}
                                                    </span>
                                                )}
                                                {item.errorMessage && (
                                                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-2">
                                                        {item.errorMessage}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
