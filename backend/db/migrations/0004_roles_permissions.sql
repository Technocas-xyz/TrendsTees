-- =====================================================================
-- TrendsTees | Migration 005 | Roles & permissions (admin access control)
-- =====================================================================
-- Concept:
--   permission = ek kaam, jaise 'orders.view' (orders dekhna) ya
--                'orders.manage' (order status badalna)
--   role       = permissions ka group, jaise "Finance" ya "Inventory"
--   user       = ek ya zyada roles (user_roles table)
--
-- 'admin' role = SUPER ADMIN: code mein usay har permission milti hai,
--                is liye us ke liye rows ki zaroorat nahi.
-- Super Admin naye roles bana sakta hai aur un ki permissions tick kar
-- sakta hai (admin panel > Users & Roles).
-- =====================================================================


-- 1. Roles ki list (pehle user_roles mein role_code sirf ek fixed CHECK list tha)
CREATE TABLE public.admin_roles (
  role_code    varchar(30)  PRIMARY KEY,
  role_name    varchar(80)  NOT NULL,
  description  varchar(250),
  is_system    boolean      NOT NULL DEFAULT false,  -- system role delete/rename nahi ho sakta
  is_staff     boolean      NOT NULL DEFAULT true,   -- false = customer (admin panel access nahi)
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_admin_roles_code CHECK (role_code ~ '^[a-z][a-z0-9_]{1,29}$')
);

INSERT INTO public.admin_roles (role_code, role_name, description, is_system, is_staff) VALUES
  ('customer',   'Customer',        'Store customer. No admin panel access.',          true,  false),
  ('admin',      'Super Admin',     'Full access, including users and roles.',         true,  true),
  ('finance',    'Finance',         'Payments, revenue and finance reports.',          false, true),
  ('operations', 'Inventory',       'Products, variants, prices and stock.',           false, true),
  ('support',    'Order Manager',   'Orders and customer requests.',                   false, true),
  ('reviewer',   'Design Manager',  'Designs, interests and niches.',                  false, true),
  ('content',    'Content Editor',  'Website pages, menus, banners and site text.',    false, true);

-- 2. Saari permissions ki list (code mein inhi codes se check hota hai)
CREATE TABLE public.admin_permissions (
  permission_code varchar(60)  PRIMARY KEY,
  module          varchar(40)  NOT NULL,
  action          varchar(20)  NOT NULL CHECK (action IN ('view', 'manage')),
  label           varchar(120) NOT NULL,
  sort_order      smallint     NOT NULL DEFAULT 100
);

INSERT INTO public.admin_permissions (permission_code, module, action, label, sort_order) VALUES
  ('dashboard.view',   'dashboard', 'view',   'View dashboard',                         10),
  ('orders.view',      'orders',    'view',   'View orders',                            20),
  ('orders.manage',    'orders',    'manage', 'Update order status',                    21),
  ('finance.view',     'finance',   'view',   'View payments and revenue',              30),
  ('finance.manage',   'finance',   'manage', 'Mark paid, refunds',                     31),
  ('inventory.view',   'inventory', 'view',   'View products, variants and stock',      40),
  ('inventory.manage', 'inventory', 'manage', 'Edit products, prices and stock',        41),
  ('designs.view',     'designs',   'view',   'View designs',                           50),
  ('designs.manage',   'designs',   'manage', 'Upload, edit, publish and hide designs', 51),
  ('catalog.view',     'catalog',   'view',   'View interests and niches',              60),
  ('catalog.manage',   'catalog',   'manage', 'Edit interests and niches',              61),
  ('discounts.view',   'discounts', 'view',   'View discount rules',                    70),
  ('discounts.manage', 'discounts', 'manage', 'Edit discount rules',                    71),
  ('customers.view',   'customers', 'view',   'View customers',                         80),
  ('customers.manage', 'customers', 'manage', 'Suspend or reactivate customers',        81),
  ('content.view',     'content',   'view',   'View pages, menus and site text',        90),
  ('content.manage',   'content',   'manage', 'Edit pages, menus and site text',        91),
  ('reports.view',     'reports',   'view',   'View reports',                          100),
  ('settings.view',    'settings',  'view',   'View store settings',                   110),
  ('settings.manage',  'settings',  'manage', 'Edit store settings (shipping countries)', 111),
  ('users.view',       'users',     'view',   'View admin users and roles',            120),
  ('users.manage',     'users',     'manage', 'Create admins, edit roles and permissions', 121);

-- 3. Kis role ke paas kaunsi permission
CREATE TABLE public.admin_role_permissions (
  role_code       varchar(30) NOT NULL REFERENCES public.admin_roles(role_code) ON DELETE CASCADE,
  permission_code varchar(60) NOT NULL REFERENCES public.admin_permissions(permission_code),
  PRIMARY KEY (role_code, permission_code)
);

INSERT INTO public.admin_role_permissions (role_code, permission_code)
SELECT r.role_code, p.permission_code
FROM (VALUES
  ('finance',    ARRAY['dashboard.view','orders.view','finance.view','finance.manage','reports.view']),
  ('operations', ARRAY['dashboard.view','inventory.view','inventory.manage','orders.view']),
  ('support',    ARRAY['dashboard.view','orders.view','orders.manage','customers.view']),
  ('reviewer',   ARRAY['dashboard.view','designs.view','designs.manage','catalog.view','catalog.manage']),
  ('content',    ARRAY['dashboard.view','content.view','content.manage'])
) AS r(role_code, perms)
CROSS JOIN LATERAL unnest(r.perms) AS p(permission_code);

-- 4. user_roles: purani fixed list hata ke admin_roles se jodo (naye roles bhi chal sakein)
ALTER TABLE public.user_roles DROP CONSTRAINT chk_no_artist_role;
ALTER TABLE public.user_roles
  ADD CONSTRAINT fk_user_roles_role FOREIGN KEY (role_code)
  REFERENCES public.admin_roles(role_code) ON UPDATE CASCADE;


-- Check: har role aur us ki permissions
SELECT r.role_name, count(rp.permission_code) AS permissions
FROM admin_roles r LEFT JOIN admin_role_permissions rp ON rp.role_code = r.role_code
GROUP BY r.role_name ORDER BY r.role_name;
