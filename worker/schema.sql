-- Schema de recetario-ia-db (Cloudflare D1).
-- Aplicar con:
--   npx wrangler d1 execute recetario-ia-db --local  --file=worker/schema.sql   (dev local)
--   npx wrangler d1 execute recetario-ia-db --remote --file=worker/schema.sql   (producción, una sola vez)

-- Una fila por cuenta (correo). La suscripción a Stripe vive en las mismas columnas
-- para no necesitar un JOIN en cada request a /me — son pocos campos y de solo lectura
-- casi siempre (el Worker los actualiza únicamente en checkout/verificar y en los webhooks
-- de Stripe de la Fase 2).
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL, -- epoch ms

  -- Estado de Stripe (todo NULL hasta la Fase 2; "subscription_status" usa los mismos
  -- valores que Stripe: trialing | active | past_due | canceled | incomplete | none).
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'none',
  trial_end INTEGER,
  current_period_end INTEGER
);

-- Tokens de un solo uso para el login por magic link. Se guarda el HASH (SHA-256) del
-- token, nunca el token en claro: si alguien llegara a leer la base, no podría iniciar
-- sesión como otra persona con esos datos. Expiran a los 15 minutos y se marcan usados
-- al primer click para que un link no sirva dos veces.
CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

-- Limpieza periódica de links vencidos (opcional, el Worker también los ignora por
-- fecha aunque sigan en la tabla): DELETE FROM magic_links WHERE expires_at < <ahora>;
