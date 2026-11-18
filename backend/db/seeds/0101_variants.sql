-- =====================================================================
-- TrendsTees | Seed 003 | T-Shirt aur Hoodie ke poore variants
-- =====================================================================
-- T-Shirt: 5 colors x 6 sizes = 30 variants
-- Hoodie : 5 colors x 6 sizes = 30 variants
-- Price  : S-XL normal, 2XL +$2, 3XL +$4 (badi size = zyada kapda)
--
-- Dobara chalao to kuch duplicate nahi banega:
-- ON CONFLICT DO NOTHING = agar same SKU ya same color+size pehle se hai to skip.
-- Purane variants (TS-BLK-M, TS-BLK-L, TS-WHT-XL) waise hi rahenge.
-- =====================================================================


-- Step 1: products ko batao ke inhein color aur size chahiye
UPDATE products
SET needs_color = true, needs_size = true, updated_at = now()
WHERE product_type IN ('tshirt', 'hoodie');

-- Step 2: colors x sizes ka har combination banao
-- CROSS JOIN = har color ko har size ke saath jodo (5 x 6 = 30)
INSERT INTO product_variants
    (product_id, sku, color_name, color_hex, size_code, size_name,
     base_product_cost, platform_amount, customer_price, variant_status)
SELECT
    p.product_id,
    -- SKU example: TS-NVY-2XL, HD-BLK-M
    CASE p.product_type WHEN 'tshirt' THEN 'TS' ELSE 'HD' END
        || '-' || c.code || '-' || s.size_code,
    c.color_name,
    c.color_hex,
    s.size_code,
    s.size_name,
    pr.base_cost,
    pr.base_price + s.extra - pr.base_cost,      -- platform_amount = price - cost
    pr.base_price + s.extra,                     -- customer_price
    'active'
FROM products p
-- har product type ki base price aur cost
JOIN (VALUES
        ('tshirt', 20.00, 8.00),
        ('hoodie', 30.00, 14.00)
     ) AS pr(product_type, base_price, base_cost)
  ON pr.product_type = p.product_type
CROSS JOIN (VALUES
        ('BLK', 'Black',        '#000000'),
        ('WHT', 'White',        '#FFFFFF'),
        ('NVY', 'Navy',         '#1F2A44'),
        ('GRY', 'Heather Grey', '#9EA3A8'),
        ('RED', 'Red',          '#C8102E')
     ) AS c(code, color_name, color_hex)
CROSS JOIN (VALUES
        ('S',   'Small',       0.00),
        ('M',   'Medium',      0.00),
        ('L',   'Large',       0.00),
        ('XL',  'X-Large',     0.00),
        ('2XL', '2X-Large',    2.00),
        ('3XL', '3X-Large',    4.00)
     ) AS s(size_code, size_name, extra)
WHERE p.product_type IN ('tshirt', 'hoodie')
ON CONFLICT DO NOTHING;


