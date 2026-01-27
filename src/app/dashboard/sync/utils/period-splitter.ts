/**
 * Розбиває період на чанки по максимум maxDays днів
 * @param startDate Дата початку
 * @param endDate Дата кінця
 * @param maxDays Максимальна кількість днів в чанку (за замовчуванням 7 для syncAllPeriod, 45 для звичайних запитів)
 * @returns Масив об'єктів { start: Date, end: Date }
 */
export function splitPeriodIntoChunks(
    startDate: Date,
    endDate: Date,
    maxDays: number = 45
): Array<{ start: Date; end: Date }> {
    const chunks: Array<{ start: Date; end: Date }> = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    let currentStart = new Date(start);
    
    while (currentStart < end) {
        const currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + maxDays - 1);
        currentEnd.setHours(23, 59, 59, 999);
        
        // Не перевищувати кінцеву дату
        if (currentEnd > end) {
            currentEnd.setTime(end.getTime());
        }
        
        chunks.push({
            start: new Date(currentStart),
            end: new Date(currentEnd)
        });
        
        // Перейти до наступного чанку
        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
        currentStart.setHours(0, 0, 0, 0);
    }
    
    return chunks;
}
