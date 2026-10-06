# Revisión de la aplicación y preparación para publicar

Fecha: 5 de octubre de 2026. Revisión del código local y de la vista de demostración. Las pruebas de Stripe usan respuestas simuladas; no se han realizado cobros ni desplegado el Worker. El servicio publicado `/me` responde 401 sin credenciales, como corresponde. No se verificaron sus secretos ni las condiciones de una cuenta comercial.

## Lo que funciona como base de producto

La aplicación reúne cálculo de metas, 72 recetas, menú para 90 días, progreso y rutina semanal. El diseño es coherente, la navegación es sencilla y se puede instalar como aplicación web. El proyecto real conserva el control de acceso; la cuenta ficticia utilizada para mostrarlo solo existe en una carpeta local ignorada por Git.

## Fallos corregidos en esta entrega

| Problema | Corrección |
|---|---|
| Correo y pagos regresaban a la raíz de github.io y perdían la carpeta del proyecto | APP_URL y un constructor de URL compartido conservan la ubicación del sitio |
| Sin Resend, se devolvía un enlace que permitía entrar sin demostrar acceso al correo | Se rechaza el acceso en producción cuando falta el servicio; el enlace de desarrollo requiere DEV_MODE explícito y un origen local. No se registran tokens en los logs |
| Stripe recibía confirmación aunque hubiera fallado la actualización de la suscripción | Un fallo devuelve 503 y libera el evento registrado para permitir el reintento |
| Abrir una fotografía podía guardarla como la página principal sin conexión | La caché de navegación solo guarda el HTML correcto de la aplicación; no guarda errores ni elimina cachés de otras aplicaciones |
| El calendario cambiaba de día a las 19:00 en Ecuador | Se utiliza la fecha local del dispositivo |
| Fotos de recetas dependían de redirecciones de Wikimedia y podían quedar bloqueadas | Se incluyen 15 fotos ligeras locales, con créditos y respaldo visual |
| Las fotografías de ejercicios estaban ocultas o recortadas | 52 archivos locales, miniaturas, dos posiciones ampliables y nombres coherentes con la variante mostrada |
| Una copia de progreso mal formada podía dañar la pantalla al restaurarse | Validación del formato al guardar y control de revisión para evitar sobrescribir una actualización concurrente |
| Calendario de actividad difícil de manejar con teclado | Botones con etiquetas y estado accesible |

Se agregan 11 pruebas automatizadas y una plantilla de comprobación para GitHub en `docs/github-checks.yml`. Para activarla, copiarla a `.github/workflows/checks.yml` desde una conexión con permiso para gestionar workflows. La conexión actual permite subir el proyecto, pero GitHub rechazó la creación del workflow por falta de ese permiso. Las fotos de recetas ocupan aproximadamente 2,49 MB y las de ejercicios 3,17 MB; se incluyen en la caché de la PWA. La primera descarga requiere conexión. Esto no significa que el acceso premium esté validado sin conexión.

## Pendientes antes de vender suscripciones

1. **Pagos reales:** los identificadores de precios permanecen vacíos en la configuración. Configurar claves, productos y precios, el portal de cancelación y los webhooks. Comprobar alta, primer cobro, fallo de cobro, cancelación, renovación y coincidencia del precio mostrado. Revisar las versiones de la API de Stripe y el orden de llegada de eventos. La prueba gratuita actual se agrega a cada nueva suscripción; hace falta definir elegibilidad y evitar altas duplicadas al abrir varias sesiones de pago.
2. **País del negocio:** confirmar dónde está registrada la empresa y qué proveedor permite recibir cobros allí. Ecuador no figura en la lista de países admitidos para abrir una cuenta estándar de Stripe en la consulta realizada. Si la empresa está registrada en Ecuador, investigar una alternativa disponible antes de invertir en esta integración. Fuente: [disponibilidad de Stripe](https://stripe.com/global).
3. **Correo:** configurar Resend con remitente verificado y probar la llegada y caducidad de los enlaces. El modo de desarrollo no debe activarse en producción.
4. **Base de datos:** aplicar la tabla nueva user_progress y comprobar que las tablas de usuarios y eventos de Stripe existen. Guardar una copia en un navegador y cargarla en otro con una cuenta de prueba.
5. **Protección comercial:** menú, rutina y progreso están incluidos en el código del navegador y el bloqueo premium de esas secciones es visual; alguien con conocimientos puede desbloquearlo. La generación de IA sí valida la suscripción en el servidor. Para proteger funciones de pago, el servidor debe decidir el acceso y entregar el servicio correspondiente.
6. **Datos personales:** las copias son manuales; cambiar de cuenta no cambia automáticamente los datos locales. Definir perfiles por cuenta, exportación y eliminación, explicar qué información se almacena y dónde, y preparar términos de servicio y privacidad ajustados al negocio.
7. **Nutrición y entrenamiento:** el formulario admite desde 14 años y aplica estimaciones generales; requiere revisión profesional del público objetivo y del contenido. Las rutinas, las calorías por ejercicio y los valores nutricionales requieren validación de sus supuestos. La app no conoce lesiones, alergias ni restricciones alimentarias. Los filtros veganos y vegetarianos del recetario no restringen actualmente el menú automático.
8. **Uso sin conexión:** al abrir de nuevo la app, el estado premium depende de consultar /me; si no hay red, puede no desbloquear las secciones aunque las imágenes estén guardadas. Resolver explícitamente la experiencia sin conexión y la verificación posterior.
9. **Retención:** el programa presenta 90 días, pero falta diseñar qué recibe el usuario después para justificar una suscripción continua. Medir uso real antes de aumentar el catálogo.

## Fotos que mejoraría después

- **Platos específicos:** 15 fotos representan 72 recetas. Una tortilla y un huevo duro pueden compartir fotografía. Producir primero fotos exactas de 8–12 recetas populares; incluir porción, ingredientes y preparación que realmente coincidan. Mantener la etiqueta ilustrativa cuando corresponda.
- **Estilo consistente:** unificar iluminación, fondo y encuadre. Las fotos de ejercicios sirven como referencia, pero muestran gimnasios y modelos diferentes. Para una identidad propia, grabar las variantes más utilizadas con el mismo entrenador y escenario.
- **Movimiento:** dos fotografías no enseñan toda la técnica. Priorizar videos breves revisados por un profesional, subtítulos, equipo requerido y sustituciones. No presentar imágenes generadas como prueba de técnica correcta ni usar fotos genéricas de transformación como resultados reales.
- **Demostración del producto:** la portada puede mostrar una semana real de comidas y actividad, usando datos ficticios identificados, para explicar el valor antes del registro.

## Propuesta para diferenciar el producto

Una dirección a validar sería: **un programa de 90 días para personas hispanohablantes con poco tiempo, comida local y seguimiento fácil de sostener**. El diseño debería resolver qué hacer hoy y cómo retomar después de una interrupción.

| Prioridad | Propuesta | Cómo comprobar su valor |
|---|---|---|
| Primero | Preguntar días disponibles, tiempo, nivel y equipo; ajustar la rutina | Ver si el usuario completa su primera sesión |
| Primero | Menús con alimentos locales, sustituciones y presupuesto | Ver si cocina y registra las comidas propuestas |
| Después | Lista de compras semanal y cocina por lotes conectadas al menú | Comprobar si reduce decisiones y uso de ingredientes difíciles de conseguir |
| Después | Registrar series, cargas y repeticiones, con descanso y resumen semanal | Comprobar continuidad y progreso percibido |
| Después | Check-in de tiempo disponible, energía y dificultad; explicar cada ajuste | Comprobar si vuelve la semana siguiente |
| Validar con usuarios | Ruta para retomar tras varios días sin usarla y continuidad tras el día 90 | Medir abandono y renovación sin asumir resultados |

La personalización por equipo y la planificación de comidas ya existen en competidores: [Fitbod](https://fitbod.me/blog/fitbod-algorithm/) y [MyFitnessPal](https://support.myfitnesspal.com/hc/en-us/articles/34603055097869-How-to-use-the-Meal-Planner). La propuesta anterior es una hipótesis de posicionamiento; no se ha demostrado que sea única ni que exista demanda suficiente. El generador de IA por sí solo ofrece poca diferenciación si no ayuda a resolver restricciones reales.

Prueba recomendada: trabajar con 5–10 usuarios del público elegido, observar sin guiar su primera sesión y su primera comida, recoger qué les impide volver y validar disposición a pagar. Separar ingresos de ganancias y medir costos de infraestructura e IA antes de anunciar rentabilidad.

## Publicación del proyecto

El frontend y el Worker son despliegues distintos. Subir a GitHub una rama de trabajo no confirma que GitHub Pages publique esa rama ni despliega el Worker de Cloudflare.

1. Revisar e integrar la rama de trabajo en la rama configurada para GitHub Pages.
2. Comprobar la compilación de Pages y abrir el sitio público.
3. Aplicar `worker/schema_progress.sql` en D1 y desplegar el Worker. No repetir la migración ALTER TABLE de Stripe si ya se aplicó.
4. Configurar los servicios externos y realizar las pruebas con cuentas y pagos de prueba.
5. Instalar la PWA desde el sitio público y comprobar una actualización, apertura de fotos, navegación, calendario y comportamiento sin conexión.

La vista de demostración en `.wrangler/` no se sube. No se han añadido claves secretas al proyecto.
