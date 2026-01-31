'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Eye, Download } from 'lucide-react';
import { Declaration, DeclarationWithRawData, ActiveTab } from '../../types';
import { statusStyles, statusLabels } from '../../constants';
import { getRawData, formatRegisteredDate, getMDNumber } from '../../utils';
import VirtualizedCompactView from '../virtualized-compact-view';

interface CompactViewProps {
    activeTab: ActiveTab;
    sortedDocs: DeclarationWithRawData[];
    paginatedDocs: DeclarationWithRawData[];
    paginatedGroupedDocs: Array<{ group: string; label: string; docs: DeclarationWithRawData[] }> | null;
    groupByDate: boolean;
    useVirtualization: boolean;
    selectedIds: Set<string>;
    handleSelectOne: (id: string, checked: boolean) => void;
    onPreview: (doc: DeclarationWithRawData) => void;
    declarations: (DeclarationWithRawData | Declaration)[];
}

/**
 * Компактний вигляд декларацій.
 * Відображає декларації у вигляді компактного списку з мінімальними даними.
 */
export default function CompactView({
    activeTab,
    sortedDocs,
    paginatedDocs,
    paginatedGroupedDocs,
    groupByDate,
    useVirtualization,
    selectedIds,
    handleSelectOne,
    onPreview,
    declarations,
}: CompactViewProps) {
    const router = useRouter();

    // Рендер одного рядка
    const renderRow = (doc: DeclarationWithRawData) => {
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
                key={doc.id}
                className="px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                onClick={() => onPreview(doc)}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="hidden md:block">
                        <input
                            type="checkbox"
                            checked={selectedIds.has(doc.id)}
                            onChange={(e) => {
                                e.stopPropagation();
                                handleSelectOne(doc.id, e.target.checked);
                            }}
                            className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
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
                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate hidden md:inline">
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
        );
    };

    // Рендер порожнього стану
    const renderEmptyState = () => {
        return (
            <div className="text-center py-12 text-slate-500">
                {activeTab === 'list61' ? (
                    <div className="flex flex-col items-center gap-3">
                        <Download className="w-12 h-12 text-slate-400" />
                        <div>
                            <p className="text-lg font-medium text-slate-700">Деталі декларацій не завантажені</p>
                            <p className="text-sm mt-1 text-slate-500">Перейдіть на вкладку "Синхронізація" та завантажте деталі (61.1) для декларацій</p>
                        </div>
                    </div>
                ) : (
                    <p>Нічого не знайдено</p>
                )}
            </div>
        );
    };

    return (
        <div className="divide-y divide-slate-200">
            {groupByDate ? (
                paginatedGroupedDocs && paginatedGroupedDocs.length > 0 ? (
                    <div className="space-y-4">
                        {paginatedGroupedDocs.map((group) => (
                            <div key={group.group}>
                                <div className="px-4 py-2 bg-slate-100 border-b-2 border-slate-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-slate-900 uppercase">{group.label}</h3>
                                        <span className="text-xs text-slate-500 font-medium">
                                            {group.docs.length} {group.docs.length === 1 ? 'декларація' : group.docs.length < 5 ? 'декларації' : 'декларацій'}
                                        </span>
                                    </div>
                                </div>
                                {group.docs.map((doc) => renderRow(doc))}
                            </div>
                        ))}
                    </div>
                ) : (
                    renderEmptyState()
                )
            ) : useVirtualization && paginatedDocs.length > 0 ? (
                <VirtualizedCompactView
                    declarations={paginatedDocs}
                    activeTab={activeTab}
                    selectedIds={selectedIds}
                    onSelectOne={handleSelectOne}
                    onPreview={onPreview}
                    containerHeight={typeof window !== 'undefined' ? window.innerHeight - 300 : 600}
                    rowHeight={40}
                />
            ) : paginatedDocs.length === 0 ? (
                renderEmptyState()
            ) : (
                <div>
                    {paginatedDocs.map((doc) => renderRow(doc))}
                </div>
            )}
        </div>
    );
}
