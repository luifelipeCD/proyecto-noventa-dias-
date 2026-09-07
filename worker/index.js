/**
 * Cloudflare Worker — Generador de recetas con IA para el "Recetario Proteico 90 Días".
 *
 * Petición:  POST /  con body JSON  { "ingredientes": ["pollo", "arroz integral", "brócoli"] }
 *
 * Respuesta OK (200):
 *   { "ok": true, "receta": {
 *       "nombre": string, "categoria": "desayuno"|"comida"|"snack",
 *       "dieta": "omnivora"|"vegetariana"|"vegana",
 *       "kcal": number, "proteina": number, "carbos": number, "grasa": number,
 *       "ingredientes": string[], "pasos": string[] } }
 *
 * Respuesta error (4xx/5xx):
 *   { "ok": false, "error": "mensaje claro para mostrar al usuario" }
 *
 * La API key de Anthropic se lee de env.ANTHROPIC_API_KEY (secret de Wrangler).
 * NUNCA está escrita en este archivo.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const MAX_INGREDIENTES = 20;
const MAX_LEN_INGREDIENTE = 60;

// Orígenes permitidos por defecto (GitHub Pages del proyecto + desarrollo local).
const DEFAULT_ALLOWED_ORIGINS = [
  'https://luifelipecd.github.io',
  'http://localhost:8000',
  'http://localhost:3000',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:3000',
];

function allowedOrigins(env) {
  const extra = String(env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = allowedOrigins(env);
  const allow = list.includes(origin) ? origin : list[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
    },
  });
}

function fail(msg, status, request, env) {
  return json({ ok: false, error: msg }, status, request, env);
}

// Extrae el primer objeto JSON de un texto (tolera texto extra o cercas ```json).
function extraerJSON(text) {
  if (typeof text !== 'string') return null;
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

function entero(v, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : fallback;
}

// Valida y normaliza la receta al mismo formato que usa el sitio.
function normalizarReceta(r) {
  if (!r || typeof r !== 'object') return null;
  const CATS = ['desayuno', 'comida', 'snack'];
  const DIETAS = ['omnivora', 'vegetariana', 'vegana'];
  const nombre = String(r.nombre || '').trim().slice(0, 120);
  const ingredientes = Array.isArray(r.ingredientes)
    ? r.ingredientes.map((x) => String(x).trim()).filter(Boolean).slice(0, 25)
    : [];
  const pasos = Array.isArray(r.pasos)
    ? r.pasos.map((x) => String(x).trim()).filter(Boolean).slice(0, 15)
    : [];
  if (!nombre || ingredientes.length === 0 || pasos.length === 0) return null;
  return {
    nombre,
    categoria: CATS.includes(r.categoria) ? r.categoria : 'comida',
    dieta: DIETAS.includes(r.dieta) ? r.dieta : 'omnivora',
    kcal: entero(r.kcal, 400),
    proteina: entero(r.proteina, 30),
    carbos: entero(r.carbos, 30),
    grasa: entero(r.grasa, 12),
    ingredientes,
    pasos,
  };
}

async function generarReceta(ingredientes, env) {
  const system =
    'Eres un nutricionista que crea recetas ALTAS EN PROTEÍNA para una dieta en déficit calórico moderado de 90 días. ' +
    'Crea EXACTAMENTE UNA receta que use principalmente los ingredientes que indica el usuario ' +
    '(puedes añadir básicos: sal, especias, limón, ajo, aceite en spray). ' +
    'Prioriza proteína alta y calorías moderadas; porciones realistas para 1 persona. ' +
    'Responde ÚNICAMENTE con un objeto JSON válido: sin texto antes ni después, sin bloques de código markdown. ' +
    'Formato EXACTO: ' +
    '{"nombre": string, "categoria": "desayuno" | "comida" | "snack", ' +
    '"dieta": "omnivora" | "vegetariana" | "vegana", ' +
    '"kcal": number, "proteina": number, "carbos": number, "grasa": number, ' +
    '"ingredientes": string[] (cada uno con su cantidad), "pasos": string[]}. ' +
    'kcal, proteina, carbos y grasa son POR PORCIÓN, números enteros y sin unidades.';

  const userMsg =
    'Ingredientes que tengo o me gustan: ' +
    ingredientes.join(', ') +
    '. Dame una receta alta en proteína con esto.';

  // .trim() evita el fallo típico de guardar el secret con un salto de línea al final.
  const apiKey = String(env.ANTHROPIC_API_KEY || '').trim();

  let resp;
  try {
    resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
  } catch (e) {
    return { error: 'No se pudo conectar con el servicio de IA. Intenta de nuevo en un momento.' };
  }

  if (!resp.ok) {
    // Registramos el detalle del lado del servidor (visible con `wrangler tail`), nunca al cliente.
    let detalle = '';
    try { detalle = (await resp.text()).slice(0, 500); } catch (e) {}
    console.error('Anthropic error', resp.status, detalle);
    // No exponemos el cuerpo del error de Anthropic (puede incluir detalles internos ni la clave).
    let error;
    if (resp.status === 429) {
      error = 'El servicio de IA está saturado ahora mismo. Espera unos segundos y vuelve a intentar.';
    } else if (resp.status === 401 || resp.status === 403) {
      // Casi siempre: el secret ANTHROPIC_API_KEY es incorrecto o está revocado.
      error = 'El generador de recetas con IA no está bien configurado. Avisa al administrador del sitio.';
    } else {
      error = 'El servicio de IA devolvió un error. Intenta de nuevo más tarde.';
    }
    return { error };
  }

  let data;
  try {
    data = await resp.json();
  } catch (e) {
    return { error: 'La IA devolvió una respuesta inesperada. Intenta de nuevo.' };
  }

  const text = Array.isArray(data.content)
    ? data.content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n')
    : '';

  const receta = normalizarReceta(extraerJSON(text));
  if (!receta) {
    return { error: 'La IA no generó una receta válida esta vez. Cambia los ingredientes o vuelve a intentar.' };
  }
  return { receta };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (request.method !== 'POST') {
      return fail('Usa POST con un cuerpo JSON { "ingredientes": [...] }.', 405, request, env);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return fail('El Worker no tiene configurada la API key (ANTHROPIC_API_KEY).', 500, request, env);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return fail('El cuerpo debe ser JSON: { "ingredientes": [...] }.', 400, request, env);
    }

    let ingredientes = Array.isArray(body && body.ingredientes) ? body.ingredientes : null;
    if (!ingredientes) {
      return fail('Falta la lista "ingredientes" (un array de textos).', 400, request, env);
    }
    ingredientes = ingredientes
      .map((x) => String(x).trim().slice(0, MAX_LEN_INGREDIENTE))
      .filter(Boolean)
      .slice(0, MAX_INGREDIENTES);
    if (ingredientes.length === 0) {
      return fail('Escribe al menos un ingrediente.', 400, request, env);
    }

    const result = await generarReceta(ingredientes, env);
    if (result.error) {
      return fail(result.error, 502, request, env);
    }
    return json({ ok: true, receta: result.receta }, 200, request, env);
  },
};
