-- Store product: optional Stripe Price ID (Monarch account). When set, checkout charges that saved price,
-- so product-restricted coupons and Stripe's product reports work.
ALTER TABLE mon_packages ADD COLUMN stripe_price TEXT NOT NULL DEFAULT '';
