'use client';

import React from 'react';
import { Button } from '@/components/ui';
import { FileSpreadsheet, X } from 'lucide-react';
import { ActiveTab } from '../../types';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: ActiveTab;
    totalCount: number;
    exportColumns: { [key: string]: boolean };
    exportColumnOrder?: string[];
    onExportColumnsChange: (columns: { [key: string]: boolean }) => void;
    onExport: () => void;
    onExtendedExport?: () => void;
}

/**
 * Модальне вікно для експорту декларацій в Excel.
 * Дозволяє вибрати колонки для експорту.
 */
export default function ExportModal({
    isOpen,
    onClose,
    activeTab,
    totalCount,
    exportColumns,
    exportColumnOrder,
    onExportColumnsChange,
    onExport,
    onExtendedExport
}: ExportModalProps) {
    if (!isOpen) return null;

    const list60Columns = ['mdNumber', 'registeredDate', 'status', 'type', 'transport', 'guid', 'mrn'];
    const list61Columns = [
        'mdNumber', 'registeredDate', 'status', 'type',
        'invoiceNumber', 'invoiceDate', 'cmrNumber', 'cmrDate', 'contractNumber', 'contractDate',
        'consignor', 'consignee', 'manufacturer', 'carrierName',
        'invoiceValue', 'invoiceCurrency', 'invoiceValueCurrency',
        'deliveryTermsIncoterms', 'deliveryTermsDetails',
        'goodsCount', 'goodsIndex', 'goodsDescription', 'goodsHSCode',
        'goodsPrice', 'goodsInvoiceValueUah', 'goodsInvoiceValueUsd', 'goodsCustomsValue', 'goodsPayments',
        'customsOffice', 'declarantName', 'guid', 'mrn'
    ];


    // Sort columns based on exportColumnOrder if available
    let availableColumns = activeTab === 'list60' ? list60Columns : list61Columns;
    if (activeTab === 'list61' && exportColumnOrder && exportColumnOrder.length > 0) {
        // Only include columns that are in list61Columns to avoid showing internal keys
        availableColumns = exportColumnOrder.filter(key => list61Columns.includes(key));
        // Add any columns from list61Columns that might be missing in exportColumnOrder
        const missing = list61Columns.filter(key => !exportColumnOrder.includes(key));
        availableColumns = [...availableColumns, ...missing];
    }

    const columnLabels: { [key: string]: string } = {
        mdNumber: 'Номер МД',
        registeredDate: 'Дата реєстрації',
        status: 'Статус',
        type: 'Тип',
        transport: 'Транспорт',
        consignor: 'Відправник',
        consignee: 'Отримувач',
        invoiceValue: 'Фактурна вартість (вал)',
        invoiceCurrency: 'Валюта контракту',
        goodsCount: 'Кількість товарів',
        customsOffice: 'Митниця',
        declarantName: 'Декларант',
        guid: 'GUID',
        mrn: 'MRN',
        invoiceNumber: '№ Інвойсу',
        invoiceDate: 'Дата інвойсу',
        cmrNumber: '№ CMR/Накладної',
        cmrDate: 'Дата CMR/Накладної',
        contractNumber: '№ Контракту',
        contractDate: 'Дата контракту',
        manufacturer: 'Виробник',
        carrierName: 'Перевізник',
        invoiceValueCurrency: 'Фактурна вартість (валюта)',
        deliveryTermsIncoterms: 'Умови поставки (Інкотермс)',
        deliveryTermsDetails: 'Місце поставки',
        goodsIndex: '№ товару',
        goodsDescription: 'Опис товару',
        goodsHSCode: 'Код УКТЗЕД',
        goodsPrice: 'Ціна товару (вал)',
        goodsInvoiceValueUah: 'Фактурна вартість грн',
        goodsInvoiceValueUsd: 'Фактурна вартість USD',
        goodsCustomsValue: 'Митна вартість грн',
        goodsPayments: 'Платежі по товару',
    };

    const handleSelectAll = () => {
        const allColumns: { [key: string]: boolean } = {};
        availableColumns.forEach(key => {
            allColumns[key] = true;
        });
        onExportColumnsChange(allColumns);
    };

    const handleDeselectAll = () => {
        const noneColumns: { [key: string]: boolean } = {};
        availableColumns.forEach(key => {
            noneColumns[key] = false;
        });
        onExportColumnsChange(noneColumns);
    };

    const handleColumnChange = (key: string, checked: boolean) => {
        onExportColumnsChange({ ...exportColumns, [key]: checked });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">
                            Експорт в Excel
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Виберіть колонки для експорту ({totalCount} декларацій)
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="gap-1"
                    >
                        <X className="w-4 h-4" />
                        Закрити
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-900">Виберіть колонки:</h3>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSelectAll}
                                    className="text-xs"
                                >
                                    Вибрати всі
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDeselectAll}
                                    className="text-xs"
                                >
                                    Скинути всі
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {availableColumns.map((key) => (
                                <label
                                    key={key}
                                    className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={exportColumns[key] !== false}
                                        onChange={(e) => handleColumnChange(key, e.target.checked)}
                                        className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                    />
                                    <span className="text-sm font-medium text-slate-900">
                                        {columnLabels[key] || key}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-200 flex items-center justify-between gap-2">
                    <div>
                        {activeTab === 'list61' && onExtendedExport && (
                            <Button
                                variant="outline"
                                onClick={onExtendedExport}
                                className="gap-2"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Розширений експорт
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                        >
                            Скасувати
                        </Button>
                        <Button
                            onClick={onExport}
                        >
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Експортувати
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
