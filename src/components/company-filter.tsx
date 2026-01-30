'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, Check, ChevronDown, X } from 'lucide-react';
import { getUserCompanies } from '@/actions/companies';
import { Button } from '@/components/ui';

interface Company {
    id: string;
    name: string;
    edrpou: string;
}

interface CompanyFilterProps {
    onFilterChange: (companyIds: string[]) => void;
    activeCompanyId: string;
}

export default function CompanyFilter({ onFilterChange, activeCompanyId }: CompanyFilterProps) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [filterMode, setFilterMode] = useState<'active' | 'selected' | 'all'>('active');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Load companies on mount
    useEffect(() => {
        loadCompanies();
        loadFilterFromStorage();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Apply filter when selection changes
    useEffect(() => {
        applyFilter();
    }, [selectedCompanyIds, filterMode, activeCompanyId]);

    const loadCompanies = async () => {
        const result = await getUserCompanies(false);
        if (result.success && result.companies) {
            setCompanies(result.companies.map(c => ({
                id: c.id,
                name: c.name,
                edrpou: c.edrpou
            })));
        }
    };

    const loadFilterFromStorage = () => {
        try {
            const stored = localStorage.getItem('companyFilter');
            if (stored) {
                const { selectedCompanyIds: ids, mode } = JSON.parse(stored);
                setSelectedCompanyIds(ids || []);
                setFilterMode(mode || 'active');
            }
        } catch (error) {
            console.error('Error loading filter from storage:', error);
        }
    };

    const saveFilterToStorage = (ids: string[], mode: 'active' | 'selected' | 'all') => {
        try {
            localStorage.setItem('companyFilter', JSON.stringify({
                selectedCompanyIds: ids,
                mode
            }));
        } catch (error) {
            console.error('Error saving filter to storage:', error);
        }
    };

    const applyFilter = () => {
        let companyIds: string[] = [];

        if (filterMode === 'active') {
            companyIds = [activeCompanyId];
        } else if (filterMode === 'all') {
            // On initial mount companies might not be loaded yet.
            // Fall back to the stored selection to avoid temporarily resetting to active company.
            companyIds = companies.length > 0 ? companies.map(c => c.id) : selectedCompanyIds;
        } else {
            companyIds = selectedCompanyIds;
        }

        // Avoid emitting empty company list for non-active modes while data is still loading.
        // Empty array is treated as "no companyIds" upstream and falls back to active company.
        if ((filterMode === 'all' || filterMode === 'selected') && companyIds.length === 0) {
            return;
        }

        onFilterChange(companyIds);
    };

    const handleToggleCompany = (companyId: string) => {
        const newSelected = selectedCompanyIds.includes(companyId)
            ? selectedCompanyIds.filter(id => id !== companyId)
            : [...selectedCompanyIds, companyId];

        setSelectedCompanyIds(newSelected);
        setFilterMode('selected');
        saveFilterToStorage(newSelected, 'selected');
    };

    const handleSelectAll = () => {
        const allIds = companies.map(c => c.id);
        setSelectedCompanyIds(allIds);
        setFilterMode('all');
        saveFilterToStorage(allIds, 'all');
    };

    const handleSelectActive = () => {
        setSelectedCompanyIds([activeCompanyId]);
        setFilterMode('active');
        saveFilterToStorage([activeCompanyId], 'active');
    };

    const handleClear = () => {
        setSelectedCompanyIds([]);
        setFilterMode('active');
        saveFilterToStorage([], 'active');
    };

    const getFilterLabel = () => {
        if (filterMode === 'active') {
            const activeCompany = companies.find(c => c.id === activeCompanyId);
            return activeCompany?.name || 'Активна компанія';
        } else if (filterMode === 'all') {
            return `Всі компанії (${companies.length})`;
        } else {
            return `Вибрано: ${selectedCompanyIds.length}`;
        }
    };

    if (companies.length <= 1) {
        // Don't show filter if user has only one company
        return null;
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2"
            >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">{getFilterLabel()}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 z-50">
                    {/* Header */}
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                Фільтр компаній
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSelectActive}
                                className={`px-2 py-1 text-xs rounded ${filterMode === 'active'
                                        ? 'bg-brand-teal text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}
                            >
                                Тільки активна
                            </button>
                            <button
                                onClick={handleSelectAll}
                                className={`px-2 py-1 text-xs rounded ${filterMode === 'all'
                                        ? 'bg-brand-teal text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}
                            >
                                Всі
                            </button>
                            {selectedCompanyIds.length > 0 && filterMode === 'selected' && (
                                <button
                                    onClick={handleClear}
                                    className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                >
                                    Скинути
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Company List */}
                    <div className="max-h-80 overflow-y-auto p-2">
                        {companies.map((company) => {
                            const isSelected = selectedCompanyIds.includes(company.id);
                            const isActive = company.id === activeCompanyId;

                            return (
                                <button
                                    key={company.id}
                                    onClick={() => handleToggleCompany(company.id)}
                                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${isSelected
                                            ? 'bg-brand-teal/10 dark:bg-brand-teal/20'
                                            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                                            ? 'border-brand-teal bg-brand-teal'
                                            : 'border-slate-300 dark:border-slate-600'
                                        }`}>
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-slate-900 dark:text-white truncate">
                                                {company.name}
                                            </p>
                                            {isActive && (
                                                <span className="px-1.5 py-0.5 text-xs bg-brand-teal/10 text-brand-teal rounded flex-shrink-0">
                                                    Активна
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {company.edrpou}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        {filterMode === 'selected' && selectedCompanyIds.length > 0 && (
                            <p>Вибрано {selectedCompanyIds.length} з {companies.length} компаній</p>
                        )}
                        {filterMode === 'all' && (
                            <p>Показуються дані всіх компаній</p>
                        )}
                        {filterMode === 'active' && (
                            <p>Показуються дані тільки активної компанії</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
