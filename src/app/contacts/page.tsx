'use client';

import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import { Mail, Phone, MapPin, Building, Clock } from "lucide-react";

export default function ContactsPage() {
    return (
        <div className="min-h-screen bg-white">
            <LandingHeader />
            <main className="pt-32 pb-24">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-brand-blue mb-6">Зв'яжіться з нами</h1>
                        <p className="text-xl text-slate-600 leading-relaxed">
                            Ми завжди відкриті до запитань, пропозицій щодо співпраці та фідбеку від наших користувачів.
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
                        <div className="space-y-8">
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
                                <h2 className="text-2xl font-bold text-brand-blue mb-8">Контактна інформація</h2>

                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-blue flex-shrink-0">
                                            <Building className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Організація</h4>
                                            <p className="text-slate-600">ФОП Осташевський Андрій Олексійович</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-blue flex-shrink-0">
                                            <Mail className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Електронна пошта</h4>
                                            <a href="mailto:info@brokerua.com" className="text-brand-teal hover:underline font-medium">info@brokerua.com</a>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-blue flex-shrink-0">
                                            <Phone className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Телефон</h4>
                                            <p className="text-slate-600">+380973691757</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-blue flex-shrink-0">
                                            <Clock className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Графік роботи</h4>
                                            <p className="text-slate-600">Пн-Пт: 09:00 - 18:00</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-100">
                            <h3 className="text-2xl font-bold text-brand-blue mb-6">Відправити повідомлення</h3>
                            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Ім'я</label>
                                        <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/50" placeholder="Іван" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Email</label>
                                        <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/50" placeholder="example@mail.com" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Тема</label>
                                    <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/50" placeholder="Питання щодо бета-тесту" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Повідомлення</label>
                                    <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/50 h-32" placeholder="Ваше повідомлення..." />
                                </div>
                                <button type="submit" className="w-full py-4 bg-brand-teal text-white font-bold rounded-xl hover:bg-cyan-600 transition-all shadow-lg shadow-brand-teal/20">
                                    Надіслати
                                </button>
                                <p className="text-xs text-center text-slate-500 mt-4">
                                    Натискаючи на кнопку, ви погоджуєтесь з обробкою персональних даних.
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
            <LandingFooter />
        </div>
    );
}
