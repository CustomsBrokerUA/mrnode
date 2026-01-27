'use client';

import Link from "next/link";
import { useState, useTransition } from "react";
import { register } from "@/actions/register";
import { Button, Input, PasswordInput, Label } from "@/components/ui";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSuccess("");

        const formData = new FormData(event.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        // For now, full name is not in the form but schema supports it optionally

        startTransition(() => {
            register({ email, password })
                .then((data) => {
                    if (data.error) {
                        setError(data.error);
                    }
                    if (data.success) {
                        setSuccess(data.success);
                        setTimeout(() => {
                            router.push('/login');
                        }, 1500);
                    }
                })
        });
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Right Side - Visual */}
            <div className="hidden lg:flex flex-col justify-center p-12 bg-slate-900 text-white relative overflow-hidden order-2">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-teal/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 max-w-lg mx-auto space-y-6">
                    <h2 className="text-3xl font-bold">Приєднуйтесь до професіоналів</h2>
                    <ul className="space-y-4 text-slate-300">
                        <li className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center text-xs">✓</div>
                            Безлімітна синхронізація МД
                        </li>
                        <li className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center text-xs">✓</div>
                            Експорт у будь-який формат
                        </li>
                        <li className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center text-xs">✓</div>
                            Підтримка 24/7
                        </li>
                    </ul>
                </div>
            </div>

            {/* Left Side - Form */}
            <div className="flex items-center justify-center p-8 bg-white order-1">
                <div className="w-full max-w-sm space-y-8">
                    <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-brand-blue transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        На головну
                    </Link>

                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-2xl font-bold tracking-tight text-brand-blue">
                            Створити акаунт
                        </h1>
                        <p className="text-sm text-slate-500">
                            Почніть роботу з MRNode вже сьогодні
                        </p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Електронна пошта</Label>
                            <Input name="email" id="email" placeholder="name@company.com" required type="email" disabled={isPending} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Пароль</Label>
                            <PasswordInput name="password" id="password" required disabled={isPending} />
                        </div>
                        {error && (
                            <div className="p-3 rounded-md bg-red-50 text-red-500 text-sm font-medium">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="p-3 rounded-md bg-emerald-50 text-emerald-500 text-sm font-medium">
                                {success}
                            </div>
                        )}
                        <Button className="w-full bg-brand-teal hover:bg-cyan-600" disabled={isPending} type="submit">
                            {isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Створити акаунт
                        </Button>
                    </form>

                    <p className="px-8 text-center text-sm text-slate-500">
                        Натискаючи, ви погоджуєтесь з нашими{" "}
                        <Link href="#" className="underline underline-offset-4 hover:text-brand-blue">
                            Умовами використання
                        </Link>{" "}
                        та{" "}
                        <Link href="#" className="underline underline-offset-4 hover:text-brand-blue">
                            Політикою конфіденційності
                        </Link>
                        .
                    </p>

                    <div className="text-center text-sm text-slate-500">
                        Вже маєте акаунт?{" "}
                        <Link href="/login" className="font-semibold text-brand-blue hover:text-slate-800 underline underline-offset-4">
                            Увійти
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
