'use client';

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Button,
    Input,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    Label,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    cn
} from "@/components/ui";
import { AlertTriangle, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { deleteAccount } from "@/actions/user";
import { logout } from "@/actions/logout";

export function DeleteAccountSection() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);

    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [deleteData, setDeleteData] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDelete = () => {
        setError(null);
        startTransition(async () => {
            const formData = new FormData();
            formData.append("password", password);
            formData.append("deleteData", deleteData.toString());

            const result = await deleteAccount(formData);

            if (result?.error) {
                setError(result.error);
            } else {
                // Success: close modal and logout
                setIsOpen(false);
                await logout();
                router.push("/");
            }
        });
    };

    return (
        <Card className="border-red-200 dark:border-red-900/30">
            <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2 text-lg">
                    <Trash2 className="w-5 h-5" />
                    Видалення облікового запису
                </CardTitle>
                <CardDescription>
                    Повне видалення вашого профілю та доступу до системи
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl p-4 mb-6">
                    <div className="flex gap-3 text-red-700 dark:text-red-400">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <div className="text-sm">
                            <p className="font-bold mb-1">Увага! Ця дія є незворотною.</p>
                            <p>Після видалення ви втратите доступ до всіх своїх даних, налаштувань та синхронізованих декларацій.</p>
                        </div>
                    </div>
                </div>

                <Button
                    variant="outline"
                    className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10 dark:border-red-900/30 focus:ring-red-500"
                    onClick={() => setIsOpen(true)}
                >
                    Видалити акаунт
                </Button>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                <span className="text-red-600">Підтвердження видалення</span>
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6">
                            <p className="text-sm text-slate-500">
                                Будь ласка, введіть пароль та оберіть параметри видалення для підтвердження.
                            </p>

                            <div className="space-y-4">
                                <label className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                                    <div className="pt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={deleteData}
                                            onChange={(e) => setDeleteData(e.target.checked)}
                                            className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                                        />
                                    </div>
                                    <div className="text-sm">
                                        <p className="font-bold text-slate-900 dark:text-slate-100">Видалити всі дані компанії</p>
                                        <p className="text-xs text-slate-500">Ми видалимо всі декларації та компанії, де ви є єдиним власником.</p>
                                    </div>
                                </label>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Введіть пароль для підтвердження</Label>
                                <div className="relative">
                                    <Input
                                        id="confirm-password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Пароль"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {error && <p className="text-xs font-medium text-red-500 mt-1">{error}</p>}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>
                                Скасувати
                            </Button>
                            <Button
                                variant="primary"
                                className="bg-red-600 hover:bg-red-700 border-none"
                                onClick={handleDelete}
                                disabled={!password || isPending}
                            >
                                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Остаточно видалити
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
