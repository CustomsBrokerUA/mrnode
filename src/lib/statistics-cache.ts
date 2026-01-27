/**
 * Server-side кешування статистики декларацій.
 * 
 * **Стратегія кешування:**
 * - In-memory кеш на сервері (швидкий доступ)
 * - Кешується на рівні company (кожна компанія має свій кеш)
 * - Автоматична інвалідація при зміні даних
 * - Оновлюється тільки після синхронізації
 */

interface CachedCompanyStatistics {
    companyId: string;
    statistics: any;
    timestamp: number;
    lastSyncTimestamp: number | null; // Timestamp останньої синхронізації
}

// In-memory кеш для кожної компанії
const statisticsCache = new Map<string, CachedCompanyStatistics>();

// TTL для кешу (30 хвилин - статистика оновлюється тільки після синхронізації)
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Отримує кешовану статистику для компанії.
 * 
 * @param companyId - ID компанії
 * @returns Кешована статистика або null якщо не знайдена/застаріла
 */
export function getCachedCompanyStatistics(companyId: string): any | null {
    const cached = statisticsCache.get(companyId);
    
    if (!cached) {
        return null;
    }
    
    // Перевіряємо чи кеш не застарів
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
        statisticsCache.delete(companyId);
        return null;
    }
    
    return cached.statistics;
}

/**
 * Зберігає статистику для компанії в кеш.
 * 
 * @param companyId - ID компанії
 * @param statistics - Розрахована статистика
 * @param lastSyncTimestamp - Timestamp останньої синхронізації (опціонально)
 */
export function setCachedCompanyStatistics(
    companyId: string,
    statistics: any,
    lastSyncTimestamp?: number | null
): void {
    statisticsCache.set(companyId, {
        companyId,
        statistics,
        timestamp: Date.now(),
        lastSyncTimestamp: lastSyncTimestamp || null,
    });
}

/**
 * Очищає кеш статистики для компанії (викликається після синхронізації).
 * 
 * @param companyId - ID компанії
 */
export function invalidateCompanyStatisticsCache(companyId: string): void {
    statisticsCache.delete(companyId);
}

/**
 * Отримує кешовану архівну статистику (з урахуванням фільтрів).
 * 
 * @param cacheKey - Унікальний ключ кешу (з companyId, tab, filters)
 * @returns Кешована статистика або null якщо не знайдена/застаріла
 */
export function getCachedArchiveStatistics(cacheKey: string): any | null {
    const cached = statisticsCache.get(cacheKey);
    
    if (!cached) {
        return null;
    }
    
    // Перевіряємо чи кеш не застарів
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
        statisticsCache.delete(cacheKey);
        return null;
    }
    
    return cached.statistics;
}

/**
 * Зберігає архівну статистику в кеш (з урахуванням фільтрів).
 * 
 * @param cacheKey - Унікальний ключ кешу (з companyId, tab, filters)
 * @param statistics - Розрахована статистика
 */
export function setCachedArchiveStatistics(cacheKey: string, statistics: any): void {
    statisticsCache.set(cacheKey, {
        companyId: cacheKey.split('_')[0] || '', // Extract companyId from key
        statistics,
        timestamp: Date.now(),
        lastSyncTimestamp: null,
    });
}

/**
 * Очищає весь кеш статистики (для тестування або очищення).
 */
export function clearAllStatisticsCache(): void {
    statisticsCache.clear();
}

/**
 * Очищає застарілі записи з кешу (викликається періодично).
 */
export function cleanupStatisticsCache(): void {
    const now = Date.now();
    
    for (const [companyId, cached] of statisticsCache.entries()) {
        const age = now - cached.timestamp;
        if (age > CACHE_TTL) {
            statisticsCache.delete(companyId);
        }
    }
}

/**
 * Перевіряє чи потрібно оновити кеш на основі останньої синхронізації.
 * 
 * @param companyId - ID компанії
 * @param lastSyncTimestamp - Timestamp останньої синхронізації
 * @returns true якщо кеш потрібно оновити
 */
export function shouldRefreshStatisticsCache(
    companyId: string,
    lastSyncTimestamp: number
): boolean {
    const cached = statisticsCache.get(companyId);
    
    if (!cached) {
        return true; // Немає кешу - потрібно оновити
    }
    
    // Якщо остання синхронізація новіша за кеш - потрібно оновити
    if (!cached.lastSyncTimestamp || lastSyncTimestamp > cached.lastSyncTimestamp) {
        return true;
    }
    
    // Якщо кеш застарів - потрібно оновити
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
        return true;
    }
    
    return false;
}
