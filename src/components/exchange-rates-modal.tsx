'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { getExchangeRatesForDate, ExchangeRateData } from '@/actions/exchange-rates';

interface ExchangeRatesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ExchangeRatesModal({ isOpen, onClose }: ExchangeRatesModalProps) {
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [rates, setRates] = useState<ExchangeRateData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Завантажуємо курси при відкритті модального вікна
    useEffect(() => {
        if (isOpen) {
            loadExchangeRates();
        }
    }, [isOpen, selectedDate]);

    const loadExchangeRates = async () => {
        setLoading(true);
        setError(null);
        setRates([]);
        try {
            const date = new Date(selectedDate + 'T00:00:00'); // Додаємо час, щоб уникнути проблем з часовими поясами
            console.log('Loading exchange rates for date:', date.toISOString());
            const data = await getExchangeRatesForDate(date);
            console.log('Received exchange rates:', data.length);
            setRates(data);
            if (data.length === 0) {
                setError('Курси валют на вибрану дату не знайдено. Можливо, це вихідний день або дата в майбутньому.');
            }
        } catch (err) {
            setError('Помилка завантаження курсів валют');
            console.error('Error loading exchange rates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedDate(e.target.value);
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-brand-blue" />
                        <h2 className="text-xl font-bold text-slate-900">Курси валют</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Date Selector */}
                    <div className="mb-6 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-slate-500" />
                            <label className="text-sm font-medium text-slate-700">
                                Дата:
                            </label>
                        </div>
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={handleDateChange}
                            className="w-48"
                            max={new Date().toISOString().split('T')[0]}
                        />
                        <Button
                            onClick={loadExchangeRates}
                            disabled={loading}
                            size="sm"
                            variant="outline"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Завантаження...
                                </>
                            ) : (
                                'Оновити'
                            )}
                        </Button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Exchange Rates Table */}
                    {loading && rates.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
                        </div>
                    ) : rates.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            Курси валют на вибрану дату не знайдено
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            Код валюти
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            Назва валюти
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            Курс (грн)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {rates.map((rate, index) => (
                                        <tr 
                                            key={`${rate.currencyCode}-${index}`}
                                            className="hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                                {rate.currencyCode}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {rate.currencyName}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900 text-right font-mono">
                                                {rate.rate.toFixed(4)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 flex items-center justify-end">
                    <Button onClick={onClose} variant="outline">
                        Закрити
                    </Button>
                </div>
            </div>
        </div>
    );
}
