'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Eye } from 'lucide-react';
import { DeclarationWithRawData, ActiveTab } from '../types';
import { statusStyles, statusLabels } from '../constants';
import { getRawData, formatRegisteredDate, getMDNumber } from '../utils';

interface VirtualizedCardsViewProps {
    declarations: DeclarationWithRawData[];
    activeTab: ActiveTab;
    selectedIds: Set<string>;
    onSelectOne: (id: string, checked: boolean) => void;
    onPreview: (doc: DeclarationWithRawData) => void;
    containerHeight?: number;
    cardWidth?: number;
    cardHeight?: number;
}

/**
 * Віртуалізований вигляд карток декларацій.
 * Рендерить тільки видимі картки для оптимізації продуктивності.
 * Використовує @tanstack/react-virtual для сумісності з React 19.
 */
export default function VirtualizedCardsView({
    declarations,
    activeTab,
    selectedIds,
    onSelectOne,
    onPreview,
    containerHeight = 600,
    cardWidth = 350,
    cardHeight = 180,
}: VirtualizedCardsViewProps) {
    const router = useRouter();
    const parentRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(1200);

    // Guard against undefined/null declarations
    if (!declarations || !Array.isArray(declarations) || declarations.length === 0) {
        return null;
    }

    // Обчислюємо кількість колонок на основі ширини контейнера
    const columnCount = useMemo(() => {
        if (containerWidth < 768) return 1; // mobile
        if (containerWidth < 1024) return 2; // tablet
        return 3; // desktop
    }, [containerWidth]);

    const rowCount = Math.ceil(declarations.length / columnCount);

    // Update container width on resize
    useEffect(() => {
        if (parentRef.current) {
            const updateWidth = () => {
                if (parentRef.current) {
                    setContainerWidth(parentRef.current.offsetWidth || 1200);
                }
            };
            updateWidth();
            window.addEventListener('resize', updateWidth);
            return () => window.removeEventListener('resize', updateWidth);
        }
    }, []);

    // Use virtualizer for rows
    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => cardHeight,
        overscan: 2,
    });

    // Функція для отримання типу декларації
    const getDeclarationType = (doc: DeclarationWithRawData, extractedData: any) => {
        if (activeTab === 'list61' && extractedData) {
            const parts = [extractedData.ccd_01_01, extractedData.ccd_01_02, extractedData.ccd_01_03]
                .filter(Boolean);
            return parts.length > 0 ? parts.join(' ') : '---';
        }
        
        const rawData = getRawData(doc);
        const type = rawData?.ccd_type;
        if (type) {
            return type;
        }
        
        const parts = [rawData?.ccd_01_01, rawData?.ccd_01_02, rawData?.ccd_01_03]
            .filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : '---';
    };

    const virtualRows = rowVirtualizer.getVirtualItems();

    return (
        <div
            ref={parentRef}
            className="w-full p-4 overflow-auto"
            style={{ 
                height: containerHeight,
                maxHeight: 'calc(100vh - 300px)' // Dynamic height based on viewport
            }}
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualRows.map((virtualRow) => {
                    const rowIndex = virtualRow.index;
                    const startIndex = rowIndex * columnCount;
                    const endIndex = Math.min(startIndex + columnCount, declarations.length);

                    return (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                                display: 'flex',
                                gap: '8px',
                                padding: '8px 0',
                            }}
                        >
                            {Array.from({ length: endIndex - startIndex }).map((_, colIndex) => {
                                const index = startIndex + colIndex;
                                const doc = declarations[index];

                                if (!doc || typeof doc !== 'object') {
                                    return <div key={colIndex} style={{ width: `${cardWidth}px`, flexShrink: 0 }} />;
                                }

                                const mdNumber = getMDNumber(getRawData(doc), doc.mrn);
                                const mappedData = activeTab === 'list61' && 'mappedData' in doc ? (doc as any).mappedData : null;
                                const extractedData = activeTab === 'list61' && 'extractedData' in doc ? (doc as any).extractedData : null;
                                
                                const registeredDate = activeTab === 'list61' && extractedData?.ccd_registered
                                    ? formatRegisteredDate(extractedData.ccd_registered)
                                    : formatRegisteredDate(getRawData(doc)?.ccd_registered);
                                
                                const status = getRawData(doc)?.ccd_status || doc.status;
                                const isCleared = status === 'R';
                                const declarationType = getDeclarationType(doc, extractedData);

                                return (
                                    <div
                                        key={doc.id}
                                        style={{ width: `${cardWidth}px`, flexShrink: 0 }}
                                        className="p-2"
                                    >
                                        <div
                                            className="bg-slate-50 rounded-lg border border-slate-200 p-4 h-full hover:shadow-md transition-shadow cursor-pointer flex flex-col overflow-hidden"
                                            style={{ height: `${cardHeight}px` }}
                                            onClick={() => onPreview(doc)}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(doc.id)}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                onSelectOne(doc.id, e.target.checked);
                                                            }}
                                                            className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <span className="text-brand-blue font-medium text-sm font-mono">
                                                            {mdNumber}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mb-1">{registeredDate}</p>
                                                </div>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                    isCleared 
                                                        ? statusStyles.CLEARED 
                                                        : statusStyles[doc.status as keyof typeof statusStyles] || statusStyles.PROCESSING
                                                }`}>
                                                    {isCleared ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || status)}
                                                </span>
                                            </div>
                                            
                                            <div className="space-y-2 text-sm flex-1">
                                                <div>
                                                    <span className="text-slate-500">Тип:</span> <span className="text-slate-700 font-medium">{declarationType}</span>
                                                </div>
                                                {activeTab === 'list61' && (
                                                    <>
                                                        {mappedData?.header?.consignor && (
                                                            <div>
                                                                <span className="text-slate-500">Відправник:</span> <span className="text-slate-700">{mappedData.header.consignor}</span>
                                                            </div>
                                                        )}
                                                        {mappedData?.header?.consignee && (
                                                            <div>
                                                                <span className="text-slate-500">Отримувач:</span> <span className="text-slate-700">{mappedData.header.consignee}</span>
                                                            </div>
                                                        )}
                                                        {mappedData?.header?.invoiceValue && (
                                                            <div>
                                                                <span className="text-slate-500">Фактурна вартість:</span> <span className="text-slate-700 font-medium">
                                                                    {mappedData.header.invoiceValue.toLocaleString('uk-UA')} {mappedData.header.invoiceCurrency || '---'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {mappedData?.goods?.length > 0 && (
                                                            <div>
                                                                <span className="text-slate-500">Товарів:</span> <span className="text-slate-700 font-medium">{mappedData.goods.length}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {activeTab === 'list60' && (() => {
                                                    const trn_all = getRawData(doc)?.trn_all;
                                                    if (!trn_all) return null;
                                                    const displayValue = typeof trn_all === 'string' 
                                                        ? trn_all.trim() 
                                                        : Array.isArray(trn_all) 
                                                            ? trn_all.filter(Boolean).join(', ')
                                                            : String(trn_all);
                                                    return displayValue ? (
                                                        <div>
                                                            <span className="text-slate-500">Транспорт:</span> <span className="text-slate-700 font-medium">{displayValue}</span>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onPreview(doc);
                                                    }}
                                                    className="gap-1 flex-1"
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
                                                    className="gap-1 flex-1"
                                                >
                                                    Деталі
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
