# Reparación del acceso por correo

## Causa comprobada

El servicio Cloudflare publicado seguía en la versión del 23 de septiembre de 2026 (hora de Ecuador), anterior al frontend publicado el 5 de octubre. No tenía el endpoint público de disponibilidad `/config`. La clave RESEND_API_KEY y la clave de sesión existen, pero no había una variable RESEND_FROM. El código utilizaba onboarding@resend.dev: es un remitente de pruebas que Resend restringe al correo propietario de la cuenta.

Además, el resultado de enviarMagicLinkEmail se ignoraba. Si Resend rechazaba el envío, el servidor respondía ok:true y la página afirmaba que había enviado el enlace. Los límites de envío también devolvían ok:true aunque no se enviara correo.

## Corrección

- El servidor confirma únicamente un envío aceptado con un identificador de mensaje de Resend. Una falla de proveedor, red o tiempo de espera devuelve 503; el límite devuelve 429 y Retry-After.
- Producción requiere base de datos, clave de sesión, clave de correo y un remitente propio. El dominio de pruebas no se anuncia como disponible. La presencia de configuración no demuestra que Resend haya aprobado el dominio.
- Un rechazo explícito invalida el token que no se pudo enviar. Los intentos fallidos no consumen la cuota de mensajes aceptados; sí tienen un límite independiente por IP para evitar intentos ilimitados.
- No se registran enlaces, tokens, destinatarios ni cuerpos de error del proveedor. Las respuestas de cuentas no se guardan en caché HTTP.
- La pantalla espera la comprobación de disponibilidad, conserva el correo al reintentar y no muestra “enviado” frente a una respuesta antigua o incompleta. Las solicitudes tienen un tiempo máximo de espera.
- Se actualiza la versión de caché de la PWA para entregar la pantalla corregida.

## Validación

34 pruebas automatizadas aprobadas; compilación del Worker, sintaxis y diferencias verificadas. Las pruebas cubren aceptación/rechazo del correo, tiempo de espera, límites, dominio de pruebas, apertura de cuenta, enlace caducado y reutilización rechazada. La pantalla se recorrió con errores y aceptación simulados en un servidor local aislado. A 390 px no hubo desbordamiento horizontal. No se utilizaron correos ni sesiones reales en esas pruebas.

## Configuración necesaria para recibir el correo real

Iniciar sesión en Resend, comprobar un dominio propio con capacidad de envío verificada, seleccionar un remitente de ese dominio y configurar RESEND_FROM en el Worker. Probar después un enlace a un correo expresamente indicado por el propietario. No copiar claves secretas al repositorio ni al chat. No usar un dominio de github.io o workers.dev como dominio de correo propio.

Fuente del límite del remitente de pruebas: https://resend.com/changelog/improved-logs-visibility . Estado de dominio y envío se comprueban en el panel del proveedor; no se presume entrega a bandeja de entrada a partir de una respuesta de aceptación.

La migración de copias user_progress, los pagos y las ramas paralelas de entrenamiento se mantienen separados de esta reparación.
