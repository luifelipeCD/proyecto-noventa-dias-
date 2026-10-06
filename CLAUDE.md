# noventa — contexto para Claude Code

El propietario autorizó continuar este proyecto en Claude Code, mejorar la aplicación y sus imágenes, ejecutar pruebas y subir los cambios directamente al repositorio existente. Comunícate en español sencillo.

## Proyecto y versión

- Repositorio: https://github.com/luifelipeCD/proyecto-noventa-dias-.git
- Rama de trabajo: `stripe-suscripcion`. Conserva esa rama. No fuerces subidas ni integres en `main` sin verificar la configuración de publicación.
- Sitio previsto: https://luifelipecd.github.io/proyecto-noventa-dias-/
- Frontend: `index.html` con scripts inline, `interface.css`, `redesign.css`, `sw.js`, `manifest.json`. Es una PWA en español, con diseño lila y marca «noventa» que el usuario aprobó.
- Backend: `worker/index.js`, Cloudflare Worker ESM con D1, KV, Resend, Stripe y Anthropic. Configuración en `worker/wrangler.toml`.
- Dependencias ya instaladas. Pruebas: `npm test`; sintaxis: `node --check worker/index.js` y `node --check sw.js`.
- Lee `docs/REVISION-Y-PUBLICACION.md`, `README-worker.md` y el encargo en `docs/ENCARGO-CLAUDE-CODE.md` antes de modificar.

## Lo que ya se hizo

Hay 72 recetas, programa de comidas de 90 días, calculadora de metas, progreso, calendario y una rutina semanal con 26 ejercicios. Se incorporaron 52 fotos de ejercicios originales y optimizadas, 72 imágenes ilustrativas propias del catálogo de comida, acceso por correo, portal de gestión y cancelación de Stripe, y copias privadas manuales de progreso con control de revisiones. Los archivos se subieron a GitHub y las 24 pruebas de la entrega final pasan.

Se corrigieron fechas locales, retornos de correo/Stripe a la carpeta de GitHub Pages, respuesta insegura de magic link sin Resend, reintentos de webhooks y caché HTML de la PWA. La demostración `.wrangler/preview-cuenta/` es local, ignorada por Git y tiene una cuenta ficticia. No copies su autenticación al producto.

## Colaboración en esta entrega

Codex terminó las imágenes específicas de recetas y sus versiones optimizadas. Están integradas por ID; revisa `docs/ENTREGA-NOVENTA.md` y el catálogo antes de cambiar imágenes. Si hay una nueva generación activa, **no modifiques ni añadas imágenes, `assets/recipes/catalog*`, los scripts de importación de imágenes ni el manifiesto de generación**. Puedes modificar el resto del código. Deja un punto claro para integrar fotos por ID de receta; Codex hará la integración final después de tu ejecución para evitar conflictos de edición.

Guarda tu informe en `docs/RESULTADO-CLAUDE-CODE.md`. Ejecuta pruebas, revisa diferencias y sube tus propios cambios a `origin stripe-suscripcion`. Añade únicamente los archivos que modificaste; no uses `git add -A` porque Codex puede tener activos archivos de imágenes. La conexión GitHub permite push, pero **no permite crear workflows**; la configuración quedó como plantilla `docs/github-checks.yml`.

## Reglas prácticas

- Conserva el diseño aprobado y compatibilidad con teléfonos de 390 px; no conviertas el proyecto a otro framework.
- No expongas secretos ni leas archivos de credenciales. Nunca añadas `.env`, `.dev.vars`, `.wrangler`, `node_modules`, enlaces de acceso o datos personales a Git.
- Sin `--dangerously-skip-permissions`. Usa los permisos de herramientas concedidos y reporta un bloqueo concreto si falta alguno.
- No hagas cobros, no crees cuentas ni aceptes contratos. No cambies credenciales, configuración global o permisos de seguridad.
- Subir a GitHub no demuestra una publicación. No despliegues el Worker ni migres D1 remoto en esta ejecución; prepara los archivos y pruebas. Los valores de precios Stripe siguen vacíos y el negocio debe confirmar pasarela y remitente.
- No afirmes que todo es seguro o listo para cobrar si quedan controles externos pendientes. Premium del catálogo está bloqueado visualmente; el servicio IA sí valida en servidor.
- Mantén licencias y créditos de fotos que sigan utilizándose. Las imágenes nuevas son ilustraciones generadas por IA, no fotografías de platos reales ni evidencia de resultados.
- Comprueba comportamiento con pruebas útiles; registra qué se verificó realmente y qué depende de servicios externos.

## Ramas paralelas

También existen ramas de Paddle y entrenamiento con trabajo posterior. No las sobrescribas ni vuelvas a introducir precios Stripe sin comparar el estado actual. Reúne los cambios en una rama de integración y verifica la pasarela elegida antes de publicar `main`.

## Continuar después

Desde la carpeta del repositorio, `npm run claude:continue` carga el encargo. Claude Code requiere una sesión iniciada (`claude auth login`). El usuario ya inició sesión durante esta entrega. No pegues claves en el chat.
