'use client';

import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import { ShieldCheck, Lock, EyeOff, UserCheck } from "lucide-react";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white">
            <LandingHeader />
            <main className="pt-32 pb-24">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-16">
                            <h1 className="text-4xl font-extrabold text-brand-blue mb-6">Політика конфіденційності</h1>
                            <p className="text-xl text-slate-600">
                                Ми цінуємо вашу довіру та забезпечуємо найвищий рівень захисту ваших даних.
                            </p>
                        </div>

                        <div className="space-y-12 text-slate-700 leading-relaxed">
                            <section className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
                                <h2 className="text-2xl font-bold text-brand-blue mb-6 flex items-center gap-3">
                                    <ShieldCheck className="w-6 h-6 text-brand-teal" />
                                    1. Загальні положення
                                </h2>
                                <p className="mb-4">
                                    Дана Політика конфіденційності описує, як MRNode (ФОП Осташевський Андрій Олексійович) збирає, використовує та захищає персональну та комерційну інформацію під час використання нашого сервісу.
                                </p>
                                <p>
                                    Ми діємо відповідно до Закону України "Про захист персональних даних" та міжнародних стандартів безпеки.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-bold text-brand-blue mb-6 flex items-center gap-3">
                                    <Lock className="w-6 h-6 text-brand-teal" />
                                    2. Збір та шифрування даних
                                </h2>
                                <p className="mb-4">Для надання послуг ми збираємо:</p>
                                <ul className="list-disc pl-6 space-y-2 mb-4">
                                    <li>Персональні дані: ПІБ, email, номер телефону.</li>
                                    <li>Технічні дані: API-токени доступу до Держмитслужби.</li>
                                    <li>Комерційні дані: Інформація з митних декларацій для цілей візуалізації.</li>
                                </ul>
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 italic text-amber-900">
                                    <strong>Важливо:</strong> Ваші API-токени зберігаються виключно у зашифрованому вигляді з використанням алгоритму <strong>AES-256</strong>. Навіть адміністратори нашої системи не мають доступу до них у відкритому вигляді.
                                </div>
                            </section>

                            <section>
                                <h2 className="text-2xl font-bold text-brand-blue mb-6 flex items-center gap-3">
                                    <EyeOff className="w-6 h-6 text-brand-teal" />
                                    3. Використання інформації
                                </h2>
                                <p className="mb-4">Ми використовуємо отримані дані виключно для:</p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Забезпечення роботи функцій синхронізації та аналітики.</li>
                                    <li>Надання технічної підтримки.</li>
                                    <li>Вдосконалення інтерфейсу та функціональних можливостей сервісу.</li>
                                    <li>Надсилання повідомлень про статус синхронізації або термінові оновлення системи.</li>
                                </ul>
                                <p className="mt-4 font-bold text-red-600 uppercase text-sm tracking-wide">
                                    Ми ніколи не продаємо та не передаємо ваші комерційні дані третім особам.
                                </p>
                            </section>

                            <section className="bg-slate-900 text-slate-300 p-8 rounded-3xl">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                    <UserCheck className="w-6 h-6 text-brand-teal" />
                                    4. Ваші права
                                </h2>
                                <p className="mb-6">Ви маєте повний контроль над своїми даними:</p>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-4">
                                        <div className="w-6 h-6 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center flex-shrink-0 text-xs font-bold">1</div>
                                        <span>Ви можете видалити свій акаунт та всі пов'язані з ним дані в будь-який момент.</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-6 h-6 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center flex-shrink-0 text-xs font-bold">2</div>
                                        <span>Ви маєте право отримати виписку всіх даних, які зберігаються у нас.</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-6 h-6 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center flex-shrink-0 text-xs font-bold">3</div>
                                        <span>Секретні ключі (API-токени) можуть бути видалені вами миттєво через панель налаштувань.</span>
                                    </li>
                                </ul>
                            </section>

                            <section className="text-sm text-slate-500 border-t border-slate-200 pt-8">
                                <p>Дата останнього оновлення: 24 січня 2026 року.</p>
                                <p className="mt-2">Якщо у вас виникли запитання, звертайтесь на <a href="mailto:privacy@brokerua.com" className="text-brand-blue hover:underline">info@brokerua.com</a>.</p>
                            </section>
                        </div>
                    </div>
                </div>
            </main>
            <LandingFooter />
        </div>
    );
}
