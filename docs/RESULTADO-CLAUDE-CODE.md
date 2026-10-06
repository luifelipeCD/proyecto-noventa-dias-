# Resultado de esta entrega — Claude Code

Fecha: 5 de octubre de 2026. Trabajo hecho sobre la rama `stripe-suscripcion`, en una copia
local limpia del repositorio. No se desplegó el Worker, no se migró D1 remoto, no se hicieron
cobros ni se creó ninguna cuenta externa. No se tocaron imágenes, `assets/recipes/catalog*`,
scripts de importación de imágenes ni el manifiesto de generación (trabajo de Codex en curso).

## 1. Preferencia alimentaria real

- Nuevo campo **"Preferencia alimentaria"** en el paso 3 del formulario (`index.html`,
  junto al nivel de actividad): Omnívora / Vegetariana / Vegana, con botones accesibles
  (`role="group"`, `aria-pressed`).
- La elección se guarda junto con los demás datos del plan (`datos.dieta`, dentro de
  `rp90_datos`) y se restaura al recargar o editar el plan.
- El menú automático de 90 días (`generarPlanDias` / `poolCategoria`) ahora filtra las
  recetas candidatas por la preferencia: vegana ve solo recetas veganas; vegetariana ve
  vegetarianas + veganas; omnívora ve todo el catálogo.
- El generador de recetas con IA recibe la preferencia (`dieta` en el cuerpo de `POST /`)
  y el Worker se la indica al modelo como **preferencia declarada por el usuario**, nunca
  como alergia o dato médico (`worker/index.js`, `DIETA_INSTRUCCION`). Un valor inválido o
  ausente se trata como "omnivora".
- Si ya existía un menú guardado con recetas que no respetan la nueva preferencia, se
  avisa con un mensaje claro y se pide confirmación antes de regenerarlo; el historial de
  días terminados y check-ins no se borra (`calcular()` + `planDiasCompatibleConDieta`).
- Datos antiguos sin el campo `dieta` (de antes de esta entrega) se tratan como "omnivora"
  automáticamente, sin romper nada.
- `worker/index.js`: `progresoValido` valida que `rp90_datos.dieta`, si viene, sea uno de
  los tres valores válidos.

## 2. Lista de compras

- Nueva sección plegable "🛒 Lista de compras de los próximos días" dentro de **Mi día**
  (reutiliza el patrón `<details class="more">` ya usado por "Cocina por lote").
- Agrupa los ingredientes de los próximos días del menú (hasta 7), sumando los gramos de
  las **porciones realmente ajustadas** a la meta de cada comida (mismo cálculo que ya usa
  "Mi día").
- Si el programa está por terminar (p. ej. en el día 88 de 90), la lista se limita a los
  días que quedan y lo indica en el texto del período ("tu programa termina pronto").
- Botón "Copiar lista" (con reintento vía `textarea` + `execCommand` si no hay
  `navigator.clipboard`) y estado vacío explícito tanto si no hay plan como si el programa
  ya terminó.
- No se recopila ningún dato nuevo: todo sale del menú y el plan que ya existían.

## 3. Disponibilidad de servicios

- Nuevo endpoint público **`GET /config`** en el Worker: devuelve solo booleanos
  (`correo`, `generacionIA`, `pagos.mensual`, `pagos.anual`) según si
  `RESEND_API_KEY` / `ANTHROPIC_API_KEY` / `STRIPE_SECRET_KEY` + los IDs de precio están
  configurados. Nunca expone claves, IDs ni otros valores.
- El frontend lo consulta al cargar y antes de mostrar el paywall, el formulario de inicio
  de sesión y el generador de IA:
  - Si los pagos no están configurados, ya no se promete "prueba gratis" ni se muestran
    botones de pago; se explica que todavía no está disponible.
  - Si el correo no está configurado, se avisa en el formulario de inicio de sesión y se
    deshabilita el envío.
  - Si la consulta falla por red, se muestra un aviso comprensible con botón
    **Reintentar** — nunca se asume disponibilidad ni se autoriza nada.
- Lo mismo para la verificación de sesión (`/me`): si falla por red, el paywall explica
  que no se pudo comprobar la suscripción y ofrece reintentar, en vez de autorizar premium
  o mostrar el paywall normal como si simplemente no hubiera suscripción.
- Ningún mensaje de error expone configuración interna (nombres de variables, URLs
  internas, etc.), solo texto genérico para la persona usuaria.

## 4. Entrenamiento usable

- Cada ejercicio de la rutina del día tiene un botón **"☐ Marcar hecho" / "✓ Hecho hoy"**
  (`aria-pressed`), guardado por fecha + día de rutina mostrado
  (`rp90_ejercicios_hechos`, nueva clave de `localStorage`).
- Barra y texto de **avance de la sesión** ("X / N ejercicios") arriba de la lista de
  ejercicios del día.
- Nuevo **temporizador de descanso** accesible con iniciar/pausar/reiniciar, duración
  elegible (30/60/90/120 s), cuenta regresiva visual y una región `aria-live` separada que
  anuncia los cambios de estado (inicio, pausa, fin) sin leer cada segundo — vive fuera del
  bloque que se vuelve a dibujar al cambiar de pestaña de día, así no se reinicia solo.
- No se agregó personalización "profesional": la rutina semanal sigue siendo la misma
  referencia general de siempre.
- `worker/index.js`: `PROGRESS_KEYS` y `progresoValido` se extendieron para aceptar
  `rp90_ejercicios_hechos` (fecha válida, día 0–6, índices de ejercicio enteros) de forma
  compatible con el resto de la validación existente.

## 5. Revisión de publicación

- Accesibilidad en las funciones nuevas: `aria-pressed` en todos los botones de selección
  (dieta, temporizador), `role="group"` + `aria-labelledby`/`aria-label`, región
  `aria-live` dedicada para el temporizador en vez de leer la cuenta regresiva completa.
- El flujo sin conexión para premium quedó explícito: una falla de red al comprobar la
  cuenta o la disponibilidad de servicios **nunca** desbloquea funciones premium ni
  promete que se validaron sin red; se muestra un estado claro con botón de reintento.
- `ul.ing-list` dejó de depender de estar dentro de `.modal-card` para verse bien (ahora
  también se usa en la lista de compras), sin cambiar su apariencia dentro del modal de
  receta.
- No se tocó el esquema de pagos ni la autenticación completa (login sin contraseña,
  Stripe Checkout/portal/webhooks) más allá de leer disponibilidad pública y extender la
  validación de progreso de forma aditiva.

## Validación realizada

- `npm test` → **16/16 pruebas en verde** (11 originales + 5 nuevas):
  - Menú de 90 días respeta la preferencia alimentaria en las tres dietas y los datos
    antiguos sin `dieta` usan "omnivora".
  - Lista de compras agrega gramos correctamente y respeta el final del programa de 90
    días (probado en el día 88 y en el último día).
  - `GET /config` devuelve los booleanos correctos en varias combinaciones y nunca filtra
    los valores reales (ej. IDs de precio).
  - El generador de IA recibe y aplica la preferencia alimentaria, y el texto que se le
    manda al modelo aclara explícitamente que es una preferencia declarada, no una
    alergia.
  - El progreso acepta los nuevos campos válidos y rechaza las variantes mal formadas
    (día de rutina fuera de 0–6, índices no numéricos, preferencia alimentaria inválida).
- `node --check worker/index.js` y `node --check sw.js` → sin errores de sintaxis.
- `git diff --check` → sin espacios en blanco conflictivos.
- Revisión manual del diff completo de `index.html` y `worker/index.js`.
- **Lo que no se verificó** (depende de servicios externos que no se activaron en esta
  entrega): envío real de correos con Resend, cobros o checkout real de Stripe,
  generación real con la API de Anthropic, y despliegue del Worker o GitHub Pages. La
  demostración local en `.wrangler/` no se usó ni se modificó.

## Pendiente antes de publicar

Sigue vigente lo que ya señalaba `docs/REVISION-Y-PUBLICACION.md`: precios de Stripe
vacíos, país del negocio sin confirmar, Resend sin remitente verificado, migración de
`user_progress` pendiente de aplicar en D1 remoto, y el Worker sin
desplegar. El nuevo endpoint `/config` ayuda a que la interfaz no anuncie de más mientras
eso se resuelve, pero no reemplaza esas tareas.

## Commits y subida

Cambios en: `index.html`, `worker/index.js`, `README-worker.md`, `tests/regression.test.mjs`.
No se modificaron imágenes, archivos de catálogo de recetas, ni la configuración de
`.github/workflows` (sigue como plantilla en `docs/github-checks.yml`).

Commit subido a `origin/stripe-suscripcion`: `c30d74d` (fast-forward desde `7a81cf7`).

Nota de revisión posterior: Codex integró las imágenes y corrigió sesión de IA, disponibilidad completa, persistencia de varias rutinas por fecha y temporizador. La validación conjunta pasa 24 pruebas; consulta `docs/ENTREGA-NOVENTA.md`.
