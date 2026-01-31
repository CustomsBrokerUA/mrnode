'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input } from '@/components/ui';
import { RotateCcw } from 'lucide-react';
import { getArchiveAutocompleteSuggestions } from '@/actions/declarations';

interface FiltersPanelProps {
    // Filter values
    filterDateFrom: string;
    filterDateTo: string;
    filterCustomsOffice: string;
    filterCurrency: string;
    filterConsignor: string;
    filterConsignee: string;
    filterContractHolder: string;
    filterHSCode: string;
    filterDeclarationType: string;

    suggestions?: {
        customsOffices?: string[];
        consignors?: string[];
        consignees?: string[];
        contractHolders?: string[];
        hsCodes?: string[];
        declarationTypes?: string[];
    };

    companyIds?: string[];
    
    // Filter setters
    setFilterDateFrom: (value: string) => void;
    setFilterDateTo: (value: string) => void;
    setFilterCustomsOffice: (value: string) => void;
    setFilterCurrency: (value: string) => void;
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
    filterDateFrom,
    filterDateTo,
    filterCustomsOffice,
    filterCurrency,
    filterConsignor,
    filterConsignee,
    filterContractHolder,
    filterHSCode,
    filterDeclarationType,
    suggestions,
    companyIds,
    setFilterDateFrom,
    setFilterDateTo,
    setFilterCustomsOffice,
    setFilterCurrency,
    setFilterConsignor,
    setFilterConsignee,
    setFilterContractHolder,
    setFilterHSCode,
    setFilterDeclarationType,
}: FiltersPanelProps) {

    const [liveCustomsOffices, setLiveCustomsOffices] = useState<string[]>([]);
    const [liveConsignors, setLiveConsignors] = useState<string[]>([]);
    const [liveConsignees, setLiveConsignees] = useState<string[]>([]);
    const [liveContractHolders, setLiveContractHolders] = useState<string[]>([]);
    const [liveHSCodes, setLiveHSCodes] = useState<string[]>([]);
    const [liveDeclarationTypes, setLiveDeclarationTypes] = useState<string[]>([]);

    const filtersForAutocomplete = useMemo(
        () => ({
            dateFrom: filterDateFrom,
            dateTo: filterDateTo,
            customsOffice: filterCustomsOffice,
            currency: filterCurrency,
            consignor: filterConsignor,
            consignee: filterConsignee,
            contractHolder: filterContractHolder,
            hsCode: filterHSCode,
            declarationType: filterDeclarationType,
        }),
        [
            filterDateFrom,
            filterDateTo,
            filterCustomsOffice,
            filterCurrency,
            filterConsignor,
            filterConsignee,
            filterContractHolder,
            filterHSCode,
            filterDeclarationType,
        ]
    );

    const timersRef = useRef<Record<string, number | null>>({});

    const scheduleFetch = (
        field: 'customsOffice' | 'consignor' | 'consignee' | 'contractHolder' | 'hsCode' | 'declarationType',
        rawValue: string,
        setResult: (values: string[]) => void
    ) => {
        const token = String(rawValue || '').split(',').pop()?.trim() ?? '';

        if (timersRef.current[field]) {
            window.clearTimeout(timersRef.current[field] as number);
        }

        if (!token) {
            setResult([]);
            timersRef.current[field] = null;
            return;
        }

        timersRef.current[field] = window.setTimeout(() => {
            (async () => {
                try {
                    const values = await getArchiveAutocompleteSuggestions(
                        field,
                        token,
                        filtersForAutocomplete as any,
                        companyIds,
                        10
                    );
                    setResult(Array.isArray(values) ? values : []);
                } catch {
                    setResult([]);
                }
            })();
        }, 250);
    };

    useEffect(() => {
        scheduleFetch('customsOffice', filterCustomsOffice, setLiveCustomsOffices);
        return () => {
            if (timersRef.current.customsOffice) window.clearTimeout(timersRef.current.customsOffice);
        };
    }, [filterCustomsOffice, filtersForAutocomplete, companyIds]);

    useEffect(() => {
        scheduleFetch('consignor', filterConsignor, setLiveConsignors);
        return () => {
            if (timersRef.current.consignor) window.clearTimeout(timersRef.current.consignor);
        };
    }, [filterConsignor, filtersForAutocomplete, companyIds]);

    useEffect(() => {
        scheduleFetch('consignee', filterConsignee, setLiveConsignees);
        return () => {
            if (timersRef.current.consignee) window.clearTimeout(timersRef.current.consignee);
        };
    }, [filterConsignee, filtersForAutocomplete, companyIds]);

    useEffect(() => {
        scheduleFetch('contractHolder', filterContractHolder, setLiveContractHolders);
        return () => {
            if (timersRef.current.contractHolder) window.clearTimeout(timersRef.current.contractHolder);
        };
    }, [filterContractHolder, filtersForAutocomplete, companyIds]);

    useEffect(() => {
        scheduleFetch('hsCode', filterHSCode, setLiveHSCodes);
        return () => {
            if (timersRef.current.hsCode) window.clearTimeout(timersRef.current.hsCode);
        };
    }, [filterHSCode, filtersForAutocomplete, companyIds]);

    useEffect(() => {
        scheduleFetch('declarationType', filterDeclarationType, setLiveDeclarationTypes);
        return () => {
            if (timersRef.current.declarationType) window.clearTimeout(timersRef.current.declarationType);
        };
    }, [filterDeclarationType, filtersForAutocomplete, companyIds]);
    
    const handleResetAll = () => {
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterCustomsOffice('');
        setFilterCurrency('all');
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
                        list="archive-customs-office-suggestions"
                        className="w-full"
                    />
                    <datalist id="archive-customs-office-suggestions">
                        {((liveCustomsOffices.length > 0 ? liveCustomsOffices : (suggestions?.customsOffices || [])) || []).map((v) => (
                            <option key={v} value={v} />
                        ))}
                    </datalist>
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
                        list="archive-consignor-suggestions"
                        className="w-full"
                    />
                    <datalist id="archive-consignor-suggestions">
                        {((liveConsignors.length > 0 ? liveConsignors : (suggestions?.consignors || [])) || []).map((v) => (
                            <option key={v} value={v} />
                        ))}
                    </datalist>
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
                        list="archive-consignee-suggestions"
                        className="w-full"
                    />
                    <datalist id="archive-consignee-suggestions">
                        {((liveConsignees.length > 0 ? liveConsignees : (suggestions?.consignees || [])) || []).map((v) => (
                            <option key={v} value={v} />
                        ))}
                    </datalist>
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
                        list="archive-contract-holder-suggestions"
                        className="w-full"
                    />
                    <datalist id="archive-contract-holder-suggestions">
                        {((liveContractHolders.length > 0 ? liveContractHolders : (suggestions?.contractHolders || [])) || []).map((v) => (
                            <option key={v} value={v} />
                        ))}
                    </datalist>
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
                        list="archive-hs-code-suggestions"
                        className="w-full"
                    />
                    <datalist id="archive-hs-code-suggestions">
                        {((liveHSCodes.length > 0 ? liveHSCodes : (suggestions?.hsCodes || [])) || []).map((v) => (
                            <option key={v} value={v} />
                        ))}
                    </datalist>
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
                        list="archive-declaration-type-suggestions"
                        className="w-full"
                    />
                    <datalist id="archive-declaration-type-suggestions">
                        {((liveDeclarationTypes.length > 0 ? liveDeclarationTypes : (suggestions?.declarationTypes || [])) || []).map((v) => (
                            <option key={v} value={v} />
                        ))}
                    </datalist>
                </div>
            </div>
        </div>
    );
}
