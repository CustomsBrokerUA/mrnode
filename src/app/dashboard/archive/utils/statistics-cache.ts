/**
 * Утиліти для кешування статистики декларацій.
 * 
 * **Стратегія кешування:**
 * - Hash-based кешування в пам'яті (швидкий доступ)
 * - Персистентне кешування в localStorage (для великих наборів)
 * - Автоматична інвалідація при зміні даних
 * - TTL (Time To Live) для автоматичного оновлення
 */

// Інтерфейс для кешованих даних
interface CachedStatistics {
    hash: string;
    statistics: any;
    timestamp: number;
    count: number; // кількість декларацій
}

// Налаштування кешу
const CACHE_CONFIG = {
    // TTL в мілісекундах (1 година)
    TTL: 60 * 60 * 1000,
    // Максимальна кількість записів в пам'яті
    MAX_MEMORY_ENTRIES: 50,
    // Ключ для localStorage
    STORAGE_KEY: 'archive_statistics_cache',
    // Мінімальна кількість декларацій для кешування в localStorage (200+)
    MIN_STORAGE_COUNT: 200,
} as const;

// In-memory кеш (швидкий доступ)
const memoryCache = new Map<string, CachedStatistics>();

/**
 * Генерує hash від ключових параметрів для унікальної ідентифікації набору даних.
 * 
 * @param filteredDocsIds - Масив ID декларацій (для швидкого hash)
 * @param activeTab - Активна вкладка
 * @returns MD5-like hash рядок
 */
export function generateStatisticsHash(
    filteredDocsIds: string[],
    activeTab: string
): string {
    // Простий hash функція (для production можна використати crypto.subtle)
    // Використовуємо ID та їх кількість для швидкого hash
    const idsString = filteredDocsIds.slice(0, 100).join(',') + `|${filteredDocsIds.length}|${activeTab}`;
    
    let hash = 0;
    for (let i = 0; i < idsString.length; i++) {
        const char = idsString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    return `${activeTab}_${Math.abs(hash)}_${filteredDocsIds.length}`;
}

/**
 * Отримує статистику з кешу (пам'ять або localStorage).
 * 
 * @param hash - Hash набору даних
 * @returns Кешована статистика або null якщо не знайдена/застаріла
 */
export function getCachedStatistics(hash: string): any | null {
    // Спочатку перевіряємо пам'ять
    const memoryEntry = memoryCache.get(hash);
    if (memoryEntry) {
        const age = Date.now() - memoryEntry.timestamp;
        if (age < CACHE_CONFIG.TTL) {
            return memoryEntry.statistics;
        }
        // Застарілий запис - видаляємо
        memoryCache.delete(hash);
    }

    // Перевіряємо localStorage (тільки в браузері)
    if (typeof window === 'undefined') {
        return null;
    }
    
    try {
        const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
        if (stored) {
            const cache: Record<string, CachedStatistics> = JSON.parse(stored);
            const entry = cache[hash];
            
            if (entry) {
                const age = Date.now() - entry.timestamp;
                if (age < CACHE_CONFIG.TTL) {
                    // Відновлюємо в пам'ять для швидкого доступу
                    memoryCache.set(hash, entry);
                    // Обмежуємо розмір кешу в пам'яті
                    if (memoryCache.size > CACHE_CONFIG.MAX_MEMORY_ENTRIES) {
                        const first = memoryCache.keys().next();
                        if (!first.done) {
                            memoryCache.delete(first.value);
                        }
                    }
                    return entry.statistics;
                }
                // Застарілий запис - видаляємо з localStorage
                delete cache[hash];
                localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(cache));
            }
        }
    } catch (error) {
        // Помилка парсингу localStorage - очищаємо
        console.warn('Statistics cache: localStorage parse error', error);
        try {
            localStorage.removeItem(CACHE_CONFIG.STORAGE_KEY);
        } catch {
            // Ignore
        }
    }

    return null;
}

/**
 * Зберігає статистику в кеш (пам'ять та localStorage для великих наборів).
 * 
 * @param hash - Hash набору даних
 * @param statistics - Розрахована статистика
 * @param count - Кількість декларацій
 */
export function setCachedStatistics(
    hash: string,
    statistics: any,
    count: number
): void {
    const entry: CachedStatistics = {
        hash,
        statistics,
        timestamp: Date.now(),
        count,
    };

    // Зберігаємо в пам'ять
    memoryCache.set(hash, entry);
    
    // Обмежуємо розмір кешу в пам'яті
    if (memoryCache.size > CACHE_CONFIG.MAX_MEMORY_ENTRIES) {
        // Видаляємо найстаріші записи
        const entries = Array.from(memoryCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = entries.slice(0, memoryCache.size - CACHE_CONFIG.MAX_MEMORY_ENTRIES);
        toDelete.forEach(([key]) => memoryCache.delete(key));
    }

    // Зберігаємо в localStorage тільки для великих наборів (для персистентності)
    // Тільки в браузері
    if (typeof window !== 'undefined' && count >= CACHE_CONFIG.MIN_STORAGE_COUNT) {
        try {
            const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
            const cache: Record<string, CachedStatistics> = stored ? JSON.parse(stored) : {};
            
            // Додаємо новий запис
            cache[hash] = entry;
            
            // Очищаємо застарілі записи та обмежуємо розмір
            const now = Date.now();
            const validEntries: Record<string, CachedStatistics> = {};
            let entryCount = 0;
            const maxEntries = 20; // Максимум 20 записів в localStorage
            
            // Сортуємо за timestamp (новіші перші)
            const sortedEntries = Object.entries(cache)
                .filter(([_, entry]) => now - entry.timestamp < CACHE_CONFIG.TTL)
                .sort((a, b) => b[1].timestamp - a[1].timestamp);
            
            // Беремо тільки найновіші
            for (const [key, value] of sortedEntries) {
                if (entryCount < maxEntries) {
                    validEntries[key] = value;
                    entryCount++;
                }
            }
            
            localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(validEntries));
        } catch (error) {
            // Помилка запису в localStorage (переповнення або інша) - ігноруємо
            console.warn('Statistics cache: localStorage write error', error);
        }
    }
}

/**
 * Очищає весь кеш статистики.
 */
export function clearStatisticsCache(): void {
    memoryCache.clear();
    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem(CACHE_CONFIG.STORAGE_KEY);
        } catch {
            // Ignore
        }
    }
}

/**
 * Очищає застарілі записи з кешу.
 */
export function cleanupStatisticsCache(): void {
    const now = Date.now();
    
    // Очищаємо пам'ять
    for (const [key, entry] of memoryCache.entries()) {
        if (now - entry.timestamp >= CACHE_CONFIG.TTL) {
            memoryCache.delete(key);
        }
    }

    // Очищаємо localStorage (тільки в браузері)
    if (typeof window === 'undefined') {
        return;
    }
    
    try {
        const stored = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
        if (stored) {
            const cache: Record<string, CachedStatistics> = JSON.parse(stored);
            const validEntries: Record<string, CachedStatistics> = {};
            
            for (const [key, entry] of Object.entries(cache)) {
                if (now - entry.timestamp < CACHE_CONFIG.TTL) {
                    validEntries[key] = entry;
                }
            }
            
            localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(validEntries));
        }
    } catch {
        // Ignore
    }
}

// Автоматичне очищення при завантаженні модуля (раз в день) - тільки в браузері
if (typeof window !== 'undefined') {
    cleanupStatisticsCache();
    
    // Очищаємо раз на день
    try {
        const lastCleanup = localStorage.getItem('stats_cache_last_cleanup');
        const oneDay = 24 * 60 * 60 * 1000;
        if (!lastCleanup || Date.now() - parseInt(lastCleanup) > oneDay) {
            cleanupStatisticsCache();
            localStorage.setItem('stats_cache_last_cleanup', Date.now().toString());
        }
    } catch {
        // Ignore
    }
}