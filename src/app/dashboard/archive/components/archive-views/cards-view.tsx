'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Eye, Download } from 'lucide-react';
import { Declaration, DeclarationWithRawData, ActiveTab } from '../../types';
import { statusStyles, statusLabels } from '../../constants';
import { getRawData, formatRegisteredDate, getMDNumber } from '../../utils';
import VirtualizedCardsView from '../virtualized-cards-view';

interface CardsViewProps {
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
 * Вигляд карток декларацій.
 * Відображає декларації у вигляді карток з основними даними.
 */
export default function CardsView({
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
}: CardsViewProps) {
    const router = useRouter();

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

    // Рендер однієї картки
    const renderCard = (doc: DeclarationWithRawData) => {
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
                className="bg-slate-50 rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
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
                                    handleSelectOne(doc.id, e.target.checked);
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
                
                <div className="space-y-2 text-sm">
                    <div>
                        <span className="text-slate-500 dark:text-slate-400">Тип:</span> <span className="text-slate-700 dark:text-slate-300 font-medium">{declarationType}</span>
                    </div>
                    {activeTab === 'list61' && (
                        <>
                            {mappedData?.header?.consignor && (
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Відправник:</span> <span className="text-slate-700 dark:text-slate-300">{mappedData.header.consignor}</span>
                                </div>
                            )}
                            {mappedData?.header?.consignee && (
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Отримувач:</span> <span className="text-slate-700 dark:text-slate-300">{mappedData.header.consignee}</span>
                                </div>
                            )}
                            {mappedData?.header?.invoiceValue && (
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Фактурна вартість:</span> <span className="text-slate-700 dark:text-slate-300 font-medium">
                                        {mappedData.header.invoiceValue.toLocaleString('uk-UA')} {mappedData.header.invoiceCurrency || '---'}
                                    </span>
                                </div>
                            )}
                            {mappedData?.goods?.length > 0 && (
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400">Товарів:</span> <span className="text-slate-700 dark:text-slate-300 font-medium">{mappedData.goods.length}</span>
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
                                <span className="text-slate-500 dark:text-slate-400">Транспорт:</span> <span className="text-slate-700 dark:text-slate-300 font-medium">{displayValue}</span>
                            </div>
                        ) : null;
                    })()}
                </div>
                
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
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
        <div className="p-4">
            {groupByDate ? (
                paginatedGroupedDocs && paginatedGroupedDocs.length > 0 ? (
                    <div className="space-y-6">
                        {paginatedGroupedDocs.map((group) => (
                            <div key={group.group}>
                                <div className="mb-4 pb-2 border-b border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-900">{group.label}</h3>
                                        <span className="text-xs text-slate-500 font-medium">
                                            {group.docs.length} {group.docs.length === 1 ? 'декларація' : group.docs.length < 5 ? 'декларації' : 'декларацій'}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {group.docs.map((doc) => renderCard(doc))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    renderEmptyState()
                )
            ) : useVirtualization && paginatedDocs.length > 0 ? (
                <VirtualizedCardsView
                    declarations={paginatedDocs}
                    activeTab={activeTab}
                    selectedIds={selectedIds}
                    onSelectOne={handleSelectOne}
                    onPreview={onPreview}
                    containerHeight={typeof window !== 'undefined' ? window.innerHeight - 300 : 600}
                    cardWidth={350}
                    cardHeight={180}
                />
            ) : paginatedDocs.length === 0 ? (
                renderEmptyState()
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedDocs.map((doc) => renderCard(doc))}
                </div>
            )}
        </div>
    );
}
