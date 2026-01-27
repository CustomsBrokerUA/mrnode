'use client';

import { useTransition } from "react";
import { loginAsDemo } from "@/actions/login";
import { Button, cn } from "@/components/ui";
import { Loader2, Play } from "lucide-react";

interface DemoButtonProps {
    variant?: "primary" | "outline" | "ghost";
    className?: string;
    showIcon?: boolean;
    text?: string;
}

export function DemoButton({
    variant = "outline",
    className,
    showIcon = true,
    text = "Спробувати Демо"
}: DemoButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleDemoLogin = () => {
        startTransition(async () => {
            const result = await loginAsDemo();
            if (result?.error) {
                alert(result.error);
            }
        });
    };

    if (variant === "ghost") {
        return (
            <button
                onClick={handleDemoLogin}
                disabled={isPending}
                className={cn(
                    "hover:text-brand-blue transition-colors disabled:opacity-50 flex items-center gap-2",
                    className
                )}
            >
                {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                {text}
            </button>
        );
    }

    return (
        <Button
            onClick={handleDemoLogin}
            disabled={isPending}
            variant={variant === "primary" ? "primary" : "outline"}
            className={cn(
                variant === "primary"
                    ? "bg-white text-brand-blue hover:bg-slate-100 border-none shadow-lg"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50",
                "h-auto py-4 px-8 font-semibold rounded-xl",
                className
            )}
        >
            {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                showIcon && <Play className="mr-2 h-4 w-4 fill-current" />
            )}
            {text}
        </Button>
    );
}
