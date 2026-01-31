'use client';

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Button, Input, cn } from "@/components/ui";
import { Search, FileSpreadsheet, Eye, Trash2, Calendar, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, X, Download, RotateCcw, Table, LayoutGrid, List } from "lucide-react";
// No router needed - all state is client-side
import { deleteDeclaration, deleteDeclarationsByIds, deleteDeclarationsByPeriod } from "@/actions/declarations";
import { getArchiveStatistics } from "@/actions/declarations";
import { getDeclarationsPaginated } from "@/actions/declarations";
import { Declaration, DeclarationWithRawData, SortColumn } from './types';
import { statusStyles, statusLabels, DEFAULT_STATS_SETTINGS, DEFAULT_EXPORT_COLUMNS } from './constants';
import { getRawData, formatRegisteredDate, decodeWindows1251, getMDNumber } from './utils';
import { exportToExcel, exportExtendedToExcel, exportExtendedGoodsToExcel } from './export-utils';
import ArchiveStatistics from './components/archive-statistics';
import VirtualizedTableView from './components/virtualized-table-view';
import { TabControl } from './components/archive-header';
import { QuickPreviewModal, DeletePeriodModal, ExportModal, StatisticsSettingsModal } from './components/archive-modals';
import { FiltersPanel } from './components/archive-filters';
import { TableView, CardsView, CompactView } from './components/archive-views';
import {
    useArchiveData,
    useArchiveFilters,
    useArchiveSorting,
    useArchivePagination,
    useArchiveStatistics,
    useArchiveSelection,
    useArchiveDelete
} from './hooks';
import CompanyFilter from '@/components/company-filter';

interface ArchiveStatistics {
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

interface ArchivePageClientProps {
    declarations: Declaration[];
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    activeTab?: 'list60' | 'list61';
    statistics?: ArchiveStatistics | null;
    activeCompanyId?: string;
}

export default function ArchivePageClient({
    declarations,
    activeCompanyId = ''
}: ArchivePageClientProps) {
    // Safety check: ensure declarations is always an array
    const initialDeclarations = Array.isArray(declarations) ? declarations : [];
    const [loadedDeclarations, setLoadedDeclarations] = useState<Declaration[]>(initialDeclarations);
    const [isListLoading, setIsListLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'list60' | 'list61'>('list61');
    const [searchTerm, setSearchTerm] = useState("");
    const [showDeletePeriodModal, setShowDeletePeriodModal] = useState(false);
    const [deletePeriodFrom, setDeletePeriodFrom] = useState("");
    const [deletePeriodTo, setDeletePeriodTo] = useState("");
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

    const [isExtendedExporting, setIsExtendedExporting] = useState(false);
    const [extendedExportProgress, setExtendedExportProgress] = useState<{
        phase: 'fetching_details' | 'generating_rows' | 'writing_file';
        current: number;
        total: number;
    } | null>(null);

    // View mode state (table, cards, compact)
    const [viewMode, setViewMode] = useState<'table' | 'cards' | 'compact'>('table');

    const [isMobile, setIsMobile] = useState(false);

    // Pagination state - client-side pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(20);

    // Sorting state - read from URL or props
    const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Filters state - will be initialized from URL
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDateFrom, setFilterDateFrom] = useState<string>('');
    const [filterDateTo, setFilterDateTo] = useState<string>('');
    const [filterCustomsOffice, setFilterCustomsOffice] = useState<string>('');
    const [filterCurrency, setFilterCurrency] = useState<string>('all');
    const [filterInvoiceValueFrom, setFilterInvoiceValueFrom] = useState<string>('');
    const [filterInvoiceValueTo, setFilterInvoiceValueTo] = useState<string>('');
    const [filterConsignor, setFilterConsignor] = useState<string>('');
    const [filterConsignee, setFilterConsignee] = useState<string>('');
    const [filterContractHolder, setFilterContractHolder] = useState<string>('');
    const [filterHSCode, setFilterHSCode] = useState<string>('');
    const [filterDeclarationType, setFilterDeclarationType] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

    const sanitizedSelectedCompanyIds = useMemo(() => {
        return Array.isArray(selectedCompanyIds)
            ? selectedCompanyIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [];
    }, [selectedCompanyIds]);

    // Quick preview state
    const [previewDoc, setPreviewDoc] = useState<DeclarationWithRawData | null>(null);

    // Grouping state
    const [groupByDate, setGroupByDate] = useState(false);

    // Export modal state
    const [showExportModal, setShowExportModal] = useState(false);

    // Statistics settings state
    const [showStatsSettings, setShowStatsSettings] = useState(false);
    // Always initialize with defaults to avoid hydration mismatch
    const [statsSettings, setStatsSettings] = useState<{ [key: string]: boolean }>(DEFAULT_STATS_SETTINGS);

    // Track if component is mounted to avoid hydration issues with formatting
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (isMobile && viewMode !== 'compact') {
            setViewMode('compact');
        }
    }, [isMobile, viewMode]);

    // Load settings from localStorage after mount to avoid hydration issues
    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') {
            // Stats
            const savedStats = localStorage.getItem('statsSettings');
            if (savedStats) {
                try {
                    setStatsSettings({ ...DEFAULT_STATS_SETTINGS, ...JSON.parse(savedStats) });
                } catch (e) { console.error(e); }
            }

            // Export
            const savedExportColumns = localStorage.getItem('exportColumns');
            if (savedExportColumns) {
                try {
                    setExportColumns({ ...DEFAULT_EXPORT_COLUMNS, ...JSON.parse(savedExportColumns) });
                } catch (e) { console.error(e); }
            }

            const savedExportOrder = localStorage.getItem('exportColumnOrder');
            if (savedExportOrder) {
                try {
                    setExportColumnOrder(JSON.parse(savedExportOrder));
                } catch (e) { console.error(e); }
            }

            // Tabs & View
            const savedTab = localStorage.getItem('archiveActiveTab') as 'list60' | 'list61';
            if (savedTab) setActiveTab(savedTab);

            const savedView = localStorage.getItem('archiveViewMode') as 'table' | 'cards' | 'compact';
            if (savedView) setViewMode(savedView);

            const savedItems = localStorage.getItem('archiveItemsPerPage');
            if (savedItems) setItemsPerPage(parseInt(savedItems, 10));
        }
    }, []);
    const [exportColumns, setExportColumns] = useState<{ [key: string]: boolean }>(DEFAULT_EXPORT_COLUMNS);

    const [exportColumnOrder, setExportColumnOrder] = useState<string[]>(Object.keys(DEFAULT_EXPORT_COLUMNS));

    // Initialize export columns when tab changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('exportColumns');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Merge with defaults to ensure all keys exist
                    const defaults = {
                        mdNumber: true,
                        registeredDate: true,
                        status: true,
                        type: true,
                        transport: true,
                        consignor: true,
                        consignee: true,
                        invoiceValue: true,
                        invoiceCurrency: true,
                        goodsCount: true,
                        customsOffice: true,
                        declarantName: true,
                        guid: true,
                        mrn: true,
                    };
                    setExportColumns({ ...defaults, ...parsed });
                } catch {
                    // Invalid saved data, keep current state
                }
            }
        }
    }, [activeTab]);

    // Loading state for tab switching
    const [isProcessing, setIsProcessing] = useState(false);

    // Load declarations from server based on active filters so older declarations appear.
    // We load a capped slice (max 500) and paginate locally.
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            setIsListLoading(true);

            (async () => {
                try {
                    const result = await getDeclarationsPaginated(
                        1,
                        500,
                        {
                            status: filterStatus,
                            dateFrom: filterDateFrom,
                            dateTo: filterDateTo,
                            customsOffice: filterCustomsOffice,
                            currency: filterCurrency,
                            invoiceValueFrom: filterInvoiceValueFrom,
                            invoiceValueTo: filterInvoiceValueTo,
                            consignor: filterConsignor,
                            consignee: filterConsignee,
                            contractHolder: filterContractHolder,
                            hsCode: filterHSCode,
                            declarationType: filterDeclarationType,
                            searchTerm: searchTerm,
                        },
                        sortColumn,
                        sortDirection,
                        activeTab,
                        sanitizedSelectedCompanyIds.length > 0 ? sanitizedSelectedCompanyIds : undefined
                    );

                    if (!cancelled) {
                        const decls = (result as any).declarations;
                        if (Array.isArray(decls)) {
                            let didReplace = false;
                            setLoadedDeclarations((prev) => {
                                const shouldReplace = decls.length > 0 || prev.length === 0;
                                didReplace = shouldReplace;
                                return shouldReplace ? decls : prev;
                            });
                            if (didReplace) {
                                setCurrentPage(1);
                            }
                        }
                    }
                } finally {
                    if (!cancelled) {
                        setIsListLoading(false);
                    }
                }
            })();
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        activeTab,
        filterStatus,
        filterDateFrom,
        filterDateTo,
        filterCustomsOffice,
        filterCurrency,
        filterInvoiceValueFrom,
        filterInvoiceValueTo,
        filterConsignor,
        filterConsignee,
        filterContractHolder,
        filterHSCode,
        filterDeclarationType,
        searchTerm,
        sortColumn,
        sortDirection,
        sanitizedSelectedCompanyIds,
    ]);

    const companyFilteredDeclarations = useMemo(() => {
        return loadedDeclarations;
    }, [loadedDeclarations]);

    // Parse raw data and details using hooks
    const { declarationsWithRawData, declarationsWithDetails } = useArchiveData(companyFilteredDeclarations, activeTab);

    // Hide loading after processing completes
    // This effect runs after tab changes and calculates how long processing should take
    useEffect(() => {
        if (loadedDeclarations.length > 0 && isProcessing) {
            // Calculate processing time based on data size
            // For list61, processing takes longer (needs to parse XML for each declaration)
            const baseTime = activeTab === 'list61' ? 800 : 400;
            const perItemTime = activeTab === 'list61' ? 5 : 2;
            const processingTime = Math.min(3000, baseTime + (loadedDeclarations.length * perItemTime));

            const timer = setTimeout(() => {
                setIsProcessing(false);
            }, processingTime);

            return () => clearTimeout(timer);
        }
    }, [activeTab, loadedDeclarations.length, isProcessing]);

    // Create filters object for useArchiveFilters
    const filters = {
        status: filterStatus,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        customsOffice: filterCustomsOffice,
        currency: filterCurrency,
        invoiceValueFrom: filterInvoiceValueFrom,
        invoiceValueTo: filterInvoiceValueTo,
        consignor: filterConsignor,
        consignee: filterConsignee,
        contractHolder: filterContractHolder,
        hsCode: filterHSCode,
        declarationType: filterDeclarationType,
        searchTerm: searchTerm,
    };

    // Filter declarations using hook
    const { filteredDocs, filteredDocs60, filteredDocs61 } = useArchiveFilters({
        declarationsWithRawData,
        declarationsWithDetails,
        activeTab,
        filters
    });

    const clientStatistics = useArchiveStatistics({
        filteredDocs: filteredDocs as any,
        activeTab,
    });

    // Sort declarations using hook
    const { sortedDocs } = useArchiveSorting({
        filteredDocs,
        activeTab,
        sortColumn,
        sortDirection
    });

    const [serverStatistics, setServerStatistics] = useState<any | null>(null);
    const [isStatsLoading, setIsStatsLoading] = useState(false);

    // Server-side statistics (for full DB, not just the currently loaded declarations)
    useEffect(() => {
        if (activeTab !== 'list61') {
            return;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            setIsStatsLoading(true);

            (async () => {
                try {
                    const stats = await getArchiveStatistics(
                        {
                            status: filters.status,
                            dateFrom: filters.dateFrom,
                            dateTo: filters.dateTo,
                            customsOffice: filters.customsOffice,
                            currency: filters.currency,
                            invoiceValueFrom: filters.invoiceValueFrom,
                            invoiceValueTo: filters.invoiceValueTo,
                            consignor: filters.consignor,
                            consignee: filters.consignee,
                            contractHolder: filters.contractHolder,
                            hsCode: filters.hsCode,
                            declarationType: filters.declarationType,
                            searchTerm: filters.searchTerm,
                        },
                        activeTab,
                        sanitizedSelectedCompanyIds.length > 0 ? sanitizedSelectedCompanyIds : undefined
                    );

                    if (!cancelled) {
                        setServerStatistics(stats);
                    }
                } finally {
                    if (!cancelled) {
                        setIsStatsLoading(false);
                    }
                }
            })();
        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        activeTab,
        filters.status,
        filters.dateFrom,
        filters.dateTo,
        filters.customsOffice,
        filters.currency,
        filters.invoiceValueFrom,
        filters.invoiceValueTo,
        filters.consignor,
        filters.consignee,
        filters.contractHolder,
        filters.hsCode,
        filters.declarationType,
        filters.searchTerm,
        sanitizedSelectedCompanyIds,
    ]);

    // Client-side pagination - paginate filtered and sorted data
    const { paginatedDocs, totalItems, totalPages, startIndex, endIndex } = useArchivePagination({
        sortedDocs,
        currentPage,
        itemsPerPage
    });

    // No URL syncing - all state is managed client-side

    // Selection management using hook (must be after pagination)
    const { selectedIds, handleSelectAll, handleSelectOne, clearSelection } = useArchiveSelection({
        paginatedDocs
    });

    // Delete management using hook
    const { isDeleting, handleDeleteOne, handleDeleteSelected, handleDeleteByPeriod } = useArchiveDelete();

    // ============================================
    // OLD CODE - REMOVED (moved to hooks)
    // ============================================
    // Old useMemo definitions for declarationsWithRawData, filteredDocs60, 
    // filteredDocs61, declarationsWithDetails, sortedDocs, statistics, 
    // paginatedDocs have been moved to hooks:
    // - useArchiveData
    // - useArchiveFilters  
    // - useArchiveSorting
    // - useArchiveStatistics
    // - useArchivePagination
    // ============================================

    // OLD CODE REMOVED: declarationsWithRawData useMemo (moved to useArchiveData hook)
    // OLD CODE REMOVED: filteredDocs60 useMemo (moved to useArchiveFilters hook)
    // OLD CODE REMOVED: declarationsWithDetails useMemo (moved to useArchiveData hook)  
    // OLD CODE REMOVED: filteredDocs61 useMemo (moved to useArchiveFilters hook)
    // OLD CODE REMOVED: statistics useMemo (moved to useArchiveStatistics hook)
    // OLD CODE REMOVED: sortedDocs useMemo (moved to useArchiveSorting hook)
    // OLD CODE REMOVED: paginatedDocs calculation (moved to useArchivePagination hook)

    // Virtualization: use for lists > 100 items (for all views without grouping)
    const useVirtualization = sortedDocs.length > 100 && !groupByDate;

    // Group documents by date if grouping is enabled
    const groupedDocs = useMemo(() => {
        if (!groupByDate) {
            return null;
        }

        const groups: { [key: string]: typeof sortedDocs } = {
            'today': [],
            'yesterday': [],
            'thisWeek': [],
            'thisMonth': [],
            'earlier': []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        sortedDocs.forEach(doc => {
            let docDate: Date | null = null;

            if (activeTab === 'list61' && 'extractedData' in doc) {
                const extractedData = (doc as any).extractedData;
                const registeredDate = extractedData?.ccd_registered || getRawData(doc)?.ccd_registered || '';
                if (registeredDate) {
                    try {
                        docDate = new Date(registeredDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
                    } catch {
                        docDate = doc.date;
                    }
                } else {
                    docDate = doc.date;
                }
            } else {
                const registeredDate = getRawData(doc)?.ccd_registered;
                if (registeredDate) {
                    try {
                        docDate = new Date(registeredDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
                    } catch {
                        docDate = doc.date;
                    }
                } else {
                    docDate = doc.date;
                }
            }

            if (!docDate) return;

            const docDateOnly = new Date(docDate.getFullYear(), docDate.getMonth(), docDate.getDate());

            if (docDateOnly.getTime() === today.getTime()) {
                groups.today.push(doc);
            } else if (docDateOnly.getTime() === yesterday.getTime()) {
                groups.yesterday.push(doc);
            } else if (docDate >= weekAgo) {
                groups.thisWeek.push(doc);
            } else if (docDate >= monthAgo) {
                groups.thisMonth.push(doc);
            } else {
                groups.earlier.push(doc);
            }
        });

        return groups;
    }, [sortedDocs, groupByDate, activeTab]);

    // For grouped view, create array of groups with their docs
    const paginatedGroupedDocs = useMemo(() => {
        if (!groupedDocs || !groupByDate) return null;

        const allGrouped: Array<{ group: string; label: string; docs: typeof sortedDocs }> = [];

        if (groupedDocs.today.length > 0) {
            allGrouped.push({ group: 'today', label: 'Сьогодні', docs: groupedDocs.today });
        }
        if (groupedDocs.yesterday.length > 0) {
            allGrouped.push({ group: 'yesterday', label: 'Вчора', docs: groupedDocs.yesterday });
        }
        if (groupedDocs.thisWeek.length > 0) {
            allGrouped.push({ group: 'thisWeek', label: 'Цей тиждень', docs: groupedDocs.thisWeek });
        }
        if (groupedDocs.thisMonth.length > 0) {
            allGrouped.push({ group: 'thisMonth', label: 'Цей місяць', docs: groupedDocs.thisMonth });
        }
        if (groupedDocs.earlier.length > 0) {
            allGrouped.push({ group: 'earlier', label: 'Раніше', docs: groupedDocs.earlier });
        }

        return allGrouped;
    }, [groupedDocs, groupByDate]);

    // Handle sort column click
    const handleSort = (column: SortColumn) => {
        const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
        setSortColumn(column);
        setSortDirection(newDirection);
        setCurrentPage(1);
    };

    // Export to Excel function
    const handleExportToExcel = () => {
        if (activeTab === 'list61') {
            exportExtendedToExcel(sortedDocs, activeTab, exportColumns, exportColumnOrder);
        } else {
            exportToExcel(sortedDocs, activeTab, exportColumns, exportColumnOrder);
        }
        setShowExportModal(false);
    };

    // Extended export function (one row per goods item)
    const handleExtendedExport = async () => {
        setIsExtendedExporting(true);
        setExtendedExportProgress({ phase: 'fetching_details', current: 0, total: sortedDocs.length || 1 });
        try {
            await exportExtendedGoodsToExcel(
                sortedDocs,
                activeTab,
                exportColumns,
                exportColumnOrder,
                (p) => setExtendedExportProgress(p)
            );
            setShowExportModal(false);
        } finally {
            setIsExtendedExporting(false);
            setExtendedExportProgress(null);
        }
    };

    const extendedExportPhaseLabel = (phase: string) => {
        switch (phase) {
            case 'fetching_details':
                return 'Підвантаження деталей (61.1)';
            case 'generating_rows':
                return 'Формування рядків Excel';
            case 'writing_file':
                return 'Збереження файлу';
            default:
                return 'Експорт...';
        }
    };

    // Save view mode to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('archiveViewMode', viewMode);
        }
    }, [viewMode]);

    // Reset to page 1 when search term changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Reset sorting when tab changes
    useEffect(() => {
        setSortColumn(null);
        setSortDirection('asc');
    }, [activeTab]);

    // Reset filters when tab changes
    useEffect(() => {
        setFilterStatus('all');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterCustomsOffice('');
        setFilterCurrency('all');
        setFilterInvoiceValueFrom('');
        setFilterInvoiceValueTo('');
    }, [activeTab]);

    // OLD CODE REMOVED: Selection and delete handlers moved to hooks:
    // - useArchiveSelection (handleSelectAll, handleSelectOne)
    // - useArchiveDelete (handleDeleteOne, handleDeleteSelected, handleDeleteByPeriod)

    // For virtualization, check all sortedDocs, otherwise check paginatedDocs
    const docsToCheck = useVirtualization ? sortedDocs : paginatedDocs;
    const allSelected = docsToCheck.length > 0 && docsToCheck.every(doc => selectedIds.has(doc.id));
    const someSelected = docsToCheck.some(doc => selectedIds.has(doc.id)) && !allSelected;

    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            selectAllCheckboxRef.current.indeterminate = someSelected;
        }

    }, [someSelected]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {isExtendedExporting && extendedExportProgress && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 md:p-10">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
                    <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Розширений експорт
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            {extendedExportPhaseLabel(extendedExportProgress.phase)}
                        </div>

                        <div className="mt-4">
                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded">
                                <div
                                    className="h-2 bg-brand-blue rounded"
                                    style={{
                                        width: `${Math.min(
                                            100,
                                            Math.round((Math.max(0, extendedExportProgress.current) / Math.max(1, extendedExportProgress.total)) * 100)
                                        )}%`
                                    }}
                                />
                            </div>
                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                {extendedExportProgress.current} / {extendedExportProgress.total}
                            </div>
                        </div>

                        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                            Не закривай вкладку під час експорту.
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Progress Bar - Show immediately when processing */}
            {isProcessing && (
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm animate-in fade-in duration-200">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 font-medium">
                                {activeTab === 'list60'
                                    ? 'Обробка списку (60.1)...'
                                    : 'Обробка списку з деталями (61.1)...'}
                            </span>
                            <span className="text-slate-500">
                                {loadedDeclarations.length} декларацій
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden relative">
                            <div
                                className="h-full bg-brand-blue rounded-full absolute animate-shimmer"
                                style={{
                                    width: '45%'
                                }}
                            ></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            {activeTab === 'list61'
                                ? 'Парсинг XML та обробка деталей...'
                                : 'Обробка даних...'}
                        </p>
                    </div>
                </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Архів декларацій</h1>
                    <p className="text-slate-500">Перегляд та експорт усіх митних декларацій</p>
                </div>
                <div className="flex items-center gap-2">
                    <CompanyFilter
                        onFilterChange={(companyIds) => {
                            setSelectedCompanyIds(companyIds);
                            setCurrentPage(1);
                        }}
                        activeCompanyId={activeCompanyId}
                    />
                    <div className="hidden sm:flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => setShowExportModal(true)}
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Експорт в Excel
                        </Button>
                        <Button
                            variant="outline"
                            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setShowDeletePeriodModal(true)}
                        >
                            <Calendar className="w-4 h-4" />
                            Видалити за період
                        </Button>
                    </div>
                </div>
            </div>

            {/* Statistics - Only show for list61 */}
            {activeTab === 'list61' && (
                <ArchiveStatistics
                    statistics={serverStatistics || clientStatistics || { total: 0, totalCustomsValue: 0, totalInvoiceValue: 0, totalItems: 0, topConsignors: [], topConsignees: [], topContractHolders: [], topHSCodes: [], topDeclarationTypes: [], topCustomsOffices: [] }}
                    statsSettings={statsSettings}
                    isMounted={isMounted}
                    onSettingsClick={() => setShowStatsSettings(true)}
                    onFilterByType={(type) => {
                        setFilterDeclarationType(type);
                        setCurrentPage(1);
                        setShowFilters(true);
                    }}
                    onFilterByOffice={(office) => {
                        setFilterCustomsOffice(office);
                        setCurrentPage(1);
                        setShowFilters(true);
                    }}
                    onFilterByConsignor={(name) => {
                        setFilterConsignor(name);
                        setCurrentPage(1);
                        setShowFilters(true);
                    }}
                    onFilterByConsignee={(name) => {
                        setFilterConsignee(name);
                        setCurrentPage(1);
                        setShowFilters(true);
                    }}
                    onFilterByContractHolder={(name) => {
                        setFilterContractHolder(name);
                        setCurrentPage(1);
                        setShowFilters(true);
                    }}
                    onFilterByHSCode={(code) => {
                        setFilterHSCode(code);
                        setCurrentPage(1);
                        setShowFilters(true);
                    }}
                />
            )}

            {/* Tabs and View Mode */}
            <div className="flex items-center justify-between gap-4">
                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg inline-flex gap-1">
                    <TabControl
                        active={activeTab === 'list60'}
                        onClick={() => {
                            if (activeTab !== 'list60') {
                                // Set processing state immediately before tab change
                                setIsProcessing(true);
                                // Change tab on next tick to allow UI to update first
                                setTimeout(() => {
                                    setActiveTab('list60');
                                    setCurrentPage(1);
                                }, 10);
                            }
                        }}
                        label="Список (60.1)"
                    />
                    <TabControl
                        active={activeTab === 'list61'}
                        onClick={() => {
                            if (activeTab !== 'list61') {
                                // Set processing state immediately before tab change
                                setIsProcessing(true);
                                // Change tab on next tick to allow UI to update first
                                setTimeout(() => {
                                    setActiveTab('list61');
                                    setCurrentPage(1);
                                }, 10);
                            }
                        }}
                        label="З деталями (61.1)"
                    />
                </div>

                {/* View Mode Switcher */}
                <div className="hidden sm:flex items-center gap-2">
                    <span className="text-sm text-slate-600">Відображення:</span>
                    <div className="bg-slate-100 p-1 rounded-lg inline-flex gap-1">
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                                viewMode === 'table'
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                            title="Таблиця"
                        >
                            <Table className="w-4 h-4" />
                            <span className="hidden sm:inline">Таблиця</span>
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                                viewMode === 'cards'
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                            title="Картки"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span className="hidden sm:inline">Картки</span>
                        </button>
                        <button
                            onClick={() => setViewMode('compact')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                                viewMode === 'compact'
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                            title="Компактний"
                        >
                            <List className="w-4 h-4" />
                            <span className="hidden sm:inline">Компактний</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Search and Filters - Only show filters for list61 */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            placeholder={activeTab === 'list60'
                                ? "Пошук за номером МД, GUID, типом, транспортом..."
                                : "Пошук за номером МД, відправником, отримувачем, фактурною вартістю..."
                            }
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                // URL will be updated by useEffect with debounce
                            }}
                            className="pl-10"
                        />
                    </div>
                    {activeTab === 'list61' && (
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            Фільтри
                            {(filterStatus !== 'all' || filterDateFrom || filterDateTo || filterCustomsOffice || filterCurrency !== 'all' || filterInvoiceValueFrom || filterInvoiceValueTo || filterConsignor || filterConsignee || filterContractHolder || filterHSCode || filterDeclarationType) && (
                                <span className="bg-brand-blue text-white text-xs rounded-full px-2 py-0.5">
                                    {(filterStatus !== 'all' ? 1 : 0) +
                                        (filterDateFrom ? 1 : 0) +
                                        (filterDateTo ? 1 : 0) +
                                        (filterCustomsOffice ? 1 : 0) +
                                        (filterCurrency !== 'all' ? 1 : 0) +
                                        (filterInvoiceValueFrom ? 1 : 0) +
                                        (filterInvoiceValueTo ? 1 : 0) +
                                        (filterConsignor ? 1 : 0) +
                                        (filterConsignee ? 1 : 0) +
                                        (filterContractHolder ? 1 : 0) +
                                        (filterHSCode ? 1 : 0) +
                                        (filterDeclarationType ? 1 : 0)}
                                </span>
                            )}
                        </Button>
                    )}
                    {(filterStatus !== 'all' || filterDateFrom || filterDateTo || filterCustomsOffice || filterCurrency !== 'all' || filterInvoiceValueFrom || filterInvoiceValueTo || filterConsignor || filterConsignee || filterContractHolder || filterHSCode || filterDeclarationType) && (
                        <Button
                            variant="outline"
                            className="gap-2 text-slate-600 hover:text-slate-900"
                            onClick={() => {
                                setFilterStatus('all');
                                setFilterDateFrom('');
                                setFilterDateTo('');
                                setFilterCustomsOffice('');
                                setFilterCurrency('all');
                                setFilterInvoiceValueFrom('');
                                setFilterInvoiceValueTo('');
                                setFilterConsignor('');
                                setFilterConsignee('');
                                setFilterContractHolder('');
                                setFilterHSCode('');
                                setFilterDeclarationType('');
                                setCurrentPage(1);
                            }}
                        >
                            <RotateCcw className="w-4 h-4" />
                            Скинути
                        </Button>
                    )}
                    <Button
                        variant={groupByDate ? "primary" : "outline"}
                        className="gap-2"
                        onClick={() => setGroupByDate(!groupByDate)}
                    >
                        <Calendar className="w-4 h-4" />
                        Групувати по датах
                    </Button>
                    {selectedIds.size > 0 && (
                        <Button
                            variant="outline"
                            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteSelected(selectedIds, clearSelection)}
                            disabled={isDeleting}
                        >
                            <Trash2 className="w-4 h-4" />
                            Видалити вибрані ({selectedIds.size})
                        </Button>
                    )}
                </div>

                {/* Filters Panel - Only show for list61 */}
                {activeTab === 'list61' && showFilters && (
                    <FiltersPanel
                        filterStatus={filterStatus}
                        filterDateFrom={filterDateFrom}
                        filterDateTo={filterDateTo}
                        filterCustomsOffice={filterCustomsOffice}
                        filterCurrency={filterCurrency}
                        filterInvoiceValueFrom={filterInvoiceValueFrom}
                        filterInvoiceValueTo={filterInvoiceValueTo}
                        filterConsignor={filterConsignor}
                        filterConsignee={filterConsignee}
                        filterContractHolder={filterContractHolder}
                        filterHSCode={filterHSCode}
                        filterDeclarationType={filterDeclarationType}
                        setFilterStatus={(value) => {
                            setFilterStatus(value);
                            setCurrentPage(1);
                        }}
                        setFilterDateFrom={(value) => {
                            setFilterDateFrom(value);
                            setCurrentPage(1);
                        }}
                        setFilterDateTo={(value) => {
                            setFilterDateTo(value);
                            setCurrentPage(1);
                        }}
                        setFilterCustomsOffice={(value) => {
                            setFilterCustomsOffice(value);
                            setCurrentPage(1);
                        }}
                        setFilterCurrency={(value) => {
                            setFilterCurrency(value);
                            setCurrentPage(1);
                        }}
                        setFilterInvoiceValueFrom={(value) => {
                            setFilterInvoiceValueFrom(value);
                            setCurrentPage(1);
                        }}
                        setFilterInvoiceValueTo={(value) => {
                            setFilterInvoiceValueTo(value);
                            setCurrentPage(1);
                        }}
                        setFilterConsignor={(value) => {
                            setFilterConsignor(value);
                            setCurrentPage(1);
                        }}
                        setFilterConsignee={(value) => {
                            setFilterConsignee(value);
                            setCurrentPage(1);
                        }}
                        setFilterContractHolder={(value) => {
                            setFilterContractHolder(value);
                            setCurrentPage(1);
                        }}
                        setFilterHSCode={(value) => {
                            setFilterHSCode(value);
                            setCurrentPage(1);
                        }}
                        setFilterDeclarationType={(value) => {
                            setFilterDeclarationType(value);
                            setCurrentPage(1);
                        }}
                    />
                )}
            </div>

            {/* Main List View */}
            <div className="bg-white rounded-lg border border-slate-200">
                {viewMode === 'table' && (
                    <TableView
                        activeTab={activeTab}
                        sortedDocs={sortedDocs}
                        paginatedDocs={paginatedDocs}
                        paginatedGroupedDocs={paginatedGroupedDocs}
                        groupByDate={groupByDate}
                        useVirtualization={useVirtualization}
                        selectedIds={selectedIds}
                        selectAllCheckboxRef={selectAllCheckboxRef}
                        allSelected={allSelected}
                        handleSelectAll={handleSelectAll}
                        handleSelectOne={handleSelectOne}
                        handleSort={handleSort}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onPreview={setPreviewDoc}
                        onDelete={handleDeleteOne}
                        isDeleting={isDeleting}
                        declarations={declarations}
                        searchTerm={searchTerm}
                    />
                )}

                {/* Cards View */}
                {viewMode === 'cards' && (
                    <CardsView
                        activeTab={activeTab}
                        sortedDocs={sortedDocs}
                        paginatedDocs={paginatedDocs}
                        paginatedGroupedDocs={paginatedGroupedDocs}
                        groupByDate={groupByDate}
                        useVirtualization={useVirtualization}
                        selectedIds={selectedIds}
                        handleSelectOne={handleSelectOne}
                        onPreview={setPreviewDoc}
                        declarations={declarations}
                    />
                )}

                {/* Compact List View */}
                {viewMode === 'compact' && (
                    <CompactView
                        activeTab={activeTab}
                        sortedDocs={sortedDocs}
                        paginatedDocs={paginatedDocs}
                        paginatedGroupedDocs={paginatedGroupedDocs}
                        groupByDate={groupByDate}
                        useVirtualization={useVirtualization}
                        selectedIds={selectedIds}
                        handleSelectOne={handleSelectOne}
                        onPreview={setPreviewDoc}
                        declarations={declarations}
                    />
                )}
            </div>

            {/* Pagination */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Показати:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span className="text-sm text-slate-600">на сторінку</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">
                            Показано {startIndex + 1}-{Math.min(endIndex, totalItems)} з {totalItems}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="gap-1"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Попередня
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={cn(
                                            "px-3 py-1.5 text-sm rounded-md transition-colors",
                                            currentPage === pageNum
                                                ? "bg-brand-blue text-white"
                                                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-300"
                                        )}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="gap-1"
                        >
                            Наступна
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Quick Preview Modal */}
            <QuickPreviewModal
                previewDoc={previewDoc}
                activeTab={activeTab}
                onClose={() => setPreviewDoc(null)}
            />

            {/* Export to Excel Modal */}
            <ExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                activeTab={activeTab}
                totalCount={sortedDocs.length}
                exportColumns={exportColumns}
                exportColumnOrder={exportColumnOrder}
                onExportColumnsChange={setExportColumns}
                onExport={handleExportToExcel}
                onExtendedExport={isExtendedExporting ? undefined : handleExtendedExport}
            />

            {/* Delete by Period Modal */}
            {/* Statistics Settings Modal */}
            <StatisticsSettingsModal
                isOpen={showStatsSettings}
                onClose={() => setShowStatsSettings(false)}
                statsSettings={statsSettings}
                onSettingsChange={setStatsSettings}
            />


            <DeletePeriodModal
                isOpen={showDeletePeriodModal}
                onClose={() => {
                    setShowDeletePeriodModal(false);
                    setDeletePeriodFrom("");
                    setDeletePeriodTo("");
                }}
                deletePeriodFrom={deletePeriodFrom}
                deletePeriodTo={deletePeriodTo}
                onPeriodFromChange={setDeletePeriodFrom}
                onPeriodToChange={setDeletePeriodTo}
                onDelete={() => handleDeleteByPeriod(deletePeriodFrom, deletePeriodTo, () => {
                    setShowDeletePeriodModal(false);
                    setDeletePeriodFrom("");
                    setDeletePeriodTo("");
                })}
                isDeleting={isDeleting}
            />
        </div>
    );
}

