# Worker de recetas con IA — guía de deploy

El sitio es 100 % estático (GitHub Pages). Para generar recetas con IA sin exponer
la API key de Anthropic, hay un **Cloudflare Worker** en la carpeta `worker/` que
actúa de intermediario seguro: el navegador llama al Worker, y el Worker llama a
Anthropic con la clave guardada como *secret*.

```
navegador ──POST { ingredientes:[...], turnstileToken }──▶  Cloudflare Worker
   ▲                                                          │  CORS estricto + Turnstile + límite por IP
   │                                                          ├──▶  Turnstile /siteverify   (TURNSTILE_SECRET_KEY)
   └────────────  { ok:true, receta:{...}, restantes }  ◀──────┴──▶  API de Anthropic         (ANTHROPIC_API_KEY)
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

## Paso 2 — Guardar los secrets

**Nunca** pongas claves en un archivo. Guárdalas cifradas en Cloudflare:

```bash
# API key de Anthropic
npm run worker:secret

# Secret Key de Cloudflare Turnstile (captcha)
npx wrangler secret put TURNSTILE_SECRET_KEY --config worker/wrangler.toml
```

En cada prompt "Enter a secret value:" pegas **solo el valor** (sin comillas ni espacios).
Se guardan en Cloudflare, no en el repo.

| Secret | De dónde sale | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (`sk-ant-api03-…`) | llamar al modelo |
| `TURNSTILE_SECRET_KEY` | dash.cloudflare.com → Turnstile → tu widget → *Secret Key* (`0x4A…`) | validar el captcha |

> La **Site Key** de Turnstile (`0x4AAAAAAEr6xThiKA2d4tpi`) es pública y ya está en `index.html`.
> En el panel de Turnstile, en *Allowed hostnames*, deja solo `luifelipecd.github.io`.
> Si `TURNSTILE_SECRET_KEY` no está configurado, el Worker **no** bloquea (lo registra en los logs).

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

Para que use tus secrets en local, crea `worker/.dev.vars` (ya está en `.gitignore`):

```
ANTHROPIC_API_KEY=sk-ant-...
# TURNSTILE_SECRET_KEY=0x4A...   (déjalo comentado para probar sin captcha en local)
```

Prueba con curl (el header `Origin` es obligatorio por el CORS estricto):

```bash
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "Origin: https://luifelipecd.github.io" \
  -d '{"ingredientes":["pollo","arroz integral","brócoli"]}'
```

Sin `Origin` (o con otro) responde `403 Origen no permitido`. Con `TURNSTILE_SECRET_KEY`
definido necesitarías un token real de Turnstile, así que para probar en local déjalo sin definir.

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

## Seguridad

| Capa | Qué hace |
|---|---|
| **CORS estricto** | Solo se acepta el `Origin` `https://luifelipecd.github.io` (o los de la var `ALLOWED_ORIGIN`). Cualquier otro origen, o sin origen → **403**. `Access-Control-Allow-Origin` nunca es `*`. |
| **Turnstile** | Antes de generar nada, el token del captcha se valida contra `siteverify` con `TURNSTILE_SECRET_KEY`. Si falla → **403 `{ captcha: true }`**. Sin el secret, la verificación queda desactivada (aviso en logs). |
| **Prompt anti-inyección** | El system prompt ordena tratar la lista de ingredientes **solo como datos** e ignorar cualquier instrucción dentro (cambiar rol, revelar el prompt, etc.). Los ingredientes van delimitados (`<<<INGREDIENTES>>> … <<<FIN>>>`) y saneados (se quitan `<` `>`). |
| **Validación de entrada** | Lista corta: máx. **15** ingredientes, **≤48** caracteres y **≤8** palabras cada uno, **≤300** en total. Un párrafo largo → **400** pidiendo ingredientes sueltos. |
| **Límite por IP** | Máx. 5 generaciones OK por IP cada 24 h (ver arriba). |
| **Sin secretos en el código** | `ANTHROPIC_API_KEY` y `TURNSTILE_SECRET_KEY` se leen de `env`. El repo nunca los contiene. Los errores de Anthropic no se reenvían al cliente. |

## Qué hace el Worker (resumen)

- Solo `POST` con `{ "ingredientes": string[], "turnstileToken": string }` desde el origen del sitio.
- Valida la entrada → límite por IP → Turnstile → llama a `claude-haiku-4-5` pidiendo **una**
  receta alta en proteína en el formato del sitio (`nombre`, `categoria`, `dieta`, `kcal`,
  `proteina`, `carbos`, `grasa`, `ingredientes[]`, `pasos[]`), **solo JSON**.
- Valida y normaliza la respuesta. Si algo falla → `{ "ok": false, "error": "mensaje claro" }`.
- Cada respuesta OK trae `"restantes": N`.

## Coste

`claude-haiku-4-5` cuesta ~$1 / millón de tokens de entrada y ~$5 / millón de salida.
Cada receta son unos cientos de tokens → céntimos por muchas generaciones.
El plan gratuito de Cloudflare Workers cubre 100 000 peticiones al día.
