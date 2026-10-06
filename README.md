# Transforma tu Cuerpo en 90 Días

App web —**instalable como PWA** en el celular— para un plan de 90 días:
déficit calórico calculado + ingesta alta en proteína, para perder grasa
cuidando la masa muscular.

> El repositorio se sigue llamando `proyecto-noventa-dias-` por historia; la URL no cambia.

## Qué hace

- **Calcula tu plan**: calorías y proteína objetivo según tu peso, estatura, edad, sexo y actividad (Mifflin-St Jeor).
- **Arma tu menú del día**: menú automático o elige entre más de 60 recetas altas en proteína (con opciones vegetarianas y veganas).
- **Genera recetas con IA** a partir de tus ingredientes favoritos (backend seguro en Cloudflare Worker — ver [`README-worker.md`](README-worker.md)).
- **Sigue tu avance**: calendario de 90 días, peso semanal y check-in de recálculo cada 2 semanas.
- **Movimiento diario**: pasos recomendados según tu actividad + rutina de fuerza con peso corporal.
- El progreso se guarda en el navegador; desde Tu cuenta puedes guardar y cargar una copia privada en Cloudflare D1. El guardado en la cuenta es manual.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | La app completa (HTML + CSS + JS en un solo archivo) |
| `manifest.json`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` | PWA: instalable y con caché offline |
| `worker/` | Cloudflare Worker del generador de recetas con IA |
| `README-worker.md` | Cómo desplegar el Worker |

## Uso

Abre `index.html` en el navegador, o sírvelo y visita `http://localhost:8000`:

```bash
python3 -m http.server 8000
```

En el celular: **"Agregar a pantalla de inicio"** lo instala como app (arranca a pantalla
completa y funciona sin conexión una vez abierto).

## Aviso

Material educativo. No reemplaza la consulta con un médico o nutricionista.
Los cálculos de calorías y proteína son estimaciones generales.

Las 52 fotografías de entrenamiento están incluidas en `assets/exercises/`, con la licencia del catálogo. Se guardan en la caché de la PWA para uso sin conexión después de la primera carga. Cada tarjeta incluye miniatura, dos posiciones ampliables, equipo y series.

Se incluyen 15 fotos ilustrativas de comida en `assets/recipes/`, con sus créditos en `sources.json` y en el recetario.

## Comprobar y preparar la publicación

Ejecuta `npm test` (Node 22 o posterior). La plantilla [docs/github-checks.yml](docs/github-checks.yml) permite activar comprobaciones automáticas al copiarla a `.github/workflows/checks.yml` con una conexión autorizada para gestionar workflows. La revisión de producto, los pendientes de suscripción y los pasos de publicación están en [docs/REVISION-Y-PUBLICACION.md](docs/REVISION-Y-PUBLICACION.md). Subir el código no despliega el Worker ni activa cobros reales.
