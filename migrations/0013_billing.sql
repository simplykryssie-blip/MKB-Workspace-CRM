-- Billing: invoices and payments are server records (amounts in cents).
-- Numbers are assigned by the server; every change is kept in `history`.
CREATE TABLE invoices (
  id                TEXT PRIMARY KEY,
  number            TEXT NOT NULL UNIQUE,
  client_id         TEXT NOT NULL REFERENCES clients(id),
  service           TEXT NOT NULL,
  tax_return_id     TEXT,
  workspace_id      TEXT,
  biz_request_id    TEXT,
  exp_matter_id     TEXT,
  description       TEXT NOT NULL,
  payment_mode      TEXT NOT NULL DEFAULT 'upfront' CHECK (payment_mode IN ('upfront', 'bank_product')),
  status            TEXT NOT NULL CHECK (status IN ('draft', 'open', 'partial', 'paid', 'void')),
  lines             TEXT NOT NULL DEFAULT '[]',
  amount_cents      INTEGER NOT NULL,
  paid_cents        INTEGER NOT NULL DEFAULT 0,
  issued_at         TEXT NOT NULL,
  due_at            TEXT NOT NULL,
  sent_at           TEXT,
  paid_at           TEXT,
  voided_at         TEXT,
  void_reason       TEXT,
  adjustments       TEXT NOT NULL DEFAULT '[]',
  history           TEXT NOT NULL DEFAULT '[]',
  bureau            TEXT,
  pay_token_hash    TEXT,
  late_fee_at       TEXT,
  created_at        TEXT NOT NULL,
  created_by        TEXT,
  updated_at        TEXT NOT NULL,
  rev               INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX invoices_client ON invoices (client_id);
CREATE INDEX invoices_return ON invoices (tax_return_id);
CREATE INDEX invoices_status ON invoices (status, due_at);

CREATE TABLE payments (
  id            TEXT PRIMARY KEY,
  invoice_id    TEXT NOT NULL REFERENCES invoices(id),
  client_id     TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,
  method        TEXT NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('manual', 'stripe', 'bank_import')),
  reference     TEXT,
  received_at   TEXT NOT NULL,
  recorded_at   TEXT NOT NULL,
  recorded_by   TEXT,
  note          TEXT
);
CREATE INDEX payments_invoice ON payments (invoice_id);
-- A Stripe payment or bank deposit can only be applied once.
CREATE UNIQUE INDEX payments_source_ref ON payments (source, reference) WHERE reference IS NOT NULL AND source != 'manual';

CREATE TABLE invoice_counters (
  year  INTEGER PRIMARY KEY,
  next  INTEGER NOT NULL
);

-- Back-end fees charged by each service bureau / bank (e.g. bank product fee,
-- transmission, service bureau, e-file, document prep). `applies` decides
-- whether a fee goes on every tax invoice or only bank product invoices.
CREATE TABLE bureau_fees (
  bureau    TEXT NOT NULL,
  code      TEXT NOT NULL,
  label     TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  applies   TEXT NOT NULL CHECK (applies IN ('all', 'bank_product')),
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bureau, code)
);

-- Bank CSV uploads waiting for approval before invoices are marked paid.
CREATE TABLE bank_imports (
  id            TEXT PRIMARY KEY,
  file_name     TEXT NOT NULL,
  rows          TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'discarded')),
  uploaded_at   TEXT NOT NULL,
  uploaded_by   TEXT,
  decided_at    TEXT,
  decided_by    TEXT
);
