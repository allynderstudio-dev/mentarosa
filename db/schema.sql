-- =====================================================================
-- Catálogo de productos · esquema Postgres (Neon)
-- Plantilla de la agencia: un proyecto de Neon por cliente.
-- Idempotente: se puede volver a correr sin perder datos.
-- Las fotos NO se guardan aquí: viven en R2 y aquí solo va su ruta (r2_key).
-- =====================================================================

create table if not exists products (
  id          text primary key,                          -- estable: carrito y favoritos lo guardan
  slug        text not null unique,                      -- URL /products/<slug>
  name        text not null,
  category    text not null,                             -- una de MENTAROSA_CATEGORIES
  description text not null default '',
  details     text[] not null default '{}',              -- viñetas de la ficha
  material    text,
  price       numeric(12,2) not null check (price >= 0),
  old_price   numeric(12,2) check (old_price is null or old_price >= 0), -- precio tachado (oferta)
  currency    text not null default 'pesos',             -- 'pesos' | 'USD'
  sizes       text[] not null default '{}',
  colors      text[] not null default '{}',              -- claves de MENTAROSA_COLORS
  inventory   jsonb not null default '{}'::jsonb,        -- { "*|34": 0, "*|40": 2 } · lo no indicado = disponible
  in_stock    boolean not null default true,             -- false = agotado completo
  tag         text check (tag in ('new', 'best')),
  show_home   boolean not null default false,            -- "Recién llegados" de la portada
  published   boolean not null default true,             -- false = borrador, no sale en la tienda
  keywords    text not null default '',                  -- sinónimos para el buscador
  bg          text,                                      -- fondo pastel de la tarjeta
  fit         text not null default 'photo' check (fit in ('photo', 'cutout')),
  added_at    timestamptz not null default now(),        -- orden "Novedades"
  updated_at  timestamptz not null default now()
);

create table if not exists product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references products(id) on delete cascade,
  r2_key      text not null unique,                      -- ruta dentro del bucket R2
  position    int  not null default 0,                   -- 0 = foto principal, 1 = la del hover…
  width       int,
  height      int,
  bytes       int,
  created_at  timestamptz not null default now()
);

create index if not exists product_images_product_idx on product_images (product_id, position);
create index if not exists products_added_idx on products (added_at desc);

-- =====================================================================
-- Acceso al dashboard (login propio, sin depender de Cloudflare Access)
-- =====================================================================
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email)),
  name          text,
  password_hash text,                                    -- null = solo puede entrar con Google
  role          text not null default 'editor' check (role in ('owner', 'editor')),
  active        boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists admin_sessions (
  token_hash  text primary key,                          -- SHA-256 del token de la cookie (el token nunca se guarda)
  user_id     uuid not null references admin_users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  user_agent  text
);
create index if not exists admin_sessions_user_idx on admin_sessions (user_id);

create table if not exists login_attempts (               -- límite de intentos fallidos
  id          bigserial primary key,
  email       text not null,
  ip          text,
  ok          boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on login_attempts (email, created_at desc);
create index if not exists login_attempts_ip_idx on login_attempts (ip, created_at desc);

-- Invitaciones: solo entra quien aceptó una invitación (o la Agencia, definida en SUPERADMIN_EMAILS)
alter table admin_users add column if not exists accepted_at timestamptz;
alter table admin_users add column if not exists invited_by uuid references admin_users(id) on delete set null;
update admin_users set accepted_at = coalesce(last_login_at, created_at) where accepted_at is null and last_login_at is not null;

create table if not exists admin_invites (
  token_hash  text primary key,                          -- SHA-256 del token del enlace (el token no se guarda)
  user_id     uuid not null references admin_users(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists admin_invites_user_idx on admin_invites (user_id);
