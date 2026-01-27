'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Eye } from 'lucide-react';
import { DeclarationWithRawData, ActiveTab } from '../types';
import { statusStyles, statusLabels } from '../constants';
import { getRawData, formatRegisteredDate, getMDNumber } from '../utils';

interface VirtualizedCompactViewProps {
    declarations: DeclarationWithRawData[];
    activeTab: ActiveTab;
    selectedIds: Set<string>;
    onSelectOne: (id: string, checked: boolean) => void;
    onPreview: (doc: DeclarationWithRawData) => void;
    containerHeight?: number;
    rowHeight?: number;
}

/**
 * Віртуалізований компактний вигляд декларацій.
 * Рендерить тільки видимі рядки для оптимізації продуктивності.
 * Використовує @tanstack/react-virtual для сумісності з React 19.
 */
export default function VirtualizedCompactView({
    declarations,
    activeTab,
    selectedIds,
    onSelectOne,
    onPreview,
    containerHeight = 600,
    rowHeight = 40,
}: VirtualizedCompactViewProps) {
    const router = useRouter();
    const parentRef = useRef<HTMLDivElement>(null);

    // Guard against undefined/null declarations
    if (!declarations || !Array.isArray(declarations) || declarations.length === 0) {
        return null;
    }

    // Ensure all props are valid numbers
    const safeHeight = typeof containerHeight === 'number' && containerHeight > 0 && !isNaN(containerHeight) ? containerHeight : 600;
    const safeRowHeight = typeof rowHeight === 'number' && rowHeight > 0 && !isNaN(rowHeight) ? rowHeight : 40;
    const safeItemCount = Array.isArray(declarations) && declarations.length > 0 ? declarations.length : 0;

    // Use virtualizer hook
    const virtualizer = useVirtualizer({
        count: safeItemCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => safeRowHeight,
        overscan: 5,
    });

    // Final safety check
    if (safeItemCount === 0 || safeHeight <= 0 || safeRowHeight <= 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500">
                Немає даних для відображення
            </div>
        );
    }

    // Get virtual items (only visible rows)
    const virtualItems = virtualizer.getVirtualItems();

    return (
        <div
            ref={parentRef}
            className="w-full overflow-auto"
            style={{ 
                height: safeHeight,
                maxHeight: 'calc(100vh - 300px)' // Dynamic height based on viewport
            }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualItems.map((virtualRow) => {
                    const index = virtualRow.index;
                    const doc = declarations[index];

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

                    return (
                        <div
                            key={virtualRow.key}
                            data-index={index}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                minHeight: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <div
                                className="px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4 border-b border-slate-200"
                                onClick={() => onPreview(doc)}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(doc.id)}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            onSelectOne(doc.id, e.target.checked);
                                        }}
                                        className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue flex-shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-brand-blue font-medium text-sm font-mono flex-shrink-0">
                                        {mdNumber}
                                    </span>
                                    <span className="text-xs text-slate-500 flex-shrink-0">{registeredDate}</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${
                                        isCleared 
                                            ? statusStyles.CLEARED 
                                            : statusStyles[doc.status as keyof typeof statusStyles] || statusStyles.PROCESSING
                                    }`}>
                                        {isCleared ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || status)}
                                    </span>
                                    {activeTab === 'list61' && mappedData?.header?.consignor && (
                                        <span className="text-xs text-slate-600 truncate hidden md:inline">
                                            {mappedData.header.consignor}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPreview(doc);
                                        }}
                                        className="gap-1 h-8 px-2"
                                    >
                                        <Eye className="w-3 h-3" />
                                        <span className="hidden sm:inline">Перегляд</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/dashboard/archive/${doc.id}`);
                                        }}
                                        className="gap-1 h-8 px-2"
                                    >
                                        <span className="hidden sm:inline">Деталі</span>
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
