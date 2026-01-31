'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { logout } from "@/actions/logout";
import {
    LayoutDashboard,
    FileText,
    RefreshCw,
    Settings,
    LogOut,
    Menu,
    Bell,
    TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui";
import ExchangeRatesModal from "@/components/exchange-rates-modal";
import GlobalSyncProgress from "@/components/global-sync-progress";
import CompanySelector from "@/components/company-selector";
import CompanySwitchingLoader from "@/components/company-switching-loader";
import NotificationsPopover from "@/components/notifications-popover";
import { syncFromLastSync, triggerAutoSyncOnLogin } from "@/actions/sync-incremental";
import { getExchangeRatesForDate } from "@/actions/exchange-rates";

const sidebarItems = [
    { icon: LayoutDashboard, label: "Дашборд", href: "/dashboard" },
    { icon: FileText, label: "Архів МД", href: "/dashboard/archive" },
    { icon: RefreshCw, label: "Синхронізація", href: "/dashboard/sync" },
    { icon: Settings, label: "Налаштування", href: "/dashboard/settings" },
];

type UserProfile = {
    fullName: string | null;
    email: string;
    company: {
        name: string;
    } | null;
} | null;

export default function DashboardLayoutClient({
    children,
    userProfile
}: {
    children: React.ReactNode;
    userProfile: UserProfile;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isExchangeRatesModalOpen, setIsExchangeRatesModalOpen] = useState(false);
    const [isSyncButtonLoading, setIsSyncButtonLoading] = useState(false);
    const [usdRateToday, setUsdRateToday] = useState<number | null>(null);
    const [eurRateToday, setEurRateToday] = useState<number | null>(null);
    const [ratesTodayLoading, setRatesTodayLoading] = useState(false);
    const [autoSyncTriggered, setAutoSyncTriggered] = useState(false);
    const [isCompanySwitching, setIsCompanySwitching] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Listen for company switch events
    useEffect(() => {
        const handleSwitchStart = () => setIsCompanySwitching(true);
        const handleSwitchEnd = () => setIsCompanySwitching(false);

        window.addEventListener('companySwitchStart', handleSwitchStart);
        window.addEventListener('companySwitchEnd', handleSwitchEnd);

        return () => {
            window.removeEventListener('companySwitchStart', handleSwitchStart);
            window.removeEventListener('companySwitchEnd', handleSwitchEnd);
        };
    }, []);
    // Trigger auto-sync on login (only once)
    useEffect(() => {
        if (!autoSyncTriggered) {
            setAutoSyncTriggered(true);
            triggerAutoSyncOnLogin().then(result => {
                if (result.success) {
                    console.log('Auto-sync triggered:', result.message);
                } else if (result.error) {
                    console.log('Auto-sync skipped:', result.error || result.message);
                }
            });
        }
    }, [autoSyncTriggered]);

    useEffect(() => {
        setRatesTodayLoading(true);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        getExchangeRatesForDate(today)
            .then((rates) => {
                const usd = rates.find(r => r.currencyCode === 'USD')?.rate ?? null;
                const eur = rates.find(r => r.currencyCode === 'EUR')?.rate ?? null;
                setUsdRateToday(usd);
                setEurRateToday(eur);
            })
            .catch(() => {
                setUsdRateToday(null);
                setEurRateToday(null);
            })
            .finally(() => setRatesTodayLoading(false));
    }, []);

    const handleQuickSync = async () => {
        setIsSyncButtonLoading(true);
        try {
            const result = await syncFromLastSync();
            if (result.error) {
                alert(result.error);
            } else if (result.success) {
                // @ts-ignore
                alert(result.message || 'Синхронізація запущена');
                router.refresh();
            }
        } catch (error: any) {
            console.error("Error starting quick sync:", error);
            alert("Помилка запуску синхронізації");
        } finally {
            setIsSyncButtonLoading(false);
        }
    };

    // Get initials for avatar
    const getInitials = () => {
        if (userProfile?.fullName) {
            return userProfile.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        }
        if (userProfile?.email) {
            return userProfile.email.substring(0, 2).toUpperCase();
        }
        return 'U';
    };

    return (
        <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex" data-theme-test="container">
            {/* Mobile Overlay */}
            {!isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(true)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out ${!isSidebarOpen ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0'
                    }`}
            >
                <div className="h-screen flex flex-col overflow-hidden">
                    {/* Logo Area */}
                    <div className={`h-16 flex items-center ${isSidebarOpen ? 'px-6' : 'justify-center px-0'} border-b border-slate-200 dark:border-slate-800 transition-all duration-300 flex-shrink-0`}>
                        {isSidebarOpen ? (
                            <Link
                                href="/"
                                className="text-xl font-bold bg-gradient-to-r from-brand-teal to-cyan-400 bg-clip-text text-transparent"
                            >
                                MRNode
                            </Link>
                        ) : (
                            <Link
                                href="/"
                                className="text-xl font-bold text-brand-teal"
                            >
                                M
                            </Link>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                        {sidebarItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                        ? 'bg-brand-teal text-white shadow-lg shadow-brand-teal/20'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                                        }`}
                                    title={!isSidebarOpen ? item.label : undefined}
                                >
                                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-brand-blue dark:group-hover:text-white'}`} />
                                    {isSidebarOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User Profile Snippet (Bottom) */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                        <div className={`flex items-center gap-3 ${!isSidebarOpen ? 'justify-center' : ''}`}>
                            <div
                                className={`w-9 h-9 rounded-full bg-brand-blue flex items-center justify-center text-white font-medium border border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-brand-teal transition-colors`}
                                onClick={() => !isSidebarOpen && logout()}
                                title={!isSidebarOpen ? "Вийти" : undefined}
                            >
                                {getInitials()}
                            </div>
                            {isSidebarOpen && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{userProfile?.fullName || userProfile?.email || 'Користувач'}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userProfile?.company?.name || 'Компанія'}</p>
                                </div>
                            )}
                            {isSidebarOpen && (
                                <button
                                    onClick={() => logout()}
                                    className="text-slate-500 dark:text-slate-400 hover:text-brand-blue dark:hover:text-white transition-colors"
                                    title="Вийти"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div
                className={`flex-1 flex flex-col min-w-0 overflow-hidden ml-0 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}
            >
                {/* Global Sync Progress Bar */}
                <GlobalSyncProgress />

                {/* Demo Mode Banner */}
                {userProfile?.email === 'test@gmail.com' && (
                    <div className="bg-amber-50 border-b border-amber-200 py-2 px-4 flex items-center justify-between text-xs sm:text-sm font-medium text-amber-700">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Ви працюєте в Демо-режимі. Дані є фейковими.
                        </div>
                        <Link
                            href="/register"
                            className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-md transition-colors"
                        >
                            Створити свій акаунт
                        </Link>
                    </div>
                )}

                {/* Top Header */}
                <header className="sticky top-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-teal hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200 hidden sm:block">
                            Панель керування
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <CompanySelector />
                        <button
                            onClick={() => setIsExchangeRatesModalOpen(true)}
                            className="px-3 py-2 text-slate-700 dark:text-slate-200 hover:text-brand-blue dark:hover:text-brand-teal hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Курси валют"
                        >
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                <div className="flex items-center gap-2 text-xs font-mono">
                                    <span className="text-slate-500 dark:text-slate-400">USD</span>
                                    <span className="text-slate-900 dark:text-slate-100">
                                        {ratesTodayLoading ? '...' : (usdRateToday !== null ? usdRateToday.toFixed(4) : '—')}
                                    </span>
                                    <span className="text-slate-400">/</span>
                                    <span className="text-slate-500 dark:text-slate-400">EUR</span>
                                    <span className="text-slate-900 dark:text-slate-100">
                                        {ratesTodayLoading ? '...' : (eurRateToday !== null ? eurRateToday.toFixed(4) : '—')}
                                    </span>
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={handleQuickSync}
                            disabled={isSyncButtonLoading}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-teal hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Синхронізувати з останнього завантаження"
                        >
                            <RefreshCw className={`w-5 h-5 ${isSyncButtonLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <NotificationsPopover />
                    </div>
                </header>

                {/* Scrollable Page Content */}
                <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 lg:p-8">
                    {isCompanySwitching ? (
                        <div className="max-w-7xl mx-auto space-y-6">
                            <CompanySwitchingLoader />
                            {/* Skeleton for content below loader to mimic page structure */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-50">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 h-32 animate-pulse"></div>
                                ))}
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 h-64 animate-pulse opacity-50"></div>
                        </div>
                    ) : (
                        children
                    )}
                </main>
            </div>

            {/* Exchange Rates Modal */}
            <ExchangeRatesModal
                isOpen={isExchangeRatesModalOpen}
                onClose={() => setIsExchangeRatesModalOpen(false)}
            />
        </div>
    );
}
