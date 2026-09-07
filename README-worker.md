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

## Límite de uso (anti-abuso y control de gasto)

Cada dirección IP puede generar **máximo 5 recetas con IA cada 24 horas**.

- El contador se guarda en el **KV namespace `RATE_LIMIT`** (binding en `worker/wrangler.toml`),
  con clave `rl:<IP>` (la IP viene del header `CF-Connecting-IP`).
- Solo cuentan las generaciones que **salieron bien** (un fallo de la IA no gasta cupo).
- Cada respuesta correcta trae `"restantes": N` (cuántas quedan hoy); el frontend lo muestra.
- Al superar el límite → **HTTP 429** con
  `{ "ok": false, "limited": true, "error": "Ya generaste el máximo de recetas con IA por hoy (5). Vuelve mañana 🙂" }`.
  El frontend lo enseña como un aviso tranquilo (ámbar), no como error.
- La ventana es fija: arranca en la primera generación y el registro caduca solo a las ~24 h.
- Si el KV no está o falla, el Worker **no bloquea** (fail-open) y lo registra en `wrangler tail`.

Para cambiar el límite, edita `LIMITE_DIARIO` en `worker/index.js` y redespliega.

### Resetear el contador (p. ej. tras pruebas)

Lo más simple: **espera 24 h**, caduca solo.

Para borrarlo ya, necesitas la IP (mírala en `wrangler tail`, campo `cf-connecting-ip`, o con `curl https://api.ipify.org`):

```bash
# borra el contador de una IP  (¡ojo: --remote, sin él toca el KV local!)
npx wrangler kv key delete "rl:LA_IP" --namespace-id b0ab7c59a9f7443b80ea5066c6e1a623 --remote

# ver todas las IPs con contador / valores
npx wrangler kv key list --namespace-id b0ab7c59a9f7443b80ea5066c6e1a623 --remote
npx wrangler kv key get  "rl:LA_IP" --namespace-id b0ab7c59a9f7443b80ea5066c6e1a623 --remote
```

O desde el panel: **Cloudflare → Storage & Databases → KV → `RATE_LIMIT`** → borra las claves `rl:*`.

> Ya reseteé el contador que se creó durante las pruebas de esta implementación
> (5 generaciones OK + 1 bloqueada, todas desde mi IP). El namespace quedó vacío.

---

## Qué hace el Worker (resumen)

- Solo acepta `POST` con `{ "ingredientes": string[] }` (máx. 20, recorta cada uno a 60 caracteres).
- **Límite de 5 generaciones OK por IP cada 24 h** (KV `RATE_LIMIT`); la 6ª devuelve 429 sin llamar a la IA.
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
