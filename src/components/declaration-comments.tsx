'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import { MessageSquare, Send, Edit2, Trash2, X } from 'lucide-react';
import { getCommentsByDeclarationId, createComment, updateComment, deleteComment } from '@/actions/comments';

type Comment = {
    id: string;
    text: string;
    createdAt: Date;
    updatedAt: Date;
};

export default function DeclarationComments({ declarationId }: { declarationId: string }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    // Load comments
    useEffect(() => {
        loadComments();
    }, [declarationId]);

    const loadComments = async () => {
        setLoading(true);
        const result = await getCommentsByDeclarationId(declarationId);
        if (result.success && result.data) {
            setComments(result.data);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || isSubmitting) return;

        setIsSubmitting(true);
        const result = await createComment(declarationId, newComment);
        if (result.success) {
            setNewComment('');
            await loadComments();
        } else {
            alert(result.error || 'Помилка створення коментаря');
        }
        setIsSubmitting(false);
    };

    const handleEdit = (comment: Comment) => {
        setEditingId(comment.id);
        setEditText(comment.text);
    };

    const handleUpdate = async (commentId: string) => {
        if (!editText.trim()) return;

        const result = await updateComment(commentId, editText);
        if (result.success) {
            setEditingId(null);
            setEditText('');
            await loadComments();
        } else {
            alert(result.error || 'Помилка оновлення коментаря');
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm('Ви впевнені, що хочете видалити цей коментар?')) return;

        const result = await deleteComment(commentId);
        if (result.success) {
            await loadComments();
        } else {
            alert(result.error || 'Помилка видалення коментаря');
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString('uk-UA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-slate-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Коментарі</h3>
                    <span className="text-sm text-slate-500">({comments.length})</span>
                </div>
            </div>

            {/* Add comment form */}
            <div className="p-4 border-b border-slate-200">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Textarea
                        placeholder="Додати коментар..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px] resize-none"
                        disabled={isSubmitting}
                    />
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={!newComment.trim() || isSubmitting}
                            className="gap-2"
                        >
                            <Send className="w-4 h-4" />
                            Додати коментар
                        </Button>
                    </div>
                </form>
            </div>

            {/* Comments list */}
            <div className="divide-y divide-slate-200">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400"></div>
                        <p className="mt-2 text-sm">Завантаження коментарів...</p>
                    </div>
                ) : comments.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">Поки що немає коментарів</p>
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="p-4 hover:bg-slate-50 transition-colors">
                            {editingId === comment.id ? (
                                <div className="space-y-3">
                                    <Textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="min-h-[80px] resize-none"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setEditingId(null);
                                                setEditText('');
                                            }}
                                        >
                                            <X className="w-4 h-4" />
                                            Скасувати
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleUpdate(comment.id)}
                                            disabled={!editText.trim()}
                                        >
                                            Зберегти
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                                                {comment.text}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-2">
                                                {formatDate(comment.createdAt)}
                                                {comment.updatedAt.getTime() !== comment.createdAt.getTime() && (
                                                    <span className="ml-2">(відредаговано)</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(comment)}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(comment.id)}
                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
