-- Seed: base products + their front print area
-- (variants come in 0101_variants.sql)

INSERT INTO public.products
    (product_code, product_type, product_name, product_slug, description,
     needs_color, needs_size, production_days_min, production_days_max, product_status)
VALUES
    ('TSHIRT001', 'tshirt', 'Classic T-Shirt', 'classic-t-shirt',
     'Soft everyday cotton tee, printed to order.', true, true, 2, 4, 'active'),
    ('HOODIE001', 'hoodie', 'Classic Hoodie', 'classic-hoodie',
     'Warm pullover hoodie, printed to order.', true, true, 3, 5, 'active')
ON CONFLICT DO NOTHING;

-- Har product ka 'front' print area (designs isi pe lagte hain)
INSERT INTO public.product_print_areas
    (product_id, area_code, area_name, max_width_in, max_height_in, preview_x_percent, preview_y_percent)
SELECT p.product_id, 'front', 'Front', 12, 16, 50, 40
FROM public.products p
WHERE p.product_code IN ('TSHIRT001', 'HOODIE001')
ON CONFLICT DO NOTHING;
