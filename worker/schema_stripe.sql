-- Migración Fase 2 (Stripe) sobre recetario-ia-db. Aplicar con:
--   npx wrangler d1 execute recetario-ia-db --local  --file=worker/schema_stripe.sql
--   npx wrangler d1 execute recetario-ia-db --remote --file=worker/schema_stripe.sql

-- Evita procesar dos veces el mismo evento si Stripe reintenta un webhook (responde
-- 200 de inmediato en el reintento sin volver a aplicar el cambio ni reenviar el
-- correo de aviso de fin de prueba).
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Para no mandar el correo de "tu prueba termina en X días" más de una vez por ciclo
-- de facturación, aunque Stripe reintente el webhook de invoice.upcoming.
ALTER TABLE users ADD COLUMN trial_warning_sent_at INTEGER;
