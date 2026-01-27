'use client';

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription, Label } from "@/components/ui";
import { Save, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Key, Building2, HelpCircle, FileSpreadsheet } from "lucide-react";
import { updateUserProfile, changeUserPassword } from "@/actions/user";
import { updateCustomsToken } from "@/actions/company";
import { getSyncSettings, updateSyncSettings, type SyncSettings } from "@/actions/company-settings";
import CustomsTokenInstructionModal from "@/components/customs-token-instruction-modal";
import { DEFAULT_EXPORT_COLUMNS } from "@/app/dashboard/archive/constants";
import { RefreshCw, Settings as SettingsIcon, Bell, Clock, LayoutGrid, Table, List, Monitor, BarChart3, PieChart, TrendingUp, DollarSign, Users, Building, FileText, Sun, Moon, GripVertical } from "lucide-react";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";

// D&D Kit imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type UserProfile = {
    fullName: string | null;
    email: string;
    role: string;
    createdAt: Date;
    company: {
        id: string;
        name: string;
        edrpou: string;
    } | null;
} | null;

type CompanyInfo = {
    id: string;
    name: string;
    edrpou: string;
    hasToken: boolean;
    isActive: boolean;
    createdAt: Date;
} | null;

export default function SettingsPageClient({
    userProfile,
    companyInfo
}: {
    userProfile: UserProfile;
    companyInfo: CompanyInfo;
}) {
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [isPendingProfile, startTransitionProfile] = useTransition();
    const [isPendingPassword, startTransitionPassword] = useTransition();
    const [isPendingToken, startTransitionToken] = useTransition();

    // Profile form state
    const [fullName, setFullName] = useState(userProfile?.fullName || '');
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Token form state
    const [customsToken, setCustomsToken] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [tokenMessage, setTokenMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

    // Export settings state
    const [exportColumns, setExportColumns] = useState<{ [key: string]: boolean }>(DEFAULT_EXPORT_COLUMNS);
    const [exportColumnOrder, setExportColumnOrder] = useState<string[]>(Object.keys(DEFAULT_EXPORT_COLUMNS));

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setExportColumnOrder((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Sync settings state
    const [isPendingSync, startTransitionSync] = useTransition();
    const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null);
    const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Interface settings state
    const [itemsPerPage, setItemsPerPage] = useState<number>(20);
    const [viewMode, setViewMode] = useState<'table' | 'cards' | 'compact'>('table');
    const [defaultTab, setDefaultTab] = useState<'list60' | 'list61'>('list61');
    const [interfaceMessage, setInterfaceMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Dashboard settings state
    const [dashboardSettings, setDashboardSettings] = useState({
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
        topDeclarationTypes: true
    });
    const [dashboardMessage, setDashboardMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Theme settings state - start with null to avoid hydration mismatch
    const [theme, setTheme] = useState<'light' | 'dark' | 'system' | null>(null);
    const [isThemeLoaded, setIsThemeLoaded] = useState(false);

    const applyTheme = (value: 'light' | 'dark' | 'system') => {
        if (typeof window === 'undefined') return;
        const root = document.documentElement;
        const body = document.body;

        // Remove all theme classes and data attributes
        root.classList.remove('light', 'dark');
        body.classList.remove('light', 'dark');
        root.removeAttribute('data-theme');
        body.removeAttribute('data-theme');

        if (value === 'light') {
            root.classList.add('light');
            body.classList.add('light');
            root.setAttribute('data-theme', 'light');
            body.setAttribute('data-theme', 'light');
        } else if (value === 'dark') {
            root.classList.add('dark');
            body.classList.add('dark');
            root.setAttribute('data-theme', 'dark');
            body.setAttribute('data-theme', 'dark');
        } else {
            // system
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                root.classList.add('dark');
                body.classList.add('dark');
                root.setAttribute('data-theme', 'dark');
                body.setAttribute('data-theme', 'dark');
            } else {
                root.setAttribute('data-theme', 'light');
                body.setAttribute('data-theme', 'light');
            }
        }

        // Force repaint
        void root.offsetHeight;

        // Dispatch event to update other components
        window.dispatchEvent(new Event('appThemeUpdated'));
    };

    // Load all settings from localStorage after mount
    React.useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') {
            // Theme
            const savedTheme = localStorage.getItem('appTheme');
            const initialTheme = (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') ? savedTheme : 'light';
            setTheme(initialTheme);
            applyTheme(initialTheme);

            // Export Settings
            const savedExportColumns = localStorage.getItem('exportColumns');
            if (savedExportColumns) {
                try {
                    const parsed = JSON.parse(savedExportColumns);
                    setExportColumns({ ...DEFAULT_EXPORT_COLUMNS, ...parsed });
                } catch (e) {
                    console.error("Error parsing exportColumns", e);
                }
            }

            const savedExportOrder = localStorage.getItem('exportColumnOrder');
            if (savedExportOrder) {
                try {
                    const parsedOrder = JSON.parse(savedExportOrder);
                    const defaultKeys = Object.keys(DEFAULT_EXPORT_COLUMNS);
                    const filteredOrder = parsedOrder.filter((key: string) => defaultKeys.includes(key));
                    const newKeys = defaultKeys.filter(key => !filteredOrder.includes(key));
                    setExportColumnOrder([...filteredOrder, ...newKeys]);
                } catch (e) {
                    console.error("Error parsing exportColumnOrder", e);
                }
            }

            // Interface Settings
            const savedItemsPerPage = localStorage.getItem('archiveItemsPerPage');
            if (savedItemsPerPage) setItemsPerPage(parseInt(savedItemsPerPage, 10));

            const savedViewMode = localStorage.getItem('archiveViewMode') as 'table' | 'cards' | 'compact';
            if (savedViewMode) setViewMode(savedViewMode);

            const savedDefaultTab = localStorage.getItem('archiveActiveTab') as 'list60' | 'list61';
            if (savedDefaultTab) setDefaultTab(savedDefaultTab);

            // Dashboard Settings
            const savedDashboard = localStorage.getItem('dashboardSettings');
            if (savedDashboard) {
                try {
                    setDashboardSettings(JSON.parse(savedDashboard));
                } catch (e) {
                    console.error("Error parsing dashboardSettings", e);
                }
            }

            setIsThemeLoaded(true);
        }
    }, []);

    React.useEffect(() => {
        if (theme && isThemeLoaded) {
            applyTheme(theme);

            // Listen for system theme changes
            if (theme === 'system' && typeof window !== 'undefined') {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                const handleChange = () => applyTheme('system');
                mediaQuery.addEventListener('change', handleChange);
                return () => mediaQuery.removeEventListener('change', handleChange);
            }
        }
    }, [theme, isThemeLoaded]);

    // Load sync settings on mount
    React.useEffect(() => {
        loadSyncSettings();
    }, []);

    const loadSyncSettings = async () => {
        const result = await getSyncSettings();
        if (result.success && result.settings) {
            setSyncSettings(result.settings);
        }
    };

    const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setProfileMessage(null);

        startTransitionProfile(async () => {
            const formData = new FormData();
            formData.append('fullName', fullName);

            const result = await updateUserProfile(formData);

            if (result?.error) {
                setProfileMessage({ type: 'error', text: result.error });
            } else if (result?.success) {
                setProfileMessage({ type: 'success', text: result.message || 'Профіль успішно оновлено' });
                router.refresh();
                // Clear message after 3 seconds
                setTimeout(() => setProfileMessage(null), 3000);
            }
        });
    };

    const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPasswordMessage(null);

        // Client-side validation
        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Паролі не співпадають' });
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Новий пароль має містити мінімум 6 символів' });
            return;
        }

        startTransitionPassword(async () => {
            const formData = new FormData();
            formData.append('currentPassword', currentPassword);
            formData.append('newPassword', newPassword);
            formData.append('confirmPassword', confirmPassword);

            const result = await changeUserPassword(formData);

            if (result?.error) {
                setPasswordMessage({ type: 'error', text: result.error });
            } else if (result?.success) {
                setPasswordMessage({ type: 'success', text: result.message || 'Пароль успішно змінено' });
                // Clear form
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                // Clear message after 3 seconds
                setTimeout(() => setPasswordMessage(null), 3000);
            }
        });
    };

    const handleTokenSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setTokenMessage(null);

        if (!customsToken.trim()) {
            setTokenMessage({ type: 'error', text: 'Токен не може бути порожнім' });
            return;
        }

        startTransitionToken(async () => {
            const formData = new FormData();
            formData.append('customsToken', customsToken.trim());

            const result = await updateCustomsToken(formData);

            if (result?.error) {
                setTokenMessage({ type: 'error', text: result.error });
            } else if (result?.success) {
                setTokenMessage({ type: 'success', text: result.message || 'Токен митниці успішно оновлено' });
                setCustomsToken('');
                router.refresh();
                // Clear message after 3 seconds
                setTimeout(() => setTokenMessage(null), 3000);
            }
        });
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Налаштування</h1>
                <p className="text-slate-500 dark:text-slate-400">Керування профілем та безпекою</p>
            </div>

            {/* Profile Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Ваш профіль</CardTitle>
                    <CardDescription>Основна інформація про користувача</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Ім'я</Label>
                            <Input
                                id="fullName"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Ваше ім'я"
                                disabled={isPendingProfile}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                value={userProfile?.email || ''}
                                disabled
                                className="bg-slate-50 dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">Роль</Label>
                            <Input
                                id="role"
                                value={userProfile?.role || 'BROKER'}
                                disabled
                                className="bg-slate-50 dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company">Компанія</Label>
                            <Input
                                id="company"
                                value={userProfile?.company?.name || 'Не вказано'}
                                disabled
                                className="bg-slate-50 dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="createdAt">Дата реєстрації</Label>
                            <Input
                                id="createdAt"
                                value={userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString('uk-UA') : ''}
                                disabled
                                className="bg-slate-50 dark:bg-slate-800"
                            />
                        </div>

                        {profileMessage && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${profileMessage.type === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                {profileMessage.type === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5" />
                                )}
                                <span className="text-sm">{profileMessage.text}</span>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <Button type="submit" disabled={isPendingProfile}>
                                <Save className="w-4 h-4 mr-2" />
                                {isPendingProfile ? 'Збереження...' : 'Зберегти зміни'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5" />
                        Зміна пароля
                    </CardTitle>
                    <CardDescription>Оновіть ваш пароль для безпеки облікового запису</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Поточний пароль</Label>
                            <div className="relative">
                                <Input
                                    id="currentPassword"
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Введіть поточний пароль"
                                    disabled={isPendingPassword}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    disabled={isPendingPassword}
                                >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Новий пароль</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNewPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Введіть новий пароль (мін. 6 символів)"
                                    disabled={isPendingPassword}
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    disabled={isPendingPassword}
                                >
                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Підтвердіть новий пароль</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Повторіть новий пароль"
                                    disabled={isPendingPassword}
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    disabled={isPendingPassword}
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {passwordMessage && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${passwordMessage.type === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                {passwordMessage.type === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5" />
                                )}
                                <span className="text-sm">{passwordMessage.text}</span>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <Button type="submit" disabled={isPendingPassword || !currentPassword || !newPassword || !confirmPassword}>
                                <Lock className="w-4 h-4 mr-2" />
                                {isPendingPassword ? 'Зміна пароля...' : 'Змінити пароль'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Company Settings */}
            {companyInfo && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="w-5 h-5" />
                            Налаштування компанії
                        </CardTitle>
                        <CardDescription>Керування даними компанії та токеном митниці</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Назва компанії</Label>
                            <Input
                                id="companyName"
                                value={companyInfo.name}
                                disabled
                                className="bg-slate-50 dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edrpou">ЄДРПОУ</Label>
                            <Input
                                id="edrpou"
                                value={companyInfo.edrpou}
                                disabled
                                className="bg-slate-50 dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyStatus">Статус</Label>
                            <Input
                                id="companyStatus"
                                value={companyInfo.isActive ? 'Активна' : 'Неактивна'}
                                disabled
                                className="bg-slate-50 dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyCreated">Дата реєстрації компанії</Label>
                            <Input
                                id="companyCreated"
                                value={new Date(companyInfo.createdAt).toLocaleDateString('uk-UA')}
                                disabled
                                className="bg-slate-50 dark:bg-slate-800"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Customs Token Settings */}
            {companyInfo && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="w-5 h-5" />
                            Токен митниці
                        </CardTitle>
                        <CardDescription>
                            {companyInfo.hasToken
                                ? "Оновіть токен для роботи з API Державної Митної Служби"
                                : "Встановіть токен для роботи з API Державної Митної Служби"
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleTokenSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="customsToken">
                                        Токен митниці {companyInfo.hasToken && <span className="text-xs text-slate-500">(Токен встановлено)</span>}
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() => setIsTokenModalOpen(true)}
                                        className="text-slate-400 hover:text-brand-teal transition-colors"
                                        title="Як отримати токен?"
                                    >
                                        <HelpCircle className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="customsToken"
                                        type={showToken ? "text" : "password"}
                                        value={customsToken}
                                        onChange={(e) => setCustomsToken(e.target.value)}
                                        placeholder={companyInfo.hasToken ? "Введіть новий токен" : "Введіть токен митниці"}
                                        disabled={isPendingToken}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(!showToken)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                        disabled={isPendingToken}
                                    >
                                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Токен використовується для автентифікації при запитах до API митниці.
                                    Зберігається у зашифрованому вигляді.
                                </p>
                            </div>

                            {tokenMessage && (
                                <div className={`flex items-center gap-2 p-3 rounded-lg ${tokenMessage.type === 'success'
                                    ? 'bg-green-50 text-green-800 border border-green-200'
                                    : 'bg-red-50 text-red-800 border border-red-200'
                                    }`}>
                                    {tokenMessage.type === 'success' ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5" />
                                    )}
                                    <span className="text-sm">{tokenMessage.text}</span>
                                </div>
                            )}

                            <div className="pt-2 flex justify-end">
                                <Button type="submit" disabled={isPendingToken || !customsToken.trim()}>
                                    <Key className="w-4 h-4 mr-2" />
                                    {isPendingToken ? 'Збереження...' : companyInfo.hasToken ? 'Оновити токен' : 'Встановити токен'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Export Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Налаштування експорту
                    </CardTitle>
                    <CardDescription>Оберіть поля, які будуть включатися в експорт в Excel за замовчуванням</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-900">Колонки для експорту (перетягуйте для зміни порядку):</h3>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setExportColumns({ ...DEFAULT_EXPORT_COLUMNS });
                                    }}
                                    className="text-xs"
                                >
                                    Вибрати всі
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        const empty: { [key: string]: boolean } = {};
                                        Object.keys(DEFAULT_EXPORT_COLUMNS).forEach(key => {
                                            empty[key] = false;
                                        });
                                        setExportColumns(empty);
                                    }}
                                    className="text-xs"
                                >
                                    Скинути всі
                                </Button>
                            </div>
                        </div>

                        {isMounted ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={exportColumnOrder}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {exportColumnOrder.map((key) => (
                                            <SortableExportItem
                                                key={key}
                                                id={key}
                                                checked={exportColumns[key] !== false}
                                                onChange={(checked) => setExportColumns(prev => ({ ...prev, [key]: checked }))}
                                                label={getExportLabel(key)}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {exportColumnOrder.map((key) => (
                                    <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                                        <div className="w-4 h-4 rounded bg-slate-200" />
                                        <div className="flex-1 text-sm text-slate-700">{getExportLabel(key)}</div>
                                        <div className="w-10 h-5 rounded bg-slate-200" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {exportMessage && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${exportMessage.type === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                {exportMessage.type === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5" />
                                )}
                                <span className="text-sm">{exportMessage.text}</span>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <Button
                                type="button"
                                onClick={() => {
                                    if (typeof window !== 'undefined') {
                                        localStorage.setItem('exportColumns', JSON.stringify(exportColumns));
                                        localStorage.setItem('exportColumnOrder', JSON.stringify(exportColumnOrder));
                                        setExportMessage({
                                            type: 'success',
                                            text: 'Налаштування експорту збережено'
                                        });
                                        setTimeout(() => setExportMessage(null), 3000);
                                    }
                                }}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Зберегти налаштування
                            </Button>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mt-4">
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                                <strong>Примітка:</strong> Ці налаштування застосовуються як значення за замовчуванням
                                при відкритті модального вікна експорту. Ви можете змінювати вибір колонок
                                для кожного окремого експорту безпосередньо в модальному вікні.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sync Settings */}
            {syncSettings && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <RefreshCw className="w-5 h-5" />
                            Налаштування синхронізації
                        </CardTitle>
                        <CardDescription>Керування автоматичною синхронізацією та продуктивністю</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            setSyncMessage(null);

                            startTransitionSync(async () => {
                                const formData = new FormData(e.currentTarget);
                                const result = await updateSyncSettings(formData);

                                if (result?.error) {
                                    setSyncMessage({ type: 'error', text: result.error });
                                } else if (result?.success) {
                                    setSyncMessage({ type: 'success', text: result.message || 'Налаштування збережено' });
                                    await loadSyncSettings();
                                    setTimeout(() => setSyncMessage(null), 3000);
                                }
                            });
                        }} className="space-y-6">
                            {/* Automatic Sync */}
                            <div className="space-y-4 border-b border-slate-200 pb-4">
                                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <SettingsIcon className="w-4 h-4" />
                                    Автоматична синхронізація
                                </h3>

                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="autoSyncEnabled"
                                            checked={syncSettings.autoSyncEnabled}
                                            onChange={(e) => setSyncSettings({ ...syncSettings, autoSyncEnabled: e.target.checked })}
                                            className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium text-slate-900">Увімкнути автоматичну синхронізацію</span>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Синхронізація автоматично запускається при вході в систему і завантажує дані з моменту останнього завантаження до поточного моменту.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Data filter settings */}
                            <div className="space-y-4 border-b border-slate-200 pb-4">
                                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Фільтрація даних
                                </h3>

                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="showEeDeclarations"
                                            checked={syncSettings.showEeDeclarations}
                                            onChange={(e) => setSyncSettings({ ...syncSettings, showEeDeclarations: e.target.checked })}
                                            className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium text-slate-900">Показувати декларації ЕЕ</span>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Якщо вимкнено — декларації з типом, що закінчується на "ЕЕ", не відображаються в архіві, архівній статистиці та дашборді.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Performance Settings */}
                            <div className="space-y-4 border-b border-slate-200 pb-4">
                                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Налаштування продуктивності
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="requestDelay">Затримка між запитами (секунди)</Label>
                                        <input
                                            type="number"
                                            id="requestDelay"
                                            name="requestDelay"
                                            min="1"
                                            max="10"
                                            value={syncSettings.requestDelay}
                                            onChange={(e) => setSyncSettings({
                                                ...syncSettings,
                                                requestDelay: parseInt(e.target.value) || 2
                                            })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                                        />
                                        <p className="text-xs text-slate-500">Поточна: 2 секунди</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="chunkSize">Розмір chunk (днів)</Label>
                                        <select
                                            id="chunkSize"
                                            name="chunkSize"
                                            value={syncSettings.chunkSize}
                                            onChange={(e) => setSyncSettings({
                                                ...syncSettings,
                                                chunkSize: parseInt(e.target.value)
                                            })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                                        >
                                            <option value="3">3 дні</option>
                                            <option value="7">7 днів (рекомендовано)</option>
                                            <option value="14">14 днів</option>
                                            <option value="30">30 днів</option>
                                        </select>
                                        <p className="text-xs text-slate-500">Поточна: 7 днів</p>
                                    </div>
                                </div>
                            </div>

                            {/* Notifications */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <Bell className="w-4 h-4" />
                                    Сповіщення
                                </h3>

                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label>Email-сповіщення <span className="text-xs text-slate-400">(Поки не реалізовано)</span></Label>
                                        <p className="text-xs text-slate-500 mb-2">Функціонал email-сповіщень буде додано в майбутньому</p>
                                        <div className="space-y-2 ml-4 opacity-60">
                                            <label className="flex items-center gap-2 cursor-not-allowed">
                                                <input
                                                    type="checkbox"
                                                    name="emailNotifications.onSyncComplete"
                                                    checked={syncSettings.emailNotifications.onSyncComplete}
                                                    onChange={(e) => setSyncSettings({
                                                        ...syncSettings,
                                                        emailNotifications: {
                                                            ...syncSettings.emailNotifications,
                                                            onSyncComplete: e.target.checked
                                                        }
                                                    })}
                                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded"
                                                    disabled
                                                />
                                                <span className="text-sm text-slate-700">Про завершення синхронізації</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-not-allowed">
                                                <input
                                                    type="checkbox"
                                                    name="emailNotifications.onSyncError"
                                                    checked={syncSettings.emailNotifications.onSyncError}
                                                    onChange={(e) => setSyncSettings({
                                                        ...syncSettings,
                                                        emailNotifications: {
                                                            ...syncSettings.emailNotifications,
                                                            onSyncError: e.target.checked
                                                        }
                                                    })}
                                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded"
                                                    disabled
                                                />
                                                <span className="text-sm text-slate-700">Про помилки синхронізації</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-not-allowed">
                                                <input
                                                    type="checkbox"
                                                    name="emailNotifications.onCriticalError"
                                                    checked={syncSettings.emailNotifications.onCriticalError}
                                                    onChange={(e) => setSyncSettings({
                                                        ...syncSettings,
                                                        emailNotifications: {
                                                            ...syncSettings.emailNotifications,
                                                            onCriticalError: e.target.checked
                                                        }
                                                    })}
                                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded"
                                                    disabled
                                                />
                                                <span className="text-sm text-slate-700">Про критичні помилки (3+ помилок)</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-not-allowed">
                                            <input
                                                type="checkbox"
                                                name="browserNotifications"
                                                checked={syncSettings.browserNotifications}
                                                onChange={(e) => setSyncSettings({
                                                    ...syncSettings,
                                                    browserNotifications: e.target.checked
                                                })}
                                                className="w-4 h-4 text-brand-blue border-slate-300 rounded"
                                                disabled
                                            />
                                            <span className="text-sm font-medium text-slate-900">Браузерні сповіщення <span className="text-xs text-slate-400">(Поки не реалізовано)</span></span>
                                        </label>
                                        <p className="text-xs text-slate-500 ml-6">Функціонал браузерних сповіщень буде додано в майбутньому</p>
                                    </div>
                                </div>
                            </div>

                            {syncMessage && (
                                <div className={`flex items-center gap-2 p-3 rounded-lg ${syncMessage.type === 'success'
                                    ? 'bg-green-50 text-green-800 border border-green-200'
                                    : 'bg-red-50 text-red-800 border border-red-200'
                                    }`}>
                                    {syncMessage.type === 'success' ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5" />
                                    )}
                                    <span className="text-sm">{syncMessage.text}</span>
                                </div>
                            )}

                            <div className="pt-2 flex justify-end">
                                <Button type="submit" disabled={isPendingSync}>
                                    <Save className="w-4 h-4 mr-2" />
                                    {isPendingSync ? 'Збереження...' : 'Зберегти налаштування'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Interface Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Monitor className="w-5 h-5" />
                        Налаштування інтерфейсу
                    </CardTitle>
                    <CardDescription>Керування відображенням даних в архіві</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Items per page */}
                        <div className="space-y-2">
                            <Label htmlFor="itemsPerPage">Кількість елементів на сторінці</Label>
                            <select
                                id="itemsPerPage"
                                value={itemsPerPage}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    setItemsPerPage(value);
                                    if (typeof window !== 'undefined') {
                                        localStorage.setItem('archiveItemsPerPage', value.toString());
                                        setInterfaceMessage({
                                            type: 'success',
                                            text: 'Налаштування збережено. Зміни застосуються при наступному відкритті архіву.'
                                        });
                                        setTimeout(() => setInterfaceMessage(null), 3000);
                                    }
                                }}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                            >
                                <option value={20}>20 (за замовчуванням)</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                            </select>
                            <p className="text-xs text-slate-500">
                                Кількість декларацій, які відображаються на одній сторінці в архіві
                            </p>
                        </div>

                        {/* Default tab */}
                        <div className="space-y-2">
                            <Label>Активна вкладка за замовчуванням</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDefaultTab('list60');
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('archiveActiveTab', 'list60');
                                            setInterfaceMessage({
                                                type: 'success',
                                                text: 'Вкладка за замовчуванням збережена. Зміни застосуються при наступному відкритті архіву.'
                                            });
                                            setTimeout(() => setInterfaceMessage(null), 3000);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${defaultTab === 'list60'
                                        ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <FileText className="w-5 h-5" />
                                    <span className="text-sm font-medium">Список (60.1)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setDefaultTab('list61');
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('archiveActiveTab', 'list61');
                                            setInterfaceMessage({
                                                type: 'success',
                                                text: 'Вкладка за замовчуванням збережена. Зміни застосуються при наступному відкритті архіву.'
                                            });
                                            setTimeout(() => setInterfaceMessage(null), 3000);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${defaultTab === 'list61'
                                        ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <FileText className="w-5 h-5" />
                                    <span className="text-sm font-medium">Деталі (61.1)</span>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Вкладка, яка буде активна за замовчуванням при відкритті архіву
                            </p>
                        </div>

                        {/* View mode */}
                        <div className="space-y-2">
                            <Label>Режим відображення за замовчуванням</Label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewMode('table');
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('archiveViewMode', 'table');
                                            setInterfaceMessage({
                                                type: 'success',
                                                text: 'Режим відображення збережено. Зміни застосуються при наступному відкритті архіву.'
                                            });
                                            setTimeout(() => setInterfaceMessage(null), 3000);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${viewMode === 'table'
                                        ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <Table className="w-6 h-6" />
                                    <span className="text-sm font-medium">Таблиця</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewMode('cards');
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('archiveViewMode', 'cards');
                                            setInterfaceMessage({
                                                type: 'success',
                                                text: 'Режим відображення збережено. Зміни застосуються при наступному відкритті архіву.'
                                            });
                                            setTimeout(() => setInterfaceMessage(null), 3000);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${viewMode === 'cards'
                                        ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <LayoutGrid className="w-6 h-6" />
                                    <span className="text-sm font-medium">Картки</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewMode('compact');
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('archiveViewMode', 'compact');
                                            setInterfaceMessage({
                                                type: 'success',
                                                text: 'Режим відображення збережено. Зміни застосуються при наступному відкритті архіву.'
                                            });
                                            setTimeout(() => setInterfaceMessage(null), 3000);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${viewMode === 'compact'
                                        ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <List className="w-6 h-6" />
                                    <span className="text-sm font-medium">Компактний</span>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Режим відображення, який буде використовуватися за замовчуванням при відкритті архіву
                            </p>
                        </div>

                        {/* Theme */}
                        <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <Label>Тема оформлення</Label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTheme('light');
                                        applyTheme('light');
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('appTheme', 'light');
                                            window.dispatchEvent(new Event('appThemeUpdated'));
                                            setInterfaceMessage({
                                                type: 'success',
                                                text: 'Світла тема застосована'
                                            });
                                            setTimeout(() => setInterfaceMessage(null), 3000);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${theme === 'light'
                                        ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    suppressHydrationWarning
                                >
                                    <Sun className="w-6 h-6" />
                                    <span className="text-sm font-medium">Світла</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setTheme('dark');
                                        applyTheme('dark');
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('appTheme', 'dark');
                                            window.dispatchEvent(new Event('appThemeUpdated'));
                                            setInterfaceMessage({
                                                type: 'success',
                                                text: 'Темна тема застосована'
                                            });
                                            setTimeout(() => setInterfaceMessage(null), 3000);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${theme === 'dark'
                                        ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    suppressHydrationWarning
                                >
                                    <Moon className="w-6 h-6" />
                                    <span className="text-sm font-medium">Темна</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setTheme('system');
                                        applyTheme('system');
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('appTheme', 'system');
                                            window.dispatchEvent(new Event('appThemeUpdated'));
                                            setInterfaceMessage({
                                                type: 'success',
                                                text: 'Системна тема застосована'
                                            });
                                            setTimeout(() => setInterfaceMessage(null), 3000);
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${theme === 'system'
                                        ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    suppressHydrationWarning
                                >
                                    <Monitor className="w-6 h-6" />
                                    <span className="text-sm font-medium">Системна</span>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Тема інтерфейсу. Системна — підлаштовується під налаштування вашої ОС.
                            </p>
                        </div>

                        {interfaceMessage && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${interfaceMessage.type === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                {interfaceMessage.type === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5" />
                                )}
                                <span className="text-sm">{interfaceMessage.text}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Dashboard Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Налаштування дашборду
                    </CardTitle>
                    <CardDescription>Оберіть, які статистики відображати на головній сторінці</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Main sections */}
                        <div className="space-y-4">
                            <Label className="text-base font-semibold">Основні секції</Label>

                            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <BarChart3 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-slate-900">Сітка статистики</span>
                                        <p className="text-xs text-slate-500">Основні показники (кількість, вартість)</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={dashboardSettings.statsGrid}
                                    onChange={(e) => {
                                        const updated = { ...dashboardSettings, statsGrid: e.target.checked };
                                        setDashboardSettings(updated);
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('dashboardSettings', JSON.stringify(updated));
                                            // Dispatch custom event to update dashboard in same tab
                                            window.dispatchEvent(new Event('dashboardSettingsUpdated'));
                                            setDashboardMessage({ type: 'success', text: 'Налаштування збережено' });
                                            setTimeout(() => setDashboardMessage(null), 3000);
                                        }
                                    }}
                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-slate-900">Графік динаміки</span>
                                        <p className="text-xs text-slate-500">Тренди декларацій за обраний період</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={dashboardSettings.trendsChart}
                                    onChange={(e) => {
                                        const updated = { ...dashboardSettings, trendsChart: e.target.checked };
                                        setDashboardSettings(updated);
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('dashboardSettings', JSON.stringify(updated));
                                            window.dispatchEvent(new Event('dashboardSettingsUpdated'));
                                            setDashboardMessage({ type: 'success', text: 'Налаштування збережено' });
                                            setTimeout(() => setDashboardMessage(null), 3000);
                                        }
                                    }}
                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <BarChart3 className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-slate-900">Темпи росту</span>
                                        <p className="text-xs text-slate-500">Порівняння з попереднім аналогічним періодом</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={dashboardSettings.comparisonCard}
                                    onChange={(e) => {
                                        const updated = { ...dashboardSettings, comparisonCard: e.target.checked };
                                        setDashboardSettings(updated);
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('dashboardSettings', JSON.stringify(updated));
                                            window.dispatchEvent(new Event('dashboardSettingsUpdated'));
                                            setDashboardMessage({ type: 'success', text: 'Налаштування збережено' });
                                            setTimeout(() => setDashboardMessage(null), 3000);
                                        }
                                    }}
                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                                        <DollarSign className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-slate-900">Фінансова інформація</span>
                                        <p className="text-xs text-slate-500">Митна та фактурна вартість</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={dashboardSettings.financialSummary}
                                    onChange={(e) => {
                                        const updated = { ...dashboardSettings, financialSummary: e.target.checked };
                                        setDashboardSettings(updated);
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('dashboardSettings', JSON.stringify(updated));
                                            window.dispatchEvent(new Event('dashboardSettingsUpdated'));
                                            setDashboardMessage({ type: 'success', text: 'Налаштування збережено' });
                                            setTimeout(() => setDashboardMessage(null), 3000);
                                        }
                                    }}
                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                />
                            </label>
                        </div>

                        {/* Top lists */}
                        <div className="space-y-4 border-t border-slate-200 pt-4">
                            <Label className="text-base font-semibold">Топ-списки</Label>

                            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                        <Building className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-slate-900">Топ-10 митниць</span>
                                        <p className="text-xs text-slate-500">Найактивніші митниці</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={dashboardSettings.topCustomsOffices}
                                    onChange={(e) => {
                                        const updated = { ...dashboardSettings, topCustomsOffices: e.target.checked };
                                        setDashboardSettings(updated);
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('dashboardSettings', JSON.stringify(updated));
                                            // Dispatch custom event to update dashboard in same tab
                                            window.dispatchEvent(new Event('dashboardSettingsUpdated'));
                                            setDashboardMessage({ type: 'success', text: 'Налаштування збережено' });
                                            setTimeout(() => setDashboardMessage(null), 3000);
                                        }
                                    }}
                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-pink-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-slate-900">Топ-10 типів декларацій</span>
                                        <p className="text-xs text-slate-500">Найпоширеніші типи</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={dashboardSettings.topDeclarationTypes}
                                    onChange={(e) => {
                                        const updated = { ...dashboardSettings, topDeclarationTypes: e.target.checked };
                                        setDashboardSettings(updated);
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('dashboardSettings', JSON.stringify(updated));
                                            window.dispatchEvent(new Event('dashboardSettingsUpdated'));
                                            setDashboardMessage({ type: 'success', text: 'Налаштування збережено' });
                                            setTimeout(() => setDashboardMessage(null), 3000);
                                        }
                                    }}
                                    className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
                                />
                            </label>
                        </div>

                        {dashboardMessage && (
                            <div className={`flex items-center gap-2 p-3 rounded-lg ${dashboardMessage.type === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                                }`}>
                                {dashboardMessage.type === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5" />
                                )}
                                <span className="text-sm">{dashboardMessage.text}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone: Account Deletion */}
            <DeleteAccountSection />

            {/* Token Instruction Modal */}
            <CustomsTokenInstructionModal
                isOpen={isTokenModalOpen}
                onClose={() => setIsTokenModalOpen(false)}
            />
        </div>
    );
}

// Допоміжні функції та компоненти для експорту
function getExportLabel(key: string): string {
    const labels: { [key: string]: string } = {
        mdNumber: 'Номер МД',
        registeredDate: 'Дата реєстрації',
        status: 'Статус',
        type: 'Тип декларації',
        transport: 'Транспорт',
        consignor: 'Відправник',
        consignee: 'Отримувач',
        invoiceValue: 'Фактурна вартість (вал)',
        invoiceCurrency: 'Валюта контракту',
        goodsCount: 'Кількість товарів',
        customsOffice: 'Митниця',
        declarantName: 'Декларант',
        guid: 'GUID',
        mrn: 'MRN',
        goodsIndex: '№ товару',
        goodsDescription: 'Опис товару',
        goodsHSCode: 'Код УКТЗЕД',
        goodsPrice: 'Ціна товару (вал)',
        goodsInvoiceValueUah: 'Фактурна вартість грн',
        goodsInvoiceValueUsd: 'Фактурна вартість USD',
        goodsCustomsValue: 'Митна вартість грн',
        goodsPayments: 'Платежі по товару',
        invoiceNumber: '№ Інвойсу',
        invoiceDate: 'Дата інвойсу',
        cmrNumber: '№ CMR/Накладної',
        cmrDate: 'Дата CMR/Накладної',
        contractNumber: '№ Контракту',
        contractDate: 'Дата контракту',
        manufacturer: 'Виробник',
        invoiceValueCurrency: 'Фактурна вартість (валюта)',
        deliveryTermsIncoterms: 'Умови поставки (Інкотермс)',
        deliveryTermsDetails: 'Місце поставки',
        carrierName: 'Перевізник'
    };
    return labels[key] || key;
}

function SortableExportItem({ id, checked, onChange, label }: { id: string, checked: boolean, onChange: (checked: boolean) => void, label: string }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.6 : 1,
    };

    return (
        <label
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 p-3 rounded-lg border ${isDragging ? 'border-brand-blue bg-blue-50' : 'border-slate-200 hover:bg-slate-50'} cursor-pointer transition-colors group relative`}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-400 hover:text-slate-600 transition-colors"
                title="Перетягнути для зміни порядку"
            >
                <GripVertical className="w-4 h-4" />
            </div>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 text-brand-blue border-slate-300 rounded focus:ring-brand-blue"
            />
            <span className="text-sm font-medium text-slate-900 select-none">
                {label}
            </span>
        </label>
    );
}
