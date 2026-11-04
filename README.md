# Прокат автомобилей

Десктопное приложение: информационная система «Прокат автомобилей».
Стек: Electron, React, TypeScript, SQLite (better-sqlite3).

## Запуск

```bash
npm install
npm run dev
```

## Установщик для Windows

```bash
npm run dist
```

Готовый `Прокат-автомобилей-Setup-0.1.0.exe` появится в папке `dist/`.

## Структура

- `db/schema.sql` — схема БД (клиенты, автомобили, договоры проката)
- `src/main` — основной процесс Electron, работа с SQLite
- `src/preload` — безопасный мост между окном и БД
- `src/renderer` — интерфейс на React

База данных хранится в `%APPDATA%\Прокат автомобилей\carrental.db`.
