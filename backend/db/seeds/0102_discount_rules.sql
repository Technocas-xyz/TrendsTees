-- Seed: default bundle and bulk discount rules (admin can change or pause them later)

INSERT INTO public.discount_rules
    (rule_name, rule_type, required_product_types_json, discount_type, discount_value, rule_status)
SELECT 'Tee + Hoodie Bundle', 'bundle', '["tshirt","hoodie"]', 'fixed_amount', 8, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.discount_rules WHERE rule_name = 'Tee + Hoodie Bundle');

INSERT INTO public.discount_rules
    (rule_name, rule_type, min_total_quantity, discount_type, discount_value, rule_status)
SELECT 'Bulk 10+ items', 'bulk', 10, 'percent', 15, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.discount_rules WHERE rule_name = 'Bulk 10+ items');
