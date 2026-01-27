# Синхронізація курсів валют

Система автоматичної синхронізації курсів валют з API Національного банку України.

## Структура

- **База даних**: Таблиця `ExchangeRate` зберігає курси валют за кожну дату
- **API endpoint**: `/api/exchange-rates/sync` для запуску синхронізації
- **Скрипт**: `sync-exchange-rates.js` для ручного запуску

## Перше заповнення бази даних

Для заповнення бази даних курсами за останні 3 роки:

```bash
npm run sync-exchange-rates:full
```

Або через Node.js:

```bash
node sync-exchange-rates.js full
```

## Щоденне оновлення

Для синхронізації відсутніх курсів (останні 30 днів):

```bash
npm run sync-exchange-rates:daily
```

Або через Node.js:

```bash
node sync-exchange-rates.js daily
```

## Автоматичне оновлення

### Варіант 1: Через API endpoint (для Vercel Cron або подібних сервісів)

Налаштуйте cron job, який буде викликати:

```
GET /api/exchange-rates/sync?type=daily
```

**Приклад для Vercel (`vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/exchange-rates/sync?type=daily",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Варіант 2: Через системний cron (Linux/Mac)

Додайте в crontab (`crontab -e`):

```cron
# Оновлення курсів валют щодня о 2:00 ранку
0 2 * * * cd /path/to/MRNode && node sync-exchange-rates.js daily >> /var/log/exchange-rates-sync.log 2>&1
```

### Варіант 3: Через Windows Task Scheduler

1. Відкрийте Task Scheduler
2. Створіть нову задачу
3. Налаштуйте:
   - **Тригер**: Щодня о 2:00
   - **Дія**: Запустити програму
   - **Програма**: `node`
   - **Аргументи**: `sync-exchange-rates.js daily`
   - **Робоча папка**: `C:\MRNode`

### Варіант 4: Через зовнішній сервіс (cron-job.org, EasyCron)

Налаштуйте HTTP запит:
- **URL**: `https://your-domain.com/api/exchange-rates/sync?type=daily`
- **Метод**: GET
- **Розклад**: Щодня о 2:00

## Використання в коді

### Отримання курсу з бази даних

```typescript
import { getExchangeRateFromDB } from '@/lib/exchange-rate-sync';

const rate = await getExchangeRateFromDB('USD', new Date('2024-01-15'));
```

### Автоматичне отримання курсу (спочатку БД, потім API)

Функція `getUSDExchangeRateForDate` автоматично перевіряє базу даних перед викликом API:

```typescript
import { getUSDExchangeRateForDate } from '@/lib/nbu-api';

const rate = await getUSDExchangeRateForDate('2024-01-15');
```

## Структура бази даних

```prisma
model ExchangeRate {
  id            String   @id @default(uuid())
  date          DateTime @db.Date
  currencyCode  String   // USD, EUR, etc.
  rate          Float
  currencyName  String?  // Назва валюти
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([date, currencyCode])
  @@index([date])
  @@index([currencyCode])
}
```

## API Endpoints

### GET /api/exchange-rates/sync

Синхронізує курси валют.

**Параметри:**
- `type` (query): `full` або `daily`
  - `full`: Синхронізує за останні 3 роки
  - `daily`: Синхронізує відсутні курси (останні 30 днів)

**Приклад:**
```bash
curl http://localhost:3000/api/exchange-rates/sync?type=daily
```

**Відповідь:**
```json
{
  "success": true,
  "message": "Синхронізовано відсутні курси валют: 15",
  "totalSynced": 15
}
```

## Примітки

- API НБУ може мати обмеження на кількість запитів, тому додано затримку 100мс між запитами
- Курси синхронізуються тільки для робочих днів (але перевіряються всі дні)
- При відсутності курсу в БД система автоматично використовує API НБУ
