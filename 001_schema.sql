-- ============================================================
-- CoreInventory — FlowLedger Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ────────────────────────────────────────────────────────────
-- USERS & AUTH
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(50)  NOT NULL DEFAULT 'warehouse_staff'
             CHECK (role IN ('inventory_manager','warehouse_staff')),
  is_active  BOOLEAN      DEFAULT true,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  email      VARCHAR(255) NOT NULL,
  otp        VARCHAR(6)  NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- PRODUCT CATALOG
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units_of_measure (
  id           UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(50) UNIQUE NOT NULL,
  abbreviation VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  sku           VARCHAR(100) UNIQUE NOT NULL,
  category_id   UUID         REFERENCES categories(id) ON DELETE SET NULL,
  uom_id        UUID         REFERENCES units_of_measure(id) ON DELETE SET NULL,
  description   TEXT,
  is_active     BOOLEAN      DEFAULT true,
  reorder_point NUMERIC(10,3) DEFAULT 0,
  reorder_qty   NUMERIC(10,3) DEFAULT 0,
  created_by    UUID         REFERENCES users(id),
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku  ON products USING gin(sku  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(name gin_trgm_ops);

-- ────────────────────────────────────────────────────────────
-- WAREHOUSE & LOCATION GRAPH
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(150) NOT NULL,
  code       VARCHAR(50)  UNIQUE NOT NULL,
  address    TEXT,
  is_active  BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID        REFERENCES warehouses(id) ON DELETE CASCADE,
  parent_id    UUID        REFERENCES locations(id)  ON DELETE SET NULL,
  name         VARCHAR(150) NOT NULL,
  code         VARCHAR(100) UNIQUE NOT NULL,
  type         VARCHAR(50)  NOT NULL DEFAULT 'bin'
               CHECK (type IN ('zone','rack','bin','production_floor','dispatch','receiving')),
  is_active    BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Virtual system warehouse + locations (for double-entry ledger)
INSERT INTO warehouses (id, name, code) VALUES
  ('00000000-0000-0000-0000-000000000001','Virtual','VIRTUAL')
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, warehouse_id, name, code, type) VALUES
  ('00000000-0000-0000-0001-000000000001','00000000-0000-0000-0000-000000000001','Vendor',      'LOC/VENDOR',   'receiving'),
  ('00000000-0000-0000-0001-000000000002','00000000-0000-0000-0000-000000000001','Customer',    'LOC/CUSTOMER', 'dispatch'),
  ('00000000-0000-0000-0001-000000000003','00000000-0000-0000-0000-000000000001','Scrap / Loss','LOC/SCRAP',    'bin')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- OPERATIONS — RECEIPTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference        VARCHAR(100) UNIQUE NOT NULL,
  supplier         VARCHAR(255),
  dest_location_id UUID        REFERENCES locations(id),
  status           VARCHAR(20) DEFAULT 'draft'
                   CHECK (status IN ('draft','ready','done','cancelled')),
  notes            TEXT,
  validated_at     TIMESTAMPTZ,
  validated_by     UUID        REFERENCES users(id),
  created_by       UUID        REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id   UUID          REFERENCES receipts(id) ON DELETE CASCADE,
  product_id   UUID          REFERENCES products(id),
  qty_expected NUMERIC(10,3) DEFAULT 0,
  qty_done     NUMERIC(10,3) DEFAULT 0,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- OPERATIONS — DELIVERIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference          VARCHAR(100) UNIQUE NOT NULL,
  customer           VARCHAR(255),
  source_location_id UUID        REFERENCES locations(id),
  status             VARCHAR(20) DEFAULT 'draft'
                     CHECK (status IN ('draft','waiting','ready','done','cancelled')),
  notes              TEXT,
  validated_at       TIMESTAMPTZ,
  validated_by       UUID        REFERENCES users(id),
  created_by         UUID        REFERENCES users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID          REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id  UUID          REFERENCES products(id),
  qty_demand  NUMERIC(10,3) DEFAULT 0,
  qty_done    NUMERIC(10,3) DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- OPERATIONS — INTERNAL TRANSFERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfers (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference           VARCHAR(100) UNIQUE NOT NULL,
  source_location_id  UUID        REFERENCES locations(id),
  dest_location_id    UUID        REFERENCES locations(id),
  status              VARCHAR(20) DEFAULT 'draft'
                      CHECK (status IN ('draft','ready','done','cancelled')),
  notes               TEXT,
  scheduled_at        TIMESTAMPTZ,
  validated_at        TIMESTAMPTZ,
  validated_by        UUID        REFERENCES users(id),
  created_by          UUID        REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_items (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID          REFERENCES transfers(id) ON DELETE CASCADE,
  product_id  UUID          REFERENCES products(id),
  qty_demand  NUMERIC(10,3) DEFAULT 0,
  qty_done    NUMERIC(10,3) DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- OPERATIONS — STOCK ADJUSTMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adjustments (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference    VARCHAR(100) UNIQUE NOT NULL,
  location_id  UUID        REFERENCES locations(id),
  status       VARCHAR(20) DEFAULT 'draft'
               CHECK (status IN ('draft','done','cancelled')),
  reason       TEXT,
  validated_at TIMESTAMPTZ,
  validated_by UUID        REFERENCES users(id),
  created_by   UUID        REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adjustment_items (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_id UUID          REFERENCES adjustments(id) ON DELETE CASCADE,
  product_id    UUID          REFERENCES products(id),
  qty_recorded  NUMERIC(10,3) DEFAULT 0,
  qty_counted   NUMERIC(10,3) DEFAULT 0,
  qty_delta     NUMERIC(10,3) GENERATED ALWAYS AS (qty_counted - qty_recorded) STORED,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- STOCK LEDGER — Immutable source of truth
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_ledger (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id         UUID          REFERENCES products(id) NOT NULL,
  source_location_id UUID          REFERENCES locations(id),
  dest_location_id   UUID          REFERENCES locations(id),
  movement_type      VARCHAR(30)   NOT NULL
                     CHECK (movement_type IN
                       ('receipt','delivery','transfer_out','transfer_in','adjustment','initial')),
  qty_delta          NUMERIC(10,3) NOT NULL,
  qty_before         NUMERIC(10,3) NOT NULL,
  qty_after          NUMERIC(10,3) NOT NULL,
  document_type      VARCHAR(30),
  document_id        UUID,
  performed_by       UUID          REFERENCES users(id),
  created_at         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_product  ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created  ON stock_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_document ON stock_ledger(document_type, document_id);

-- ────────────────────────────────────────────────────────────
-- LIVE STOCK TWIN — Fast materialized projection
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_snapshot (
  product_id    UUID          REFERENCES products(id)  NOT NULL,
  location_id   UUID          REFERENCES locations(id) NOT NULL,
  qty_on_hand   NUMERIC(10,3) DEFAULT 0,
  qty_reserved  NUMERIC(10,3) DEFAULT 0,
  qty_incoming  NUMERIC(10,3) DEFAULT 0,
  qty_available NUMERIC(10,3) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  updated_at    TIMESTAMPTZ   DEFAULT NOW(),
  PRIMARY KEY (product_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_product  ON stock_snapshot(product_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_location ON stock_snapshot(location_id);

-- ────────────────────────────────────────────────────────────
-- ALERTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        VARCHAR(50) NOT NULL
              CHECK (type IN ('low_stock','out_of_stock','high_variance','shortage')),
  product_id  UUID        REFERENCES products(id),
  location_id UUID        REFERENCES locations(id),
  message     TEXT        NOT NULL,
  is_read     BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- SEQUENCES for human-readable reference numbers
-- ────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS receipt_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS delivery_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS transfer_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS adjustment_seq START 1;
