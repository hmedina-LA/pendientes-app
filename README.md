# Pendientes App

## 1. Conectar con Supabase
Abre `src/supabaseClient.js` y reemplaza:
- `TU_PROJECT_URL_AQUI` → tu Project URL
- `TU_ANON_PUBLIC_KEY_AQUI` → tu anon/public key

(Los copiaste en el paso 5: Project Settings > API en tu proyecto "pendientes-app" de Supabase).

## 2. Probar en local
```
npm install
npm run dev
```
Abre la URL que te muestre en la terminal (normalmente http://localhost:5173).

## 3. Subir a GitHub
Crea un repo nuevo llamado `pendientes-app` y sube estos archivos igual que hiciste con `finanzas-app`.

## 4. Desplegar en Vercel
Importa el repo en Vercel (misma cuenta `principal6`) como un proyecto nuevo. Vercel detecta automáticamente que es un proyecto Vite/React — no necesitas configurar nada extra.

## Qué falta (próximos pasos)
- Conectar el Atajo de captura por voz al Inbox.
- Agregar subtareas dentro de cada pendiente (ya existe la tabla `subtareas`, falta la interfaz).
- Filtro/vista completa "Todo" además de "Hoy".
