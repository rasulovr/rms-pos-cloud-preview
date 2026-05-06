# RMS POS Cloud Preview v0.1

Временная cloud-версия POS для тестирования интерфейса и логики.

## Запуск локально

```bash
npm install
cp .env.example .env
npm run dev
```

## Деплой на Vercel

1. Создать отдельный GitHub repo, например `rms-pos-cloud-preview`.
2. Загрузить туда файлы проекта.
3. В Vercel создать новый проект из этого repo.
4. Добавить Environment Variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_RMS_POS_TERMINAL_ID
```

5. Build command:

```text
npm run build
```

6. Output directory:

```text
dist
```

## Supabase

Выполнить SQL:

```text
sql/rms_pos_cloud_preview_tables.sql
```

## Важно

Это cloud-preview.  
Боевой POS позже будет отдельным локальным `.exe` с SQLite и offline sync.
