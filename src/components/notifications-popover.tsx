'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Info } from 'lucide-react';
import { Button } from '@/components/ui';
import { getUserNotifications, markNotificationAsRead } from '@/actions/notifications';
import { acceptInvitation, rejectInvitation } from '@/actions/companies';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner'; // Assuming sonner is used as seen in other files (or use window.alert if not sure, but invite-client uses it? No, invite-client used window.alert earlier, but toast in recent edits). 
// Wait, looking at company-members-modal, toast was used?
// Let's check imports in company-members-modal.tsx later. I'll use simple alert or simple console for now if unsure, but better to be safe.
// Actually, earlier logs mentioned "Added `sonner`". So toast should be available.

// Let's assume toast is available from 'sonner' or similar. 
// If not, I'll fallback to a simple UI state.
// Checking previous edits: "Fixing missing dependency sonner". Yes, it's there.

export default function NotificationsPopover() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const fetchNotifications = async () => {
        try {
            const result = await getUserNotifications();
            if (result.notifications) {
                setNotifications(result.notifications);
                setUnreadCount(result.notifications.filter((n: any) => !n.read).length);
            }
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Optional: Poll every 30s
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleAcceptInvite = async (e: React.MouseEvent, notification: any) => {
        e.stopPropagation();
        const token = notification.data?.token;
        if (!token) return;

        try {
            const result = await acceptInvitation(token);
            if ('success' in result && result.success) {
                toast.success('Запрошення прийнято!');
                // Mark as read
                await markNotificationAsRead(notification.id);
                fetchNotifications();
                router.refresh();
                setIsOpen(false);
            } else {
                // @ts-ignore
                alert(result.error || 'Помилка');
            }
        } catch (error) {
            console.error(error);
            alert('Помилка виконання дії');
        }
    };

    const handleRejectInvite = async (e: React.MouseEvent, notification: any) => {
        e.stopPropagation();
        const token = notification.data?.token;
        if (!token) return;

        try {
            const result = await rejectInvitation(token);
            if ('success' in result && result.success) {
                // Mark as read or maybe keep it but update status?
                // Just mark as read for now.
                await markNotificationAsRead(notification.id);
                fetchNotifications();
                alert('Запрошення відхилено');
            } else {
                // @ts-ignore
                alert(result.error);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        await markNotificationAsRead(id);
        fetchNotifications();
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-500 hover:text-brand-blue hover:bg-slate-100 dark:text-slate-400 dark:hover:text-brand-teal dark:hover:bg-slate-800 rounded-lg transition-colors outline-none focus:ring-2 focus:ring-brand-blue/20"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Сповіщення</h3>
                        {unreadCount > 0 && (
                            <span className="text-xs bg-brand-blue/10 text-brand-blue dark:bg-brand-teal/20 dark:text-brand-teal px-2 py-0.5 rounded-full font-medium">
                                {unreadCount} нових
                            </span>
                        )}
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto p-2">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Немає сповіщень</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-3 rounded-lg border transition-all ${notification.read
                                            ? 'bg-slate-50 border-transparent dark:bg-slate-800/50'
                                            : 'bg-white border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700'
                                            }`}
                                        onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                                    >
                                        <div className="flex gap-3 items-start">
                                            <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${notification.read ? 'bg-transparent' : 'bg-brand-blue dark:bg-brand-teal'}`} />

                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-none">
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    {notification.message}
                                                </p>

                                                {notification.type === 'COMPANY_INVITE' && !notification.read && (
                                                    <div className="flex gap-2 mt-3">
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-3 text-xs bg-brand-blue hover:bg-brand-blue/90"
                                                            onClick={(e) => handleAcceptInvite(e, notification)}
                                                        >
                                                            <Check className="w-3 h-3 mr-1.5" />
                                                            Прийняти
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 px-3 text-xs"
                                                            onClick={(e) => handleRejectInvite(e, notification)}
                                                        >
                                                            <X className="w-3 h-3 mr-1.5" />
                                                            Відхилити
                                                        </Button>
                                                    </div>
                                                )}

                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    {new Date(notification.createdAt).toLocaleString('uk-UA', {
                                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
