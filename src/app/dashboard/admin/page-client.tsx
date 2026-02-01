'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { attachCompanyToUser, listUsersWithCompanies } from '@/actions/admin';

type Result =
  | { ok: true; userEmail: string; company: { id: string; name: string; edrpou: string } }
  | { ok: false; error: string };

type UsersResponse =
  | {
      success: true;
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      users: Array<{
        id: string;
        email: string;
        fullName: string | null;
        activeCompanyId: string | null;
        createdAt: string | Date;
        companies: Array<{
          role: string;
          isActive: boolean;
          companyId: string;
          company: { id: string; name: string; edrpou: string };
        }>;
      }>;
    }
  | { error: string };

export default function AdminPageClient() {
  const [userEmail, setUserEmail] = useState('');
  const [companyEdrpou, setCompanyEdrpou] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const [usersQuery, setUsersQuery] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize] = useState(50);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersData, setUsersData] = useState<Extract<UsersResponse, { success: true }> | null>(null);

  const usersTotalPages = useMemo(() => usersData?.totalPages ?? 1, [usersData?.totalPages]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setResult(null);
    try {
      const resp = await attachCompanyToUser({
        userEmail: userEmail.trim(),
        companyEdrpou: companyEdrpou.trim(),
      });

      if ((resp as any).success) {
        setResult({
          ok: true,
          userEmail: (resp as any).userEmail,
          company: (resp as any).company,
        });
      } else {
        setResult({
          ok: false,
          error: (resp as any).error || 'Помилка',
        });
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || 'Помилка' });
    } finally {
      setIsSubmitting(false);
    }
  }, [companyEdrpou, userEmail]);

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);

    const timer = setTimeout(() => {
      (async () => {
        try {
          const resp = (await listUsersWithCompanies({
            query: usersQuery.trim(),
            page: usersPage,
            pageSize: usersPageSize,
          })) as UsersResponse;

          if (cancelled) return;

          if ((resp as any).success) {
            setUsersData(resp as Extract<UsersResponse, { success: true }>);
          } else {
            setUsersData(null);
            setUsersError((resp as any).error || 'Помилка завантаження');
          }
        } catch (e: any) {
          if (cancelled) return;
          setUsersData(null);
          setUsersError(e?.message || 'Помилка завантаження');
        } finally {
          if (!cancelled) setUsersLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [usersPage, usersPageSize, usersQuery]);

  const handleUsersPrev = useCallback(() => {
    setUsersPage((p) => Math.max(1, p - 1));
  }, []);

  const handleUsersNext = useCallback(() => {
    setUsersPage((p) => Math.min(usersTotalPages, p + 1));
  }, [usersTotalPages]);

  const handleUsersSearchChange = useCallback((value: string) => {
    setUsersQuery(value);
    setUsersPage(1);
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Навігація</CardTitle>
          <CardDescription>Операційні екрани для адміністрування</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a href="/dashboard/admin/sync">
            <Button variant="outline">Sync Jobs</Button>
          </a>
          <a href="/dashboard/admin/companies">
            <Button variant="outline">Companies</Button>
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Адмін панель</CardTitle>
          <CardDescription>
            Привʼязка компаній до користувачів (створює/активує UserCompany та ставить activeCompanyId).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userEmail">Email користувача</Label>
              <Input
                id="userEmail"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyEdrpou">ЄДРПОУ компанії</Label>
              <Input
                id="companyEdrpou"
                value={companyEdrpou}
                onChange={(e) => setCompanyEdrpou(e.target.value)}
                placeholder="12345678"
                autoComplete="off"
              />
            </div>
          </div>

          {result && result.ok && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Успішно. Користувач: <span className="font-medium">{result.userEmail}</span>. Компанія:{' '}
              <span className="font-medium">{result.company.name}</span> ({result.company.edrpou}).
            </div>
          )}

          {result && !result.ok && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {result.error}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Виконую…' : 'Привʼязати компанію'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Користувачі</CardTitle>
          <CardDescription>
            Всі зареєстровані користувачі та їх компанії (активні доступи). Пошук працює по email/ПІБ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usersQuery">Пошук</Label>
            <Input
              id="usersQuery"
              value={usersQuery}
              onChange={(e) => handleUsersSearchChange(e.target.value)}
              placeholder="andrii@... або ПІБ"
            />
          </div>

          {usersError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {usersError}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>ПІБ</TableHead>
                  <TableHead>Active company</TableHead>
                  <TableHead>Компанії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading && (
                  <TableRow>
                    <TableCell colSpan={5}>Завантаження…</TableCell>
                  </TableRow>
                )}

                {!usersLoading && usersData?.users?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>Нічого не знайдено</TableCell>
                  </TableRow>
                )}

                {!usersLoading &&
                  usersData?.users?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{u.fullName || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {u.activeCompanyId || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {u.companies.length === 0 && <div className="text-sm text-slate-500">—</div>}
                          {u.companies.map((uc) => (
                            <div key={uc.companyId} className="text-sm">
                              <span className="font-medium">{uc.company.name}</span> ({uc.company.edrpou})
                              <span className="text-slate-500"> — {uc.role}</span>
                              {u.activeCompanyId === uc.companyId && (
                                <span className="ml-2 text-xs text-brand-teal">active</span>
                              )}
                            </div>
                          ))}
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
            {usersData ? (
              <span>
                Всього: <span className="font-medium">{usersData.total}</span>. Сторінка{' '}
                <span className="font-medium">{usersData.page}</span> /{' '}
                <span className="font-medium">{usersData.totalPages}</span>
              </span>
            ) : (
              <span />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleUsersPrev} disabled={usersLoading || usersPage <= 1}>
              Назад
            </Button>
            <Button variant="outline" onClick={handleUsersNext} disabled={usersLoading || usersPage >= usersTotalPages}>
              Далі
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
