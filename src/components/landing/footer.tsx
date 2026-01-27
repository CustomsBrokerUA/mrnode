'use client';

import Link from "next/link";

export function LandingFooter() {
    return (
        <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-4 gap-8 mb-8">
                    <div className="col-span-1 md:col-span-2">
                        <Link href="/" className="text-xl font-bold text-white tracking-tight mb-4 block">MRNode</Link>
                        <p className="max-w-xs leading-relaxed">
                            Інноваційна платформа для автоматизації роботи з митними деклараціями.
                        </p>
                        <div className="mt-6 text-sm">
                            <p className="font-semibold text-white">ФОП Осташевський Андрій Олексійович</p>
                            <p>+380973691757</p>
                            <p>info@brokerua.com</p>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-4">Продукт</h4>
                        <ul className="space-y-2">
                            <li><Link href="/features" className="hover:text-white transition-colors">Можливості</Link></li>
                            <li><Link href="/pricing" className="hover:text-white transition-colors">Тарифи</Link></li>
                            <li><Link href="#" className="hover:text-white transition-colors">API (незабаром)</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-4">Компанія</h4>
                        <ul className="space-y-2">
                            <li><Link href="/about" className="hover:text-white transition-colors">Про нас</Link></li>
                            <li><Link href="/contacts" className="hover:text-white transition-colors">Контакти</Link></li>
                            <li><Link href="/privacy" className="hover:text-white transition-colors">Політика конфіденційності</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="pt-8 border-t border-slate-800 text-center md:text-left flex flex-col md:flex-row justify-between items-center">
                    <p>© {new Date().getFullYear()} MRNode. Всі права захищені.</p>
                    <div className="flex items-center gap-4 mt-4 md:mt-0">
                        {/* Social placeholders */}
                        <div className="w-8 h-8 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors cursor-pointer" />
                        <div className="w-8 h-8 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors cursor-pointer" />
                    </div>
                </div>
            </div>
        </footer>
    );
}
