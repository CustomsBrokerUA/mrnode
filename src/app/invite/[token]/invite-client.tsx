'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/index";
import { Button } from "@/components/ui/index";
import { acceptInvitation, rejectInvitation } from "@/actions/companies";
import { Loader2, CheckCircle2, XCircle, Building2, UserPlus, Shield } from 'lucide-react';

interface InviteClientProps {
    initialData: {
        id: string;
        companyName: string;
        inviterName: string;
        email: string;
        role: string;
    } | null;
    error?: string;
    token: string;
}

export function InviteClient({ initialData, error: initialError, token }: InviteClientProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | undefined>(initialError);
    const [status, setStatus] = useState<'idle' | 'success' | 'rejected'>(initialError ? 'rejected' : 'idle');
    const router = useRouter();

    const handleAccept = async () => {
        setIsLoading(true);
        setError(undefined);
        try {
            const res = await acceptInvitation(token);
            if (res && 'error' in res && res.error) {
                setError(res.error as string);
            } else {
                setStatus('success');
                setTimeout(() => {
                    router.push('/dashboard/companies');
                }, 2000);
            }
        } catch (err) {
            setError("Щось пішло не так. Спробуйте пізніше.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async () => {
        setIsLoading(true);
        try {
            const res = await rejectInvitation(token);
            if (res && 'error' in res && res.error) {
                setError(res.error as string);
            } else {
                setStatus('rejected');
            }
        } catch (err) {
            setError("Щось пішло не так");
        } finally {
            setIsLoading(false);
        }
    };

    if (status === 'success') {
        return (
            <Card className="border-green-100 shadow-xl bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-green-700">Вітаємо!</h2>
                        <p className="text-slate-600 dark:text-slate-300">
                            Ви успішно приєдналися до компанії. <br />
                            Зараз відбудеться перенаправлення...
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || status === 'rejected') {
        return (
            <Card className="border-red-100 shadow-xl bg-red-50/50 dark:bg-red-950/20">
                <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-red-700">Помилка</h2>
                        <p className="text-slate-600 dark:text-slate-300">
                            {status === 'rejected' ? 'Запрошення відхилено.' : error || 'Не вдалося обробити запрошення.'}
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')} className="mt-4">
                        Перейти до панелі керування
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!initialData) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-slate-500">Завантаження...</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-2xl border-0 overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative flex items-center justify-center">
                <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                    <Building2 className="h-10 w-10 text-white" />
                </div>
            </div>

            <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Запрошення до команди</CardTitle>
                <CardDescription>
                    Вас запрошують приєднатися до робочого простору
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl space-y-4 border border-slate-100 dark:border-slate-800">
                    <div className="text-center">
                        <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Компанія</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{initialData.companyName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                            <p className="text-xs text-slate-500 mb-1">Запросив</p>
                            <p className="font-medium text-sm truncate" title={initialData.inviterName}>
                                {initialData.inviterName}
                            </p>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                            <p className="text-xs text-slate-500 mb-1">Ваша Роль</p>
                            <div className="flex items-center justify-center space-x-1.5">
                                <Shield className="h-3.5 w-3.5 text-indigo-500" />
                                <p className="font-medium text-sm">
                                    {initialData.role === 'OWNER' ? 'Власник' :
                                        initialData.role === 'MEMBER' ? 'Учасник' : 'Переглядач'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-sm text-slate-500 pt-2">
                        Invitation sent to <span className="font-medium text-slate-700 dark:text-slate-300">{initialData.email}</span>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2 pb-8 px-8">
                <Button
                    variant="outline"
                    className="w-full sm:w-1/2 order-2 sm:order-1 border-slate-200 hover:bg-slate-50 text-slate-600"
                    onClick={handleReject}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Відхилити
                </Button>
                <Button
                    variant="primary"
                    className="w-full sm:w-1/2 order-1 sm:order-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 border-0"
                    onClick={handleAccept}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    Приєднатися
                </Button>
            </CardFooter>
        </Card>
    );
}
