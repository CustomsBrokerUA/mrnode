'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';
import { DeclarationWithRawData } from '../../types';
import { getMDNumber, getRawData } from '../../utils';
import { QuickPreview60 } from './quick-preview-60';
import { QuickPreview61 } from './quick-preview-61';

interface QuickPreviewModalProps {
    previewDoc: DeclarationWithRawData | null;
    activeTab: 'list60' | 'list61';
    onClose: () => void;
}

/**
 * Модальне вікно для швидкого попереднього перегляду декларації.
 * Відображає основну інформацію про декларацію та дозволяє перейти до повного перегляду.
 */
export function QuickPreviewModal({ previewDoc, activeTab, onClose }: QuickPreviewModalProps) {
    const router = useRouter();

    if (!previewDoc) return null;

    const handleOpenDetails = () => {
        onClose();
        router.push(`/dashboard/archive/${previewDoc.id}`);
    };

    const hasMappedData = activeTab === 'list61' && 'mappedData' in previewDoc && (previewDoc as any).mappedData;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
            <div 
                className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">
                            Швидкий перегляд декларації
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {getMDNumber(getRawData(previewDoc), previewDoc.mrn)}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="gap-1"
                    >
                        <X className="w-4 h-4" />
                        Закрити
                    </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {hasMappedData ? (
                        <QuickPreview61 doc={previewDoc as any} />
                    ) : (
                        <QuickPreview60 doc={previewDoc} />
                    )}
                </div>
                
                <div className="p-6 border-t border-slate-200 flex items-center justify-end">
                    <Button onClick={handleOpenDetails}>
                        Відкрити повні деталі
                    </Button>
                </div>
            </div>
        </div>
    );
}
