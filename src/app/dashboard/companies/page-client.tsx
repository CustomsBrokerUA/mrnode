'use client';

import { useState, useEffect } from 'react';
import { Building2, Plus, Users, Trash2, Edit, Crown, User, Eye, ArrowLeft, RotateCcw, History, Activity } from 'lucide-react';
import { getUserCompanies, setActiveCompany, deleteCompany, restoreCompany, leaveCompany, getCompanyOperationLogs } from '@/actions/companies';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import CompanyMembersModal from '@/components/company-members-modal';
import CompanyAuditLogModal from '@/components/company-audit-log-modal';

interface Company {
  id: string;
  name: string;
  edrpou: string;
  role: 'OWNER' | 'MEMBER' | 'VIEWER';
  isActiveCompany: boolean;
  deletedAt?: Date | null;
  declarationsCount: number;
  syncHistoryCount: number;
  createdAt: Date;
}

type CompanyTab = 'companies' | 'operations';

interface OperationLogEntry {
  id: string;
  operation: string;
  status: string;
  details?: string | null;
  meta?: any;
  startedAt: Date;
  finishedAt?: Date | null;
  durationMs?: number | null;
  createdAt: Date;
}

export default function CompaniesPageClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [tab, setTab] = useState<CompanyTab>('companies');
  const [operationLogs, setOperationLogs] = useState<OperationLogEntry[]>([]);
  const [isLoadingOps, setIsLoadingOps] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadCompanies();
  }, [showDeleted]);

  useEffect(() => {
    if (tab !== 'operations') return;
    void loadOperationLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companies]);

  const loadCompanies = async () => {
    try {
      setIsLoading(true);
      const result = await getUserCompanies(showDeleted);
      if (result.success && result.companies) {
        const validCompanies = result.companies.map((c: any) => ({
          ...c,
          role: c.role as 'OWNER' | 'MEMBER' | 'VIEWER'
        }));
        setCompanies(validCompanies);

        // Відправити подію для оновлення CompanySelector в header
        window.dispatchEvent(new CustomEvent('companyUpdated'));
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOperationLogs = async () => {
    try {
      const active = companies.find(c => c.isActiveCompany);
      if (!active) {
        setOperationLogs([]);
        return;
      }

      if (active.role !== 'OWNER' && active.role !== 'MEMBER') {
        setOperationLogs([]);
        return;
      }

      setIsLoadingOps(true);
      const result = await getCompanyOperationLogs(active.id, 100);
      if ((result as any)?.success && (result as any)?.logs) {
        setOperationLogs((result as any).logs as OperationLogEntry[]);
      } else {
        setOperationLogs([]);
      }
    } catch (error) {
      console.error('Error loading operation logs:', error);
      setOperationLogs([]);
    } finally {
      setIsLoadingOps(false);
    }
  };

  const handleSetActive = async (companyId: string) => {
    try {
      const result = await setActiveCompany(companyId);
      if (result.success) {
        // Оновити список компаній
        setCompanies(prev => prev.map(c => ({
          ...c,
          isActiveCompany: c.id === companyId
        })));

        // Відправити подію для оновлення CompanySelector в header
        window.dispatchEvent(new CustomEvent('companyUpdated'));

        // Перезавантажити сторінку для оновлення даних
        router.refresh();
      }
    } catch (error) {
      console.error('Error setting active company:', error);
      alert('Помилка зміни активної компанії');
    }
  };

  const handleDelete = async (companyId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цю компанію? Дані будуть збережені протягом 90 днів, після чого будуть безповоротно видалені.')) {
      return;
    }

    try {
      const result = await deleteCompany(companyId);
      if (result.success) {
        // Перезавантажити список компаній
        loadCompanies();
        router.refresh();
      } else {
        alert(result.error || 'Помилка видалення компанії');
      }
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Помилка видалення компанії');
    }
  };

  const handleLeave = async (companyId: string) => {
    if (!confirm('Ви впевнені, що хочете вийти з цієї компанії?')) {
      return;
    }

    try {
      const result = await leaveCompany(companyId);
      if (result.success) {
        // Перезавантажити список компаній
        loadCompanies();
        router.refresh();
      } else {
        alert(result.error || 'Помилка виходу з компанії');
      }
    } catch (error) {
      console.error('Error leaving company:', error);
      alert('Помилка виходу з компанії');
    }
  };

  const handleRestore = async (companyId: string) => {
    if (!confirm('Відновити цю компанію?')) {
      return;
    }

    try {
      const result = await restoreCompany(companyId);
      if (result.success) {
        loadCompanies();
        router.refresh();
      } else {
        alert(result.error || 'Помилка відновлення компанії');
      }
    } catch (error) {
      console.error('Error restoring company:', error);
      alert('Помилка відновлення компанії');
    }
  };

  // Modal state
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [auditLogModalOpen, setAuditLogModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');
  const [selectedCompanyRole, setSelectedCompanyRole] = useState<'OWNER' | 'MEMBER' | 'VIEWER' | null>(null);

  const handleOpenMembers = (companyId: string, role: 'OWNER' | 'MEMBER' | 'VIEWER') => {
    setSelectedCompanyId(companyId);
    setSelectedCompanyRole(role);
    setMembersModalOpen(true);
  };

  const handleOpenAuditLog = (companyId: string, companyName: string) => {
    setSelectedCompanyId(companyId);
    setSelectedCompanyName(companyName);
    setAuditLogModalOpen(true);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'MEMBER':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'VIEWER':
        return <Eye className="w-4 h-4 text-slate-400" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Власник';
      case 'MEMBER':
        return 'Учасник';
      case 'VIEWER':
        return 'Переглядач';
      default:
        return role;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Мої компанії</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Мої компанії</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Управління вашими компаніями
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showDeleted ? "primary" : "outline"}
            size="sm"
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {showDeleted ? 'Приховати видалені' : 'Показати видалені'}
          </Button>
          <Link href="/dashboard/companies/new">
            <Button variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              Додати компанію
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg inline-flex gap-1">
        <button
          onClick={() => setTab('companies')}
          className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${tab === 'companies'
            ? 'bg-white dark:bg-slate-700 text-brand-blue dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
        >
          Компанії
        </button>
        <button
          onClick={() => setTab('operations')}
          className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${tab === 'operations'
            ? 'bg-white dark:bg-slate-700 text-brand-blue dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
        >
          Операції
        </button>
      </div>

      {/* Companies Grid */}
      {tab === 'companies' ? (
        companies.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Немає компаній
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Додайте вашу першу компанію для початку роботи
            </p>
            <Link href="/dashboard/companies/new">
              <Button variant="primary">
                <Plus className="w-4 h-4 mr-2" />
                Додати компанію
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <div
                key={company.id}
                className={`bg-white dark:bg-slate-900 rounded-lg border-2 transition-all ${company.isActiveCompany
                  ? 'border-brand-teal shadow-lg shadow-brand-teal/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-brand-blue/10 dark:bg-brand-teal/20 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-brand-blue dark:text-brand-teal" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                          {company.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getRoleIcon(company.role)}
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {getRoleLabel(company.role)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {company.isActiveCompany && (
                        <span className="px-2 py-1 text-xs font-medium bg-brand-teal/10 text-brand-teal rounded-full flex-shrink-0">
                          Активна
                        </span>
                      )}
                      {company.deletedAt && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full flex-shrink-0">
                          Видалена
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">ЄДРПОУ:</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-white">{company.edrpou}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Декларацій:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{company.declarationsCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Синхронізацій:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{company.syncHistoryCount}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                    {!company.deletedAt && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenMembers(company.id, company.role)}
                          className="text-slate-600 hover:text-slate-700"
                          title="Учасники"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAuditLog(company.id, company.name)}
                          className="text-slate-600 hover:text-slate-700"
                          title="Історія змін"
                        >
                          <History className="w-4 h-4" />
                        </Button>

                        {!company.isActiveCompany && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetActive(company.id)}
                            className="flex-1"
                          >
                            Зробити активною
                          </Button>
                        )}
                        {company.isActiveCompany && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="flex-1"
                          >
                            Активна
                          </Button>
                        )}
                        {company.role === 'OWNER' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(company.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        {company.role !== 'OWNER' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLeave(company.id)}
                            className="text-slate-600 hover:text-slate-700"
                          >
                            Вийти
                          </Button>
                        )}
                      </>
                    )}
                    {company.deletedAt && company.role === 'OWNER' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRestore(company.id)}
                        className="flex-1"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Відновити компанію
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 dark:bg-brand-teal/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-brand-blue dark:text-brand-teal" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Операції</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Історія важких операцій для активної компанії
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadOperationLogs}>
              Оновити
            </Button>
          </div>

          <div className="p-6">
            {(() => {
              const active = companies.find(c => c.isActiveCompany);
              if (!active) {
                return (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                      Активна компанія не вибрана
                    </p>
                  </div>
                );
              }

              if (active.role !== 'OWNER' && active.role !== 'MEMBER') {
                return (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                      Перегляд операцій доступний тільки для ролей Власник / Учасник
                    </p>
                  </div>
                );
              }

              if (isLoadingOps) {
                return (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                    ))}
                  </div>
                );
              }

              if (!operationLogs || operationLogs.length === 0) {
                return (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                      Операцій поки немає
                    </p>
                  </div>
                );
              }

              const formatDate = (date: Date) => {
                return new Date(date).toLocaleString('uk-UA', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
              };

              const statusLabel = (status: string) => {
                if (status === 'started') return 'Виконується';
                if (status === 'success') return 'Успішно';
                if (status === 'error') return 'Помилка';
                if (status === 'blocked') return 'Заблоковано';
                return status;
              };

              return (
                <div className="space-y-3">
                  {operationLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {log.operation}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                              {statusLabel(log.status)}
                            </span>
                            {typeof log.durationMs === 'number' && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {log.durationMs} ms
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {formatDate(log.createdAt)}
                          </div>
                          {log.details && (
                            <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                              {log.details}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {selectedCompanyId && selectedCompanyRole && (
        <CompanyMembersModal
          isOpen={membersModalOpen}
          onClose={() => setMembersModalOpen(false)}
          companyId={selectedCompanyId}
          currentUserRole={selectedCompanyRole}
        />
      )}
      {selectedCompanyId && (
        <CompanyAuditLogModal
          isOpen={auditLogModalOpen}
          onClose={() => setAuditLogModalOpen(false)}
          companyId={selectedCompanyId}
          companyName={selectedCompanyName}
        />
      )}
    </div>
  );
}
