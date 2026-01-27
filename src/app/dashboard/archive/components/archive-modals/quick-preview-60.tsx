'use client';

import { DeclarationWithRawData } from '../../types';
import { getRawData, getMDNumber, formatRegisteredDate } from '../../utils';
import { statusStyles, statusLabels } from '../../constants';

interface QuickPreview60Props {
    doc: DeclarationWithRawData;
}

/**
 * Компонент для швидкого попереднього перегляду декларації (список 60.1).
 * Відображає основну інформацію про декларацію без деталей товарів.
 */
export function QuickPreview60({ doc }: QuickPreview60Props) {
    const mdNumber = getMDNumber(getRawData(doc), doc.mrn);
    const registeredDate = formatRegisteredDate(getRawData(doc)?.ccd_registered);
    const status = getRawData(doc)?.ccd_status || doc.status;
    const isCleared = status === 'R';
    
    const type = getRawData(doc)?.ccd_type || 
        [getRawData(doc)?.ccd_01_01, getRawData(doc)?.ccd_01_02, getRawData(doc)?.ccd_01_03]
            .filter(Boolean)
            .join(' ') || '---';
    
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Номер МД</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">{mdNumber}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Дата реєстрації</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{registeredDate}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Статус</div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                        isCleared 
                            ? statusStyles.CLEARED 
                            : statusStyles[doc.status as keyof typeof statusStyles] || statusStyles.PROCESSING
                    }`}>
                        {isCleared ? 'Оформлена' : (statusLabels[doc.status as keyof typeof statusLabels] || status)}
                    </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Тип</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{type}</div>
                </div>
                {(() => {
                    const trn_all = getRawData(doc)?.trn_all;
                    if (!trn_all) return null;
                    const displayValue = typeof trn_all === 'string' 
                        ? trn_all.trim() 
                        : Array.isArray(trn_all) 
                            ? trn_all.filter(Boolean).join(', ')
                            : String(trn_all);
                    return displayValue ? (
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 md:col-span-2">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Транспорт</div>
                            <div className="text-base font-medium text-slate-900 dark:text-slate-100">{displayValue}</div>
                        </div>
                    ) : null;
                })()}
            </div>
            
            {getRawData(doc)?.guid && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">GUID</div>
                    <div className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all">{getRawData(doc)?.guid}</div>
                </div>
            )}
        </div>
    );
}
