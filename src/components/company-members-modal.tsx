'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
    Button, Badge, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui';
import { X, UserMinus, Shield, ShieldCheck, User, Mail, Search, CheckCircle2 } from 'lucide-react';
import { getCompanyMembers, updateMemberRole, removeCompanyMember, inviteUser } from '@/actions/companies';

// Temporary toast replacement until proper UI library is available
const toast = {
    success: (message: string) => alert(message),
    error: (message: string) => alert(message)
};

interface Member {
    userId: string;
    email: string;
    fullName: string | null;
    role: 'OWNER' | 'MEMBER' | 'VIEWER';
    joinedAt: Date;
}

interface CompanyMembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string;
    currentUserRole: 'OWNER' | 'MEMBER' | 'VIEWER';
}

export default function CompanyMembersModal({ isOpen, onClose, companyId, currentUserRole }: CompanyMembersModalProps) {
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [emailInvite, setEmailInvite] = useState('');
    const [roleInvite, setRoleInvite] = useState<'MEMBER' | 'VIEWER'>('MEMBER');
    const [isInviting, setIsInviting] = useState(false);

    // Confirmation dialog state
    const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

    const loadMembers = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getCompanyMembers(companyId);
            if (result.success && result.members) {
                // Cast string date to Date object if needed, usually server actions return Date
                setMembers(result.members as any);
            } else {
                toast.error(result.error || 'Не вдалося завантажити учасників');
            }
        } catch (error) {
            toast.error('Помилка завантаження');
        } finally {
            setIsLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        if (isOpen) {
            loadMembers();
        }
    }, [isOpen, loadMembers]);

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (newRole !== 'MEMBER' && newRole !== 'VIEWER') return;

        try {
            const result = await updateMemberRole(companyId, userId, newRole as 'MEMBER' | 'VIEWER');
            if (result.success) {
                toast.success('Роль оновлено');
                loadMembers();
            } else {
                toast.error(result.error || 'Помилка оновлення ролі');
            }
        } catch (error) {
            toast.error('Помилка');
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;

        try {
            const result = await removeCompanyMember(companyId, memberToRemove.userId);
            if (result.success) {
                toast.success('Учасника видалено');
                setMemberToRemove(null);
                loadMembers();
            } else {
                toast.error(result.error || 'Помилка видалення');
            }
        } catch (error) {
            toast.error('Помилка');
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailInvite) return;

        setIsInviting(true);
        try {
            const result = await inviteUser(companyId, emailInvite, roleInvite);

            if (result.success) {
                if (result.method === 'NOTIFICATION') {
                    toast.success(result.message || 'Користувача сповіщено!');
                    setEmailInvite('');
                } else if (result.token) {
                    // For development/demo purposes
                    const inviteLink = `${window.location.origin}/invite/${result.token}`;
                    navigator.clipboard.writeText(inviteLink);
                    toast.success(`Запрошення створено! Посилання скопійовано: ${inviteLink}`);
                    setEmailInvite('');
                } else {
                    toast.success('Запрошення надіслано');
                    setEmailInvite('');
                }
            } else {
                toast.error(result.error || 'Помилка надсилання запрошення');
            }
        } catch (error) {
            toast.error('Помилка');
        } finally {
            setIsInviting(false);
        }
    };

    const canManage = currentUserRole === 'OWNER';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Учасники компанії</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Invite Section */}
                    {canManage && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-medium mb-3">Запросити нового учасника</h3>
                            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                <div className="flex-1 relative w-full">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        placeholder="user@example.com"
                                        className="w-full pl-10 pr-4 h-11 text-base text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-sm transition-all"
                                        value={emailInvite}
                                        onChange={(e) => setEmailInvite(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <Select value={roleInvite} onValueChange={(v: any) => setRoleInvite(v)}>
                                        <SelectTrigger className="w-[140px] h-11 text-base">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MEMBER">Учасник</SelectItem>
                                            <SelectItem value="VIEWER">Переглядач</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="submit" size="lg" className="h-11 px-6 text-base whitespace-nowrap" disabled={isInviting || !emailInvite}>
                                        {isInviting ? '...' : 'Надіслати'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Members List */}
                    <div>
                        <div className="rounded-md border border-slate-200 dark:border-slate-800">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Користувач</TableHead>
                                        <TableHead>Роль</TableHead>
                                        <TableHead>Приєднався</TableHead>
                                        {canManage && <TableHead className="w-[100px]"></TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        [...Array(3)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><div className="h-4 w-32 bg-slate-200 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-4 w-20 bg-slate-200 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-4 w-24 bg-slate-200 rounded animate-pulse" /></TableCell>
                                                {canManage && <TableCell />}
                                            </TableRow>
                                        ))
                                    ) : (
                                        members.map((member) => (
                                            <TableRow key={member.userId}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-slate-900 dark:text-white">
                                                            {member.fullName || 'Без імені'}
                                                        </span>
                                                        <span className="text-xs text-slate-500">{member.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {member.role === 'OWNER' ? (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                            <ShieldCheck className="w-3 h-3 mr-1" /> Власник
                                                        </Badge>
                                                    ) : !canManage ? (
                                                        <Badge variant="secondary">
                                                            {member.role === 'MEMBER' ? 'Учасник' : 'Переглядач'}
                                                        </Badge>
                                                    ) : (
                                                        <Select
                                                            value={member.role}
                                                            onValueChange={(v: string) => handleRoleChange(member.userId, v)}
                                                        >
                                                            <SelectTrigger className="h-8 w-[130px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="MEMBER">Учасник</SelectItem>
                                                                <SelectItem value="VIEWER">Переглядач</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-500">
                                                    {new Date(member.joinedAt).toLocaleDateString()}
                                                </TableCell>
                                                {canManage && (
                                                    <TableCell>
                                                        {member.role !== 'OWNER' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => setMemberToRemove(member)}
                                                            >
                                                                <UserMinus className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* Remove Confirmation */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Видалити учасника?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ви впевнені, що хочете видалити <b>{memberToRemove?.email}</b> з компанії?
                            Вони втратять доступ до всіх даних компанії.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Скасувати</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveMember}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Видалити
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
