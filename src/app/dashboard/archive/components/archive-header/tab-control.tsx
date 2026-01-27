'use client';

import { cn } from "@/components/ui";

interface TabControlProps {
    active: boolean;
    onClick: () => void;
    label: string;
}

/**
 * Компонент для перемикання вкладок (табів).
 * Використовується для перемикання між списком 60.1 та списком 61.1.
 */
export function TabControl({ active, onClick, label }: TabControlProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-1.5 text-sm font-semibold rounded-md transition-all",
                active 
                    ? "bg-white dark:bg-slate-700 text-brand-blue dark:text-white shadow-sm" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
        >
            {label}
        </button>
    );
}
