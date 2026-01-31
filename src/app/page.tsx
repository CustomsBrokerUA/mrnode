import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import Link from "next/link";
import { ArrowRight, RefreshCw, FileSpreadsheet, ShieldCheck, ChevronRight } from "lucide-react";
import { DemoButton } from "@/components/landing/demo-button";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-brand-teal selection:text-white">
      <LandingHeader />

      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-24 lg:pt-48 lg:pb-32 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-teal/10 text-brand-teal text-xs font-semibold uppercase tracking-wider mb-8">
                <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
                BETA Версія 2.0
              </div>
              <h1 className="text-4xl lg:text-6xl font-extrabold text-brand-blue mb-6 leading-tight">
                Автоматизація митної звітності <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-teal">
                  без зайвих зусиль
                </span>
              </h1>
              <p className="text-lg lg:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                MRNode — це екосистема для брокерів та бухгалтерів. Синхронізуйте декларації з митниці та експортуйте в облікові системи за лічені секунди.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {session?.user ? (
                  <Link
                    href="/dashboard"
                    className="w-full sm:w-auto px-8 py-4 bg-brand-teal text-white font-semibold rounded-xl hover:bg-cyan-500 transition-all shadow-xl shadow-brand-teal/30 flex items-center justify-center gap-2 group"
                  >
                    Перейти в дашборд
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                ) : (
                  <Link
                    href="/register"
                    className="w-full sm:w-auto px-8 py-4 bg-brand-teal text-white font-semibold rounded-xl hover:bg-cyan-500 transition-all shadow-xl shadow-brand-teal/30 flex items-center justify-center gap-2 group"
                  >
                    Розпочати безкоштовно
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
                {!session?.user && (
                  <DemoButton
                    className="w-full sm:w-auto"
                    variant="outline"
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-brand-blue mb-4">Все необхідне в одному місці</h2>
              <p className="text-slate-600">
                Забудьте про ручне перенесення даних. MRNode бере рутину на себе.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6 text-brand-blue">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Автоматична синхронізація</h3>
                <p className="text-slate-600 leading-relaxed">
                  Пряме з'єднання з API Держмитслужби. Запити 60.1 та 61.1 виконуються автоматично за розкладом або вручну.
                </p>
              </div>
              {/* Feature 2 */}
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mb-6 text-brand-teal">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Експорт в облікові системи</h3>
                <p className="text-slate-600 leading-relaxed">
                  Гнучкий конструктор експорту. Налаштуйте колонки Excel один раз і завантажуйте дані в бухгалтерію без помилок.
                </p>
              </div>
              {/* Feature 3 */}
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6 text-indigo-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Максимальна безпека</h3>
                <p className="text-slate-600 leading-relaxed">
                  Ваші токени доступу шифруються алгоритмом AES-256. Ми не передаємо ваші комерційні дані третім особам.
                </p>
              </div>
            </div>
            <div className="text-center mt-12">
              <Link href="/features" className="inline-flex items-center gap-2 text-brand-blue font-semibold hover:underline">
                Більше про наші можливості <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24 overflow-hidden">
          <div className="container mx-auto px-4 text-slate-900">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2">
                <h2 className="text-3xl font-bold text-brand-blue mb-6">Як почати користуватися?</h2>
                <div className="space-y-8">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold">1</div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-900 mb-1">Створіть акаунт</h4>
                      <p className="text-slate-600">Швидка реєстрація та налаштування профілю компанії.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-brand-blue flex items-center justify-center font-bold">2</div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-900 mb-1">Додайте токен</h4>
                      <p className="text-slate-600">Введіть токен доступу до митниці. Ми збережемо його в зашифрованому вигляді.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-brand-blue flex items-center justify-center font-bold">3</div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-900 mb-1">Отримайте дані</h4>
                      <p className="text-slate-600">Натисніть "Синхронізувати" і отримайте всі МД в зручному форматі.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-10">
                  <Link href="/register" className="text-brand-teal font-semibold hover:text-cyan-600 flex items-center gap-2">
                    Перейти до реєстрації <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <div className="lg:w-1/2 relative">
                {/* Decorative Elements */}
                <div className="absolute -top-10 -right-10 w-72 h-72 bg-brand-teal/20 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-brand-blue/20 rounded-full blur-3xl opacity-50" />

                {/* Abstract UI Representation */}
                <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
                  <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-32 bg-slate-100 rounded" />
                      <div className="h-8 w-24 bg-brand-teal rounded-lg opacity-20" />
                    </div>
                    <div className="h-32 w-full bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-3 text-slate-900">
                      <div className="h-3 w-full bg-slate-200 rounded opacity-50" />
                      <div className="h-3 w-3/4 bg-slate-200 rounded opacity-50" />
                      <div className="h-3 w-1/2 bg-slate-200 rounded opacity-50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-20 bg-blue-50 rounded-xl" />
                      <div className="h-20 bg-teal-50 rounded-xl" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
