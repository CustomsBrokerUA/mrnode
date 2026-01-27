'use client';

import { DeclarationWithRawData } from '../../types';
import { getRawData, getMDNumber, formatRegisteredDate } from '../../utils';
import { statusStyles, statusLabels } from '../../constants';

interface QuickPreview61Props {
    doc: DeclarationWithRawData & { mappedData: any; extractedData?: any };
}

/**
 * Компонент для швидкого попереднього перегляду декларації (список 61.1).
 * Відображає детальну інформацію про декларацію, включаючи відправника, отримувача та вартість.
 */
export function QuickPreview61({ doc }: QuickPreview61Props) {
    const mdNumber = getMDNumber(getRawData(doc), doc.mrn);
    const mappedData = doc.mappedData;
    const extractedData = doc.extractedData;
    
    const registeredDate = extractedData?.ccd_registered
        ? formatRegisteredDate(extractedData.ccd_registered)
        : formatRegisteredDate(getRawData(doc)?.ccd_registered);
    
    const status = getRawData(doc)?.ccd_status || doc.status;
    const isCleared = status === 'R';
    
    const type = extractedData
        ? [extractedData.ccd_01_01, extractedData.ccd_01_02, extractedData.ccd_01_03]
            .filter(Boolean)
            .join(' ') || '---'
        : (getRawData(doc)?.ccd_type || '---');
    
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
            </div>
            
            {mappedData?.header && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mappedData.header.consignor && (
                            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                                <div className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase mb-1">Відправник</div>
                                <div className="text-base font-medium text-slate-900 dark:text-slate-100">{mappedData.header.consignor}</div>
                            </div>
                        )}
                        {mappedData.header.consignee && (
                            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                                <div className="text-xs font-semibold text-green-600 dark:text-green-300 uppercase mb-1">Отримувач</div>
                                <div className="text-base font-medium text-slate-900 dark:text-slate-100">{mappedData.header.consignee}</div>
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {mappedData.header.invoiceValue && (
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Фактурна вартість</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {mappedData.header.invoiceValue.toLocaleString('uk-UA')} {mappedData.header.invoiceCurrency || '---'}
                                </div>
                            </div>
                        )}
                        {mappedData.goods && (
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Кількість товарів</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{mappedData.goods.length}</div>
                            </div>
                        )}
                        {mappedData.header.customsOffice && (
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Митниця</div>
                                <div className="text-base font-medium text-slate-900 dark:text-slate-100">{mappedData.header.customsOffice}</div>
                            </div>
                        )}
                    </div>
                    
                    {mappedData.header.declarantName && (
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Декларант</div>
                            <div className="text-base font-medium text-slate-900 dark:text-slate-100">{mappedData.header.declarantName}</div>
                        </div>
                    )}
                </>
            )}
            
            {getRawData(doc)?.guid && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">GUID</div>
                    <div className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all">{getRawData(doc)?.guid}</div>
                </div>
            )}
        </div>
    );
}
