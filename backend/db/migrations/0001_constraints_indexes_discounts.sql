-- =====================================================================
-- TrendsTees  |  Migration 001  |  Schema audit fixes
-- =====================================================================
-- Kya karta hai:
--   A. Status columns mein sirf allowed values (galat spelling block)
--   B. Number rules (quantity > 0, price negative nahi, totals match)
--   C. Duplicate rokne wale rules (case-insensitive email/slug, pairs)
--   D. Fast search indexes (Postgres foreign keys pe khud index nahi banata)
--   E. Naye features: trending interests + bundle/bulk discount rules
--
-- Kaise chalana hai: pgAdmin > trendstees_db > Query Tool > yeh file
-- open karo > Run (F5).
-- Poori file ek transaction (BEGIN ... COMMIT) mein hai: agar beech mein
-- koi line fail hui to KUCH bhi change nahi hoga. Error copy karke bhejo.
-- =====================================================================


-- =====================================================================
-- A. STATUS ALLOWED VALUES
-- CHECK constraint = har INSERT/UPDATE pe database khud check karega.
-- Values spec ki "Allowed Values" sheet se hain (artist wali hata di).
-- =====================================================================

ALTER TABLE public.app_users ADD CONSTRAINT chk_app_users_status
  CHECK (account_status IN ('pending','active','suspended','disabled','closed'));

ALTER TABLE public.designs ADD CONSTRAINT chk_designs_status
  CHECK (design_status IN ('draft','published','hidden','reported','removed','archived'));
ALTER TABLE public.designs ADD CONSTRAINT chk_designs_rights
  CHECK (rights_status IN ('original','licensed','public_domain','unclear'));

ALTER TABLE public.design_reports ADD CONSTRAINT chk_design_reports_type
  CHECK (report_type IN ('duplicate','copyright','unsafe_content','policy'));
ALTER TABLE public.design_reports ADD CONSTRAINT chk_design_reports_status
  CHECK (report_status IN ('open','checking','waiting_for_proof','reviewing','decided','closed'));
ALTER TABLE public.design_reports ADD CONSTRAINT chk_design_reports_decision
  CHECK (decision_action IS NULL OR decision_action IN ('request_proof','keep','hide','remove','restore'));

-- 'top' add kiya hai kyunke admin docs mein "Tops" product group hai
ALTER TABLE public.products ADD CONSTRAINT chk_products_type
  CHECK (product_type IN ('tshirt','hoodie','sweatshirt','top','mug','tote_bag','dtf_transfer','other'));
ALTER TABLE public.products ADD CONSTRAINT chk_products_status
  CHECK (product_status IN ('draft','active','hidden','archived'));

ALTER TABLE public.product_variants ADD CONSTRAINT chk_variants_status
  CHECK (variant_status IN ('active','out_of_stock','hidden','archived'));

ALTER TABLE public.production_items ADD CONSTRAINT chk_production_status
  CHECK (production_status IN ('queued','printing','quality_check','passed','failed','packed','completed'));

ALTER TABLE public.carts ADD CONSTRAINT chk_carts_status
  CHECK (cart_status IN ('active','converted','expired','abandoned'));

ALTER TABLE public.checkout_sessions ADD CONSTRAINT chk_checkout_status
  CHECK (checkout_status IN ('open','ready','payment_pending','completed','expired'));

ALTER TABLE public.orders ADD CONSTRAINT chk_orders_status
  CHECK (order_status IN ('payment_pending','confirmed','printing','quality_check','packed',
                          'shipped','delivered','cancelled','refunded'));
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_payment_status
  CHECK (payment_status IN ('unpaid','authorized','paid','partially_refunded','refunded'));

ALTER TABLE public.payments ADD CONSTRAINT chk_payments_action
  CHECK (action_type IN ('authorization','charge','refund','void'));
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_status
  CHECK (payment_status IN ('pending','successful','failed','cancelled'));

ALTER TABLE public.shipments ADD CONSTRAINT chk_shipments_status
  CHECK (shipment_status IN ('preparing','shipped','in_transit','out_for_delivery','delivered','lost'));

ALTER TABLE public.service_requests ADD CONSTRAINT chk_service_requests_type
  CHECK (request_type IN ('return','refund','replacement','reprint','order_issue'));
ALTER TABLE public.service_requests ADD CONSTRAINT chk_service_requests_status
  CHECK (request_status IN ('submitted','reviewing','approved','rejected','processing','completed','closed'));

ALTER TABLE public.support_tickets ADD CONSTRAINT chk_support_tickets_status
  CHECK (ticket_status IN ('open','waiting_for_user','in_progress','resolved','closed'));


-- =====================================================================
-- B. NUMBER & DATE RULES
-- =====================================================================

-- Cart / order lines: quantity positive, price negative nahi
ALTER TABLE public.cart_items ADD CONSTRAINT chk_cart_items_numbers
  CHECK (quantity > 0 AND unit_price_snapshot >= 0);

ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_numbers
  CHECK (quantity > 0 AND unit_price >= 0);
-- line_total = quantity x unit_price (business rule)
ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_line_total
  CHECK (line_total = quantity * unit_price);

-- Order total = subtotal - discount + shipping + tax
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_amounts
  CHECK (item_subtotal >= 0 AND discount_total >= 0 AND shipping_total >= 0
         AND tax_total >= 0 AND discount_total <= item_subtotal);
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_total
  CHECK (order_total = item_subtotal - discount_total + shipping_total + tax_total);

ALTER TABLE public.checkout_sessions ADD CONSTRAINT chk_checkout_amounts
  CHECK (item_subtotal >= 0 AND discount_total >= 0 AND shipping_amount >= 0
         AND tax_total >= 0 AND discount_total <= item_subtotal);
ALTER TABLE public.checkout_sessions ADD CONSTRAINT chk_checkout_total
  CHECK (checkout_total = item_subtotal - discount_total + shipping_amount + tax_total);
ALTER TABLE public.checkout_sessions ADD CONSTRAINT chk_checkout_delivery_dates
  CHECK (estimated_delivery_end >= estimated_delivery_start);

-- Cart ya to logged-in user ka ho ya guest token wala
ALTER TABLE public.carts ADD CONSTRAINT chk_carts_owner
  CHECK (user_id IS NOT NULL OR guest_cart_token IS NOT NULL);

-- Product & pricing
ALTER TABLE public.products ADD CONSTRAINT chk_products_days
  CHECK (production_days_min >= 0 AND production_days_max >= production_days_min);
ALTER TABLE public.product_variants ADD CONSTRAINT chk_variants_prices
  CHECK (base_product_cost >= 0 AND platform_amount >= 0 AND customer_price >= 0
         AND minimum_quantity > 0);
ALTER TABLE public.product_print_areas ADD CONSTRAINT chk_print_areas_numbers
  CHECK (max_width_in > 0 AND max_height_in > 0 AND safe_margin_in >= 0
         AND preview_x_percent BETWEEN 0 AND 100 AND preview_y_percent BETWEEN 0 AND 100);
ALTER TABLE public.design_product_settings ADD CONSTRAINT chk_design_settings_percent
  CHECK (placement_x_percent BETWEEN 0 AND 100 AND placement_y_percent BETWEEN 0 AND 100
         AND scale_percent > 0 AND scale_percent <= 100);
ALTER TABLE public.design_tags ADD CONSTRAINT chk_design_tags_score
  CHECK (relevance_score IS NULL OR relevance_score BETWEEN 0 AND 100);

-- Inventory: stock negative nahi, reserved stock on-hand se zyada nahi
ALTER TABLE public.inventory_stock ADD CONSTRAINT chk_inventory_stock_numbers
  CHECK (quantity_on_hand >= 0 AND quantity_reserved >= 0
         AND quantity_reserved <= quantity_on_hand AND reorder_level >= 0);
ALTER TABLE public.inventory_events ADD CONSTRAINT chk_inventory_events_change
  CHECK (quantity_change <> 0);

-- Payments / promotions
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_amount CHECK (amount > 0);
ALTER TABLE public.promotions ADD CONSTRAINT chk_promotions_numbers
  CHECK (discount_value > 0 AND minimum_order_amount >= 0
         AND (ends_at IS NULL OR ends_at > starts_at));
ALTER TABLE public.promotion_uses ADD CONSTRAINT chk_promotion_uses_amount
  CHECK (discount_amount >= 0);

-- Production / shipping
ALTER TABLE public.production_items ADD CONSTRAINT chk_production_numbers
  CHECK (quantity_to_produce > 0
         AND (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at));
ALTER TABLE public.shipment_items ADD CONSTRAINT chk_shipment_items_qty
  CHECK (quantity_shipped > 0);
ALTER TABLE public.shipments ADD CONSTRAINT chk_shipments_dates
  CHECK (delivered_at IS NULL OR shipped_at IS NULL OR delivered_at >= shipped_at);

-- Accounts / files
ALTER TABLE public.user_roles ADD CONSTRAINT chk_user_roles_dates
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at);
ALTER TABLE public.one_time_tokens ADD CONSTRAINT chk_tokens_attempts
  CHECK (attempt_count >= 0 AND attempt_count <= max_attempts);
ALTER TABLE public.user_sessions ADD CONSTRAINT chk_sessions_expiry
  CHECK (expires_at > created_at);
ALTER TABLE public.files ADD CONSTRAINT chk_files_size
  CHECK (file_size_bytes > 0);
ALTER TABLE public.fulfillment_locations ADD CONSTRAINT chk_locations_rating
  CHECK (service_rating IS NULL OR service_rating BETWEEN 0 AND 5);


-- =====================================================================
-- C. DUPLICATE ROKNE WALE RULES (UNIQUE INDEX)
-- =====================================================================

-- Case-insensitive: "Ali@Mail.com" aur "ali@mail.com" ek hi email hain.
-- Abhi wala UNIQUE(email) dono ko alag samajhta hai.
CREATE UNIQUE INDEX uq_app_users_email_lower   ON public.app_users (lower(email));
CREATE UNIQUE INDEX uq_categories_slug_lower   ON public.categories (lower(category_slug));
CREATE UNIQUE INDEX uq_products_slug_lower     ON public.products (lower(product_slug));
CREATE UNIQUE INDEX uq_tags_name_lower         ON public.tags (lower(tag_name));
CREATE UNIQUE INDEX uq_help_articles_slug_lower ON public.help_articles (lower(article_slug));
CREATE UNIQUE INDEX uq_collections_slug_lower  ON public.collections (lower(collection_slug));
CREATE UNIQUE INDEX uq_promotions_code_upper   ON public.promotions (upper(promotion_code));

-- Ek parent ke andar same naam ki do categories na hon
CREATE UNIQUE INDEX uq_categories_parent_name
  ON public.categories (COALESCE(parent_category_id, 0), lower(category_name));

-- Pair duplicates: same cheez do baar link na ho
CREATE UNIQUE INDEX uq_design_tags_pair        ON public.design_tags (design_id, tag_id);
CREATE UNIQUE INDEX uq_design_settings_combo   ON public.design_product_settings (design_id, product_id, print_area_id);
CREATE UNIQUE INDEX uq_print_areas_code        ON public.product_print_areas (product_id, area_code);
CREATE UNIQUE INDEX uq_inventory_stock_pair    ON public.inventory_stock (product_variant_id, location_id);
CREATE UNIQUE INDEX uq_collection_designs_pair ON public.collection_designs (collection_id, design_id);
CREATE UNIQUE INDEX uq_design_revisions_number ON public.design_revisions (design_id, revision_number);
CREATE UNIQUE INDEX uq_promotion_uses_pair     ON public.promotion_uses (promotion_id, order_id);
CREATE UNIQUE INDEX uq_order_addresses_type    ON public.order_addresses (order_id, address_type);
CREATE UNIQUE INDEX uq_shipment_items_pair     ON public.shipment_items (shipment_id, order_item_id);
CREATE UNIQUE INDEX uq_locations_partner_facility ON public.fulfillment_locations (partner_code, facility_name);

-- Same product mein same color + size + DTF size ka variant do baar na bane.
-- NULLS NOT DISTINCT = NULL ko bhi "same" maano (DTF mein size NULL hota hai).
CREATE UNIQUE INDEX uq_variants_options ON public.product_variants
  (product_id, color_name, size_code, width_in, height_in) NULLS NOT DISTINCT;

-- Partial unique (WHERE wala): rule sirf un rows pe lagta hai jo condition match karein
CREATE UNIQUE INDEX uq_favorites_active ON public.favorites (user_id, design_id)
  WHERE removed_at IS NULL;                              -- ek design ek dafa favorite
CREATE UNIQUE INDEX uq_carts_one_active ON public.carts (user_id)
  WHERE cart_status = 'active' AND user_id IS NOT NULL;  -- user ka ek hi active cart
CREATE UNIQUE INDEX uq_checkout_one_open ON public.checkout_sessions (cart_id)
  WHERE checkout_status IN ('open','ready','payment_pending'); -- ek cart ka ek open checkout
CREATE UNIQUE INDEX uq_addresses_default_shipping ON public.user_addresses (user_id)
  WHERE is_default_shipping;                             -- ek default shipping address
CREATE UNIQUE INDEX uq_addresses_default_billing ON public.user_addresses (user_id)
  WHERE is_default_billing;                              -- ek default billing address


-- =====================================================================
-- D. FAST SEARCH INDEXES
-- Index = kitaab ki "index page". Bina iske Postgres poori table padhta hai.
-- Sirf woh columns jin se website/admin rozana filter ya join karegi.
-- =====================================================================

-- Browse / design pages
CREATE INDEX ix_designs_category_status   ON public.designs (category_id, design_status);
CREATE INDEX ix_designs_status_published  ON public.designs (design_status, first_published_at DESC);
CREATE INDEX ix_categories_parent         ON public.categories (parent_category_id, display_order);
CREATE INDEX ix_design_tags_tag           ON public.design_tags (tag_id);
CREATE INDEX ix_design_settings_product   ON public.design_product_settings (product_id);
CREATE INDEX ix_products_type_status      ON public.products (product_type, product_status);

-- Cart / checkout / orders
CREATE INDEX ix_cart_items_cart           ON public.cart_items (cart_id);
CREATE INDEX ix_checkout_cart             ON public.checkout_sessions (cart_id);
CREATE INDEX ix_orders_user_placed        ON public.orders (user_id, placed_at DESC);
CREATE INDEX ix_orders_status             ON public.orders (order_status, payment_status);
CREATE INDEX ix_order_items_order         ON public.order_items (order_id);
CREATE INDEX ix_order_items_design        ON public.order_items (design_id);   -- best seller report
CREATE INDEX ix_order_history_order       ON public.order_status_history (order_id, changed_at);
CREATE INDEX ix_payments_order            ON public.payments (order_id);
CREATE INDEX ix_shipments_order           ON public.shipments (order_id);
CREATE INDEX ix_production_status         ON public.production_items (production_status, location_id);
CREATE INDEX ix_inventory_events_stock    ON public.inventory_events (inventory_stock_id, event_time);

-- Account / support
CREATE INDEX ix_user_addresses_user       ON public.user_addresses (user_id);
CREATE INDEX ix_user_sessions_user        ON public.user_sessions (user_id);
CREATE INDEX ix_tokens_user_type          ON public.one_time_tokens (user_id, token_type);
CREATE INDEX ix_notifications_user        ON public.notifications (user_id, read_at);
CREATE INDEX ix_support_tickets_status    ON public.support_tickets (ticket_status, assigned_to_user_id);
CREATE INDEX ix_support_tickets_order     ON public.support_tickets (order_id);
CREATE INDEX ix_support_messages_ticket   ON public.support_messages (support_ticket_id, sent_at);
CREATE INDEX ix_service_requests_order    ON public.service_requests (order_id);
CREATE INDEX ix_audit_logs_entity         ON public.audit_logs (entity_type, entity_id);


-- =====================================================================
-- E. NAYE FEATURES (User Overview + Admin docs se)
-- =====================================================================

-- E1. Trending Interests: home page pe kaunse interests dikhne hain.
--     Interest = parent category (Animals & Pets), Niche = child category (Dogs).
ALTER TABLE public.categories
  ADD COLUMN is_trending boolean NOT NULL DEFAULT false;
CREATE INDEX ix_categories_trending ON public.categories (is_trending, display_order)
  WHERE is_trending;

-- E2. Bundle aur Bulk discount rules (Admin "Discount Rule Form").
--     bundle = order mein yeh product types saath hon, e.g. ["tshirt","hoodie"]
--     bulk   = order mein total items >= min_total_quantity, e.g. 10
--     Dono qualify karein to backend sirf BARA discount lagayega (stack nahi).
CREATE TABLE public.discount_rules (
  discount_rule_id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_name                   varchar(120) NOT NULL,
  rule_type                   varchar(20)  NOT NULL,
  min_total_quantity          integer,
  required_product_types_json jsonb        NOT NULL DEFAULT '[]'::jsonb,
  discount_type               varchar(20)  NOT NULL,
  discount_value              numeric(12,2) NOT NULL,
  starts_at                   timestamptz  NOT NULL DEFAULT now(),
  ends_at                     timestamptz,
  rule_status                 varchar(20)  NOT NULL DEFAULT 'draft',
  created_by_user_id          bigint REFERENCES public.app_users(user_id),
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_at                  timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT chk_discount_rules_type   CHECK (rule_type IN ('bundle','bulk')),
  CONSTRAINT chk_discount_rules_dtype  CHECK (discount_type IN ('percent','fixed_amount')),
  CONSTRAINT chk_discount_rules_status CHECK (rule_status IN ('draft','active','paused','ended')),
  CONSTRAINT chk_discount_rules_value  CHECK (discount_value > 0
                                         AND (discount_type <> 'percent' OR discount_value <= 100)),
  CONSTRAINT chk_discount_rules_dates  CHECK (ends_at IS NULL OR ends_at > starts_at),
  -- bulk rule ko quantity chahiye, bundle rule ko kam se kam 2 product types.
  -- "IS NOT NULL" zaroori hai: NULL wali CHECK Postgres mein pass ho jati hai.
  CONSTRAINT chk_discount_rules_condition CHECK (
       (rule_type = 'bulk'   AND min_total_quantity IS NOT NULL AND min_total_quantity > 0)
    OR (rule_type = 'bundle' AND jsonb_typeof(required_product_types_json) = 'array'
                             AND jsonb_array_length(required_product_types_json) >= 2)
  )
);
CREATE INDEX ix_discount_rules_active ON public.discount_rules (rule_status, rule_type);

-- E3. Checkout aur order mein save karo ke kaunsa rule laga (history ke liye)
ALTER TABLE public.checkout_sessions
  ADD COLUMN applied_discount_rule_id bigint REFERENCES public.discount_rules(discount_rule_id);
ALTER TABLE public.orders
  ADD COLUMN applied_discount_rule_id bigint REFERENCES public.discount_rules(discount_rule_id),
  ADD COLUMN applied_discount_type    varchar(20),
  ADD CONSTRAINT chk_orders_applied_discount_type
    CHECK (applied_discount_type IS NULL OR applied_discount_type IN ('bundle','bulk'));


-- Check: neeche wali query ab 44 tables dikhaye
-- SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
