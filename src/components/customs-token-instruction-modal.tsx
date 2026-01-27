'use client';

import { Button } from "@/components/ui";
import { X, ExternalLink, CheckCircle2, Key } from "lucide-react";

interface CustomsTokenInstructionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CustomsTokenInstructionModal({
    isOpen,
    onClose
}: CustomsTokenInstructionModalProps) {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-brand-teal/10 to-brand-blue/10">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-teal/20 p-2 rounded-lg">
                            <Key className="w-6 h-6 text-brand-teal" />
                        </div>
                        <h3 className="font-bold text-xl text-slate-900">Інструкція: Як отримати токен митниці</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg"
                        type="button"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-slate-700 leading-relaxed">
                            Токен митниці необхідний для автоматичного завантаження декларацій з порталу Державної Митної Служби. 
                            Дотримуйтесь покрокової інструкції нижче, щоб отримати або знайти ваш токен.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* Step 1 */}
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-brand-teal text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    1
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <h4 className="font-semibold text-slate-900">Вхід до Єдиного вікна митниці</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Зайдіть на сайт{' '}
                                    <a 
                                        href="https://cabinet.customs.gov.ua/login/cdspubliclist" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-brand-teal underline hover:text-brand-blue font-medium inline-flex items-center gap-1"
                                    >
                                        Єдиного вікна митниці
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                    {' '}за допомогою <strong>КЕП</strong> (Кваліфікована Електронна Підпис).
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-brand-teal text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    2
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <h4 className="font-semibold text-slate-900">Вибір вкладки "Бізнесу"</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Після входу оберіть вкладку <strong>"Бізнесу"</strong> у верхній частині інтерфейсу.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-brand-teal text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    3
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <h4 className="font-semibold text-slate-900">Перехід до "Моя акредитація"</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    У меню навігації знайдіть та оберіть розділ <strong>"Моя акредитація"</strong>.
                                </p>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-brand-teal text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    4
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <h4 className="font-semibold text-slate-900">Відкриття "Мої токени доступу"</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    У розділі "Моя акредитація" оберіть пункт <strong>"Мої токени доступу"</strong>.
                                </p>
                            </div>
                        </div>

                        {/* Step 5 */}
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-brand-teal text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    5
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <h4 className="font-semibold text-slate-900">Отримання токену</h4>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">Якщо у вас вже є токен:</p>
                                            <p className="text-xs text-slate-600">Натисніть кнопку <strong>"Шукати"</strong> та скопіюйте існуючий токен.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">Якщо токену немає:</p>
                                            <p className="text-xs text-slate-600">Натисніть кнопку <strong>"Згенерувати"</strong> та очікуйте створення нового токену.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 6 */}
                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-brand-teal text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    6
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <h4 className="font-semibold text-slate-900">Копіювання та вставка токену</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Скопіюйте отриманий токен (довгий рядок символів) та вставте його у відповідне поле в нашому додатку.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                            <div className="text-amber-600 text-lg">⚠️</div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-900 mb-1">Важливо для безпеки:</p>
                                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                                    <li>Нікому не передавайте ваш токен, окрім довірених сервісів</li>
                                    <li>Ми зберігаємо токен у зашифрованому вигляді за стандартом AES-256</li>
                                    <li>Якщо токен буде скомпрометований, негайно згенеруйте новий</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 pt-0 flex justify-end border-t border-slate-200">
                    <Button onClick={onClose} className="bg-brand-teal hover:bg-brand-blue">
                        Зрозуміло
                    </Button>
                </div>
            </div>
        </div>
    );
}
