'use client';

import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import { Rocket, Target, Heart, Sparkles } from "lucide-react";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white">
            <LandingHeader />
            <main className="pt-32 pb-24">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-brand-blue mb-6">Наша місія — цифровізація митних процесів</h1>
                        <p className="text-xl text-slate-600 leading-relaxed">
                            Ми — стартап-команда з великим потенціалом та глибоким розумінням потреб митних брокерів та бухгалтерів України.
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto mb-24">
                        <div className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-200">
                            <h2 className="text-2xl font-bold text-brand-blue mb-6">Хто ми?</h2>
                            <p className="text-lg text-slate-700 mb-6 leading-relaxed">
                                MRNode народився як відповідь на реальні виклики бізнесу. Ми бачили, як досвідчені фахівці витрачають години на ручне копіювання даних з митних систем в Excel. Ми вирішили, що технології мають працювати на людей, а не навпаки.
                            </p>
                            <p className="text-lg text-slate-700 mb-8 leading-relaxed">
                                Наша команда складається з розробників та експертів у сфері логістики, що дозволяє нам створювати інструменти, які дійсно працюють "в полі", а не лише в теорії.
                            </p>

                            <div className="grid sm:grid-cols-2 gap-8">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-teal flex-shrink-0">
                                        <Rocket className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-1">Швидкість</h4>
                                        <p className="text-sm text-slate-600">Ми постійно вдосконалюємо алгоритми для миттєвої обробки даних.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-teal flex-shrink-0">
                                        <Target className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-1">Точність</h4>
                                        <p className="text-sm text-slate-600">Кожна цифра в звітах перевіряється на відповідність оригінальному XML.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-teal flex-shrink-0">
                                        <Heart className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-1">Клієнтоорієнтованість</h4>
                                        <p className="text-sm text-slate-600">Ми слухаємо кожного користувача і впроваджуємо функції за вашими відгуками.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-teal flex-shrink-0">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-1">Інновації</h4>
                                        <p className="text-sm text-slate-600">Використовуємо найсучасніші технології для безпеки та стабільності.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-brand-blue mb-6">Приєднуйтесь до нашої подорожі</h2>
                        <p className="text-slate-600 mb-8 max-w-xl mx-auto">
                            Ми тільки на початку шляху, але наш розвиток дуже стрімкий. Станьте частиною ком’юніті MRNode вже сьогодні.
                        </p>
                        <div className="flex justify-center gap-4">
                            <a href="mailto:info@brokerua.com" className="px-8 py-3 bg-brand-blue text-white font-semibold rounded-xl hover:bg-slate-800 transition-all">
                                Написати нам
                            </a>
                        </div>
                    </div>
                </div>
            </main>
            <LandingFooter />
        </div>
    );
}
