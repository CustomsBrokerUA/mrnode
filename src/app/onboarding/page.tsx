'use client';

import { useState } from "react";
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { CheckCircle2, Building2, User, Key, HelpCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveCompanyData, saveProfileData } from "./actions";
import CustomsTokenInstructionModal from "@/components/customs-token-instruction-modal";

export default function OnboardingPage() {
    const [step, setStep] = useState(1);
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // Handle step 2 form submission using Server Action
    async function handleCompanySubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const result = await saveCompanyData({}, formData);

        if (result.success) {
            setStep(3);
        } else {
            alert(result.error); // Simple error handling for MVP
        }
        setIsLoading(false);
    }

    async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const result = await saveProfileData({}, formData);

        if ((result as any).success) {
            setStep(2);
        } else {
            alert((result as any).error);
        }

        setIsLoading(false);
    }

    function finishOnboarding() {
        router.push('/dashboard');
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center justify-between relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10" />

                        {/* Step 1 Indicator */}
                        <div className={`flex flex-col items-center gap-2 bg-slate-50 px-2 ${step >= 1 ? 'text-brand-blue' : 'text-slate-400'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${step >= 1 ? 'bg-brand-blue border-brand-blue text-white' : 'bg-white border-slate-300'}`}>
                                <User className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium">Профіль</span>
                        </div>

                        {/* Step 2 Indicator */}
                        <div className={`flex flex-col items-center gap-2 bg-slate-50 px-2 ${step >= 2 ? 'text-brand-blue' : 'text-slate-400'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${step >= 2 ? 'bg-brand-blue border-brand-blue text-white' : 'bg-white border-slate-300'}`}>
                                <Building2 className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium">Компанія</span>
                        </div>

                        {/* Step 3 Indicator */}
                        <div className={`flex flex-col items-center gap-2 bg-slate-50 px-2 ${step >= 3 ? 'text-brand-blue' : 'text-slate-400'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${step >= 3 ? 'bg-brand-blue border-brand-blue text-white' : 'bg-white border-slate-300'}`}>
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium">Готово</span>
                        </div>
                    </div>
                </div>

                {/* Step 1: Profile Setup */}
                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Налаштування профілю</CardTitle>
                            <CardDescription>Розповіть трохи про себе</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleProfileSubmit} className="space-y-4">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">Ім'я</Label>
                                            <Input name="firstName" id="firstName" required placeholder="Іван" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Прізвище</Label>
                                            <Input name="lastName" id="lastName" required placeholder="Петренко" />
                                        </div>
                                    </div>
                                    <div className="pt-4 flex justify-end">
                                        <Button type="submit" disabled={isLoading}>
                                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Далі: Компанія
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Company & Token Setup */}
                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Підключення компанії</CardTitle>
                            <CardDescription>Введіть дані для синхронізації з митницею</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCompanySubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="companyName">Назва компанії</Label>
                                        <Input name="companyName" id="companyName" required placeholder="ТОВ 'Приклад'" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edrpou">ЄДРПОУ / РНОКПП</Label>
                                        <Input name="edrpou" id="edrpou" required placeholder="12345678 або 1234567890" maxLength={10} minLength={8} />
                                    </div>
                                </div>

                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 bg-brand-teal/10 p-2 rounded-lg text-brand-teal">
                                            <Key className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <Label htmlFor="token" className="text-brand-blue font-semibold">API Токен Держмитслужби</Label>
                                            <p className="text-xs text-slate-500">
                                                Необхідний для завантаження декларацій. Ми шифруємо його за стандартом AES-256.
                                            </p>
                                        </div>
                                    </div>
                                    <Input
                                        name="token"
                                        id="token"
                                        type="password"
                                        required
                                        placeholder="Вставте ваш токен тут..."
                                        className="bg-white"
                                    />
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <HelpCircle className="w-3 h-3" />
                                        <button type="button" onClick={() => setIsTokenModalOpen(true)} className="underline hover:text-brand-blue">
                                            Де знайти цей токен? (Інструкція)
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end gap-2">
                                    <Button type="button" variant="ghost" onClick={() => setStep(1)}>Назад</Button>
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Зберегти та підключити
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: Success & Sync Info */}
                {step === 3 && (
                    <Card className="text-center py-8">
                        <CardContent className="space-y-6">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-brand-blue">Все налаштовано!</h2>
                                <p className="text-slate-600 max-w-md mx-auto">
                                    Ваша компанія успішно додана. Тепер ви можете перейти до панелі керування та завантажити перші декларації.
                                </p>
                            </div>
                            <Button onClick={finishOnboarding} size="lg" className="bg-brand-teal hover:bg-cyan-600">
                                Перейти в Dashboard
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Token Instruction Modal */}
            <CustomsTokenInstructionModal 
                isOpen={isTokenModalOpen}
                onClose={() => setIsTokenModalOpen(false)}
            />
        </div>
    );
}
