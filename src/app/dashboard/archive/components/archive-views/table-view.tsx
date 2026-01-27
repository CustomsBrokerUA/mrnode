'use client';

import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { ArrowUp, ArrowDown, ArrowUpDown, Download, Eye, Trash2 } from 'lucide-react';
import { Declaration, DeclarationWithRawData, ActiveTab, SortColumn, SortDirection } from '../../types';
import { statusStyles, statusLabels } from '../../constants';
import { getRawData, formatRegisteredDate, getMDNumber } from '../../utils';
import VirtualizedTableView from '../virtualized-table-view';

interface TableViewProps {
    activeTab: ActiveTab;
    sortedDocs: DeclarationWithRawData[];
    paginatedDocs: DeclarationWithRawData[];
    paginatedGroupedDocs: Array<{ group: string; label: string; docs: DeclarationWithRawData[] }> | null;
    groupByDate: boolean;
    useVirtualization: boolean;
    selectedIds: Set<string>;
    selectAllCheckboxRef: React.RefObject<HTMLInputElement | null>;
    allSelected: boolean;
    handleSelectAll: (checked: boolean) => void;
    handleSelectOne: (id: string, checked: boolean) => void;
    handleSort: (column: SortColumn) => void;
    sortColumn: SortColumn | null;
    sortDirection: SortDirection;
    onPreview: (doc: DeclarationWithRawData) => void;
    onDelete: (id: string, mdNumber: string) => void;
    isDeleting: boolean;
    declarations: (DeclarationWithRawData | Declaration)[];
    searchTerm: string;
}

/**
 * Табличний вигляд декларацій.
 * Підтримує віртуалізацію, групування по датах та різні режими відображення.
 */
export default function TableView({
    activeTab,
    sortedDocs,
    paginatedDocs,
    paginatedGroupedDocs,
    groupByDate,
    useVirtualization,
    selectedIds,
    selectAllCheckboxRef,
    allSelected,
    handleSelectAll,
    handleSelectOne,
    handleSort,
    sortColumn,
    sortDirection,
    onPreview,
    onDelete,
    isDeleting,
    declarations,
    searchTerm,
}: TableViewProps) {
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

    // Функція для отримання транспорту (list60)
    const getTransport = (doc: DeclarationWithRawData) => {
        const rawData = getRawData(doc);
        let trn_all = rawData?.trn_all;
        
        // Ensure trn_all is a string before calling trim()
        if (trn_all) {
            if (typeof trn_all === 'string') {
                const trimmed = trn_all.trim();
                if (trimmed) {
                    return trimmed;
                }
            } else if (Array.isArray(trn_all)) {
                // If it's an array, join it
                const joined = trn_all.filter(Boolean).join(', ');
                if (joined) {
                    return joined;
                }
            } else if (typeof trn_all === 'number' || typeof trn_all === 'object') {
                // Convert to string if possible
                const str = String(trn_all);
                if (str && str !== 'undefined' && str !== 'null') {
                    return str;
                }
            }
        }
        
        // Fallback: try to extract from xmlData if it's JSON with data60_1
        if (doc.xmlData) {
            try {
                const trimmed = doc.xmlData.trim();
                if (trimmed.startsWith('{')) {
                    const parsed = JSON.parse(doc.xmlData);
                    trn_all = parsed.data60_1?.trn_all;
                    if (trn_all) {
                        if (typeof trn_all === 'string') {
                            const trimmedValue = trn_all.trim();
                            if (trimmedValue) {
                                return trimmedValue;
                            }
                        } else if (Array.isArray(trn_all)) {
                            const joined = trn_all.filter(Boolean).join(', ');
                            if (joined) {
                                return joined;
                            }
                        } else {
                            const str = String(trn_all);
                            if (str && str !== 'undefined' && str !== 'null') {
                                return str;
                            }
                        }
                    }
                }
            } catch {
                // Ignore parse errors
            }
        }
        
        return '---';
    };

    // Рендер одного рядка таблиці
    const renderTableRow = (doc: DeclarationWithRawData) => {
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
            <tr 
                key={doc.id} 
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() => onPreview(doc)}
            >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={(e) => handleSelectOne(doc.id, e.target.checked)}
                        className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                    />
                </td>
                <td className="px-4 py-3">
                    <span className="text-brand-blue font-medium text-sm font-mono">
                        {mdNumber}
                    </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                    {registeredDate}
                </td>
                <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        isCleared 
                            ? statusStyles.CLEARED 
                            : statusStyles[doc.status as keyof typeof statusStyles] || statusStyles.PROCESSING
                    }`}>
                        {isCleared ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || status)}
                    </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                    {declarationType}
                </td>
                {activeTab === 'list61' && (
                    <>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                            {mappedData?.header?.consignor || '---'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                            {mappedData?.header?.consignee || '---'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                            {mappedData?.header?.invoiceValue 
                                ? `${mappedData.header.invoiceValue.toLocaleString('uk-UA')} ${mappedData.header.invoiceCurrency || '---'}`
                                : '---'
                            }
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                            {mappedData?.header?.totalItems ?? doc.summary?.totalItems ?? 0}
                        </td>
                    </>
                )}
                {activeTab === 'list60' && (
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">
                        {getTransport(doc)}
                    </td>
                )}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                </td>
            </tr>
        );
    };

    // Рендер порожнього стану
    const renderEmptyState = (colSpan: number) => {
        return (
            <tr>
                <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-500">
                    {declarations.length === 0 ? (
                        <div>
                            <p className="text-lg font-medium">Декларацій ще немає</p>
                            <p className="text-sm mt-1">Виконайте синхронізацію для завантаження даних</p>
                        </div>
                    ) : activeTab === 'list61' ? (
                        <div className="flex flex-col items-center gap-3">
                            <Download className="w-12 h-12 text-slate-400" />
                            <div>
                                <p className="text-lg font-medium text-slate-700">Деталі декларацій не завантажені</p>
                                <p className="text-sm mt-1 text-slate-500">Перейдіть на вкладку "Синхронізація" та завантажте деталі (61.1) для декларацій</p>
                            </div>
                        </div>
                    ) : (
                        <p>Нічого не знайдено за запитом "{searchTerm}"</p>
                    )}
                </td>
            </tr>
        );
    };

    const colSpan = activeTab === 'list61' ? 10 : 7;

    return (
        <div className={`w-full ${activeTab === 'list61' ? 'overflow-x-auto' : ''}`}>
            <table className="w-full" style={{ width: '100%', minWidth: activeTab === 'list61' ? '1400px' : '100%', tableLayout: 'auto' }}>
                <colgroup>
                    {activeTab === 'list61' ? (
                        <>
                            <col style={{ width: '48px', minWidth: '48px' }} />
                            <col style={{ minWidth: '160px', width: '160px' }} />
                            <col style={{ minWidth: '160px', width: '160px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ minWidth: '200px', width: '200px' }} />
                            <col style={{ minWidth: '200px', width: '200px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: '100px', minWidth: '100px' }} />
                            <col style={{ width: '280px', minWidth: '280px' }} />
                        </>
                    ) : (
                        <>
                            <col style={{ width: '48px', minWidth: '48px' }} />
                            <col style={{ minWidth: '160px' }} />
                            <col style={{ minWidth: '160px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ minWidth: '250px' }} />
                            <col style={{ width: '280px', minWidth: '280px' }} />
                        </>
                    )}
                </colgroup>
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300 text-sm w-12">
                            <input
                                type="checkbox"
                                ref={selectAllCheckboxRef}
                                checked={allSelected}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                            />
                        </th>
                        <th 
                            className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleSort('mdNumber')}
                        >
                            <div className="flex items-center gap-1">
                                Номер МД
                                {sortColumn === 'mdNumber' ? (
                                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                )}
                            </div>
                        </th>
                        <th 
                            className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleSort('registeredDate')}
                        >
                            <div className="flex items-center gap-1">
                                Дата реєстрації
                                {sortColumn === 'registeredDate' ? (
                                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                )}
                            </div>
                        </th>
                        <th 
                            className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleSort('status')}
                        >
                            <div className="flex items-center gap-1">
                                Статус
                                {sortColumn === 'status' ? (
                                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                )}
                            </div>
                        </th>
                        <th 
                            className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => handleSort('type')}
                        >
                            <div className="flex items-center gap-1">
                                Тип
                                {sortColumn === 'type' ? (
                                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                )}
                            </div>
                        </th>
                        {activeTab === 'list61' && (
                            <>
                                <th 
                                    className="px-4 py-3 text-left font-medium text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('consignor')}
                                >
                                    <div className="flex items-center gap-1">
                                        Відправник
                                        {sortColumn === 'consignor' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-left font-medium text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('consignee')}
                                >
                                    <div className="flex items-center gap-1">
                                        Отримувач
                                        {sortColumn === 'consignee' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-left font-medium text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('invoiceValue')}
                                >
                                    <div className="flex items-center gap-1">
                                        Фактурна вартість
                                        {sortColumn === 'invoiceValue' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-3 text-left font-medium text-slate-700 text-sm cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('goodsCount')}
                                >
                                    <div className="flex items-center gap-1">
                                        Товарів
                                        {sortColumn === 'goodsCount' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                        )}
                                    </div>
                                </th>
                            </>
                        )}
                        {activeTab === 'list60' && (
                            <th 
                                className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('transport')}
                            >
                                <div className="flex items-center gap-1">
                                    Транспорт
                                    {sortColumn === 'transport' ? (
                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    )}
                                </div>
                            </th>
                        )}
                        <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300 text-sm">Дії</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {useVirtualization ? (
                        <tr>
                            <td colSpan={colSpan} className="p-0">
                                <VirtualizedTableView
                                    declarations={paginatedDocs}
                                    activeTab={activeTab}
                                    selectedIds={selectedIds}
                                    onSelectOne={handleSelectOne}
                                    onPreview={onPreview}
                                    onDelete={onDelete}
                                    isDeleting={isDeleting}
                                    containerHeight={600} // Will be calculated dynamically inside component
                                    rowHeight={60}
                                />
                            </td>
                        </tr>
                    ) : groupByDate && paginatedGroupedDocs ? (
                        paginatedGroupedDocs.length === 0 ? (
                            <tr>
                                <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-500">
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
                                </td>
                            </tr>
                        ) : (
                            paginatedGroupedDocs.map((group) => (
                                <React.Fragment key={group.group}>
                                    <tr>
                                        <td colSpan={colSpan} className="px-4 py-3 bg-slate-100 border-b-2 border-slate-300">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-slate-900">{group.label}</h3>
                                                <span className="text-xs text-slate-500 font-medium">
                                                    {group.docs.length} {group.docs.length === 1 ? 'декларація' : group.docs.length < 5 ? 'декларації' : 'декларацій'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    {group.docs.map((doc) => renderTableRow(doc))}
                                </React.Fragment>
                            ))
                        )
                    ) : paginatedDocs.length === 0 ? (
                        renderEmptyState(colSpan)
                    ) : (
                        paginatedDocs.map((doc) => renderTableRow(doc))
                    )}
                </tbody>
            </table>
        </div>
    );
}
