'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { adminAttachUserToCompany, adminSoftDeleteCompany, listCompanyAnomalies } from '@/actions/admin-companies';

type CompanyRole = 'OWNER' | 'MEMBER' | 'VIEWER';

type CompaniesResponse =
  | {
      success: true;
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      companies: Array<{
        id: string;
        name: string;
        edrpou: string;
        isActive: boolean;
        deletedAt: string | Date | null;
        createdAt: string | Date;
        updatedAt: string | Date;
        activeUsersCount: number;
        ownersCount: number;
        owners: Array<{
          role: CompanyRole;
          userId: string;
          user: { id: string; email: string; fullName: string | null };
        }>;
        userCompanies: Array<{
          role: CompanyRole;
          userId: string;
          user: { id: string; email: string; fullName: string | null };
        }>;
      }>;
    }
  | { error: string };

export default function AdminCompaniesPageClient() {
  const [query, setQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [onlyNoUsers, setOnlyNoUsers] = useState(true);
  const [onlyNoOwner, setOnlyNoOwner] = useState(true);
  const [onlyMultiOwner, setOnlyMultiOwner] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Extract<CompaniesResponse, { success: true }> | null>(null);

  const totalPages = useMemo(() => data?.totalPages ?? 1, [data?.totalPages]);

  const [attachOpen, setAttachOpen] = useState(false);
  const [attachCompanyId, setAttachCompanyId] = useState<string | null>(null);
  const [attachUserEmail, setAttachUserEmail] = useState('');
  const [attachRole, setAttachRole] = useState<CompanyRole>('MEMBER');
  const [attachReplaceOwner, setAttachReplaceOwner] = useState(false);
  const [attachSubmitting, setAttachSubmitting] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const resp = (await listCompanyAnomalies({
        query: query.trim(),
        includeDeleted,
        onlyNoUsers,
        onlyNoOwner,
        onlyMultiOwner,
        page,
        pageSize,
      })) as CompaniesResponse;

      if ((resp as any).success) {
        setData(resp as Extract<CompaniesResponse, { success: true }>);
      } else {
        setData(null);
        setError((resp as any).error || 'Помилка завантаження');
      }
    } catch (e: any) {
      setData(null);
      setError(e?.message || 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  }, [includeDeleted, onlyMultiOwner, onlyNoOwner, onlyNoUsers, page, pageSize, query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCompanies();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCompanies]);

  const handleFilterChange = useCallback((updater: () => void) => {
    updater();
    setPage(1);
  }, []);

  const handlePrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNext = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const openAttach = useCallback((companyId: string) => {
    setAttachCompanyId(companyId);
    setAttachUserEmail('');
    setAttachRole('MEMBER');
    setAttachReplaceOwner(false);
    setAttachOpen(true);
  }, []);

  const closeAttach = useCallback(() => {
    setAttachOpen(false);
    setAttachCompanyId(null);
  }, []);

  const submitAttach = useCallback(async () => {
    if (!attachCompanyId) return;
    if (!attachUserEmail.trim()) {
      alert('Вкажи email користувача');
      return;
    }

    setAttachSubmitting(true);
    try {
      const resp = await adminAttachUserToCompany({
        companyId: attachCompanyId,
        userEmail: attachUserEmail.trim(),
        role: attachRole,
        replaceOwner: attachRole === 'OWNER' ? attachReplaceOwner : false,
      });

      if ((resp as any).error) {
        alert((resp as any).error);
        return;
      }

      closeAttach();
      await loadCompanies();
    } catch (e: any) {
      alert(e?.message || 'Помилка');
    } finally {
      setAttachSubmitting(false);
    }
  }, [attachCompanyId, attachReplaceOwner, attachRole, attachUserEmail, closeAttach, loadCompanies]);

  const handleDelete = useCallback(
    async (companyId: string) => {
      if (!confirm('Soft-delete компанію?')) return;
      try {
        const resp = await adminSoftDeleteCompany({ companyId });
        if ((resp as any).error) {
          alert((resp as any).error);
          return;
        }
        await loadCompanies();
      } catch (e: any) {
        alert(e?.message || 'Помилка');
      }
    },
    [loadCompanies]
  );

  return (
    <div className="max-w-6xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Адмін: Компанії (аномалії)</CardTitle>
          <CardDescription>Компанії без користувачів / без OWNER / з кількома OWNER</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="space-y-2">
              <Label htmlFor="q">Пошук (назва/ЄДРПОУ)</Label>
              <Input id="q" value={query} onChange={(e) => handleFilterChange(() => setQuery(e.target.value))} />
            </div>

            <div className="space-y-2">
              <Label>Фільтри</Label>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={onlyNoUsers}
                    onChange={(e) => handleFilterChange(() => setOnlyNoUsers(e.target.checked))}
                  />
                  0 користувачів
                </label>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={onlyNoOwner}
                    onChange={(e) => handleFilterChange(() => setOnlyNoOwner(e.target.checked))}
                  />
                  без OWNER
                </label>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={onlyMultiOwner}
                    onChange={(e) => handleFilterChange(() => setOnlyMultiOwner(e.target.checked))}
                  />
                  &gt;1 OWNER
                </label>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => handleFilterChange(() => setIncludeDeleted(e.target.checked))}
                  />
                  include deleted
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Дії</Label>
              <Button variant="outline" onClick={() => loadCompanies()} disabled={loading}>
                Оновити список
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Компанія</TableHead>
                  <TableHead>Аномалії</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead>Owners</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5}>Завантаження…</TableCell>
                  </TableRow>
                )}

                {!loading && data?.companies?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>Нічого не знайдено</TableCell>
                  </TableRow>
                )}

                {!loading &&
                  data?.companies?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium">{c.name}</div>
                          <div className="text-xs text-slate-500">{c.edrpou}</div>
                          <div className="text-xs text-slate-400">companyId: {c.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {c.activeUsersCount === 0 && (
                            <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                              0 users
                            </span>
                          )}
                          {c.ownersCount === 0 && (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                              no owner
                            </span>
                          )}
                          {c.ownersCount > 1 && (
                            <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                              multi-owner
                            </span>
                          )}
                          {c.activeUsersCount > 0 && c.ownersCount === 1 && (
                            <span className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800">
                              ok
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-right">{c.activeUsersCount}</TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div>{c.ownersCount}</div>
                          {c.ownersCount > 0 && (
                            <div className="text-xs text-slate-600">
                              {c.owners.map((o) => o.user.email).join(', ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className={c.deletedAt ? 'text-slate-400' : 'text-slate-700'}>{c.deletedAt ? 'deleted' : 'active'}</div>
                        <div className="text-[11px] text-slate-400">created: {new Date(c.createdAt).toLocaleString('uk-UA')}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => openAttach(c.id)} disabled={Boolean(c.deletedAt)}>
                            Привʼязати
                          </Button>
                          <Button
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(c.id)}
                            disabled={Boolean(c.deletedAt)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            {data ? (
              <span>
                Всього: <span className="font-medium">{data.total}</span>. Сторінка{' '}
                <span className="font-medium">{data.page}</span> /{' '}
                <span className="font-medium">{data.totalPages}</span>
              </span>
            ) : (
              <span />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrev} disabled={loading || page <= 1}>
              Назад
            </Button>
            <Button variant="outline" onClick={handleNext} disabled={loading || page >= totalPages}>
              Далі
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={attachOpen} onOpenChange={(o) => (o ? null : closeAttach())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Привʼязати користувача до компанії</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={attachUserEmail} onChange={(e) => setAttachUserEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Роль</Label>
              <select
                id="role"
                value={attachRole}
                onChange={(e) => setAttachRole(e.target.value as CompanyRole)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50"
              >
                <option value="OWNER">OWNER</option>
                <option value="MEMBER">MEMBER</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>

            {attachRole === 'OWNER' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={attachReplaceOwner}
                  onChange={(e) => setAttachReplaceOwner(e.target.checked)}
                />
                replaceOwner (існуючий OWNER стане MEMBER)
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAttach}>
              Скасувати
            </Button>
            <Button onClick={submitAttach} disabled={attachSubmitting}>
              {attachSubmitting ? 'Зберігаю…' : 'Привʼязати'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
