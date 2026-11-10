-- Bookkeeping proposal: after an intake is submitted, staff review the price,
-- adjust it if needed, and send the client a proposal + engagement letter to
-- sign through a private link. JSON (see lib/books/proposal.ts).
ALTER TABLE books_intakes ADD COLUMN proposal TEXT;
