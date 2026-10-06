# Entrega de noventa a Claude Code y GitHub

El propietario inició sesión en Claude Code y autorizó continuar la aplicación y subirla al repositorio existente. Claude Code se ejecutó en una copia local con ruta compatible porque los espacios finales de la carpeta original impedían sus ediciones. La copia conserva el mismo repositorio y rama; no se desactivaron sus protecciones de permisos.

## Imágenes y marca

- 72 imágenes de recetas, cada una asociada al ID y a los ingredientes de su plato. Son ilustraciones generadas con IA, identificadas como tales en la aplicación; la porción y el aspecto real pueden variar.
- Formato WebP, máximo 960 px, unos 7,2 MB en total. El archivo `assets/recipes/catalog.json` contiene el catálogo público y `docs/IMAGENES-GENERADAS.json` conserva el modo, los prompts y los archivos finales de cada generación.
- 52 fotos originales de ejercicios convertidas a WebP sin cambiar las posturas. Los originales y su licencia se conservan. Las 26 variantes mantienen dos posiciones y el diagrama de respaldo.
- Iconos lila de noventa para navegador, instalación PWA e iPhone.
- Imágenes y estilos incluidos en la caché de la aplicación. La primera descarga requiere conexión; el acceso a funciones de suscripción se comprueba por separado.

## Continuidad del proyecto

El contexto está en `CLAUDE.md` y el encargo funcional en `docs/ENCARGO-CLAUDE-CODE.md`. `npm run claude:continue` permite volver a pasar ese encargo al Claude Code instalado y autenticado. Requiere una carpeta sin cambios pendientes; cuando la ruta contiene espacios finales, prepara una copia compatible y conserva los cambios originales.

`npm run site:build` prepara `dist/` con el sitio público y sus imágenes. No incluye el servidor, las credenciales, la demostración ni las instrucciones para Claude. La carpeta se vuelve a generar y está ignorada por Git.

## Estado de publicación

La rama de esta entrega es `stripe-suscripcion`. GitHub Pages está configurado para publicar `main` desde la raíz; subir esta rama no cambia todavía el sitio público ni despliega Cloudflare. No se han efectuado cobros ni migraciones remotas.

Hay trabajo adicional de entrenamiento y Paddle en otras ramas del mismo repositorio. Se preserva y no se incorpora automáticamente a esta entrega para evitar sobrescribir cambios que están en curso. Antes de integrar en `main`, comparar y reunir esas ramas: no conservar simultáneamente dos pasarelas o precios contradictorios.

Los pasos pendientes para vender son confirmar el país y la pasarela, unificar precios, configurar correo verificado y servicios externos, aplicar la tabla de copias, comprobar pagos y cancelaciones en modo de prueba e integrar la versión revisada en la rama que publica Pages. La revisión completa y las limitaciones comerciales están en `docs/REVISION-Y-PUBLICACION.md`.

## Verificación final

24 pruebas aprobadas; comprobación de sintaxis y diferencias sin errores. Vista móvil a 390 px con plan vegano, lista de compras, registro de un ejercicio y persistencia tras recarga. Los 72 platos se revisaron en hojas de contacto y en la interfaz. Los servicios externos se probaron con respuestas simuladas, no con cobros ni correos reales.
