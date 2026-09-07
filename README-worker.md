# Worker de recetas con IA — guía de deploy

El sitio es 100 % estático (GitHub Pages). Para generar recetas con IA sin exponer
la API key de Anthropic, hay un **Cloudflare Worker** en la carpeta `worker/` que
actúa de intermediario seguro: el navegador llama al Worker, y el Worker llama a
Anthropic con la clave guardada como *secret*.

```
navegador  ──POST { ingredientes:[...] }──▶  Cloudflare Worker  ──▶  API de Anthropic (claude-haiku-4-5)
   ▲                                              │  (usa ANTHROPIC_API_KEY, un secret)
   └──────────────  { ok:true, receta:{...} }  ◀──┘
```

---

## Requisitos (una sola vez)

- Una cuenta gratuita de Cloudflare: <https://dash.cloudflare.com/sign-up>
- Una API key de Anthropic: <https://console.anthropic.com/> → *API Keys*
- Node.js instalado (ya lo tienes si clonaste el repo)
- Dependencias del repo instaladas:

  ```bash
  npm install
  ```

  Esto instala **Wrangler** (la CLI de Cloudflare) como dependencia de desarrollo.

---

## Paso 1 — Iniciar sesión en Cloudflare

```bash
npm run worker:login
```

Se abre el navegador para autorizar Wrangler. (Equivale a `npx wrangler login`.)

## Paso 2 — Guardar la API key como secret

**Nunca** pongas la clave en un archivo. Guárdala cifrada en Cloudflare:

```bash
npm run worker:secret
```

Te pedirá pegar el valor de tu `ANTHROPIC_API_KEY`. Se guarda en Cloudflare, no en el repo.
(Equivale a `npx wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml`.)

## Paso 3 — Deploy del Worker

```bash
npm run worker:deploy
```

Al terminar, Wrangler imprime la URL pública del Worker, algo como:

```
https://recetario-ia.<tu-subdominio>.workers.dev
```

**Copia esa URL.**

## Paso 4 — Pegar la URL en el frontend

Abre `index.html`, busca esta línea (cerca del inicio del `<script>` de lógica):

```js
const IA_WORKER_URL = 'https://TU-WORKER.workers.dev'; // <-- cámbiala tras el deploy
```

y reemplázala por tu URL real:

```js
const IA_WORKER_URL = 'https://recetario-ia.tu-subdominio.workers.dev';
```

Guarda, haz commit y push. GitHub Pages se actualiza solo y la sección
**"Tus ingredientes favoritos"** empieza a funcionar.

---

## Probar en local (opcional)

```bash
npm run worker:dev          # levanta el Worker en http://localhost:8787
```

Para que use tu clave en local, crea un archivo `worker/.dev.vars` (ya está en
`.gitignore`, no se sube):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Prueba con curl:

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"ingredientes":["pollo","arroz integral","brócoli"]}'
```

> Si `wrangler dev` falla al arrancar el runtime local, aprueba los scripts de
> instalación con `npm install-scripts approve workerd esbuild` y reinténtalo.
> El `deploy` no necesita esos scripts.

---

## CORS

El Worker ya permite llamadas desde:

- `https://luifelipecd.github.io` (tu GitHub Pages)
- `http://localhost:8000` / `:3000` y `http://127.0.0.1:8000` / `:3000` (desarrollo)

Si sirves el sitio desde otro dominio, añádelo sin volver a tocar el código:
descomenta en `worker/wrangler.toml`

```toml
[vars]
ALLOWED_ORIGIN = "https://midominio.com,https://www.midominio.com"
```

y vuelve a hacer `npm run worker:deploy`.

---

## Qué hace el Worker (resumen)

- Solo acepta `POST` con `{ "ingredientes": string[] }` (máx. 20, recorta cada uno a 60 caracteres).
- Llama a `claude-haiku-4-5` pidiendo **una** receta alta en proteína en el
  formato exacto del sitio (`nombre`, `categoria`, `dieta`, `kcal`, `proteina`,
  `carbos`, `grasa`, `ingredientes[]`, `pasos[]`), respondiendo **solo JSON**.
- Valida y normaliza la respuesta. Si la IA falla o el JSON no es válido, devuelve
  `{ "ok": false, "error": "mensaje claro" }` — nunca filtra detalles internos ni la clave.
- Lee `ANTHROPIC_API_KEY` de una variable de entorno (secret). No hay ninguna clave en el código.

## Coste

`claude-haiku-4-5` cuesta ~$1 / millón de tokens de entrada y ~$5 / millón de salida.
Cada receta son unos cientos de tokens → céntimos por muchas generaciones.
El plan gratuito de Cloudflare Workers cubre 100 000 peticiones al día.
