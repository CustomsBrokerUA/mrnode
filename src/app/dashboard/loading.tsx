export default function DashboardLoading() {
    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Page Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-2"></div>
                    <div className="h-4 w-96 bg-slate-200 rounded animate-pulse"></div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Завантаження дашборду...</span>
                        <span className="text-slate-500">Обробка статистики</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden relative">
                        <div 
                            className="h-full bg-brand-blue rounded-full absolute animate-shimmer"
                            style={{ width: '45%' }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Розрахунок статистики та аналітики...
                    </p>
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
                        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
                        <div className="h-8 w-32 bg-slate-200 rounded animate-pulse"></div>
                        <div className="h-3 w-16 bg-slate-100 rounded animate-pulse"></div>
                    </div>
                ))}
            </div>

            {/* Statistics Skeleton */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                <div className="h-6 w-48 bg-slate-200 rounded animate-pulse"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 bg-slate-100 rounded animate-pulse"></div>
                    ))}
                </div>
            </div>
        </div>
    );
}
