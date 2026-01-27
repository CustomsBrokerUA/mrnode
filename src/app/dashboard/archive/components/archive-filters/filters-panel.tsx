'use client';

import React from 'react';
import { Button, Input } from '@/components/ui';
import { RotateCcw } from 'lucide-react';

interface FiltersPanelProps {
    // Filter values
    filterStatus: string;
    filterDateFrom: string;
    filterDateTo: string;
    filterCustomsOffice: string;
    filterCurrency: string;
    filterInvoiceValueFrom: string;
    filterInvoiceValueTo: string;
    filterConsignor: string;
    filterConsignee: string;
    filterContractHolder: string;
    filterHSCode: string;
    filterDeclarationType: string;
    
    // Filter setters
    setFilterStatus: (value: string) => void;
    setFilterDateFrom: (value: string) => void;
    setFilterDateTo: (value: string) => void;
    setFilterCustomsOffice: (value: string) => void;
    setFilterCurrency: (value: string) => void;
    setFilterInvoiceValueFrom: (value: string) => void;
    setFilterInvoiceValueTo: (value: string) => void;
    setFilterConsignor: (value: string) => void;
    setFilterConsignee: (value: string) => void;
    setFilterContractHolder: (value: string) => void;
    setFilterHSCode: (value: string) => void;
    setFilterDeclarationType: (value: string) => void;
}

/**
 * Панель фільтрів для архіву декларацій.
 * Показує всі доступні фільтри для list61.
 */
export default function FiltersPanel({
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
    setFilterStatus,
    setFilterDateFrom,
    setFilterDateTo,
    setFilterCustomsOffice,
    setFilterCurrency,
    setFilterInvoiceValueFrom,
    setFilterInvoiceValueTo,
    setFilterConsignor,
    setFilterConsignee,
    setFilterContractHolder,
    setFilterHSCode,
    setFilterDeclarationType,
}: FiltersPanelProps) {
    
    const handleResetAll = () => {
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
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Фільтри</h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetAll}
                    className="text-xs"
                >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Скинути всі
                </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Статус</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                    >
                        <option value="all">Всі</option>
                        <option value="cleared">Оформлені</option>
                        <option value="PROCESSING">В роботі</option>
                        <option value="REJECTED">Помилка</option>
                    </select>
                </div>
                
                {/* Date From Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Дата від</label>
                    <Input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* Date To Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Дата до</label>
                    <Input
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* Customs Office Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Митниця</label>
                    <Input
                        placeholder="Введіть код митниці..."
                        value={filterCustomsOffice}
                        onChange={(e) => setFilterCustomsOffice(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* Currency Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Валюта</label>
                    <select
                        value={filterCurrency}
                        onChange={(e) => setFilterCurrency(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                    >
                        <option value="all">Всі</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="UAH">UAH</option>
                        <option value="GBP">GBP</option>
                        <option value="PLN">PLN</option>
                    </select>
                </div>
                
                {/* Invoice Value From Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Фактурна вартість від</label>
                    <Input
                        type="number"
                        placeholder="0"
                        value={filterInvoiceValueFrom}
                        onChange={(e) => setFilterInvoiceValueFrom(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* Invoice Value To Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Фактурна вартість до</label>
                    <Input
                        type="number"
                        placeholder="0"
                        value={filterInvoiceValueTo}
                        onChange={(e) => setFilterInvoiceValueTo(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* Consignor Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Відправник
                        <span className="text-xs text-slate-500 ml-1 font-normal">(через кому для кількох)</span>
                    </label>
                    <Input
                        placeholder="Назва відправника або кілька через кому..."
                        value={filterConsignor}
                        onChange={(e) => setFilterConsignor(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* Consignee Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Отримувач
                        <span className="text-xs text-slate-500 ml-1 font-normal">(через кому для кількох)</span>
                    </label>
                    <Input
                        placeholder="Назва отримувача або кілька через кому..."
                        value={filterConsignee}
                        onChange={(e) => setFilterConsignee(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* Contract Holder Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Контрактотримач
                        <span className="text-xs text-slate-500 ml-1 font-normal">(через кому для кількох)</span>
                    </label>
                    <Input
                        placeholder="Назва контрактотримача або кілька через кому..."
                        value={filterContractHolder}
                        onChange={(e) => setFilterContractHolder(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* HS Code Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Код УКТЗЕД
                        <span className="text-xs text-slate-500 ml-1 font-normal">(через кому для кількох)</span>
                    </label>
                    <Input
                        placeholder="Код УКТЗЕД або кілька через кому..."
                        value={filterHSCode}
                        onChange={(e) => setFilterHSCode(e.target.value)}
                        className="w-full"
                    />
                </div>
                
                {/* Declaration Type Filter */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Тип декларації
                        <span className="text-xs text-slate-500 ml-1 font-normal">(через кому для кількох)</span>
                    </label>
                    <Input
                        placeholder="Тип декларації або кілька через кому (напр. 01 / 02 / 03)..."
                        value={filterDeclarationType}
                        onChange={(e) => setFilterDeclarationType(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );
}
