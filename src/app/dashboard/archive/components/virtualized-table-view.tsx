'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DeclarationWithRawData, ActiveTab } from '../types';
import { getRawData, formatRegisteredDate, getMDNumber } from '../utils';
import { statusStyles, statusLabels } from '../constants';
import { Button } from '@/components/ui';
import { Eye, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VirtualizedTableViewProps {
    declarations: DeclarationWithRawData[];
    activeTab: ActiveTab;
    selectedIds: Set<string>;
    onSelectOne: (id: string, checked: boolean) => void;
    onPreview: (doc: DeclarationWithRawData) => void;
    onDelete: (id: string, mdNumber: string) => void;
    isDeleting: boolean;
    containerHeight?: number;
    rowHeight?: number;
}

/**
 * Віртуалізований табличний вигляд декларацій.
 * Рендерить тільки видимі рядки для оптимізації продуктивності.
 * Використовує @tanstack/react-virtual для сумісності з React 19.
 */
export default function VirtualizedTableView({
    declarations,
    activeTab,
    selectedIds,
    onSelectOne,
    onPreview,
    onDelete,
    isDeleting,
    containerHeight = 600,
    rowHeight = 60,
}: VirtualizedTableViewProps) {
    const router = useRouter();
    const parentRef = useRef<HTMLDivElement>(null);
    const [calculatedHeight, setCalculatedHeight] = useState<number>(containerHeight || 600);

    // Calculate dynamic height based on viewport
    useEffect(() => {
        const updateHeight = () => {
            if (typeof window !== 'undefined') {
                // Subtract header, filters, pagination, etc. (~300px)
                const newHeight = window.innerHeight - 300;
                setCalculatedHeight(Math.max(newHeight, 400)); // Minimum 400px
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    // Ensure all props are valid numbers
    const safeHeight = typeof calculatedHeight === 'number' && calculatedHeight > 0 && !isNaN(calculatedHeight) ? calculatedHeight : 600;
    const safeRowHeight = typeof rowHeight === 'number' && rowHeight > 0 && !isNaN(rowHeight) ? rowHeight : 60;
    
    // Guard against undefined/null declarations - but check AFTER all hooks
    const safeDeclarations = Array.isArray(declarations) ? declarations : [];
    const safeItemCount = safeDeclarations.length;

    // Memoize declarations array to prevent unnecessary re-renders
    const memoizedDeclarations = useMemo(() => safeDeclarations, [safeDeclarations]);

    // Use virtualizer hook
    // Note: We need a DOM element for ResizeObserver, but we'll handle scrolling at page level
    const virtualizer = useVirtualizer({
        count: safeItemCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => safeRowHeight,
        overscan: 5,
    });

    // Early return AFTER all hooks
    if (safeItemCount === 0 || !safeDeclarations || safeDeclarations.length === 0) {
        return null;
    }

    // Get virtual items (only visible rows)
    const virtualItems = virtualizer.getVirtualItems();


    // Column widths for grid layout - using fixed widths for list61 to prevent overflow
    const columnWidths = activeTab === 'list61' 
        ? '48px 160px 160px 120px 120px 200px 200px 180px 100px 280px'
        : '48px minmax(160px, 1fr) minmax(160px, 1fr) 120px 120px minmax(250px, 2fr) 280px';

    return (
        <div
            ref={parentRef}
            className={`w-full ${activeTab === 'list61' ? 'overflow-x-auto' : ''}`}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: activeTab === 'list61' ? '1400px' : '100%',
                    position: 'relative',
                }}
            >
                {virtualItems.map((virtualRow) => {
                    const index = virtualRow.index;
                    const doc = memoizedDeclarations[index];

                    // Guard against null/undefined doc
                    if (!doc || typeof doc !== 'object') {
                        return null;
                    }

                    const mdNumber = getMDNumber(getRawData(doc), doc.mrn);
                    const mappedData = activeTab === 'list61' && 'mappedData' in doc ? (doc as any).mappedData : null;
                    const extractedData = activeTab === 'list61' && 'extractedData' in doc ? (doc as any).extractedData : null;

                    const registeredDate = activeTab === 'list61' && extractedData?.ccd_registered
                        ? formatRegisteredDate(extractedData.ccd_registered)
                        : formatRegisteredDate(getRawData(doc)?.ccd_registered);

                    const status = getRawData(doc)?.ccd_status || doc.status;
                    const isCleared = status === 'R';

                    const declarationType = activeTab === 'list61' && extractedData
                        ? [extractedData.ccd_01_01, extractedData.ccd_01_02, extractedData.ccd_01_03]
                            .filter(Boolean)
                            .join(' ') || '---'
                        : (() => {
                            const type = getRawData(doc)?.ccd_type;
                            if (type) return type;
                            const parts = [
                                getRawData(doc)?.ccd_01_01,
                                getRawData(doc)?.ccd_01_02,
                                getRawData(doc)?.ccd_01_03
                            ].filter(Boolean);
                            return parts.length > 0 ? parts.join(' ') : '---';
                        })();

                    return (
                        <div
                            key={virtualRow.key}
                            data-index={index}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-slate-200 dark:border-slate-700"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                                display: 'grid',
                                gridTemplateColumns: columnWidths,
                                alignItems: 'center',
                            }}
                            onClick={() => onPreview(doc)}
                        >
                            <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(doc.id)}
                                    onChange={(e) => onSelectOne(doc.id, e.target.checked)}
                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                />
                            </div>
                            <div className="px-4 py-3 flex items-center">
                                <span className="text-brand-blue font-medium text-sm font-mono whitespace-nowrap">
                                    {mdNumber}
                                </span>
                            </div>
                            <div className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm flex items-center whitespace-nowrap">
                                {registeredDate}
                            </div>
                            <div className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                    isCleared
                                        ? statusStyles.CLEARED
                                        : statusStyles[doc.status as keyof typeof statusStyles] || statusStyles.PROCESSING
                                }`}>
                                    {isCleared ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || status)}
                                </span>
                            </div>
                            <div className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                                {declarationType}
                            </div>
                            {activeTab === 'list61' && (
                                <>
                                    <div className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                                        <div className="truncate">{mappedData?.header?.consignor || '---'}</div>
                                    </div>
                                    <div className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                                        <div className="truncate">{mappedData?.header?.consignee || '---'}</div>
                                    </div>
                                    <div className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                                        {mappedData?.header?.invoiceValue
                                            ? `${mappedData.header.invoiceValue.toLocaleString('uk-UA')} ${mappedData.header.invoiceCurrency || '---'}`
                                            : '---'
                                        }
                                    </div>
                                    <div className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                                        {mappedData?.goods?.length || 0}
                                    </div>
                                </>
                            )}
                            {activeTab === 'list60' && (
                                <div className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                                    <div className="truncate">
                                        {(() => {
                                            const trn_all = getRawData(doc)?.trn_all;
                                            if (!trn_all) return '---';
                                            if (typeof trn_all === 'string') {
                                                return trn_all.trim() || '---';
                                            }
                                            if (Array.isArray(trn_all)) {
                                                return trn_all.filter(Boolean).join(', ') || '---';
                                            }
                                            const str = String(trn_all);
                                            return (str && str !== 'undefined' && str !== 'null') ? str : '---';
                                        })()}
                                    </div>
                                </div>
                            )}
                            <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPreview(doc);
                                        }}
                                        className="gap-1"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Перегляд
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/dashboard/archive/${doc.id}`);
                                        }}
                                        className="gap-1"
                                    >
                                        Деталі
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(doc.id, mdNumber);
                                        }}
                                        disabled={isDeleting}
                                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
