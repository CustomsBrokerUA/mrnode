# Виправлення помилки Turbopack з Prisma Client

## Проблема
Turbopack на Windows має проблеми з Prisma Client, особливо після додавання нових моделей.

## Рішення

### Крок 1: Зупинити dev server
Натисніть `Ctrl+C` в терміналі, де працює `npm run dev`.

### Крок 2: Перегенерувати Prisma Client
```bash
npx prisma generate
```

### Крок 3: Очистити кеш (якщо ще не зроблено)
```bash
# Кеш .next вже видалено автоматично
```

### Крок 4: Перезапустити dev server
```bash
npm run dev
```

## Якщо проблема залишається

### Варіант 1: Використати стандартний webpack (не Turbopack)
В `next.config.mjs` додайте:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: false, // Вимкнути Turbopack
  },
};
```

### Варіант 2: Перевстановити залежності
```bash
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma
npm install
npx prisma generate
```

## Примітки

- Додано `postinstall` скрипт в `package.json` для автоматичної генерації Prisma Client після `npm install`
- Додано `prisma generate` в `build` скрипт для production build
