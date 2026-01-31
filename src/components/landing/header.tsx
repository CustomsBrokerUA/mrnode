import Link from "next/link";
import { DemoButton } from "./demo-button";
import { DemoAutoLogout } from "./demo-auto-logout";
import { auth } from "@/auth";

export async function LandingHeader() {
    const session = await auth();
    const userLabel = session?.user?.name || session?.user?.email || 'Профіль';

    return (
        <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
            <DemoAutoLogout email={session?.user?.email} />
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center">
                        <div className="w-3 h-3 bg-brand-teal rounded-full" />
                    </div>
                    <span className="text-xl font-bold text-brand-blue tracking-tight">MRNode</span>
                </Link>
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                    <Link href="/features" className="hover:text-brand-blue transition-colors">Можливості</Link>
                    <Link href="/#how-it-works" className="hover:text-brand-blue transition-colors">Як це працює</Link>
                    {!session?.user && (
                        <DemoButton variant="ghost" text="Демо" showIcon={false} className="text-sm font-medium text-slate-600" />
                    )}
                    <Link href="/pricing" className="hover:text-brand-blue transition-colors">Ціни</Link>
                </nav>
                <div className="flex items-center gap-4">
                    {session?.user ? (
                        <Link
                            href="/dashboard"
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-brand-blue hover:bg-white/60 rounded-lg transition-colors"
                            title="Перейти в дашборд"
                        >
                            {userLabel}
                        </Link>
                    ) : (
                        <>
                            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-brand-blue px-4 py-2">
                                Увійти
                            </Link>
                            <Link
                                href="/register"
                                className="px-5 py-2.5 bg-brand-blue text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-brand-blue/20"
                            >
                                Реєстрація
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
