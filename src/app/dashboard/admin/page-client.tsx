'use client';

import { useCallback, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { attachCompanyToUser } from '@/actions/admin';

type Result =
  | { ok: true; userEmail: string; company: { id: string; name: string; edrpou: string } }
  | { ok: false; error: string };

export default function AdminPageClient() {
  const [userEmail, setUserEmail] = useState('');
  const [companyEdrpou, setCompanyEdrpou] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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

  return (
    <div className="max-w-3xl space-y-4">
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
    </div>
  );
}
