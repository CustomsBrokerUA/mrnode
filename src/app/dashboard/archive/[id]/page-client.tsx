'use client';

import * as React from "react";
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Badge,
    cn
} from "@/components/ui";
import {
    ArrowLeft,
    FileText,
    Users,
    ShieldCheck,
    Truck,
    UserCircle,
    Info,
    X,
    Package,
    Scale,
    Globe,
    Zap,
    ListOrdered,
    Coins,
    Hash,
    Banknote,
    ShieldAlert,
    Calendar,
    LayoutGrid,
    ClipboardList,
    Calculator,
    FileCheck,
    Box,
    PackageOpen,
    CreditCard,
    History,
    LayoutList,
    Tags
} from "lucide-react";
import { useRouter } from "next/navigation";
import { mapXmlToDeclaration, parseRawOnly, MappedClient, MappedGoods } from "@/lib/xml-mapper";
import { getUSDExchangeRateForDate } from "@/lib/nbu-api";
import DeclarationComments from "@/components/declaration-comments";

type Declaration = {
    id: string;
    customsId: string | null;
    mrn: string | null;
    status: string;
    xmlData: string | null;
    date: Date;
};

export default function DeclarationDetailsClient({ declaration }: { declaration: Declaration }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = React.useState<'structured' | 'json' | 'raw' | 'protocol'>('structured');
    const [classicPage, setClassicPage] = React.useState<'md2' | 'md3' | 'back'>('md2');
    const [selectedGoods, setSelectedGoods] = React.useState<MappedGoods | null>(null);
    const [showDiagnostic, setShowDiagnostic] = React.useState(false);
    const [prevDocIndex, setPrevDocIndex] = React.useState(0);
    const [currentGoodIndex, setCurrentGoodIndex] = React.useState(0);
    const [showGoodsTable, setShowGoodsTable] = React.useState(false);
    const [showGraphCModal, setShowGraphCModal] = React.useState(false);
    const [showTotalPaymentsModal, setShowTotalPaymentsModal] = React.useState(false);
    const [showGoodSpecificationModal, setShowGoodSpecificationModal] = React.useState(false);
    const [expandedSpecIndex, setExpandedSpecIndex] = React.useState<number | null>(null);
    const [usdRate, setUsdRate] = React.useState<number | null>(null);
    const [usdRateLoading, setUsdRateLoading] = React.useState(false);

    // Map XML data
    // xmlData can be:
    // 1. JSON with { data60_1: {...}, data61_1: "<xml>..." } - new format
    // 2. XML string - old format (61.1 only)
    // 3. JSON string - old format (60.1 only)
    const xmlDataForMapping = React.useMemo(() => {
        if (!declaration.xmlData) return null;
        
        try {
            const trimmed = declaration.xmlData.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const parsed = JSON.parse(declaration.xmlData);
                // New format with both datasets
                if (parsed && typeof parsed === 'object' && parsed.data61_1) {
                    return parsed.data61_1; // Use 61.1 XML for detailed view
                }
                // Old format - might be 60.1 data only, but mapXmlToDeclaration expects XML
                return null;
            }
            // XML format (old or direct)
            return declaration.xmlData;
        } catch {
            // Not JSON, assume XML
            return declaration.xmlData;
        }
    }, [declaration.xmlData]);
    
    const mappedData = React.useMemo(() => mapXmlToDeclaration(xmlDataForMapping), [xmlDataForMapping]);

    // Load USD exchange rate
    React.useEffect(() => {
        const rateDate = mappedData?.header?.currencyRateDateRaw || mappedData?.header?.rawDate;
        if (rateDate) {
            setUsdRateLoading(true);
            getUSDExchangeRateForDate(rateDate)
                .then(rate => {
                    setUsdRate(rate);
                    setUsdRateLoading(false);
                })
                .catch(() => {
                    setUsdRate(null);
                    setUsdRateLoading(false);
                });
        }
    }, [mappedData?.header?.currencyRateDateRaw, mappedData?.header?.rawDate]);

    // Handle body scroll locking
    React.useEffect(() => {
        if (selectedGoods || showGoodsTable || showGraphCModal || showTotalPaymentsModal || showGoodSpecificationModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [selectedGoods, showGoodsTable, showGraphCModal, showTotalPaymentsModal, showGoodSpecificationModal]);

    // Reset prevDocIndex when switching goods
    React.useEffect(() => {
        setPrevDocIndex(0);
        setExpandedSpecIndex(null);
    }, [currentGoodIndex]);

    if (!mappedData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <FileText className="w-12 h-12 text-slate-300" />
                <div className="text-center">
                    <h3 className="text-lg font-medium">Дані відсутні або завантажуються</h3>
                    <p className="text-slate-500">Виконайте синхронізацію</p>
                </div>
                <Button variant="outline" onClick={() => router.back()}>Назад</Button>
            </div>
        );
    }

    const { header, goods, taxes, generalPayments, protocol, documents, banks, clients, paymentDocs, invoiceCosts, dccCosts, licenses, backContent, obligations, transports } = mappedData;

    // Calculate total payments sum
    const totalPaymentsSum = React.useMemo(() => {
        const sumByCurrency: Record<string, number> = {};
        generalPayments.forEach(payment => {
            const currency = payment.currency || 'UAH';
            sumByCurrency[currency] = (sumByCurrency[currency] || 0) + payment.amount;
        });
        return sumByCurrency;
    }, [generalPayments]);

    // Parse MD number from ccd_07_01, ccd_07_02, ccd_07_03
    const getMDNumber = () => {
        const part1 = mappedData.header.mdNumberPart1 || '---';
        const part2 = mappedData.header.mdNumberPart2 || '---';
        let part3 = mappedData.header.mdNumberPart3 || '---';
        
        // Pad part3 with leading zeros to ensure it's always 6 digits
        if (part3 !== '---' && /^\d+$/.test(part3)) {
            part3 = part3.padStart(6, '0');
        }
        
        return `${part1} / ${part2} / ${part3}`;
    };

    // Helper to get country name from code (ISO 3166-1 alpha-2)
    const getCountryName = (code: string): string => {
        if (!code || code === '---') return '---';
        const countryMap: Record<string, string> = {
            // Європа
            'UA': 'Україна', 'DE': 'Німеччина', 'PL': 'Польща', 'FR': 'Франція', 'IT': 'Італія',
            'GB': 'Великобританія', 'NL': 'Нідерланди', 'ES': 'Іспанія', 'BE': 'Бельгія', 'AT': 'Австрія',
            'CH': 'Швейцарія', 'SE': 'Швеція', 'NO': 'Норвегія', 'DK': 'Данія', 'FI': 'Фінляндія',
            'PT': 'Португалія', 'GR': 'Греція', 'IE': 'Ірландія', 'CZ': 'Чехія', 'SK': 'Словаччина',
            'HU': 'Угорщина', 'RO': 'Румунія', 'BG': 'Болгарія', 'HR': 'Хорватія', 'SI': 'Словенія',
            'LT': 'Литва', 'LV': 'Латвія', 'EE': 'Естонія', 'MT': 'Мальта', 'CY': 'Кіпр',
            'LU': 'Люксембург', 'IS': 'Ісландія', 'LI': 'Ліхтенштейн', 'MC': 'Монако', 'AD': 'Андорра',
            'SM': 'Сан-Марино', 'VA': 'Ватикан', 'AL': 'Албанія', 'BA': 'Боснія і Герцеговина',
            'ME': 'Чорногорія', 'MK': 'Північна Македонія', 'RS': 'Сербія', 'XK': 'Косово',
            'BY': 'Білорусь', 'MD': 'Молдова', 'RU': 'Росія', 'TR': 'Туреччина',
            
            // Азія
            'CN': 'Китай', 'JP': 'Японія', 'KR': 'Південна Корея', 'IN': 'Індія', 'ID': 'Індонезія',
            'TH': 'Таїланд', 'VN': 'В\'єтнам', 'MY': 'Малайзія', 'SG': 'Сінгапур', 'PH': 'Філіппіни',
            'TW': 'Тайвань', 'HK': 'Гонконг', 'MO': 'Макао', 'BN': 'Бруней', 'MM': 'М\'янма',
            'KH': 'Камбоджа', 'LA': 'Лаос', 'MN': 'Монголія', 'KP': 'Північна Корея',
            'PK': 'Пакистан', 'BD': 'Бангладеш', 'LK': 'Шрі-Ланка', 'NP': 'Непал', 'BT': 'Бутан',
            'AF': 'Афганістан', 'IR': 'Іран', 'IQ': 'Ірак', 'SA': 'Саудівська Аравія', 'AE': 'ОАЕ',
            'KW': 'Кувейт', 'QA': 'Катар', 'BH': 'Бахрейн', 'OM': 'Оман', 'YE': 'Ємен',
            'JO': 'Йорданія', 'LB': 'Ліван', 'SY': 'Сирія', 'IL': 'Ізраїль', 'PS': 'Палестина',
            'KZ': 'Казахстан', 'UZ': 'Узбекистан', 'TM': 'Туркменістан', 'TJ': 'Таджикистан',
            'KG': 'Киргизстан', 'GE': 'Грузія', 'AM': 'Вірменія', 'AZ': 'Азербайджан',
            
            // Америка
            'US': 'Сполучені Штати Америки', 'CA': 'Канада', 'MX': 'Мексика', 'BR': 'Бразилія',
            'AR': 'Аргентина', 'CL': 'Чилі', 'CO': 'Колумбія', 'PE': 'Перу', 'VE': 'Венесуела',
            'EC': 'Еквадор', 'BO': 'Болівія', 'PY': 'Парагвай', 'UY': 'Уругвай', 'GY': 'Гаяна',
            'SR': 'Суринам', 'GF': 'Французька Гвіана', 'FK': 'Фолклендські острови',
            'CR': 'Коста-Рика', 'PA': 'Панама', 'NI': 'Нікарагуа', 'HN': 'Гондурас',
            'GT': 'Гватемала', 'BZ': 'Беліз', 'SV': 'Сальвадор', 'CU': 'Куба', 'JM': 'Ямайка',
            'HT': 'Гаїті', 'DO': 'Домініканська Республіка', 'TT': 'Тринідад і Тобаго',
            'BB': 'Барбадос', 'BS': 'Багамські Острови', 'AG': 'Антигуа і Барбуда',
            'DM': 'Домініка', 'GD': 'Гренада', 'LC': 'Сент-Люсія', 'VC': 'Сент-Вінсент і Гренадини',
            'KN': 'Сент-Кітс і Невіс',
            
            // Африка
            'ZA': 'Південна Африка', 'EG': 'Єгипет', 'NG': 'Нігерія', 'KE': 'Кенія', 'ET': 'Ефіопія',
            'GH': 'Гана', 'TZ': 'Танзанія', 'UG': 'Уганда', 'AO': 'Ангола', 'MZ': 'Мозамбік',
            'ZM': 'Замбія', 'ZW': 'Зімбабве', 'BW': 'Ботсвана', 'NA': 'Намібія', 'SN': 'Сенегал',
            'CI': 'Кот-д\'Івуар', 'CM': 'Камерун', 'GA': 'Габон', 'CG': 'Республіка Конго',
            'CD': 'Демократична Республіка Конго', 'MA': 'Марокко', 'TN': 'Туніс', 'DZ': 'Алжир',
            'LY': 'Лівія', 'SD': 'Судан', 'SS': 'Південний Судан', 'ER': 'Еритрея', 'DJ': 'Джибуті',
            'SO': 'Сомалі', 'MG': 'Мадагаскар', 'MU': 'Маврикій', 'SC': 'Сейшели', 'KM': 'Комори',
            'MW': 'Малаві', 'RW': 'Руанда', 'BI': 'Бурунді', 'TD': 'Чад', 'NE': 'Нігер',
            'ML': 'Малі', 'BF': 'Буркіна-Фасо', 'GN': 'Гвінея', 'GW': 'Гвінея-Бісау', 'SL': 'Сьєрра-Леоне',
            'LR': 'Ліберія', 'TG': 'Того', 'BJ': 'Бенін', 'MR': 'Мавританія', 'GM': 'Гамбія',
            'CV': 'Кабо-Верде', 'ST': 'Сан-Томе і Принсіпі', 'GQ': 'Екваторіальна Гвінея',
            
            // Океанія
            'AU': 'Австралія', 'NZ': 'Нова Зеландія', 'PG': 'Папуа-Нова Гвінея', 'FJ': 'Фіджі',
            'NC': 'Нова Каледонія', 'PF': 'Французька Полінезія', 'GU': 'Гуам', 'AS': 'Американське Самоа',
            'WS': 'Самоа', 'TO': 'Тонга', 'VU': 'Вануату', 'SB': 'Соломонові Острови',
            'KI': 'Кірибаті', 'TV': 'Тувалу', 'NR': 'Науру', 'PW': 'Палау', 'FM': 'Мікронезія',
            'MH': 'Маршаллові Острови',
            
            // Інші
            'GL': 'Гренландія', 'FO': 'Фарерські острови', 'SJ': 'Шпіцберген і Ян-Маєн',
        };
        return countryMap[code.toUpperCase()] || code;
    };

    // Helper to resolve client box to title
    const getClientRole = (box: string) => {
        const roles: Record<string, string> = {
            "2": "Відправник (Consignor)",
            "8": "Одержувач (Consignee)",
            "9": "Особа, відп. за фін. врегулювання",
            "14": "Декларант",
            "50": "Принципал (Зобов'язана особа)",
        };
        return roles[box] || `Графа ${box}`;
    };

    // Decode package type
    const getPackageTypeLabel = (code: string) => {
        const types: Record<string, string> = {
            "0": "Кількість місць",
            "1": "Частина місця",
            "2": "Навал, насип, налив (трубопровід)",
            "3": "Упаковка (тара) за окремою ВМД",
        };
        return types[code] || code;
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20 relative">
            {/* Header / Actions */}
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="border border-slate-200 h-9 w-9 p-0">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold">МД: {header.mrn}</h1>
                            <Badge variant="success">{header.displayStatus}</Badge>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <TabControl active={activeTab === 'structured'} onClick={() => setActiveTab('structured')} label="ТАБЛИЦЯ ГРАФ" />
                    <TabControl active={activeTab === 'protocol'} onClick={() => setActiveTab('protocol')} label="ІСТОРІЯ СТАТУСІВ" />
                    <TabControl active={activeTab === 'json'} onClick={() => setActiveTab('json')} label="JSON (DEBUG)" />
                    <TabControl active={activeTab === 'raw'} onClick={() => setActiveTab('raw')} label="XML" />
                </div>
            </div>

            {activeTab === 'structured' ? (
                <div className="space-y-4">
                    {/* General Section - First Row */}
                    <SectionTitle title="Загальна інформація (Заголовки)" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Column: Box 2 - Sender/Exporter */}
                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                                <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase text-slate-500">Графа 2: Експортер / Відправник</span>
                                    </div>
                                </CardHeader>
                            <CardContent className="p-4">
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-slate-800 leading-tight">{header.consignor || '---'}</p>
                                    {clients.find(c => c.box === '2') && (
                                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                                            {clients.find(c => c.box === '2')?.code && (
                                                <p className="font-mono">ЄДРПОУ: <span className="font-bold text-slate-800">{clients.find(c => c.box === '2')?.code}</span></p>
                                            )}
                                            {clients.find(c => c.box === '2')?.address && (
                                                <p className="text-slate-500">{clients.find(c => c.box === '2')?.address}</p>
                                            )}
                                        </div>
                                    )}
                                    </div>
                            </CardContent>
                        </Card>

                        {/* Right Column: Split into two parts - left (1,3,4) and right (MD Number, MRN), then 5,6,7 full width below */}
                        <div className="space-y-3">
                            {/* Top row: Split into left (1,3,4) and right (MD Number, MRN) */}
                            <div className="grid grid-cols-[1fr_auto] gap-3">
                                {/* Left part: Boxes 1, 3, 4 */}
                                <div className="space-y-3">
                                    {/* Top Row: Box 1 */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                                        <CardContent className="p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Графа 1: Тип декларації</span>
                                                <span className="text-sm font-black text-brand-blue">{header.type || '---'}</span>
                                    </div>
                                        </CardContent>
                                    </Card>

                                    {/* Second Row: Boxes 3, 4 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Box 3 */}
                                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                                            <CardContent className="p-3">
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 3: Форми</span>
                                                    <p className="text-xs font-black text-slate-800">1 / {header.md8Sheets || '1'}</p>
                                        </div>
                                            </CardContent>
                                        </Card>

                                        {/* Box 4 */}
                                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                                            <CardContent className="p-3">
                                                <div className="space-y-1">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 4: Аркушів МД-8</span>
                                                    <p className="text-xs font-black text-slate-800">{header.md8Sheets || '0'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                    </div>
                                    </div>

                                {/* Right part: MD Number and MRN */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-3">
                                    <div>
                                                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Графа 7: Номер МД</span>
                                                <p className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono leading-tight mt-1">
                                                    {getMDNumber()}
                                                </p>
                                    </div>
                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                                                <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">MRN</span>
                                                <p className="text-[10px] font-black text-brand-blue dark:text-brand-teal font-mono leading-tight mt-1">{header.mrn || '---'}</p>
                                        </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Bottom row: Boxes 5, 6, 7 (internal number) - full width */}
                            <div className="grid grid-cols-3 gap-3">
                                {/* Box 5 */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 5: Всього товарів</span>
                                            <p className="text-xs font-black text-slate-800">{header.totalItems.toString()}</p>
                                    </div>
                                </CardContent>
                            </Card>

                                {/* Box 6 */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 6: Всього місць</span>
                                            <p className="text-xs font-black text-slate-800">{header.packagesCount || '0'}</p>
                            </div>
                                    </CardContent>
                                </Card>

                                {/* Box 7: Internal Number */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 7: Внутрішній №</span>
                                            <p className="text-xs font-black text-slate-800 font-mono">{header.internalNumber || '---'}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>

                    {/* Second Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Column: Box 8 - Consignee */}
                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                            <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase text-slate-500">Графа 8: Імпортер / Одержувач</span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-slate-800 leading-tight">{header.consignee || '---'}</p>
                                    {clients.find(c => c.box === '8') && (
                                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                                            {clients.find(c => c.box === '8')?.code && (
                                                <p className="font-mono">ЄДРПОУ: <span className="font-bold text-slate-800">{clients.find(c => c.box === '8')?.code}</span></p>
                                            )}
                                            {clients.find(c => c.box === '8')?.address && (
                                                <p className="text-slate-500">{clients.find(c => c.box === '8')?.address}</p>
                                            )}
                                        </div>
                            )}
                                </div>
                        </CardContent>
                    </Card>

                        {/* Right Column: Split into two rows */}
                        <div className="flex flex-col">
                            {/* Top row: Box 9 (70% height) */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm flex-[3] mb-3">
                                <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black uppercase text-slate-500">Графа 9: Особа відповідальна за фінанси</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-slate-800 leading-tight">{clients.find(c => c.box === '9')?.name || '---'}</p>
                                        {clients.find(c => c.box === '9') && (
                                            <div className="mt-3 space-y-1 text-xs text-slate-600">
                                                {clients.find(c => c.box === '9')?.code && (
                                                    <p className="font-mono">ЄДРПОУ: <span className="font-bold text-slate-800">{clients.find(c => c.box === '9')?.code}</span></p>
                                                )}
                                                {clients.find(c => c.box === '9')?.address && (
                                                    <p className="text-slate-500">{clients.find(c => c.box === '9')?.address}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                        </CardContent>
                    </Card>

                            {/* Bottom row: Boxes 10, 11, 12, 13 (30% height) - пропорції 20%:20%:40%:20% */}
                            <div className="grid grid-cols-[1fr_1fr_2fr_1fr] gap-3 flex-[1]">
                                {/* Box 10 - 20% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 10</span>
                                            <p className="text-xs font-black text-slate-800 break-words">---</p>
                    </div>
                                    </CardContent>
                                </Card>

                                {/* Box 11 - 20% */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 11: Торгуюча країна</span>
                                            <p className="text-xs font-black text-slate-800 break-words">{header.originCountryCode || '---'}</p>
                                        </div>
                                </CardContent>
                            </Card>

                                {/* Box 12 - 40% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 12: Митна вартість</span>
                                            <p className="text-xs font-black text-slate-800 break-words">{header.totalValue ? header.totalValue.toLocaleString() : '---'}</p>
                        </div>
                                    </CardContent>
                                </Card>

                                {/* Box 13 - 20% */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 13</span>
                                            <p className="text-xs font-black text-slate-800 break-words">---</p>
                                        </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    </div>

                    {/* Third Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Column: Box 14 - Declarant */}
                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                        <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase text-slate-500">Графа 14: Декларант / Представник</span>
                            </div>
                        </CardHeader>
                            <CardContent className="p-4">
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-slate-800 leading-tight">{clients.find(c => c.box === '14')?.name || header.declarantName || '---'}</p>
                                    {clients.find(c => c.box === '14') && (
                                        <div className="mt-3 space-y-1 text-xs text-slate-600">
                                            {clients.find(c => c.box === '14')?.code && (
                                                <p className="font-mono">ЄДРПОУ: <span className="font-bold text-slate-800">{clients.find(c => c.box === '14')?.code}</span></p>
                                            )}
                                            {clients.find(c => c.box === '14')?.address && (
                                                <p className="text-slate-500">{clients.find(c => c.box === '14')?.address}</p>
                                            )}
                                        </div>
                            )}
                                </div>
                        </CardContent>
                    </Card>

                        {/* Right Column: Split into two equal rows */}
                        <div className="flex flex-col">
                            {/* Top row: Boxes 15 (50%), 15a (25%), 17a (25%) */}
                            <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 mb-3">
                                {/* Box 15 - 50% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 15: Країна відправлення</span>
                                            <p className="text-xs font-black text-slate-800 break-words">{getCountryName(header.originCountryCode || '')}</p>
                    </div>
                                    </CardContent>
                                </Card>

                                {/* Box 15a - 25% */}
                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 15а: Код</span>
                                            <p className="text-xs font-black text-slate-800 font-mono">{header.originCountryCode || '---'}</p>
                                                </div>
                                    </CardContent>
                                </Card>

                                {/* Box 17a - 25% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 17а: Код</span>
                                            <p className="text-xs font-black text-slate-800 font-mono">{header.destCountryCode || '---'}</p>
                                            </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Bottom row: Boxes 16 (50%), 17 (50%) */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Box 16 - 50% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                                <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 16</span>
                                            <p className="text-xs font-black text-slate-800 break-words">---</p>
                                                </div>
                                    </CardContent>
                                </Card>

                                {/* Box 17 - 50% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                                <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 17: Країна призначення</span>
                                            <p className="text-xs font-black text-slate-800 break-words">{getCountryName(header.destCountryCode || '')}</p>
                                                </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>

                    {/* Fourth Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Column: Split into Box 18 (80%) and Box 19 (20%) */}
                        <div className="grid grid-cols-[4fr_1fr] gap-3">
                            {/* Box 18 - 80% */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm">
                                <CardContent className="p-3">
                                                <div className="space-y-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 18: ТЗ при відправленні</span>
                                        <p className="text-xs font-black text-slate-800 break-words">
                                            {transports.filter(t => t.box === '18').map(t => t.name).join(', ') || header.transportDetails || '---'}
                                        </p>
                                                </div>
                                </CardContent>
                            </Card>

                            {/* Box 19 - 20% */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm">
                                <CardContent className="p-3">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 19: Контейнер</span>
                                        <p className="text-xs font-black text-slate-800">{header.containersIndicator || '0'}</p>
                                            </div>
                                </CardContent>
                            </Card>
                                        </div>

                        {/* Right Column: Box 20 */}
                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                            <CardContent className="p-3">
                                <div className="space-y-1">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 20: Умови поставки</span>
                                    <p className="text-xs font-black text-slate-800 break-words">
                                        {[
                                            header.deliveryTerms || '',
                                            header.deliveryPlace || '',
                                            header.deliveryCountryCode ? `(${header.deliveryCountryCode})` : ''
                                        ].filter(Boolean).join(' ')}
                                        {!header.deliveryTerms && !header.deliveryPlace && '---'}
                                    </p>
                                </div>
                        </CardContent>
                    </Card>
                    </div>

                    {/* Fifth Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Column: Box 21 */}
                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                            <CardContent className="p-3">
                                <div className="space-y-1">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 21: ТЗ на кордоні</span>
                                    <p className="text-xs font-black text-slate-800 break-words">
                                        {transports.filter(t => t.box === '21').map(t => t.name).join(', ') || header.transportDetails || '---'}
                                    </p>
                    </div>
                            </CardContent>
                        </Card>

                        {/* Right Column: Boxes 22 (40%), 23 (30%), 24 (30%) */}
                        <div className="grid grid-cols-[4fr_3fr_3fr] gap-3">
                            {/* Box 22 - 50% */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm">
                                <CardContent className="p-3">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 22: Валюта / Сума</span>
                                        <p className="text-xs font-black text-slate-800 break-words">
                                            {header.invoiceCurrency ? `${header.invoiceCurrency} ${header.invoiceValue?.toLocaleString() || '0'}` : '---'}
                                        </p>
                                            </div>
                                </CardContent>
                            </Card>

                            {/* Box 23 - 25% */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm">
                                <CardContent className="p-3">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 23: Курс</span>
                                        <p className="text-xs font-black text-slate-800">{header.exchangeRate ? header.exchangeRate.toFixed(4) : '---'}</p>
                                        </div>
                                </CardContent>
                            </Card>

                            {/* Box 24 - 25% */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm">
                                <CardContent className="p-3">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 24: Характер угоди</span>
                                        <p className="text-xs font-black text-slate-800 break-words">
                                            {header.transactionCharacter ? `${header.transactionCharacter} / ${header.transactionCurrency || ''}`.trim() : '---'}
                                        </p>
                                </div>
                        </CardContent>
                    </Card>
                        </div>
                    </div>

                    {/* Sixth Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Column: Split into two rows */}
                        <div className="flex flex-col">
                            {/* Top row: Boxes 25 (25%), 26 (25%), 27 (50%) */}
                            <div className="grid grid-cols-[1fr_1fr_2fr] gap-3 mb-3">
                                {/* Box 25 - 25% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 25: ТЗ кордоні</span>
                                            <p className="text-xs font-black text-slate-800 break-words">{header.borderTransportMode || '---'}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Box 26 - 25% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 26: ТЗ внутрі</span>
                                            <p className="text-xs font-black text-slate-800 break-words">{header.inlandTransportMode || '---'}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Box 27 - 50% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 27: Митниця перевантаження</span>
                                            <p className="text-xs font-black text-slate-800 break-words">{header.transshipmentCustoms || '---'}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Bottom row: Boxes 29 (50%), 30 (50%) */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Box 29 - 50% */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 29: Митниця на кордоні</span>
                                            <p className="text-xs font-black text-slate-800 break-words">{header.borderCustoms || '---'}</p>
                    </div>
                                    </CardContent>
                                </Card>

                                {/* Box 30 - 50% */}
                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 30: Місце знах. товару</span>
                                            <p className="text-xs font-black text-slate-800 break-words">
                                                {[
                                                    header.inspectionPlace || '',
                                                    mappedData.header.custDest || ''
                                                ].filter(Boolean).join(' ') || '---'}
                                            </p>
                                                </div>
                        </CardContent>
                    </Card>
                </div>
                        </div>

                        {/* Right Column: Box 28 */}
                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                            <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-black uppercase text-slate-500">Графа 28: Банк</span>
                                </div>
                    </CardHeader>
                            <CardContent className="p-4">
                                <div className="space-y-2">
                                    {banks.find(b => b.box === '28') ? (
                                        <>
                                            <p className="text-sm font-bold text-slate-800 leading-tight">{banks.find(b => b.box === '28')?.name || '---'}</p>
                                            <div className="mt-3 space-y-1 text-xs text-slate-600">
                                                {banks.find(b => b.box === '28')?.mfo && (
                                                    <p className="font-mono">МФО: <span className="font-bold text-slate-800">{banks.find(b => b.box === '28')?.mfo}</span></p>
                                                )}
                                                {banks.find(b => b.box === '28')?.edrpou && (
                                                    <p className="font-mono">ЄДРПОУ: <span className="font-bold text-slate-800">{banks.find(b => b.box === '28')?.edrpou}</span></p>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm font-bold text-slate-800">---</p>
                                    )}
                                </div>
                    </CardContent>
                </Card>
                    </div>

                    {/* Goods Row - First Item */}
                    {goods.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left Column: Box 31 */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm flex-shrink-0" style={{ height: '300px' }}>
                                <CardHeader className="bg-slate-50 py-2 border-b border-slate-100 flex-shrink-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-[10px] font-black uppercase text-slate-500">Графа 31: Вантажні місця та опис товару</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {goods.length > 1 && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setCurrentGoodIndex(Math.max(0, currentGoodIndex - 1))}
                                                        disabled={currentGoodIndex === 0}
                                                        className="px-1.5 py-0.5 text-[8px] font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                                                    >
                                                        ‹
                                                    </button>
                                                    <span className="text-[8px] text-slate-500 font-mono px-1">
                                                        {currentGoodIndex + 1}/{goods.length}
                                                    </span>
                                                    <button
                                                        onClick={() => setCurrentGoodIndex(Math.min(goods.length - 1, currentGoodIndex + 1))}
                                                        disabled={currentGoodIndex >= goods.length - 1}
                                                        className="px-1.5 py-0.5 text-[8px] font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                                                    >
                                                        ›
                                                    </button>
                                    </div>
                                            )}
                                            <button
                                                onClick={() => setShowGoodsTable(true)}
                                                className="px-2 py-0.5 text-[8px] font-bold bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
                                                title="Переглянути всі товари"
                                            >
                                                <ListOrdered className="w-3 h-3" />
                                                Всі товари
                                            </button>
                                            {goods[currentGoodIndex]?.invoiceSpecification && goods[currentGoodIndex].invoiceSpecification.length > 0 && (
                                                <button
                                                    onClick={() => setShowGoodSpecificationModal(true)}
                                                    className="px-2 py-0.5 text-[8px] font-bold bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
                                                    title="Переглянути специфікацію товару"
                                                >
                                                    <FileText className="w-3 h-3" />
                                                    Специфікація
                                                </button>
                                            )}
                                    </div>
                                </div>
                                </CardHeader>
                                <CardContent className="p-4 overflow-y-auto" style={{ height: 'calc(300px - 42px)' }}>
                                    <p className="text-sm font-bold text-slate-800 leading-tight whitespace-pre-wrap">{goods[currentGoodIndex]?.description || '---'}</p>
                                    {/* Container info if exists */}
                                    {header.containersIndicator === '1' && goods[currentGoodIndex]?.containers && goods[currentGoodIndex].containers.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Package className="w-4 h-4 text-slate-400" />
                                                <span className="text-xs font-bold text-slate-500 uppercase">Контейнери:</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {goods[currentGoodIndex].containers.map((c: any, i: number) => {
                                                    const getContainerStatus = (isPart: string) => {
                                                        switch (isPart) {
                                                            case '1': return 'контейнер';
                                                            case '2': return 'частина контейнеру';
                                                            case '3': return 'є товари з цієї і іншої МД';
                                                            case '4': return 'є товари з іншої МД';
                                                            default: return '';
                                                        }
                                                    };
                                                    const status = getContainerStatus(c.isPart);
                                                    return (
                                                        <div key={i} className="bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs font-mono font-bold text-slate-700">{c.name}</span>
                                                                {c.type && c.type !== '---' && (
                                                                    <span className="text-[10px] text-slate-600 font-medium">Тип: {c.type}</span>
                                                                )}
                                                            </div>
                                                            {status && (
                                                                <span className="text-[10px] text-slate-500 italic block mt-0.5">{status}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Right Column: Multiple rows with goods data */}
                            <div className="space-y-2 min-w-0">
                                {/* First row: Boxes 32 (33%), 33 (34%), Export Control (33%) */}
                                <div className="grid grid-cols-[1fr_1.03fr_1fr] gap-1.5 min-w-0">
                                    {/* Box 32 - 33% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 32: Товар №</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight">{goods[currentGoodIndex]?.index || '1'}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Box 33 - 34% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 33: Код товару</span>
                                            <p className="text-[10px] font-black text-slate-800 font-mono leading-tight">{goods[currentGoodIndex]?.hsCode || '---'}</p>
                                            {goods[currentGoodIndex]?.exportControl && goods[currentGoodIndex].exportControl !== '---' && goods[currentGoodIndex].exportControl !== '0' && (
                                                <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">Експ. контроль: {goods[currentGoodIndex].exportControl}</p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Export Control - 33% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Ознака експортного контролю</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight">{goods[currentGoodIndex]?.exportControl && goods[currentGoodIndex].exportControl !== '0' ? goods[currentGoodIndex].exportControl : '---'}</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Second row: Boxes 34 (33%), 35 (34%), 36 (33%) */}
                                <div className="grid grid-cols-[1fr_1.03fr_1fr] gap-1.5 min-w-0">
                                    {/* Box 34 - 33% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 34: Країна походження</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight truncate">{goods[currentGoodIndex]?.originCountry || '---'}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Box 35 - 34% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 35: Брутто (кг)</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight">{goods[currentGoodIndex]?.grossWeight?.toLocaleString() || '0'}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Box 36 - 33% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 36: Преференції</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight truncate">
                                                {[
                                                    goods[currentGoodIndex]?.prefDuty || '',
                                                    goods[currentGoodIndex]?.prefExcise || '',
                                                    goods[currentGoodIndex]?.prefVat || ''
                                                ].filter(Boolean).join(' / ') || '---'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Third row: Boxes 37 (33%), 38 (34%), 39 (33%) */}
                                <div className="grid grid-cols-[1fr_1.03fr_1fr] gap-1.5 min-w-0">
                                    {/* Box 37 - 33% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 37: Процедура</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight truncate">
                                                {[
                                                    goods[currentGoodIndex]?.procedure || '',
                                                    goods[currentGoodIndex]?.prevProcedure || '',
                                                    goods[currentGoodIndex]?.procFeatures || '',
                                                    goods[currentGoodIndex]?.addProcFeature || ''
                                                ].filter(Boolean).join(' / ') || '---'}
                                            </p>
                                        </CardContent>
                                    </Card>

                                    {/* Box 38 - 34% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 38: Нетто (кг)</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight">{goods[currentGoodIndex]?.netWeight?.toLocaleString() || '0'}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Box 39 - 33% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 39: Квота</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight truncate">{goods[currentGoodIndex]?.quota || '---'}</p>
                                        </CardContent>
                                    </Card>
                                            </div>

                                {/* Fourth row: Box 40 - Previous Documents with switcher */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">Графа 40: Попередній документ</span>
                                                {goods[currentGoodIndex]?.prevDocs && goods[currentGoodIndex].prevDocs.length > 1 && (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setPrevDocIndex(Math.max(0, prevDocIndex - 1))}
                                                            disabled={prevDocIndex === 0}
                                                            className="px-1.5 py-0.5 text-[8px] font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                                                        >
                                                            ‹
                                                        </button>
                                                        <span className="text-[8px] text-slate-500 font-mono px-1">
                                                            {prevDocIndex + 1}/{goods[currentGoodIndex].prevDocs.length}
                                                        </span>
                                                        <button
                                                            onClick={() => setPrevDocIndex(Math.min((goods[currentGoodIndex].prevDocs?.length || 1) - 1, prevDocIndex + 1))}
                                                            disabled={prevDocIndex >= (goods[currentGoodIndex].prevDocs?.length || 1) - 1}
                                                            className="px-1.5 py-0.5 text-[8px] font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                                                        >
                                                            ›
                                                        </button>
                                        </div>
                                                )}
                                        </div>
                                            {goods[currentGoodIndex]?.prevDocs && goods[currentGoodIndex].prevDocs.length > 0 ? (
                                                <p className="text-xs font-black text-slate-800 break-words">
                                                    {[
                                                        goods[currentGoodIndex].prevDocs[prevDocIndex]?.code || '',
                                                        goods[currentGoodIndex].prevDocs[prevDocIndex]?.name || '',
                                                        goods[currentGoodIndex].prevDocs[prevDocIndex]?.date || '',
                                                        goods[currentGoodIndex].prevDocs[prevDocIndex]?.goodsNum || ''
                                                    ].filter(Boolean).join(' / ') || '---'}
                                                </p>
                                            ) : (
                                                <p className="text-xs font-black text-slate-800">---</p>
                                            )}
                                    </div>
                                    </CardContent>
                                </Card>

                                {/* Fifth row: Boxes 41 (40%), 42 (40%), 43 (20%) */}
                                <div className="grid grid-cols-[2fr_2fr_1fr] gap-1.5 min-w-0">
                                    {/* Box 41 - 40% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 41: Дод. одиниці</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight truncate">{goods[currentGoodIndex]?.additionalUnits || '---'}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Box 42 - 40% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 42: Ціна</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight">{goods[currentGoodIndex]?.price?.toLocaleString() || '0'}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Box 43 - 20% */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm min-w-0">
                                        <CardContent className="p-2">
                                            <span className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">Графа 43: Гарантія</span>
                                            <p className="text-[10px] font-black text-slate-800 leading-tight truncate">
                                                {[
                                                    goods[currentGoodIndex]?.guaranteeCode || '',
                                                    goods[currentGoodIndex]?.guaranteeRelease || ''
                                                ].filter(Boolean).join(' / ') || '---'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                        </div>
                                                </div>
                                        </div>
                    )}

                    {/* Eighth Row: Documents, Payments, Calculations */}
                    {goods.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                            {/* Left Column: Two rows - 44 (70%) and 47 (30%) */}
                            <div className="flex flex-col gap-3 h-full">
                                {/* Graph 44 - Documents (70%) */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm flex-shrink-0" style={{ height: '300px' }}>
                                    <CardHeader className="bg-slate-50 py-1.5 border-b border-slate-100 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-3 h-3 text-slate-400" />
                                            <span className="text-[9px] font-black uppercase text-slate-500">Графа 44: Дозвільні документи</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-2 overflow-y-auto" style={{ height: 'calc(300px - 42px)' }}>
                                        <div className="space-y-1.5">
                                            {/* Documents by VMD (ccd_cmn_docs) - show only on first goods item */}
                                            {currentGoodIndex === 0 && documents.length > 0 && (
                                                <div className="mb-2 pb-2 border-b-2 border-slate-200">
                                                    <div className="text-[9px] font-bold text-brand-blue uppercase mb-1.5">Документи по ВМД</div>
                                                    {documents.map((doc, i) => (
                                                        <div key={`vmd-${i}`} className="text-xs text-slate-800 border-b border-slate-100 last:border-0 pb-1.5 last:pb-0 mb-1.5">
                                                            <div className="font-bold">
                                                                {doc.type} / {doc.number}
                                                                {doc.date && doc.expiryDate !== '---' && (
                                                                    <span className="text-slate-500 font-normal"> / {doc.date} - {doc.expiryDate}</span>
                                                                )}
                                                                {doc.date && doc.expiryDate === '---' && (
                                                                    <span className="text-slate-500 font-normal"> / {doc.date}</span>
                                                                )}
                                            </div>
                                        </div>
                                                    ))}
                                    </div>
                                            )}
                                            
                                            {/* Documents by goods (ccd_goods_docs) */}
                                            {goods[currentGoodIndex]?.docs && goods[currentGoodIndex].docs.length > 0 ? (
                                                <div>
                                                    {currentGoodIndex === 0 && documents.length > 0 && (
                                                        <div className="text-[9px] font-bold text-slate-600 uppercase mb-1.5">Документи по товару</div>
                                                    )}
                                                    {goods[currentGoodIndex].docs.map((doc, i) => (
                                                        <div key={`goods-${i}`} className="text-xs text-slate-800 border-b border-slate-100 last:border-0 pb-1.5 last:pb-0">
                                                            <div className="font-bold">
                                                                {doc.code} / {doc.name}
                                                                {doc.dateBeg && doc.dateEnd !== '---' && (
                                                                    <span className="text-slate-500 font-normal"> / {doc.dateBeg} - {doc.dateEnd}</span>
                                                                )}
                                                                {doc.dateBeg && doc.dateEnd === '---' && (
                                                                    <span className="text-slate-500 font-normal"> / {doc.dateBeg}</span>
                                                                )}
                                                                {doc.qty > 0 && (
                                                                    <span className="text-slate-500 font-normal"> / {doc.qty} {doc.unit}</span>
                                                                )}
                                            </div>
                                        </div>
                                                    ))}
                                    </div>
                                            ) : (
                                                currentGoodIndex !== 0 && documents.length === 0 && (
                                                    <p className="text-[11px] text-slate-500">---</p>
                                                )
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Graph 47 - Payments (30%) */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm flex-shrink-0" style={{ height: '120px' }}>
                                    <CardHeader className="bg-slate-50 py-1.5 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="w-3 h-3 text-slate-400" />
                                            <span className="text-[9px] font-black uppercase text-slate-500">Графа 47: Нарахування платежів</span>
                                    </div>
                                    </CardHeader>
                                    <CardContent className="p-2 overflow-y-auto" style={{ maxHeight: '85px' }}>
                                        {goods[currentGoodIndex]?.payments && goods[currentGoodIndex].payments.length > 0 ? (
                                            <div className="space-y-1">
                                                {goods[currentGoodIndex].payments.filter(p => !p.isHidden).slice(0, 3).map((payment, i) => (
                                                    <div key={i} className="text-xs text-slate-800">
                                                        <span className="font-bold">{payment.code}</span> ({payment.currency}): {payment.sum.toLocaleString()}
                                </div>
                                                ))}
                                                {goods[currentGoodIndex].payments.filter(p => !p.isHidden).length > 3 && (
                                                    <div className="text-[10px] text-slate-500 pt-0.5">
                                                        +{goods[currentGoodIndex].payments.filter(p => !p.isHidden).length - 3} інших
                                </div>
                                                )}
                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-500">---</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column: Multiple rows */}
                            <div className="flex flex-col gap-3">
                                {/* First row: Calculations (50%) and Graph 45 (50%) */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Calculations - Left */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                                        <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                            <span className="text-[10px] font-black uppercase text-slate-500">Розрахунок митної вартості</span>
                                        </CardHeader>
                                        <CardContent className="p-3">
                                            {(() => {
                                                const currentGood = goods[currentGoodIndex];
                                                if (!currentGood?.customsValue || !usdRate) {
                                                    return (
                                                        <div className="space-y-2 text-[10px]">
                                                            {usdRateLoading ? (
                                                                <p className="text-slate-500">Завантаження курсу...</p>
                                                            ) : (
                                                                <p className="text-slate-500">Курс долара не знайдено</p>
                                                            )}
                                </div>
                                                    );
                                                }
                                                
                                                // Convert customs value from UAH to USD
                                                const customsValueUSD = currentGood.customsValue / usdRate;
                                                const perKg = currentGood.netWeight && currentGood.netWeight > 0 
                                                    ? (customsValueUSD / currentGood.netWeight).toFixed(4) 
                                                    : '0.0000';
                                                const perUnit = currentGood.additionalUnits && parseFloat(currentGood.additionalUnits) > 0
                                                    ? (customsValueUSD / parseFloat(currentGood.additionalUnits)).toFixed(4)
                                                    : null;
                                                
                                                return (
                                                    <div className="space-y-2 text-[10px]">
                                                        <div>
                                                            <span className="text-slate-500">За 1 кг:</span>
                                                            <p className="font-bold text-slate-800">${perKg}</p>
                                                </div>
                                                        {perUnit && (
                                                            <div>
                                                                <span className="text-slate-500">За од. виміру:</span>
                                                                <p className="font-bold text-slate-800">${perUnit}</p>
                                            </div>
                                                        )}
                                                        <div className="text-[8px] text-slate-400 pt-1 border-t border-slate-100">
                                                            Курс: {usdRate.toFixed(4)} грн/USD
                                                        </div>
                                                </div>
                                                );
                                            })()}
                                        </CardContent>
                                    </Card>

                                    {/* Graph 45 - Right */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                                        <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                            <span className="text-[10px] font-black uppercase text-slate-500">Графа 45: Митна вартість</span>
                                        </CardHeader>
                                        <CardContent className="p-3">
                                            <p className="text-sm font-bold text-slate-800">
                                                {goods[currentGoodIndex]?.customsValue?.toLocaleString() || '0'}
                                            </p>
                                        </CardContent>
                                    </Card>
                                            </div>

                                {/* Second row: Graph 48 (50%) and Graphs 46, 49 (50%) */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Graph 48 - Left */}
                                    <Card className="overflow-hidden border-slate-200 shadow-sm">
                                        <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                            <span className="text-[10px] font-black uppercase text-slate-500">Графа 48: Дата відстрочки платежу</span>
                                        </CardHeader>
                                        <CardContent className="p-3">
                                            <p className="text-xs font-bold text-slate-800">
                                                {header.deferredPaymentDate && header.deferredPaymentDate !== '---' ? header.deferredPaymentDate : '---'}
                                            </p>
                                        </CardContent>
                                    </Card>

                                    {/* Graphs 46, 49 - Right (two rows) */}
                                    <div className="flex flex-col gap-3">
                                        {/* Graph 46 */}
                                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                                            <CardHeader className="bg-slate-50 py-1.5 border-b border-slate-100">
                                                <span className="text-[9px] font-black uppercase text-slate-500">Графа 46: Статистична вартість</span>
                                            </CardHeader>
                                            <CardContent className="p-2">
                                                <p className="text-xs font-bold text-slate-800">
                                                    {goods[currentGoodIndex]?.statisticalValue?.toLocaleString() || '0'}
                                                </p>
                                            </CardContent>
                                        </Card>

                                        {/* Graph 49 */}
                                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                                            <CardHeader className="bg-slate-50 py-1.5 border-b border-slate-100">
                                                <span className="text-[9px] font-black uppercase text-slate-500">Графа 49: Реквізити складу</span>
                                            </CardHeader>
                                            <CardContent className="p-2">
                                                <p className="text-xs text-slate-500 italic">Дані відсутні</p>
                                            </CardContent>
                                        </Card>
                                                </div>
                                            </div>

                                {/* Graph B */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm flex-shrink-0" style={{ height: '150px' }}>
                                    <CardHeader className="bg-slate-50 py-2 border-b border-slate-100 flex-shrink-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-slate-500">Графа В: Загальні платежі</span>
                                            {generalPayments.length > 0 && (
                                                <button
                                                    onClick={() => setShowTotalPaymentsModal(true)}
                                                    className="px-2 py-0.5 text-[8px] font-bold bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1"
                                                >
                                                    <Calculator className="w-3 h-3" />
                                                    Сума
                                                </button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3 overflow-y-auto" style={{ height: 'calc(150px - 42px)' }}>
                                        {generalPayments.length > 0 ? (
                                            <div className="space-y-1 text-[10px] text-slate-800">
                                                {generalPayments.map((payment, i) => (
                                                    <div key={i}>
                                                        {payment.code} ({payment.currency}): {payment.amount.toLocaleString()}
                                                        {payment.date && <span className="text-slate-500 text-[9px]"> • {payment.date}</span>}
                                    </div>
                                ))}
                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-500">---</p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Graph C - Hidden with click to open modal */}
                                <Card className="overflow-hidden border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setShowGraphCModal(true)}>
                                    <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-slate-500">Графа С</span>
                                            <Info className="w-3.5 h-3.5 text-slate-400" />
                                            </div>
                                    </CardHeader>
                                </Card>
                                            </div>
                                        </div>
                    )}

                    {/* Ninth Row: Graphs 50, 52, 53, 54 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        {/* Left Column: Two rows - 50 (80%) and 52 (20%) */}
                        <div className="flex flex-col gap-3">
                            {/* Graph 50 - Top (80%) */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm flex-[8]">
                                <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black uppercase text-slate-500">Графа 50: Зобов'язання</span>
                                        </div>
                                </CardHeader>
                                <CardContent className="p-3">
                                    <div className="space-y-1 text-xs text-slate-800">
                                        {(() => {
                                            const client50 = clients.find(c => c.box === '50');
                                            const hasClient = client50 && (client50.uori !== '---' || client50.name !== '---' || client50.address !== '---');
                                            const hasObligations = obligations && obligations.length > 0;
                                            
                                            if (!hasClient && !hasObligations) {
                                                return <p className="text-slate-500">---</p>;
                                            }
                                            
                                            return (
                                                <>
                                                    {/* Row 1: UORI */}
                                                    {client50 && client50.uori && client50.uori !== '---' && (
                                                        <p className="font-bold">{client50.uori}</p>
                                                    )}
                                                    
                                                    {/* Row 2: Name */}
                                                    {client50 && client50.name && client50.name !== '---' && (
                                                        <p className="font-bold">{client50.name}</p>
                                                    )}
                                                    
                                                    {/* Row 3: Address */}
                                                    {client50 && client50.address && client50.address !== '---' && (
                                                        <p className="text-slate-600">{client50.address}</p>
                                                    )}
                                                    
                                                    {/* Row 4: Tel */}
                                                    {client50 && client50.tel && client50.tel !== '---' && (
                                                        <p className="text-slate-600">{client50.tel}</p>
                                                    )}
                                                    
                                                    {/* Row 5: Obligations */}
                                                    {hasObligations && obligations.map((obl, idx) => {
                                                        const parts: string[] = [];
                                                        if (obl.surname && obl.surname !== '---') parts.push(obl.surname);
                                                        if (obl.name && obl.name !== '---') parts.push(obl.name);
                                                        const namePart = parts.join(' ');
                                                        
                                                        const passportPart = obl.passportNumber && obl.passportNumber !== '---' 
                                                            ? `, паспорт ${obl.passportNumber}` 
                                                            : '';
                                                        
                                                        if (namePart || passportPart) {
                                                            return (
                                                                <p key={idx} className="text-slate-600">
                                                                    {namePart}{passportPart}
                                                                </p>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </>
                                            );
                                        })()}
                                </div>
                                </CardContent>
                            </Card>

                            {/* Graph 52 - Bottom (20%) */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm flex-[2] min-h-[80px]">
                                <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black uppercase text-slate-500">Графа 52: Сума гарантії / Код гарантії</span>
                            </div>
                                </CardHeader>
                                <CardContent className="p-3 flex items-center">
                                    <p className="text-sm font-bold text-slate-800 leading-tight">
                                        {(() => {
                                            const amount = header.guaranteeAmount !== null && header.guaranteeAmount !== undefined ? header.guaranteeAmount : null;
                                            const code = header.guaranteeCode && header.guaranteeCode !== '---' ? header.guaranteeCode : null;
                                            
                                            if (!amount && !code) {
                                                return <span className="text-slate-500">---</span>;
                                            }
                                            
                                            const parts: string[] = [];
                                            if (amount !== null && amount !== 0) {
                                                parts.push(amount.toString());
                                            }
                                            if (code) {
                                                parts.push(code);
                                            }
                                            
                                            return parts.length > 0 ? parts.join(' / ') : '---';
                                        })()}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Two rows - 53 (30%) and 54 (70%) */}
                        <div className="flex flex-col gap-3">
                            {/* Graph 53 - Top (30%) */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm flex-[3]">
                                <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black uppercase text-slate-500">Графа 53: Митниця призначення</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-3">
                                    <p className="text-xs font-bold text-slate-800">
                                        {header.destCustoms && header.destCustoms !== '---' ? header.destCustoms : '---'}
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Graph 54 - Bottom (70%) */}
                            <Card className="overflow-hidden border-slate-200 shadow-sm flex-[7]">
                                <CardHeader className="bg-slate-50 py-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <UserCircle className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black uppercase text-slate-500">Графа 54: Декларант / Місце заповнення</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-3">
                                    <div className="space-y-2 text-xs text-slate-800">
                                        {header.declarantName && header.declarantName !== '---' && (
                                            <p className="font-bold">{header.declarantName}</p>
                                        )}
                                        {header.fillingPlace && header.fillingPlace !== '---' && (
                                            <p className="text-slate-600">Місце: {header.fillingPlace}</p>
                                        )}
                                        {header.fillingDate && header.fillingDate !== '---' && (
                                            <p className="text-slate-600">Дата: {header.fillingDate}</p>
                                        )}
                                        {header.declarantId && header.declarantId !== '---' && (
                                            <p className="text-slate-500 text-[10px]">ID: {header.declarantId}</p>
                                        )}
                                        {header.declarantPosition && header.declarantPosition !== '---' && (
                                            <p className="text-slate-500 text-[10px]">Посада: {header.declarantPosition}</p>
                                        )}
                                        {header.declarantPhone && header.declarantPhone !== '---' && (
                                            <p className="text-slate-500 text-[10px]">Телефон: {header.declarantPhone}</p>
                                        )}
                                        {(!header.declarantName || header.declarantName === '---') && (!header.fillingPlace || header.fillingPlace === '---') && (
                                            <p className="text-slate-500">---</p>
                        )}
                    </div>
                                </CardContent>
                            </Card>
                </div>
                    </div>
                </div>
            ) : activeTab === 'protocol' ? (
                <div className="space-y-4">
                    {protocol.length > 0 ? (
                        <SectionContainer title="Історія статусів оформлення (ccd_proc)">
                            <TableList
                                columns={["Дата", "Процес", "Інспектор", "Посвідчення", "Код/Корист."]}
                                data={protocol.map(p => [
                                    p.date,
                                    p.actionName,
                                    p.userName,
                                    p.inspectorId !== '---' ? p.inspectorId : (p.inspectorCardIns !== '---' ? p.inspectorCardIns : '---'),
                                    `${p.code} / ${p.userCode}`
                                ])}
                                color="text-indigo-600 font-medium"
                            />
                        </SectionContainer>
                    ) : (
                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                            <CardContent className="p-8 text-center">
                                <p className="text-slate-400 text-sm">Історія статусів оформлення відсутня</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            ) : activeTab === 'json' ? (
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="border-b bg-slate-50 py-3">
                        <CardTitle className="text-xs font-bold text-slate-500">Парсинг JSON (Debug)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <pre className="p-4 text-slate-600 text-[10px] font-mono overflow-auto max-h-[800px] leading-relaxed">
                            {JSON.stringify(parseRawOnly(xmlDataForMapping), null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-slate-900 border-none shadow-2xl">
                    <CardContent className="p-4">
                        <pre className="text-slate-300 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[800px] whitespace-pre-wrap">
                            {declaration.xmlData || "NULL"}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {/* Premium Goods Detail Modal */}
            {
                selectedGoods && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200">
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setSelectedGoods(null)} />
                        <Card className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden border-none animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-blue" />
                            <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between border-b border-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-brand-blue" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-black text-slate-800">Товар №{selectedGoods.index}</CardTitle>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Детальні параметри ВМД</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-slate-200"
                                        onClick={() => setShowDiagnostic(!showDiagnostic)}
                                    >
                                        {showDiagnostic ? 'Закрити діагностику' : 'Діагностика'}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-slate-100 p-0" onClick={() => setSelectedGoods(null)}>
                                        <X className="w-4 h-4 text-slate-400" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6 overflow-y-auto flex-1">
                                {showDiagnostic && (
                                    <div className="p-4 bg-slate-900 rounded-xl font-mono text-[9px] text-emerald-400 overflow-x-auto border-2 border-emerald-900/30">
                                        <div className="flex justify-between items-center mb-2 border-b border-emerald-900/50 pb-2">
                                            <span className="font-bold uppercase tracking-widest text-emerald-500">Raw Mapped Data (Debug)</span>
                                            <Button size="sm" variant="ghost" className="h-4 text-[8px] text-emerald-600 hover:text-emerald-400 p-0" onClick={() => setShowDiagnostic(false)}>CLOSE</Button>
                                        </div>
                                        <pre>{JSON.stringify(selectedGoods, null, 2)}</pre>
                                    </div>
                                )}
                                {/* Description Full */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <FileText className="w-3 h-3" /> Опис товару (Графа 31)
                                    </label>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed font-medium">
                                        {selectedGoods.description}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Left Column: Logic & Origin */}
                                    <div className="space-y-4">
                                        <div className="space-y-4 bg-white rounded-xl">
                                            <ModalField
                                                icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}
                                                label="Код УКТЗЕД (33)"
                                                value={selectedGoods.hsCode}
                                                highlight
                                            />
                                            <ModalField
                                                icon={<Globe className="w-3.5 h-3.5 text-blue-500" />}
                                                label="Країна походження (34)"
                                                value={selectedGoods.originCountry}
                                            />
                                            <ModalField
                                                icon={<Info className="w-3.5 h-3.5 text-indigo-500" />}
                                                label="Енергоносії (31_05)"
                                                value={selectedGoods.energyMonth !== '---' ? `Місяць: ${selectedGoods.energyMonth}` : '---'}
                                            />
                                        </div>
                                    </div>

                                    {/* Right Column: Weight & Packages */}
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <MetricCard label="Брутто (35)" value={`${selectedGoods.grossWeight} кг`} icon={<Scale className="w-4 h-4" />} />
                                            <MetricCard label="Нетто (38)" value={`${selectedGoods.netWeight} кг`} secondary />
                                        </div>
                                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                                            {selectedGoods.netWeightClean > 0 && (
                                                <div className="flex justify-between items-center text-[11px] pb-2 border-b border-slate-100/50">
                                                    <span className="text-slate-400 font-medium">Чиста вага (31_38):</span>
                                                    <span className="font-bold text-slate-800">{selectedGoods.netWeightClean} кг</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-400 font-medium">Кількість місць (31_03):</span>
                                                <span className="font-bold text-slate-800">{selectedGoods.packagesCount}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-400 font-medium">Тип місця (31_03p):</span>
                                                <Badge variant="outline" className="text-[9px] py-0">{getPackageTypeLabel(selectedGoods.packageType)}</Badge>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-400 font-medium">Контейнери (31_02):</span>
                                                <span className="font-mono text-slate-800">{selectedGoods.containersCount}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px] pt-2 border-t border-slate-100">
                                                <span className="text-slate-400 font-medium">Дод. одиниці (31_04):</span>
                                                <span className="font-bold text-brand-blue">{selectedGoods.additionalUnits}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Batch 17: Preferences & Procedures */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                                    {/* Preferences (Box 36) */}
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <ShieldCheck className="w-3 h-3 text-emerald-500" /> Преференції (36)
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-[8px] text-slate-400 block">Мито</span>
                                                <span className="text-[10px] font-bold text-slate-700">{selectedGoods.prefDuty}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-[8px] text-slate-400 block">Акциз</span>
                                                <span className="text-[10px] font-bold text-slate-700">{selectedGoods.prefExcise}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-[8px] text-slate-400 block">ПДВ</span>
                                                <span className="text-[10px] font-bold text-slate-700">{selectedGoods.prefVat}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Procedure (Box 37) */}
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <ListOrdered className="w-3 h-3 text-brand-blue" /> Процедура (37)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-[8px] text-slate-400 block">Режим / Попередній</span>
                                                <span className="text-[10px] font-bold text-slate-700">{selectedGoods.procedure} / {selectedGoods.prevProcedure}</span>
                                            </div>
                                            <div className="flex-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-[8px] text-slate-400 block">Особливості</span>
                                                <span className="text-[10px] font-bold text-slate-700">{selectedGoods.procFeatures}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Batch 17 & 18: Mixed Technical */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                    <ModalField
                                        icon={<Hash className="w-3.5 h-3.5 text-orange-500" />}
                                        label="Квота (39)"
                                        value={selectedGoods.quota}
                                    />
                                    <ModalField
                                        icon={<Coins className="w-3.5 h-3.5 text-blue-400" />}
                                        label="Код дод. одиниці (41)"
                                        value={selectedGoods.addUnitCode}
                                    />
                                </div>

                                {/* Batch 18: Financial Metrics (42, 45, 46) */}
                                <div className="space-y-4 pt-4 border-t border-slate-50">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Banknote className="w-3 h-3 text-emerald-600" /> Фінансові показники (42, 45, 46)
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="bg-brand-blue/[0.03] p-3 rounded-xl border border-brand-blue/10">
                                            <span className="text-[8px] text-slate-400 block uppercase font-bold">Фактурна (грн)</span>
                                            <span className="text-xs font-black text-brand-blue">{selectedGoods.invoiceValueUah.toLocaleString()} UAH</span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-[8px] text-slate-400 block uppercase font-bold">Митна (45)</span>
                                            <span className="text-xs font-black text-slate-700">{selectedGoods.customsValue.toLocaleString()} UAH</span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-[8px] text-slate-400 block uppercase font-bold">Статистична (46)</span>
                                            <span className="text-xs font-black text-slate-700">{selectedGoods.statisticalValue.toLocaleString()} $</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Batch 18: Technical Features & Classification */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                                    <div className="space-y-4">
                                        <ModalField
                                            icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-500" />}
                                            label="Експортний контроль (33_03)"
                                            value={selectedGoods.exportControl}
                                        />
                                        <ModalField
                                            icon={<LayoutGrid className="w-3.5 h-3.5 text-slate-500" />}
                                            label="Дод. класифікація (33_02)"
                                            value={selectedGoods.addClassification}
                                        />
                                        <ModalField
                                            icon={<Info className="w-3.5 h-3.5 text-indigo-400" />}
                                            label="Дод. особливість проц. (37_04)"
                                            value={selectedGoods.addProcFeature}
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <ModalField
                                            icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}
                                            label="Комплектність (31_06)"
                                            value={selectedGoods.completeness !== '---' ? `${selectedGoods.completeness}%` : '---'}
                                        />
                                        <ModalField
                                            icon={<Calendar className="w-3.5 h-3.5 text-brand-blue" />}
                                            label="Термін зберігання"
                                            value={selectedGoods.storageTerm}
                                        />
                                        <ModalField
                                            icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                                            label="Код гарантії (43)"
                                            value={selectedGoods.guaranteeCode}
                                        />
                                    </div>
                                </div>

                                {/* Batch 19: Collections & Additional Data */}
                                <div className="space-y-4 pt-4 border-t border-slate-50">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <ClipboardList className="w-3 h-3 text-brand-blue" /> Супровідні дані товару
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                                                        <Calculator className="w-3 h-3" />
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Метод (DCC):</span>
                                                </div>
                                                <span className="text-xs font-black text-slate-700">{selectedGoods.dccMethod}</span>
                                            </div>
                                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                        <FileCheck className="w-3 h-3" />
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Випуск під гар.:</span>
                                                </div>
                                                <span className="text-xs font-black text-slate-700">{selectedGoods.guaranteeRelease}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[8px] font-bold py-0.5">
                                                    Платежі (47): {selectedGoods.paymentsCount}
                                                </Badge>
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[8px] font-bold py-0.5">
                                                    Документи (44): {selectedGoods.docsCount}
                                                </Badge>
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[8px] font-bold py-0.5">
                                                    Попередні (40): {selectedGoods.prevDocsCount}
                                                </Badge>
                                            </div>
                                            {/* Containers */}
                                            {(selectedGoods.containers?.length ?? 0) > 0 && (
                                                <div className="mt-2 p-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                                    <span className="text-[8px] text-slate-400 block uppercase font-bold mb-1">Контейнери:</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {selectedGoods.containers.map((c, i) => {
                                                            const getContainerStatus = (isPart: string) => {
                                                                switch (isPart) {
                                                                    case '1': return 'контейнер';
                                                                    case '2': return 'частина контейнеру';
                                                                    case '3': return 'є товари з цієї і іншої МД';
                                                                    case '4': return 'є товари з іншої МД';
                                                                    default: return '';
                                                                }
                                                            };
                                                            const status = getContainerStatus(c.isPart);
                                                            return (
                                                                <div key={i} className="text-[9px] bg-white px-2 py-1 rounded border border-slate-100">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-mono font-bold text-slate-600">{c.name}</span>
                                                                        {c.type && c.type !== '---' && (
                                                                            <span className="text-[8px] text-slate-500">Тип: {c.type}</span>
                                                                        )}
                                                                    </div>
                                                                    {status && (
                                                                        <span className="text-[8px] text-slate-400 italic block mt-0.5">{status}</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {selectedGoods.specification !== '---' && (
                                                <div className="mt-1 text-[10px] text-slate-400 font-medium italic">
                                                    Специфікація: {selectedGoods.specification}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Batch 20: DCC Dist & Returns */}
                                {((selectedGoods.dccDistributions?.length ?? 0) > 0 || (selectedGoods.returns?.length ?? 0) > 0) && (
                                    <div className="space-y-4 pt-4 border-t border-slate-50">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Info className="w-3 h-3 text-indigo-500" /> Детальні логи та розподіли
                                        </label>

                                        <div className="space-y-3">
                                            {/* DCC Distribution */}
                                            {selectedGoods.dccDistributions.length > 0 && (
                                                <div className="bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
                                                    <table className="w-full text-[9px] min-w-[600px]">
                                                        <thead className="bg-slate-50 text-slate-400 uppercase font-bold">
                                                            <tr>
                                                                <th className="p-2 text-left">Код DCC</th>
                                                                <th className="p-2 text-center">К-сть / Ціна</th>
                                                                <th className="p-2 text-right">Сума (грн)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {selectedGoods.dccDistributions.map((d, i) => (
                                                                <tr key={i} className="text-slate-600">
                                                                    <td className="p-2 font-bold text-slate-700">{d.code}</td>
                                                                    <td className="p-2 text-center">{d.quantity} {d.unit} / {d.price} {d.currency}</td>
                                                                    <td className="p-2 text-right font-black text-brand-blue">{d.sumUah.toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* Returns / Back Content */}
                                            {selectedGoods.returns.length > 0 && (
                                                <div className="space-y-2">
                                                    {selectedGoods.returns.map((r, i) => (
                                                        <div key={i} className="p-3 bg-rose-50/30 border border-rose-100/50 rounded-xl">
                                                            <span className="text-[8px] font-black text-rose-400 uppercase block mb-1">Зворот (Графа {r.box})</span>
                                                            <p className="text-[10px] text-slate-600 leading-relaxed">{r.content}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Batch 21: Goods Documents */}
                                {(selectedGoods.docs?.length ?? 0) > 0 && (
                                    <div className="bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
                                        <div className="bg-slate-50 p-2 border-b border-slate-100 flex items-center gap-2">
                                            <FileText className="w-3 h-3 text-brand-blue" />
                                            <span className="text-[9px] font-black text-slate-500 uppercase">Дозвільні документи (гр. 44)</span>
                                        </div>
                                        <table className="w-full text-[9px] min-w-[600px]">
                                            <thead className="bg-slate-50/50 text-slate-400 uppercase font-bold text-[8px]">
                                                <tr>
                                                    <th className="p-2 text-left">Код / Номер</th>
                                                    <th className="p-2 text-center">Дата (з - по)</th>
                                                    <th className="p-2 text-right">К-сть / Од.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedGoods.docs.map((d, i) => (
                                                    <tr key={i} className="text-slate-600">
                                                        <td className="p-2">
                                                            <div className="font-bold text-slate-700">{d.code}</div>
                                                            <div className="text-[8px] text-slate-400 truncate max-w-[120px]">{d.name}</div>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            {d.dateBeg} {d.dateEnd !== '---' ? `- ${d.dateEnd}` : ''}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {d.qty > 0 ? `${d.qty} ${d.unit}` : '---'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Batch 21: Packaging */}
                                {(selectedGoods.packaging?.length ?? 0) > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 px-1">
                                            <PackageOpen className="w-3 h-3 text-amber-500" />
                                            <span className="text-[9px] font-black text-slate-500 uppercase">Пакування та тара</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {selectedGoods.packaging.map((p, i) => (
                                                <div key={i} className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-start gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                                                        <Box className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-slate-700">Код: {p.code} (x{p.qty})</div>
                                                        <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{p.text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Batch 22: Goods Payments (Box 47) */}
                                {(selectedGoods.payments?.length ?? 0) > 0 && (
                                    <div className="bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
                                        <div className="bg-slate-50 p-2 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="w-3 h-3 text-emerald-500" />
                                                <span className="text-[9px] font-black text-slate-500 uppercase">Нарахування платежів (гр. 47)</span>
                                            </div>
                                            <Badge variant="outline" className="text-[8px] font-bold border-brand-blue text-brand-blue bg-white">
                                                Разом: {selectedGoods.payments.filter(p => !p.isHidden).reduce((acc, curr) => acc + curr.sum, 0).toLocaleString()} {selectedGoods.payments[0]?.currency}
                                            </Badge>
                                        </div>
                                        <table className="w-full text-[9px] min-w-[600px]">
                                            <thead className="bg-slate-50/50 text-slate-400 uppercase font-bold text-[8px]">
                                                <tr>
                                                    <th className="p-2 text-left">Код / СП</th>
                                                    <th className="p-2 text-right">Основа</th>
                                                    <th className="p-2 text-center">Ставка</th>
                                                    <th className="p-2 text-right">Сума</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedGoods.payments.map((p, i) => (
                                                    <tr key={i} className={cn("text-slate-600", p.isHidden ? "opacity-50 italic" : "")}>
                                                        <td className="p-2">
                                                            <div className="font-bold text-slate-700">{p.code} ({p.char})</div>
                                                            <div className="text-[8px] text-slate-400">Спосіб: {p.method}</div>
                                                        </td>
                                                        <td className="p-2 text-right font-mono">
                                                            {p.base.toLocaleString()} <span className="text-[7px] text-slate-400">{p.baseType}</span>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            {p.tax} {p.taxType} {p.taxDiv > 1 ? `/ ${p.taxDiv}` : ''}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            <div className="font-black text-slate-800">{p.sum.toLocaleString()}</div>
                                                            <div className="text-[8px] text-slate-400">{p.currency}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Batch 23: Goods Previous Docs (Box 40) */}
                                {(selectedGoods.prevDocs?.length ?? 0) > 0 && (
                                    <div className="bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
                                        <div className="bg-slate-50 p-2 border-b border-slate-100 flex items-center gap-2">
                                            <History className="w-3 h-3 text-slate-500" />
                                            <span className="text-[9px] font-black text-slate-500 uppercase">Попередні документи (гр. 40)</span>
                                        </div>
                                        <table className="w-full text-[9px] min-w-[600px]">
                                            <thead className="bg-slate-50/50 text-slate-400 uppercase font-bold text-[8px]">
                                                <tr>
                                                    <th className="p-2 text-left">Код / Номер</th>
                                                    <th className="p-2 text-center">Дата / Товар</th>
                                                    <th className="p-2 text-right">Списання / К-сть</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedGoods.prevDocs.map((pd, i) => (
                                                    <tr key={i} className="text-slate-600">
                                                        <td className="p-2">
                                                            <div className="font-bold text-slate-700">{pd.code}</div>
                                                            <div className="text-[8px] text-slate-400 truncate max-w-[150px]">{pd.name}</div>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <div>{pd.date}</div>
                                                            <div className="text-[8px] text-slate-400">Товар: {pd.goodsNum}</div>
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            <div className="font-bold text-slate-700">{pd.writeOff}</div>
                                                            <div className="text-[8px] text-slate-400">{pd.qty > 0 ? `${pd.qty} ${pd.unit}` : '---'}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Batch 24: Invoice Specification */}
                                {(selectedGoods.invoiceSpecification?.length ?? 0) > 0 && (
                                    <div className="bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden">
                                        <div className="bg-slate-50 p-2 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <LayoutList className="w-3 h-3 text-indigo-500" />
                                                <span className="text-[9px] font-black text-slate-500 uppercase">Специфікація інвойсу</span>
                                            </div>
                                            <Badge variant="outline" className="text-[8px] font-bold border-brand-blue text-brand-blue bg-white">
                                                Позицій: {selectedGoods.invoiceSpecification.length}
                                            </Badge>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto overflow-x-auto">
                                            <table className="w-full text-[9px] min-w-[800px]">
                                                <thead className="bg-slate-50/50 text-slate-400 uppercase font-bold text-[8px] sticky top-0 z-10">
                                                    <tr>
                                                        <th className="p-2 text-left">Поз / Артикул</th>
                                                        <th className="p-2 text-left">Назва</th>
                                                        <th className="p-2 text-right">Вага (Б/Н)</th>
                                                        <th className="p-2 text-right">Сума (UAH)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {selectedGoods.invoiceSpecification.map((item, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-2">
                                                                <div className="font-bold text-slate-700">#{item.pos}</div>
                                                                <div className="text-[8px] text-slate-400 font-mono">{item.article || '---'}</div>
                                                            </td>
                                                            <td className="p-2">
                                                                <div className="text-slate-600 line-clamp-2 leading-tight font-medium">{item.name}</div>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {item.trademark && (
                                                                        <Badge variant="outline" className="text-[7px] px-1 h-3.5 bg-slate-50 border-slate-200 text-slate-500">
                                                                            <Tags className="w-2 h-2 mr-0.5" /> {item.trademark}
                                                                        </Badge>
                                                                    )}
                                                                    {item.producerName && (
                                                                        <Badge variant="outline" className="text-[7px] px-1 h-3.5 bg-slate-50 border-slate-200 text-slate-500">
                                                                            <Globe className="w-2 h-2 mr-0.5" /> {item.producerName} ({item.producerCountry})
                                                                        </Badge>
                                                                    )}
                                                                    {item.packaging && <span className="text-[7px] text-slate-400 italic">({item.packaging})</span>}
                                                                </div>

                                                                {/* Nested Details */}
                                                                {((item.details?.length ?? 0) > 0 || (item.prevDeclarations?.length ?? 0) > 0) && (
                                                                    <div className="mt-1.5 p-1.5 bg-slate-100/50 rounded border border-slate-100 space-y-1">
                                                                        {item.details?.map((d, di) => (
                                                                            <div key={di} className="text-[7px] text-slate-500 flex gap-1">
                                                                                <span className="font-bold">[{d.code}]</span> {d.value}
                                                                            </div>
                                                                        ))}
                                                                        {item.prevDeclarations?.map((pd, pdi) => (
                                                                            <div key={pdi} className="text-[7px] text-emerald-600 bg-emerald-50/50 px-1 py-0.5 rounded flex items-center gap-1">
                                                                                <History className="w-2 h-2" />
                                                                                <span>{pd.mrn} (Товар: {pd.goodsNum}, Вага: {pd.weightNet}кг)</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-2 text-right whitespace-nowrap">
                                                                <div className="flex flex-col items-end">
                                                                    <div className="text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md mb-1">
                                                                        {item.qty.toLocaleString()} <span className="text-[7px] text-slate-500 font-normal uppercase">{item.unit}</span>
                                                                    </div>
                                                                    <div className="text-slate-700 font-medium text-[8px]">{item.weightGross.toFixed(2)} / {item.weightNet.toFixed(2)} кг</div>
                                                                    {item.qty2 > 0 && (
                                                                        <div className="text-[7px] text-slate-400 mt-0.5">
                                                                            Дод: {item.qty2} {item.unit2}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-2 text-right">
                                                                <div className="font-black text-slate-900">{item.sumUah.toLocaleString()}</div>
                                                                <div className="text-[8px] text-slate-400 font-mono">{item.sumCur.toLocaleString()} {selectedGoods.price > 0 ? '' : ''}</div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <Button size="sm" onClick={() => setSelectedGoods(null)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg px-6">
                                    Закрити
                                </Button>
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* Graph C Modal */}
            {showGraphCModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowGraphCModal(false)} />
                    <Card className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden border-none animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-blue" />
                        <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                                    <Info className="w-5 h-5 text-brand-blue" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-black text-slate-800">Графа С</CardTitle>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Детальна інформація</p>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-slate-100 p-0" onClick={() => setShowGraphCModal(false)}>
                                <X className="w-4 h-4 text-slate-400" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6 overflow-y-auto flex-1">
                            {paymentDocs.length > 0 ? (
                                <div className="bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
                                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-brand-blue" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase">Платіжні документи по ВМД (Графа С)</span>
                                    </div>
                                    <table className="w-full text-[10px] min-w-[800px]">
                                        <thead className="bg-slate-50/50 text-slate-400 uppercase font-bold text-[9px]">
                                            <tr>
                                                <th className="p-2 text-left">Код / Спосіб</th>
                                                <th className="p-2 text-left">Номер / Дата</th>
                                                <th className="p-2 text-left">Платник</th>
                                                <th className="p-2 text-right">Сума</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {paymentDocs.map((doc, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-2">
                                                        <div className="font-bold text-slate-700">{doc.code}</div>
                                                        <div className="text-[9px] text-slate-500">СП: {doc.method}</div>
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="font-medium text-slate-800">{doc.number || '---'}</div>
                                                        <div className="text-[9px] text-slate-500">
                                                            {doc.date || '---'}
                                                            {doc.promissoryNoteDate && doc.promissoryNoteDate !== '---' && (
                                                                <span> • Вексель: {doc.promissoryNoteDate}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="text-slate-700">{doc.payerCode || '---'}</div>
                                                    </td>
                                                    <td className="p-2 text-right">
                                                        <div className="font-black text-slate-900">{doc.amount.toLocaleString()}</div>
                                                        <div className="text-[9px] text-slate-400">{doc.currency}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400">
                                    <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-sm font-medium">Платіжні документи відсутні</p>
                                </div>
                            )}
                        </CardContent>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button size="sm" onClick={() => setShowGraphCModal(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg px-6">
                                Закрити
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Total Payments Modal */}
            {showTotalPaymentsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowTotalPaymentsModal(false)} />
                    <Card className="relative w-full max-w-md bg-white shadow-2xl rounded-2xl overflow-hidden border-none animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-blue" />
                        <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                                    <Calculator className="w-5 h-5 text-brand-blue" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-black text-slate-800">Загальна сума платежів</CardTitle>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Графа В</p>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-slate-100 p-0" onClick={() => setShowTotalPaymentsModal(false)}>
                                <X className="w-4 h-4 text-slate-400" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-3">
                                {Object.entries(totalPaymentsSum).map(([currency, sum]) => (
                                    <div key={currency} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <span className="text-sm font-bold text-slate-600 uppercase">{currency}</span>
                                        <span className="text-xl font-black text-brand-blue">{sum.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button size="sm" onClick={() => setShowTotalPaymentsModal(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg px-6">
                                Закрити
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Goods Table Modal */}
            {showGoodsTable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowGoodsTable(false)} />
                    <Card className="relative w-full max-w-6xl max-h-[90vh] flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden border-none animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-blue" />
                        <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                                    <ListOrdered className="w-5 h-5 text-brand-blue" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-black text-slate-800">Перелік товарів</CardTitle>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Всього товарів: {goods.length}</p>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-slate-100 p-0" onClick={() => setShowGoodsTable(false)}>
                                <X className="w-4 h-4 text-slate-400" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6 overflow-y-auto flex-1">
                            <div className="bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
                                <table className="w-full text-[10px] min-w-[1000px]">
                                    <thead className="bg-slate-50 text-slate-400 uppercase font-bold">
                                        <tr>
                                            <th className="p-3 text-left">№</th>
                                            <th className="p-3 text-left">Код УКТЗЕД</th>
                                            <th className="p-3 text-left">Опис</th>
                                            {header.containersIndicator === '1' && (
                                                <th className="p-3 text-left">Контейнер</th>
                                            )}
                                            <th className="p-3 text-right">Країна</th>
                                            <th className="p-3 text-right">Брутто (кг)</th>
                                            <th className="p-3 text-right">Нетто (кг)</th>
                                            <th className="p-3 text-right">Ціна</th>
                                            <th className="p-3 text-center">Дія</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {goods.map((good, index) => (
                                            <tr 
                                                key={index} 
                                                className={cn(
                                                    "hover:bg-slate-50 transition-colors cursor-pointer",
                                                    currentGoodIndex === index && "bg-brand-blue/5"
                                                )}
                                                onClick={() => {
                                                    setCurrentGoodIndex(index);
                                                    setShowGoodsTable(false);
                                                }}
                                            >
                                                <td className="p-3 font-bold text-slate-700">{good.index || index + 1}</td>
                                                <td className="p-3 font-mono text-slate-800">{good.hsCode || '---'}</td>
                                                <td className="p-3 text-slate-600 max-w-md">
                                                    <div className="line-clamp-2 leading-tight">{good.description || '---'}</div>
                                                </td>
                                                {header.containersIndicator === '1' && (
                                                    <td className="p-3 text-slate-600">
                                                        {good.containers && good.containers.length > 0 ? (
                                                            <div className="flex flex-col gap-1">
                                                                {good.containers.map((c: any, i: number) => {
                                                                    const getContainerStatus = (isPart: string) => {
                                                                        switch (isPart) {
                                                                            case '1': return 'контейнер';
                                                                            case '2': return 'частина контейнеру';
                                                                            case '3': return 'є товари з цієї і іншої МД';
                                                                            case '4': return 'є товари з іншої МД';
                                                                            default: return '';
                                                                        }
                                                                    };
                                                                    const status = getContainerStatus(c.isPart);
                                                                    return (
                                                                        <div key={i} className="text-[9px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="font-mono font-bold text-slate-700">{c.name}</span>
                                                                                {c.type && c.type !== '---' && (
                                                                                    <span className="text-[8px] text-slate-600">Тип: {c.type}</span>
                                                                                )}
                                                                            </div>
                                                                            {status && (
                                                                                <span className="text-[8px] text-slate-500 italic">{status}</span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400">---</span>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="p-3 text-right text-slate-600">{good.originCountry || '---'}</td>
                                                <td className="p-3 text-right font-bold text-slate-800">{good.grossWeight?.toLocaleString() || '0'}</td>
                                                <td className="p-3 text-right font-bold text-slate-800">{good.netWeight?.toLocaleString() || '0'}</td>
                                                <td className="p-3 text-right font-bold text-brand-blue">{good.price?.toLocaleString() || '0'}</td>
                                                <td className="p-3 text-center">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 text-[8px] font-bold px-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCurrentGoodIndex(index);
                                                            setShowGoodsTable(false);
                                                        }}
                                                    >
                                                        Вибрати
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button size="sm" onClick={() => setShowGoodsTable(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg px-6">
                                Закрити
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Good Specification Modal */}
            {showGoodSpecificationModal && goods[currentGoodIndex] && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => {
                        setShowGoodSpecificationModal(false);
                        setExpandedSpecIndex(null);
                    }} />
                    <Card className="relative w-full max-w-6xl max-h-[90vh] flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden border-none animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-blue" />
                        <CardHeader className="pb-4 pt-6 px-6 flex flex-row items-center justify-between border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-brand-blue" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-black text-slate-800">Специфікація товару №{goods[currentGoodIndex].index || currentGoodIndex + 1}</CardTitle>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        {goods[currentGoodIndex].invoiceSpecification?.length || 0} позицій
                                    </p>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-slate-100 p-0" onClick={() => {
                                setShowGoodSpecificationModal(false);
                                setExpandedSpecIndex(null);
                            }}>
                                <X className="w-4 h-4 text-slate-400" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-6 overflow-y-auto flex-1">
                            {goods[currentGoodIndex].invoiceSpecification && goods[currentGoodIndex].invoiceSpecification.length > 0 ? (
                                <div className="space-y-4">
                                    {/* Компактна таблиця */}
                                    <div className="bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden overflow-x-auto">
                                        <table className="w-full text-[10px] min-w-[800px]">
                                            <thead className="bg-slate-50 text-slate-400 uppercase font-bold">
                                                <tr>
                                                    <th className="p-3 text-left">Поз.</th>
                                                    <th className="p-3 text-left">Найменування</th>
                                                    <th className="p-3 text-left">Артикул</th>
                                                    <th className="p-3 text-left">Кількість</th>
                                                    <th className="p-3 text-left">Од. вим.</th>
                                                    <th className="p-3 text-right">Ціна</th>
                                                    <th className="p-3 text-right">Сума (валюта)</th>
                                                    <th className="p-3 text-right">Сума (грн)</th>
                                                    <th className="p-3 text-right">Брутто (кг)</th>
                                                    <th className="p-3 text-right">Нетто (кг)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {goods[currentGoodIndex].invoiceSpecification.map((spec, index) => (
                                                    <tr 
                                                        key={index} 
                                                        className={cn(
                                                            "hover:bg-slate-50 transition-colors cursor-pointer",
                                                            expandedSpecIndex === index && "bg-brand-blue/5"
                                                        )}
                                                        onClick={() => setExpandedSpecIndex(expandedSpecIndex === index ? null : index)}
                                                    >
                                                        <td className="p-3 font-bold text-slate-700">{spec.pos || '---'}</td>
                                                        <td className="p-3 text-slate-600 max-w-xs">
                                                            <div className="line-clamp-2 leading-tight">{spec.name || '---'}</div>
                                                        </td>
                                                        <td className="p-3 font-mono text-slate-600">{spec.article || '---'}</td>
                                                        <td className="p-3 text-slate-600">{spec.qty ? spec.qty.toLocaleString() : '---'}</td>
                                                        <td className="p-3 text-slate-600">{spec.unit || '---'}</td>
                                                        <td className="p-3 text-right font-bold text-slate-800">{spec.price ? spec.price.toLocaleString() : '---'}</td>
                                                        <td className="p-3 text-right font-bold text-slate-800">{spec.sumCur ? spec.sumCur.toLocaleString() : '---'}</td>
                                                        <td className="p-3 text-right font-bold text-brand-blue">{spec.sumUah ? spec.sumUah.toLocaleString() : '---'}</td>
                                                        <td className="p-3 text-right text-slate-600">{spec.weightGross ? spec.weightGross.toLocaleString() : '---'}</td>
                                                        <td className="p-3 text-right text-slate-600">{spec.weightNet ? spec.weightNet.toLocaleString() : '---'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Детальна картка для розгорнутої позиції */}
                                    {expandedSpecIndex !== null && goods[currentGoodIndex].invoiceSpecification[expandedSpecIndex] && (
                                        <Card className="border-brand-blue/20 shadow-md overflow-hidden">
                                            <CardContent className="p-4">
                                                {(() => {
                                                    const spec = goods[currentGoodIndex].invoiceSpecification[expandedSpecIndex];
                                                    return (
                                                        <div className="space-y-4">
                                                            {/* Основна інформація */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Позиція</span>
                                                                    <p className="text-sm font-black text-slate-800 mt-1">{spec.pos || '---'}</p>
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Найменування</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1 leading-tight">{spec.name || '---'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Артикул</span>
                                                                    <p className="text-sm font-mono text-slate-800 mt-1">{spec.article || '---'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Упаковка</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1">{spec.packaging || '---'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Торгова марка</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1">{spec.trademark || '---'}</p>
                                                                </div>
                                                            </div>

                                                            {/* Виробник та країна */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Виробник</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1">{spec.producerName || '---'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Країна виробника</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1">{spec.producerCountry || '---'}</p>
                                                                </div>
                                                            </div>

                                                            {/* Кількість та одиниці виміру */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Кількість</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1">{spec.qty ? spec.qty.toLocaleString() : '---'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Од. вим.</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1">{spec.unit || '---'}</p>
                                                                </div>
                                                                {spec.qty2 && spec.qty2 > 0 && (
                                                                    <>
                                                                        <div>
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Кількість 2</span>
                                                                            <p className="text-sm font-bold text-slate-800 mt-1">{spec.qty2.toLocaleString()}</p>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Од. вим. 2</span>
                                                                            <p className="text-sm font-bold text-slate-800 mt-1">{spec.unit2 || '---'}</p>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* Ціни та суми */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Ціна</span>
                                                                    <p className="text-sm font-black text-slate-800 mt-1">{spec.price ? spec.price.toLocaleString() : '---'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Сума (валюта)</span>
                                                                    <p className="text-sm font-black text-slate-800 mt-1">{spec.sumCur ? spec.sumCur.toLocaleString() : '---'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Сума (грн)</span>
                                                                    <p className="text-sm font-black text-brand-blue mt-1">{spec.sumUah ? spec.sumUah.toLocaleString() : '---'}</p>
                                                                </div>
                                                            </div>

                                                            {/* Ваги */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Брутто (кг)</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1">{spec.weightGross ? spec.weightGross.toLocaleString() : '---'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Нетто (кг)</span>
                                                                    <p className="text-sm font-bold text-slate-800 mt-1">{spec.weightNet ? spec.weightNet.toLocaleString() : '---'}</p>
                                                                </div>
                                                            </div>

                                                            {/* Додаткові характеристики */}
                                                            {spec.details && spec.details.length > 0 && (
                                                                <div className="pt-2 border-t border-slate-100">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-2">Додаткові характеристики</span>
                                                                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                                                        {spec.details.map((detail, detailIndex) => (
                                                                            <div key={detailIndex} className="flex gap-3 text-xs">
                                                                                <span className="font-bold text-slate-600 min-w-[80px]">{detail.code || '---'}:</span>
                                                                                <span className="text-slate-800">{detail.value || '---'}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Попередні декларації */}
                                                            {spec.prevDeclarations && spec.prevDeclarations.length > 0 && (
                                                                <div className="pt-2 border-t border-slate-100">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-2">Попередні декларації</span>
                                                                    <div className="bg-slate-50 rounded-lg overflow-hidden overflow-x-auto">
                                                                        <table className="w-full text-[10px] min-w-[800px]">
                                                                            <thead className="bg-slate-100 text-slate-500 uppercase font-bold">
                                                                                <tr>
                                                                                    <th className="p-2 text-left">МД</th>
                                                                                    <th className="p-2 text-left">Товар №</th>
                                                                                    <th className="p-2 text-left">Поз.</th>
                                                                                    <th className="p-2 text-right">Брутто (кг)</th>
                                                                                    <th className="p-2 text-right">Нетто (кг)</th>
                                                                                    <th className="p-2 text-right">Кількість</th>
                                                                                    <th className="p-2 text-left">Од. вим.</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100">
                                                                                {spec.prevDeclarations.map((prev, prevIndex) => (
                                                                                    <tr key={prevIndex} className="hover:bg-slate-50">
                                                                                        <td className="p-2 font-mono text-slate-700">{prev.mrn || '---'}</td>
                                                                                        <td className="p-2 text-slate-600">{prev.goodsNum || '---'}</td>
                                                                                        <td className="p-2 text-slate-600">{prev.pos || '---'}</td>
                                                                                        <td className="p-2 text-right text-slate-600">{prev.weightGross ? prev.weightGross.toLocaleString() : '---'}</td>
                                                                                        <td className="p-2 text-right text-slate-600">{prev.weightNet ? prev.weightNet.toLocaleString() : '---'}</td>
                                                                                        <td className="p-2 text-right text-slate-600">{prev.qty ? prev.qty.toLocaleString() : '---'}</td>
                                                                                        <td className="p-2 text-slate-600">{prev.unit || '---'}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <FileText className="w-12 h-12 opacity-20 mb-4" />
                                    <p className="text-sm font-bold">Специфікація товару відсутня</p>
                                </div>
                            )}
                        </CardContent>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button size="sm" onClick={() => {
                                setShowGoodSpecificationModal(false);
                                setExpandedSpecIndex(null);
                            }} className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg px-6">
                                Закрити
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Comments Section */}
            <DeclarationComments declarationId={declaration.id} />
        </div >
    );
}

function SectionTitle({ title }: { title: string }) {
    return (
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 mt-6 first:mt-0 px-1">
            {title}
        </h3>
    );
}

function SimpleRow({ label, value, vertical = false, highlight = false }: { label: string, value: string, vertical?: boolean, highlight?: boolean }) {
    return (
        <div className={cn(
            "p-3 bg-white flex gap-2",
            vertical ? "flex-col" : "flex-row items-center justify-between",
            highlight ? "bg-brand-blue/[0.02]" : ""
        )}>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
            <span className={cn(
                "font-bold truncate",
                highlight ? "text-brand-blue text-sm" : "text-slate-800 text-xs",
                vertical ? "whitespace-normal break-words" : "max-w-[60%]"
            )}>
                {value || '---'}
            </span>
        </div>
    );
}

function TabControl({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-1.5 text-[10px] font-black rounded-md transition-all uppercase tracking-wider",
                active 
                    ? "bg-white dark:bg-slate-700 text-brand-blue dark:text-white shadow-sm" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
        >
            {label}
        </button>
    );
}

function SectionContainer({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <SectionTitle title={title} />
            <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardContent className="p-0">{children}</CardContent>
            </Card>
        </div>
    );
}

function TableList({ columns, data, color = "" }: { columns: string[], data: string[][], color?: string }) {
    if (data.length === 0) return <div className="p-4 text-center text-slate-400 text-xs">Дані відсутні</div>;
    return (
        <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                <tr>
                    {columns.map((c, i) => <th key={i} className="p-3">{c}</th>)}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {data.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                        {row.map((cell, j) => (
                            <td key={j} className={cn("p-3", j === 0 ? "font-medium text-slate-700" : "text-slate-600", j === 0 ? color : "")}>
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function ModalField({ icon, label, value, highlight = false }: { icon: React.ReactNode, label: string, value: string, highlight?: boolean }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5">{icon}</div>
            <div className="space-y-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                <p className={cn(
                    "font-bold leading-none",
                    highlight ? "text-brand-blue font-mono text-sm" : "text-slate-800 text-xs"
                )}>{value}</p>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon, secondary = false }: { label: string, value: string, icon?: React.ReactNode, secondary?: boolean }) {
    return (
        <div className={cn(
            "p-3 rounded-xl border flex flex-col justify-center",
            secondary ? "bg-slate-50 border-slate-100" : "bg-brand-blue shadow-lg shadow-brand-blue/20 border-brand-blue/10"
        )}>
            <div className="flex items-center gap-1.5 mb-1">
                {icon && <div className={cn(secondary ? "text-slate-400" : "text-white/60")}>{icon}</div>}
                <span className={cn("text-[8px] font-black uppercase tracking-wider", secondary ? "text-slate-400" : "text-white/70")}>{label}</span>
            </div>
            <p className={cn("text-sm font-black", secondary ? "text-slate-800" : "text-white")}>{value}</p>
        </div>
    );
}

function BoxField({ nr, label, value, cols = 1, rows = 1, multiline = false }: { nr: string, label: string, value: string, cols?: number, rows?: number, multiline?: boolean }) {
    // Dynamic mapping for Tailwind col/row spans to avoid missing classes
    const colSpan = {
        1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4", 5: "col-span-5",
        6: "col-span-6", 8: "col-span-8", 10: "col-span-10", 14: "col-span-14", 18: "col-span-18"
    }[cols] || "col-span-1";

    const rowSpan = {
        1: "row-span-1", 2: "row-span-2", 3: "row-span-3", 4: "row-span-4"
    }[rows] || "row-span-1";

    return (
        <div
            className={cn(
                "border-b border-r border-black p-1.5 relative hover:bg-slate-50 transition-colors group",
                colSpan,
                rowSpan
            )}
        >
            <div className="flex justify-between items-start mb-0.5">
                <span className="text-[9px] font-black italic leading-none">{nr}</span>
                <span className="text-[6px] text-slate-400 uppercase leading-none group-hover:text-brand-blue transition-colors font-bold">{label}</span>
            </div>
            <div className={cn(
                "font-black text-black leading-tight",
                multiline ? "text-[10px] whitespace-pre-wrap" : "text-[11px] truncate",
                !value && "opacity-20"
            )}>
                {value || '---'}
            </div>
        </div>
    );
}

function PageButton({ active, onClick, label, disabled = false }: { active: boolean, onClick: () => void, label: string, disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "px-6 py-2 text-[11px] font-black rounded-lg transition-all uppercase tracking-widest border-2",
                active
                    ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-800",
                disabled && "opacity-30 cursor-not-allowed grayscale"
            )}
        >
            {label}
        </button>
    );
}

