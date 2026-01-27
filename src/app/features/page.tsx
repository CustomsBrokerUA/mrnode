'use client';

import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import { RefreshCw, FileSpreadsheet, ShieldCheck, PieChart, Users, Zap, Search, Download, Clock } from "lucide-react";

export default function FeaturesPage() {
    const features = [
        {
            icon: RefreshCw,
            title: "Автоматична синхронізація",
            description: "Пряма інтеграція з API Державної Митної Служби України. Система автоматично завантажує дані за запитами 60.1 та 61.1, позбавляючи вас потреби ручного введення."
        },
        {
            icon: FileSpreadsheet,
            title: "Розумний експорт в Excel",
            description: "Конструктор звітів дозволяє вивантажувати дані у форматі, ідеально підготовленому для втягування у 1С, BAS або інші облікові системи."
        },
        {
            icon: PieChart,
            title: "Глибока аналітика",
            description: "Візуалізація митної вартості, податків, ваги та кількості товарів у реальному часі. Відстежуйте тренди та ефективність вашої логістики."
        },
        {
            icon: Users,
            title: "Мульти-компанійність",
            description: "Керуйте декількома компаніями з одного акаунту. Ідеально для брокерських фірм, які обслуговують велику кількість клієнтів."
        },
        {
            icon: ShieldCheck,
            title: "Безпека корпоративного рівня",
            description: "Ваші API-токени шифруються за стандартом AES-256. Користувачі мають чітко розмежовані ролі (Власник, Менеджер, Переглядач)."
        },
        {
            icon: Search,
            title: "Потужний фільтр та пошук",
            description: "Миттєвий пошук по MRN, назві товару, коду УКТЗЕД або контрагенту серед тисяч декларацій."
        }
    ];

    return (
        <div className="min-h-screen bg-white">
            <LandingHeader />
            <main className="pt-32 pb-24">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-brand-blue mb-6">
                            Всі потрібні інструменти для роботи з митницею
                        </h1>
                        <p className="text-xl text-slate-600 leading-relaxed">
                            MRNode об'єднує технічну інтеграцію з митницею та потужні інструменти аналізу даних в одному зручному інтерфейсі.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 mb-24">
                        {features.map((f, i) => (
                            <div key={i} className="group p-8 rounded-3xl border border-slate-100 bg-white hover:border-brand-teal/30 hover:shadow-xl hover:shadow-brand-teal/5 transition-all duration-300">
                                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 text-brand-blue group-hover:bg-brand-teal group-hover:text-white transition-colors">
                                    <f.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">{f.title}</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    {f.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Detail Sections */}
                    <div className="space-y-32">
                        {/* Section 1 */}
                        <div className="flex flex-col lg:flex-row items-center gap-16">
                            <div className="lg:w-1/2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase mb-6">
                                    <Clock className="w-3 h-3" />
                                    Економія часу
                                </div>
                                <h2 className="text-3xl font-extrabold text-brand-blue mb-6">Синхронізація за лічені секунди</h2>
                                <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                                    Замість того, щоб чекати відповіді від митниці або копіювати дані вручну, ви просто натискаєте одну кнопку. MRNode миттєво отримує дані 60.1 (статус) та 61.1 (повний вміст) всіх ваших декларацій.
                                </p>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3 text-slate-700">
                                        <Zap className="w-5 h-5 text-brand-teal mt-1 flex-shrink-0" />
                                        <span>Підтримка історичних даних за будь-який період.</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-slate-700">
                                        <Zap className="w-5 h-5 text-brand-teal mt-1 flex-shrink-0" />
                                        <span>Можливість завантажувати конкретні МД за номером.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="lg:w-1/2 bg-slate-50 rounded-3xl p-8 border border-slate-200 aspect-video flex items-center justify-center overflow-hidden">
                                <div className="text-center">
                                    <div className="flex justify-center mb-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 bg-brand-teal rounded-full animate-ping opacity-20 absolute inset-0" />
                                            <div className="w-16 h-16 bg-brand-teal rounded-full flex items-center justify-center relative shadow-lg">
                                                <RefreshCw className="w-8 h-8 text-white animate-spin-slow" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-slate-400 font-mono">CONNECTING TO CUSTOMS API...</div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2 */}
                        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
                            <div className="lg:w-1/2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold uppercase mb-6">
                                    <Download className="w-3 h-3" />
                                    Готові звіти
                                </div>
                                <h2 className="text-3xl font-extrabold text-brand-blue mb-6">Експорт без помилок</h2>
                                <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                                    Наша система автоматично розпізнає понад 50 типів граф митної декларації та конвертує їх у чистий Excel-файл. Ви можете вивантажувати загальні дані або детальні специфікації товарів.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                                        <div className="text-brand-blue font-bold mb-1">Митна вартість</div>
                                        <div className="text-xs text-slate-500">Автоматичний перерахунок у UAH</div>
                                    </div>
                                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                                        <div className="text-brand-blue font-bold mb-1">Коди товарів</div>
                                        <div className="text-xs text-slate-500">Коректна обробка УКТЗЕД</div>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2 bg-slate-900 rounded-3xl p-8 border border-slate-800 aspect-video shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/20 to-transparent opacity-50" />
                                <div className="relative">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="w-3 h-3 rounded-full bg-slate-700" />
                                        <div className="w-3 h-3 rounded-full bg-slate-700" />
                                        <div className="w-3 h-3 rounded-full bg-slate-700" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="h-4 w-3/4 bg-slate-800 rounded animate-pulse" />
                                        <div className="grid grid-cols-4 gap-2">
                                            {[...Array(12)].map((_, i) => (
                                                <div key={i} className="h-8 bg-slate-800 rounded opacity-40" />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="absolute bottom-4 right-4 group-hover:scale-105 transition-transform">
                                        <div className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg">
                                            <Download className="w-4 h-4" />
                                            Export_Complete.xlsx
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <LandingFooter />
        </div>
    );
}
