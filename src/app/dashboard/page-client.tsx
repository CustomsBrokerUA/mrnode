'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { FileText, CheckCircle2, Clock, XCircle, DollarSign, Package, TrendingUp, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

type Analytics = {
    total: number;
    totalCustomsValue?: number;
    totalInvoiceValueUah?: number;
    avgCustomsValue?: number;
    totalItems?: number;
    trends?: Array<{
        date: string;
        count: number;
        customsValue: number;
    }>;
    topConsignors?: Array<{ name: string; count: number; totalValue: number }>;
    topConsignees?: Array<{ name: string; count: number; totalValue: number }>;
    topCustomsOffices?: Array<{ office: string; count: number; totalValue: number }>;
    topDeclarationTypes?: Array<{ type: string; count: number; totalValue: number }>;
    comparison?: {
        thisPeriodCount: number;
        lastPeriodCount: number;
        countChange: number;
        thisPeriodValue: number;
        lastPeriodValue: number;
        valueChange: number;
    };
} | null;

import CompanyFilter from '@/components/company-filter';
import { getDashboardAnalytics } from "@/actions/analytics";

export default function DashboardPageClient({
    analytics: initialAnalytics,
    activeCompanyId = ''
}: {
    analytics: Analytics,
    activeCompanyId?: string
}) {
    const [analytics, setAnalytics] = useState<Analytics>(initialAnalytics);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

    // Date range state
    const [dateRange, setDateRange] = useState<string>('30d');
    const [customDates, setCustomDates] = useState<{ from?: string; to?: string }>({});

    // Sync state with props when server-side data changes
    useEffect(() => {
        setAnalytics(initialAnalytics);
    }, [initialAnalytics]);

    const [dashboardSettings] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('dashboardSettings');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch {
                }
            }
        }
        return {
            statsGrid: true,
            statsCards: {
                total: true,
                customsValue: true,
                items: true
            },
            trendsChart: true,
            comparisonCard: true,
            financialSummary: true,
            topCustomsOffices: true,
            topDeclarationTypes: true,
        };
    });

    const refreshAnalytics = async (companyIds?: string[], range?: string, custom?: { from?: string; to?: string }) => {
        setIsRefreshing(true);
        try {
            const targetRange = range || dateRange;
            const targetCustom = custom || customDates;
            const targetCompanyIds = companyIds !== undefined ? companyIds : selectedCompanyIds;

            let dateFrom: string | undefined;
            let dateTo: string | undefined = new Date().toISOString();

            if (targetRange === '7d') {
                dateFrom = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString();
            } else if (targetRange === '30d') {
                dateFrom = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
            } else if (targetRange === 'month') {
                const now = new Date();
                dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            } else if (targetRange === 'lastMonth') {
                const now = new Date();
                dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
                dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
            } else if (targetRange === 'year') {
                dateFrom = new Date(new Date().setDate(new Date().getDate() - 365)).toISOString();
            } else if (targetRange === 'custom') {
                dateFrom = targetCustom.from;
                dateTo = targetCustom.to;
            }

            const newAnalytics = await getDashboardAnalytics({
                companyIds: targetCompanyIds,
                dateFrom,
                dateTo
            });
            setAnalytics(newAnalytics);
        } catch (error) {
            console.error("Error refreshing analytics:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleFilterChange = (companyIds: string[]) => {
        setSelectedCompanyIds(companyIds);
        refreshAnalytics(companyIds);
    };

    const handleDateRangeChange = (range: string) => {
        setDateRange(range);
        if (range !== 'custom') {
            refreshAnalytics(undefined, range);
        }
    };

    // Listen for storage changes to update settings
    useEffect(() => {
        const handleStorageChange = () => {
            // Placeholder for updates if needed
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('dashboardSettingsUpdated', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('dashboardSettingsUpdated', handleStorageChange);
        };
    }, []);

    if (!analytics) {
        return (
            <div className="space-y-8 max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Дашборд</h2>
                        <p className="text-slate-500 dark:text-slate-400">Завантаження даних...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        Аналітика декларацій 📊
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-lg">
                        {isRefreshing ? "Оновлення статистичних даних..." : "Огляд вашої митної діяльності"}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Date Range Selector */}
                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        {[
                            { id: '7d', label: '7 днів' },
                            { id: '30d', label: '30 днів' },
                            { id: 'month', label: 'Цей місяць' },
                            { id: 'year', label: 'Рік' },
                            { id: 'all', label: 'Все' }
                        ].map((range) => (
                            <button
                                key={range.id}
                                onClick={() => handleDateRangeChange(range.id)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${dateRange === range.id
                                    ? 'bg-slate-800 text-white shadow-md'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>

                    <CompanyFilter
                        onFilterChange={handleFilterChange}
                        activeCompanyId={activeCompanyId}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            {dashboardSettings.statsGrid && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatsCard
                        title="Всього МД"
                        value={analytics.total.toString()}
                        subtitle="Кількість оформлених декларацій"
                        icon={FileText}
                        color="blue"
                    />
                    {analytics.totalCustomsValue !== undefined && (
                        <StatsCard
                            title="Митна вартість"
                            value={`${(analytics.totalCustomsValue / 1000000).toFixed(2)}М`}
                            subtitle={`${analytics.totalCustomsValue.toLocaleString('uk-UA')} грн`}
                            icon={DollarSign}
                            color="green"
                        />
                    )}
                    {analytics.totalItems !== undefined && (
                        <StatsCard
                            title="Товари"
                            value={analytics.totalItems.toLocaleString('uk-UA')}
                            subtitle="Всього одиниць товарів"
                            icon={Package}
                            color="orange"
                        />
                    )}
                </div>
            )}

            {/* Main Content Area */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Trends Chart */}
                <div className="xl:col-span-2">
                    {dashboardSettings.trendsChart && analytics.trends && (
                        <Card className="h-full">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-blue-600" />
                                        Динаміка активності
                                    </CardTitle>
                                    <p className="text-sm text-slate-500 mt-1">Кількість МД за обраний період</p>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={analytics.trends}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                dy={10}
                                                tickFormatter={(value) => {
                                                    const date = new Date(value);
                                                    if (dateRange === 'year') {
                                                        const months = ['Січ', 'Лют', 'Бер', 'Квіт', 'Трав', 'Черв', 'Лип', 'Серп', 'Вер', 'Жовт', 'Лист', 'Груд'];
                                                        return `${months[date.getMonth()]}`;
                                                    }
                                                    return `${date.getDate()}.${date.getMonth() + 1}`;
                                                }}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                allowDecimals={false}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                hide={true}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                labelFormatter={(value) => new Date(value).toLocaleDateString('uk-UA')}
                                                itemSorter={(item) => (item.name === "Декларації" ? -1 : 1)}
                                                formatter={(value: any, name: any) => {
                                                    if (name === "Вартість") return [`${Number(value).toLocaleString('uk-UA')} грн`, name];
                                                    return [value, name];
                                                }}
                                            />
                                            <Area
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="customsValue"
                                                fill="#10b981"
                                                stroke="none"
                                                fillOpacity={0.1}
                                                name="Вартість"
                                            />
                                            <Line
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="count"
                                                stroke="#3b82f6"
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                                name="Декларації"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Comparison & Financial Hub */}
                <div className="space-y-6">
                    {dashboardSettings.comparisonCard && analytics.comparison && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Темпи росту</CardTitle>
                                <p className="text-sm text-slate-500">Порівняно з минулим періодом</p>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Декларації (шт)</span>
                                        <span className={`text-sm font-bold flex items-center ${analytics.comparison.countChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {analytics.comparison.countChange >= 0 ? '↑' : '↓'} {Math.abs(analytics.comparison.countChange)}%
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold">{analytics.comparison.thisPeriodCount}</div>
                                    <div className="text-xs text-slate-500 mt-1">Попередньо: {analytics.comparison.lastPeriodCount}</div>
                                </div>
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Митна вартість (грн)</span>
                                        <span className={`text-sm font-bold flex items-center ${analytics.comparison.valueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {analytics.comparison.valueChange >= 0 ? '↑' : '↓'} {Math.abs(analytics.comparison.valueChange)}%
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold">{(analytics.comparison.thisPeriodValue / 1000000).toFixed(2)}М</div>
                                    <div className="text-xs text-slate-500 mt-1">Попередньо: {(analytics.comparison.lastPeriodValue / 1000000).toFixed(2)}М</div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {dashboardSettings.financialSummary && analytics.totalInvoiceValueUah !== undefined && (
                        <StatsCard
                            title="Фактурна вартість (UAH)"
                            value={analytics.totalInvoiceValueUah.toLocaleString('uk-UA')}
                            subtitle={`Середній чек: ${Math.round(analytics.avgCustomsValue || 0).toLocaleString('uk-UA')} грн`}
                            icon={DollarSign}
                            color="purple"
                        />
                    )}
                </div>
            </div>

            {/* Top Lists */}
            {dashboardSettings.topCustomsOffices && dashboardSettings.topDeclarationTypes && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TopListCard
                        title="Топ митниць"
                        data={analytics.topCustomsOffices || []}
                        labelKey="office"
                        icon={BarChart3}
                    />
                    <TopListCard
                        title="Типи декларацій"
                        data={analytics.topDeclarationTypes || []}
                        labelKey="type"
                        icon={FileText}
                    />
                </div>
            )}
        </div>
    );
}

function StatsCard({ title, value, subtitle, icon: Icon, color }: any) {
    const colorStyles: any = {
        blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
        green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
        orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
        purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    };

    return (
        <Card className="border-none shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                        <div>
                            <h3 className="text-4xl font-extrabold text-slate-900 dark:text-white">{value}</h3>
                            {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">{subtitle}</p>}
                        </div>
                    </div>
                    <div className={`p-3 rounded-2xl ${colorStyles[color]}`}>
                        <Icon className="w-7 h-7" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TopListCard({ title, data, labelKey, icon: Icon }: any) {
    if (!data.length) return null;
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Icon className="w-5 h-5 text-blue-600" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
                    {data.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors group">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">
                                    {item[labelKey]}
                                </p>
                                <p className="text-xs text-slate-500">{item.count} МД</p>
                            </div>
                            <div className="text-right ml-4">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {Math.round(item.totalValue / 1000).toLocaleString('uk-UA')} тис.
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
