'use client';

import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import { CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-white">
            <LandingHeader />
            <main className="pt-32 pb-24">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h1 className="text-4xl font-extrabold text-brand-blue mb-6">Прозорі тарифи для вашого бізнесу</h1>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-teal/10 text-brand-teal font-semibold mb-6">
                            <Zap className="w-5 h-5 fill-current" />
                            Наразі триває відкритий Бета-тест
                        </div>
                        <p className="text-xl text-slate-600">
                            Ми віримо, що MRNode має бути доступним кожному брокеру.
                            Під час бета-тестування всі функції системи доступні **безкоштовно**.
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto">
                        <div className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-200 relative overflow-hidden shadow-xl">
                            <div className="absolute top-0 right-0 bg-brand-teal text-white px-6 py-2 rounded-bl-2xl font-bold text-sm">
                                BETA FREE
                            </div>

                            <div className="grid md:grid-cols-2 gap-12 items-center">
                                <div>
                                    <h3 className="text-2xl font-bold text-brand-blue mb-4">Тариф "Early Adopter"</h3>
                                    <p className="text-slate-600 mb-8">
                                        Допоможіть нам зробити продукт кращим і отримайте безкоштовний доступ до всіх можливостей.
                                    </p>
                                    <ul className="space-y-4">
                                        {[
                                            "Необмежена кількість компаній",
                                            "Автоматична синхронізація 60.1 та 61.1",
                                            "Повна аналітика та звіти",
                                            "Експорт в Excel без обмежень",
                                            "Пріоритетна підтримка",
                                            "Шифрування за стандартом AES-256"
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-slate-700">
                                                <CheckCircle2 className="w-5 h-5 text-brand-teal flex-shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-inner">
                                    <div className="text-slate-500 mb-2 font-medium uppercase tracking-wider text-sm">Ціна під час Бета</div>
                                    <div className="text-5xl font-extrabold text-brand-blue mb-4">0 грн</div>
                                    <p className="text-slate-500 text-sm mb-8">
                                        Назавжди для тих, хто приєднався зараз (уточнюється умови підписки)
                                    </p>
                                    <Link
                                        href="/register"
                                        className="block w-full py-4 bg-brand-blue text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-brand-blue/20"
                                    >
                                        Почати зараз
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="mt-16 bg-blue-50 rounded-2xl p-8 border border-blue-100 italic text-slate-700">
                            **Важливо:** Вартість підписки в майбутньому буде сформована на основі відгуків користувачів.
                            Ми гарантуємо спеціальні умови для наших перших клієнтів, які допомагають проекту розвиватися зараз.
                        </div>
                    </div>
                </div>
            </main>
            <LandingFooter />
        </div>
    );
}
