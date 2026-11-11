-- Automatic monthly bookkeeping invoices.
-- Each workspace has its own billing settings; an invoice can be tied to the month it bills,
-- and a workspace is billed at most once per month.
ALTER TABLE books_workspaces ADD COLUMN billing TEXT NOT NULL DEFAULT '{}';
ALTER TABLE invoices ADD COLUMN billing_period TEXT;
CREATE UNIQUE INDEX invoices_ws_period ON invoices(workspace_id, billing_period) WHERE billing_period IS NOT NULL;
