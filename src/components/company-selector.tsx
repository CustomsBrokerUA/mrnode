'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, ChevronDown, Plus, Check } from 'lucide-react';
import { getUserCompanies, setActiveCompany } from '@/actions/companies';
import { useRouter, usePathname } from 'next/navigation';

interface Company {
  id: string;
  name: string;
  edrpou: string;
  role: 'OWNER' | 'MEMBER' | 'VIEWER';
  isActiveCompany: boolean;
  declarationsCount: number;
}

export default function CompanySelector() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const loadCompanies = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getUserCompanies();
      if (result.success && result.companies) {
        const validCompanies = result.companies.map((c: any) => ({
          ...c,
          role: c.role as 'OWNER' | 'MEMBER' | 'VIEWER'
        }));
        setCompanies(validCompanies);
        const active = validCompanies.find((c: any) => c.isActiveCompany);
        setActiveCompanyState(active || validCompanies[0] || null);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Завантажити компанії при монтуванні
  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Перезавантажити компанії при зміні URL (після додавання/зміни компанії)
  useEffect(() => {
    if (pathname === '/dashboard/companies' || pathname?.startsWith('/dashboard/companies/')) {
      loadCompanies();
    }
  }, [pathname, loadCompanies]);

  // Перезавантажити при відкритті dropdown
  const handleToggleDropdown = () => {
    if (!isOpen) {
      loadCompanies();
    }
    setIsOpen(!isOpen);
  };

  // Прослуховування події оновлення компаній (для синхронізації між компонентами)
  useEffect(() => {
    const handleCompanyUpdate = () => {
      loadCompanies();
    };

    window.addEventListener('companyUpdated', handleCompanyUpdate);
    window.addEventListener('focus', handleCompanyUpdate); // Оновити при поверненні фокусу на вікно

    return () => {
      window.removeEventListener('companyUpdated', handleCompanyUpdate);
      window.removeEventListener('focus', handleCompanyUpdate);
    };
  }, [loadCompanies]);

  const handleCompanyChange = async (companyId: string) => {
    // Якщо компанія вже активна, просто закрити dropdown
    if (companyId === activeCompany?.id) {
      setIsOpen(false);
      return;
    }

    try {
      // Notify layout to show loader
      window.dispatchEvent(new CustomEvent('companySwitchStart'));
      setIsOpen(false);

      const result = await setActiveCompany(companyId);
      if (result.success) {
        // Оновити локальний стан одразу
        const newActive = companies.find(c => c.id === companyId);
        if (newActive) {
          setActiveCompanyState(newActive);
          setCompanies(prev => prev.map(c => ({
            ...c,
            isActiveCompany: c.id === companyId
          })));
        }

        // Перезавантажити компанії з сервера для оновлення
        await loadCompanies();

        // Відправити подію для оновлення інших компонентів
        window.dispatchEvent(new CustomEvent('companyUpdated'));

        // Перезавантажити сторінку для оновлення всіх даних
        router.refresh();

        // Wait a bit for the refresh to actually happen/start rendering new data
        // We rely on router.refresh but since it's async we can remove loader shortly after
        // Ideally we would wait for the new page segment to load, but router.refresh promise resolves when fetch is done
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('companySwitchEnd'));
        }, 1000); // Small delay to prevent flashing if quick, or to allow render to start

      } else {
        alert(result.error || 'Помилка зміни активної компанії');
        window.dispatchEvent(new CustomEvent('companySwitchEnd'));
      }
    } catch (error: any) {
      console.error('Error changing company:', error);
      alert(error.message || 'Помилка зміни активної компанії');
      window.dispatchEvent(new CustomEvent('companySwitchEnd'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse">
        <Building2 className="w-4 h-4 text-slate-400" />
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
    );
  }

  if (!activeCompany) {
    return (
      <button
        onClick={() => router.push('/dashboard/companies')}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors"
        title="Додати компанію"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm font-medium">Додати компанію</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggleDropdown}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title={activeCompany.name}
      >
        <Building2 className="w-4 h-4 text-brand-blue dark:text-brand-teal" />
        <span className="text-sm font-medium text-slate-800 dark:text-white max-w-[150px] truncate">
          {activeCompany.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-[500px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                Мої компанії
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {companies.length} {companies.length === 1 ? 'компанія' : 'компаній'}
              </p>
            </div>

            <div className="overflow-y-auto flex-1">
              {companies.length === 0 ? (
                <div className="p-8 text-center">
                  <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Немає компаній
                  </p>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push('/dashboard/companies/new');
                    }}
                    className="text-xs text-brand-blue dark:text-brand-teal hover:underline"
                  >
                    Додати компанію
                  </button>
                </div>
              ) : (
                companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleCompanyChange(company.id)}
                    disabled={company.isActiveCompany}
                    className={`w-full px-4 py-3 text-left transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${company.isActiveCompany
                      ? 'bg-brand-teal/10 dark:bg-brand-teal/20 cursor-default'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
                      } disabled:opacity-100`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="w-4 h-4 text-brand-blue dark:text-brand-teal flex-shrink-0" />
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {company.name}
                          </span>
                          {company.isActiveCompany && (
                            <Check className="w-4 h-4 text-brand-teal flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 ml-6">
                          <span>ЄДРПОУ: {company.edrpou}</span>
                          <span className="capitalize">{company.role === 'OWNER' ? 'Власник' : company.role === 'MEMBER' ? 'Учасник' : 'Переглядач'}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 ml-6 mt-1">
                          {company.declarationsCount} декларацій
                        </div>
                      </div>
                      {company.isActiveCompany && (
                        <span className="px-2 py-1 text-xs font-medium bg-brand-teal/20 text-brand-teal rounded-full flex-shrink-0">
                          Активна
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/dashboard/companies');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Додати компанію</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
