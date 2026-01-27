'use client';

import Link from "next/link";
import { useState, useTransition } from "react";
import { login } from "@/actions/login";
import { Button, Input, PasswordInput, Label } from "@/components/ui";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function LoginPage() {
    const [error, setError] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        const formData = new FormData(event.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        startTransition(() => {
            login({ email, password })
                .then((data) => {
                    if (data?.error) {
                        setError(data.error);
                    }
                })
        });
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left Side - Form */}
            <div className="flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-sm space-y-8">
                    <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-brand-blue transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        На головну
                    </Link>

                    <div className="flex flex-col space-y-2 text-center">
                        <h1 className="text-2xl font-bold tracking-tight text-brand-blue">
                            З поверненням
                        </h1>
                        <p className="text-sm text-slate-500">
                            Введіть ваші дані для входу в MRNode
                        </p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Електронна пошта</Label>
                            <Input name="email" id="email" placeholder="name@company.com" required type="email" disabled={isPending} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Пароль</Label>
                                <Link href="#" className="text-sm font-medium text-brand-teal hover:text-cyan-600">
                                    Забули пароль?
                                </Link>
                            </div>
                            <PasswordInput name="password" id="password" required disabled={isPending} />
                        </div>
                        {error && (
                            <div className="p-3 rounded-md bg-red-50 text-red-500 text-sm font-medium flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                {error}
                            </div>
                        )}
                        <Button className="w-full" disabled={isPending} type="submit">
                            {isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Увійти
                        </Button>
                    </form>

                    <div className="text-center text-sm text-slate-500">
                        Немає акаунту?{" "}
                        <Link href="/register" className="font-semibold text-brand-teal hover:text-cyan-600 underline underline-offset-4">
                            Зареєструватися
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right Side - Visual */}
            <div className="hidden lg:flex flex-col justify-center p-12 bg-brand-blue text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-teal/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-teal/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 max-w-lg mx-auto space-y-6">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                        <div className="w-6 h-6 bg-brand-teal rounded-full" />
                    </div>
                    <blockquote className="space-y-2">
                        <p className="text-lg font-medium leading-relaxed">
                            &ldquo;MRNode повністю змінив наш підхід до митної звітності. Те, що раніше займало години, тепер робиться за хвилини.&rdquo;
                        </p>
                        <footer className="text-sm text-slate-400">Олена К., Головний бухгалтер</footer>
                    </blockquote>
                </div>
            </div>
        </div>
    );
}
