# Адмін панель — пропозиції та план розвитку

Цей документ — беклог ідей для адмін-панелі. Я пропоную брати задачі **в порядку P0 → P1 → P2**, або ти можеш пріоритезувати по ситуації.

## Принципи (щоб адмінка не стала ризиком)
- **Доступ**: тільки `andrii@brokerua.com` (як зараз) + опційно feature-flag `ADMIN_PANEL_ENABLED=true` для швидкого вимкнення.
- **Read-only за замовчуванням**: керуючі дії тільки з підтвердженням.
- **Аудит адмін-дій**: будь-яка зміна (write action) має логуватись.
- **Без показу секретів**: токени/ключі не відображати повністю (тільки `isSet`, `updatedAt`, останні 4 символи — за потреби).
- **Пагінація/фільтри**: не тягнути всю БД.

---

## P0 (операційна критичність)

### P0-1. Моніторинг Sync Jobs + Errors
**Навіщо**: найчастіше проблеми в проді — це sync/інтеграції.

**Екран**: `/dashboard/admin/sync`
- Показати `SyncJob` (status, createdAt/updatedAt, company, dateFrom/dateTo, прогрес полів).
- Показати `SyncJobError` (chunkNumber, errorCode, message, retryAttempts).
- Фільтри: статус, компанія, дата.

**Дії**:
- `cancel job`
- `retry failed chunks` (або retry job)

**Acceptance**:
- Можна знайти останні 24h помилки і зрозуміти, що саме впало.
- Можна безпечно перезапустити/доретрайти.

### P0-2. "Користувачі без активної компанії" + швидкий фікс
**Екран**: `/dashboard/admin/users` (або на головній адмінці блок)
- Фільтр: `activeCompanyId is null`.
- Показати їх `UserCompany` (якщо є) або "0 компаній".

**Дія**:
- `setActiveCompany(userId, companyId)` (тільки якщо доступ є).

### P0-3. Детальна сторінка користувача
**Екран**: `/dashboard/admin/users/[userId]`
- email, fullName, role, createdAt.
- activeCompanyId.
- всі `UserCompany` (включно `isActive=false`) + дані компанії.

**Дії**:
- активувати/деактивувати доступ до компанії (`UserCompany.isActive`).
- зробити конкретну компанію активною.

---

## P1 (керування компаніями + сапорт)

### P1-1. Список компаній + сторінка компанії
**Екран**: `/dashboard/admin/companies`
- Пошук по назві/ЄДРПОУ.
- Статус: `deletedAt`, `isActive`, `customsToken isSet`.

**Екран**: `/dashboard/admin/companies/[companyId]`
- користувачі з ролями.
- sync-історія (`SyncHistory`) по компанії.

**Дії**:
- додати користувача до компанії (email + роль).
- змінити роль.
- забрати доступ.

### P1-2. Мінімальний "Health" екран
**Екран**: `/dashboard/admin/health`
- DB ping / час відповіді.
- кількість користувачів/компаній.
- останній sync exchange rates.

---

## P2 (якість/аналітика/зручність)

### P2-1. Аномалії/алерти
**Екран**: `/dashboard/admin/alerts`
- користувачі з 0 компаній.
- компанії з 0 користувачів.
- компанії з великою кількістю sync помилок за 24h.
- відсутні курси валют за сьогодні.

### P2-2. AdminAuditLog (журнал дій адміна)
**Модель**: `AdminAuditLog`
- adminEmail, action, targetType (user/company/job), targetId, payload, success, createdAt.

**Acceptance**:
- будь-яка write-дія з адмінки записується.

### P2-3. Масові операції (обережно)
- масово привʼязати компанії/користувачів за списком.
- backfill/repair tasks (але з rate limit і курсором).

---

## Пропозиція по навігації
- `/dashboard/admin` — головна (швидкі дії + блок Users)
- `/dashboard/admin/users` — користувачі
- `/dashboard/admin/companies` — компанії
- `/dashboard/admin/sync` — sync jobs/errors
- `/dashboard/admin/health` — health
- `/dashboard/admin/alerts` — аномалії

---

## Зауваження по безпеці (рекомендовано)
- Додати `ADMIN_PANEL_ENABLED` і вимикати адмінку в один клік.
- Для небезпечних операцій: підтвердження (наприклад, введення email/edrpou повторно).
- Усі write-дії логувати в `AdminAuditLog`.

