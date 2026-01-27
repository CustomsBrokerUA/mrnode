'use client';

import { useState, useEffect } from 'react';
import { X, History, User, Crown, Trash2, RotateCcw, UserPlus, UserMinus, Shield } from 'lucide-react';
import { getCompanyAuditLog } from '@/actions/companies';
import { Button } from '@/components/ui';

interface AuditLogEntry {
    id: string;
    userId: string;
    userName: string;
    action: string;
    targetUserId?: string | null;
    targetUserName?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    details?: string | null;
    createdAt: Date;
}

interface CompanyAuditLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string;
    companyName: string;
}

export default function CompanyAuditLogModal({
    isOpen,
    onClose,
    companyId,
    companyName
}: CompanyAuditLogModalProps) {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadLogs();
        }
    }, [isOpen, companyId]);

    const loadLogs = async () => {
        try {
            setIsLoading(true);
            const result = await getCompanyAuditLog(companyId, 50);
            if (result.success && result.logs) {
                setLogs(result.logs as AuditLogEntry[]);
            }
        } catch (error) {
            console.error('Error loading audit log:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE_COMPANY':
                return <UserPlus className="w-4 h-4 text-green-500" />;
            case 'DELETE_COMPANY':
                return <Trash2 className="w-4 h-4 text-red-500" />;
            case 'RESTORE_COMPANY':
                return <RotateCcw className="w-4 h-4 text-blue-500" />;
            case 'INVITE_USER':
                return <UserPlus className="w-4 h-4 text-blue-500" />;
            case 'ACCEPT_INVITATION':
                return <UserPlus className="w-4 h-4 text-green-500" />;
            case 'LEAVE_COMPANY':
                return <UserMinus className="w-4 h-4 text-orange-500" />;
            case 'REMOVE_MEMBER':
                return <UserMinus className="w-4 h-4 text-red-500" />;
            case 'CHANGE_ROLE':
                return <Shield className="w-4 h-4 text-purple-500" />;
            case 'CANCEL_INVITATION':
                return <X className="w-4 h-4 text-slate-500" />;
            default:
                return <History className="w-4 h-4 text-slate-400" />;
        }
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'CREATE_COMPANY':
                return 'Створення компанії';
            case 'DELETE_COMPANY':
                return 'Видалення компанії';
            case 'RESTORE_COMPANY':
                return 'Відновлення компанії';
            case 'INVITE_USER':
                return 'Запрошення користувача';
            case 'ACCEPT_INVITATION':
                return 'Прийняття запрошення';
            case 'LEAVE_COMPANY':
                return 'Вихід з компанії';
            case 'REMOVE_MEMBER':
                return 'Видалення учасника';
            case 'CHANGE_ROLE':
                return 'Зміна ролі';
            case 'CANCEL_INVITATION':
                return 'Скасування запрошення';
            default:
                return action;
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString('uk-UA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                Історія змін
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {companyName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="animate-pulse">
                                    <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                                </div>
                            ))}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12">
                            <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400">
                                Історія змін порожня
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            {getActionIcon(log.action)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {getActionLabel(log.action)}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    {formatDate(log.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                                                <span className="font-medium">{log.userName}</span>
                                                {log.details && `: ${log.details}`}
                                            </p>
                                            {log.targetUserName && (
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Користувач: {log.targetUserName}
                                                </p>
                                            )}
                                            {log.oldValue && log.newValue && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {log.oldValue} → {log.newValue}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
                    <Button variant="outline" onClick={onClose}>
                        Закрити
                    </Button>
                </div>
            </div>
        </div>
    );
}
