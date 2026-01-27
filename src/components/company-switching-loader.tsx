export default function CompanySwitchingLoader() {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300 font-medium text-lg">Зміна активної компанії...</span>
                    <span className="text-slate-500 dark:text-slate-400">Підготовка даних</span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden relative">
                    <div
                        className="h-full bg-brand-blue dark:bg-brand-teal rounded-full absolute animate-shimmer w-1/2"
                    ></div>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 mt-2">
                    <span>Парсинг декларацій</span>
                    <span>Оновлення статистики</span>
                    <span>Завантаження налаштувань</span>
                </div>
            </div>
        </div>
    );
}
