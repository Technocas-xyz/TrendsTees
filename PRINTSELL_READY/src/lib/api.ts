import type {Design} from '@/components/data';

// Base URL of the FastAPI backend (set NEXT_PUBLIC_API_URL to change it).
// Use the same host name as the site (localhost) so the backend's login cookie is sent with credentialed requests.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type ApiInterest = {category_id:number; category_name:string; category_slug:string; description:string|null; cover_url?:string|null; design_count?:number};
// cover_url: preview of the niche's newest design (null when it has none)
export type ApiNiche = {category_name:string; category_slug:string; count?:number; cover_url?:string|null};
export type ApiProduct = {product_id:number; product_name:string; product_type:string; starting_price:string|number|null};
export type ApiDesign = {
  public_design_code:string; title:string; description?:string|null; preview_url:string|null;
  category_name:string|null; category_slug?:string|null;
  starting_price?:string|number|null; // list endpoint
  colors?:{color_name:string; color_hex:string|null}[]; // list endpoint: colors the design is available in
  products?:ApiProduct[]; // detail endpoint
};

// Full image URL for a path like "/media/designs/x.jpg" (null if there is no image)
export function imageUrl(path?:string|null):string|null {
  return path ? API_URL + path : null;
}

// Error from the API; `status` is the HTTP status (0 when the API is unreachable)
export class ApiError extends Error {
  status:number;
  constructor(message:string, status:number) { super(message); this.status = status; }
}

// Request helper: throws an ApiError whose message is the API's {"detail"} text when there is one
// withCookies: send the backend's login cookie (needed for /me/... endpoints)
async function request<T>(method:string, path:string, body?:unknown, withCookies = false):Promise<T> {
  let res:Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      cache: 'no-store',
      credentials: withCookies ? 'include' : undefined,
      // FormData (file uploads): no Content-Type header, the browser adds it with the multipart boundary
      headers: body === undefined || body instanceof FormData ? undefined : {'Content-Type': 'application/json'},
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the store API at ' + API_URL + '. Is the backend running?', 0);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const d = (await res.json()).detail;
      if (typeof d === 'string') detail = d;
      else if (Array.isArray(d)) { // 422 validation errors: "field: message"
        detail = d.map(x => {
          const field = Array.isArray(x.loc) ? String(x.loc[x.loc.length - 1]) : '';
          return (field && field !== 'body' ? field + ': ' : '') + x.msg;
        }).join('; ');
      }
    } catch {}
    throw new ApiError(detail || 'Store API error ' + res.status, res.status);
  }
  return res.json() as Promise<T>;
}

function get<T>(path:string) {
  return request<T>('GET', path);
}

export function getInterests() {
  return get<ApiInterest[]>('/interests');
}

// One interest plus its niches (niches can be an empty list)
export function getNiches(slug:string) {
  return get<{interest:ApiInterest; niches:ApiNiche[]}>('/interests/' + encodeURIComponent(slug) + '/niches');
}

// minOrders: only designs ordered at least this many times (used for Bestsellers)
// sizes / colors: designs available in ANY of these size codes / color names (sent comma separated)
export type DesignParams = {categorySlug?:string; search?:string; priceMin?:string; priceMax?:string; productType?:string; sort?:string; minOrders?:number; sizes?:string[]; colors?:string[]; terms?:string[]; limit?:number; offset?:number};

// Query string for the filters shared by GET /designs and GET /designs/facets
function designFilterQuery({categorySlug, search, priceMin, priceMax, productType, minOrders, sizes, colors, terms}:DesignParams) {
  const q = new URLSearchParams();
  if (minOrders) q.set('min_orders', String(minOrders));
  if (categorySlug) q.set('category_slug', categorySlug);
  if (search) q.set('search', search);
  if (priceMin) q.set('price_min', priceMin);
  if (priceMax) q.set('price_max', priceMax);
  if (productType) q.set('product_type', productType);
  if (sizes && sizes.length) q.set('sizes', sizes.join(','));
  if (colors && colors.length) q.set('colors', colors.join(','));
  if (terms && terms.length) q.set('terms', terms.join(','));
  return q;
}

// One page of designs plus the total number of matches
export async function getDesignPage(params:DesignParams = {}) {
  const {sort, limit = 100, offset = 0} = params;
  const q = designFilterQuery(params);
  if (sort) q.set('sort', sort);
  q.set('limit', String(limit));
  q.set('offset', String(offset));
  return get<{items:ApiDesign[]; total:number}>('/designs?' + q.toString());
}

// GET /designs/facets: counts for the listing sidebar. Each facet ignores its own filter and applies the others.
// price.min / max are null when nothing matches.
export type ApiFacets = {
  niches:{category_id:number; category_name:string; category_slug:string; count:number}[];
  price:{min:string|number|null; max:string|number|null};
  sizes:{size_code:string; count:number}[];
  colors:{color_name:string; color_hex:string|null; count:number}[];
  total:number;
};
export function getDesignFacets(params:DesignParams = {}) {
  return get<ApiFacets>('/designs/facets?' + designFilterQuery(params).toString());
}

export async function getDesigns(params:DesignParams = {}) {
  return (await getDesignPage(params)).items;
}

export function getDesign(code:string) {
  return get<ApiDesign>('/designs/' + encodeURIComponent(code));
}

export type ApiVariant = {product_variant_id:number; sku:string; color_name:string; color_hex:string|null; size_code:string; size_name:string; customer_price:string|number};

export function getVariants(productId:number) {
  return get<{product:ApiProduct; variants:ApiVariant[]}>('/products/' + productId + '/variants');
}

export type ApiCartItem = {
  cart_item_id:number; public_design_code:string; title:string; product_name:string; product_type:string;
  product_variant_id:number; sku:string; color_name:string; color_hex:string|null; size_code:string;
  quantity:number; unit_price:string|number; line_total:string|number; preview_url:string|null;
};
export type ApiCart = {items:ApiCartItem[]; item_count:number; subtotal:string|number};

const CART_TOKEN_KEY = 'printsell-cart-token';
const emptyCart:ApiCart = {items:[], item_count:0, subtotal:0};

function savedToken() {
  try { return localStorage.getItem(CART_TOKEN_KEY); } catch { return null; }
}
function saveToken(token:string|null) {
  try { if (token) localStorage.setItem(CART_TOKEN_KEY, token); else localStorage.removeItem(CART_TOKEN_KEY); } catch {}
}

export async function createCart() {
  return (await request<{cart_token:string}>('POST', '/cart')).cart_token;
}

export function getCart(token:string) {
  return get<ApiCart>('/cart/' + encodeURIComponent(token));
}

export function addCartItem(token:string, body:{public_design_code:string; product_variant_id:number; quantity:number}) {
  return request<ApiCart>('POST', '/cart/' + encodeURIComponent(token) + '/items', body);
}

export function updateCartItem(token:string, id:number, quantity:number) {
  return request<ApiCart>('PATCH', '/cart/' + encodeURIComponent(token) + '/items/' + id, {quantity});
}

export function removeCartItem(token:string, id:number) {
  return request<ApiCart>('DELETE', '/cart/' + encodeURIComponent(token) + '/items/' + id);
}

// Saved cart token (null if there is none) and a way to forget it after an order is placed
export const getCartToken = savedToken;
export function clearCartToken() {
  saveToken(null);
}

// Token of a working cart: the saved one, or a new cart if there is none or the API no longer knows it
export async function ensureCart() {
  const token = savedToken();
  if (token) {
    try { await getCart(token); return token; }
    catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }
  }
  const fresh = await createCart();
  saveToken(fresh);
  return fresh;
}

// The current cart, or an empty one when there is no saved cart (does not create a cart)
export async function loadCart() {
  const token = savedToken();
  if (!token) return emptyCart;
  try { return await getCart(token); }
  catch (e) {
    if (e instanceof ApiError && e.status === 404) { saveToken(null); return emptyCart; }
    throw e;
  }
}

// ---- Checkout, orders (shapes checked against the backend, main.py) ----
// GET /shipping-methods. free_over: order subtotal above which shipping is free (null = never)
export type ApiShippingMethod = {code:string; name:string; price:number; min_days:number; max_days:number; free_over:number|null};

export function getShippingMethods() {
  return get<ApiShippingMethod[]>('/shipping-methods');
}

// Fields shown for an item on the payment and tracking pages (quote and order items both have them)
export type ApiLineItem = {preview_url?:string|null; title:string; product_name:string|null; color_name:string|null; size_code:string|null; quantity:number; line_total:string|number};
export type ApiQuoteItem = ApiLineItem & {
  public_design_code:string; sku:string; unit_price:string|number; preview_url:string|null; product_name:string;
};
export type ApiTotals = {
  subtotal:string|number; discount_total:string|number; discount_name:string|null;
  shipping_amount:string|number; tax_total:string|number; total:string|number;
};
// POST /checkout
export type ApiQuote = ApiTotals & {
  checkout_session_id:number; items:ApiQuoteItem[];
  estimated_delivery_start:string|null; estimated_delivery_end:string|null; quote_expires_at:string;
};
export type ApiCheckoutBody = {
  cart_token:string; contact_email:string; shipping_method_code:string;
  shipping_address:{full_name:string; phone:string; line_1:string; line_2?:string; city:string; state_region:string; postal_code:string; country_code:string};
};

export function createCheckout(body:ApiCheckoutBody) {
  return request<ApiQuote>('POST', '/checkout', body, true); // cookie: the backend links a logged-in customer to the checkout
}

// POST /checkout/{id}/place-order. 400 = quote expired or already used, 409 = prices changed
export function placeOrder(checkoutSessionId:number, cartToken:string) {
  return request<{order_public_code:string; order_total:string|number}>('POST', '/checkout/' + checkoutSessionId + '/place-order', {cart_token: cartToken}, true); // cookie: a logged-in customer's order shows up in My Orders
}

// GET /orders/track. Note the order totals use different names than the quote (item_subtotal, shipping_total, order_total)
export type ApiTrackedOrder = {
  order_public_code:string; placed_at:string; order_status:string; payment_status:string;
  item_subtotal:string|number; discount_total:string|number; discount_name:string|null;
  shipping_total:string|number; tax_total:string|number; order_total:string|number;
  shipping_address:{recipient_name:string; city:string; country_code:string}|null;
  items:(ApiLineItem & {unit_price:string|number; preview_url:string|null; item_status:string})[];
  status_history:{status_code:string; status_message:string|null; changed_at:string}[];
};

export function trackOrder(code:string, email:string) {
  return get<ApiTrackedOrder>('/orders/track?' + new URLSearchParams({code, email}).toString());
}
// ---- Logged-in customer's orders (need the backend login cookie) ----
export type ApiMyOrder = {order_public_code:string; placed_at:string; order_status:string; payment_status:string; order_total:string|number; item_count:number; preview_url:string|null};

// GET /me/orders (newest first)
export function getMyOrders() {
  return request<ApiMyOrder[]>('GET', '/me/orders', undefined, true);
}

// GET /me/orders/{code}: same shape as the tracking response
export function getMyOrder(code:string) {
  return request<ApiTrackedOrder>('GET', '/me/orders/' + encodeURIComponent(code), undefined, true);
}

// ---- Customer accounts (login cookie "tt_session" is set by the backend) ----
export type ApiUser = {user_id:number; full_name:string; email:string};

export function signupCustomer(body:{full_name:string; email:string; password:string}) {
  return request<ApiUser>('POST', '/auth/signup', body, true);
}

export function loginCustomer(body:{email:string; password:string}) {
  return request<ApiUser>('POST', '/auth/login', body, true);
}

export function logoutCustomer() {
  return request<{message:string}>('POST', '/auth/logout', undefined, true);
}

// The logged-in user (with roles and permissions), or null when logged out (401). Other errors (API down) are thrown.
export async function getMe() {
  try { return await request<ApiMe>('GET', '/auth/me', undefined, true); }
  catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
}

// Attaches a guest cart to the logged-in customer (merges it with their older cart)
export function claimCart(token:string) {
  return request<ApiCart>('POST', '/cart/' + encodeURIComponent(token) + '/claim', undefined, true);
}

// ---- Shipping locations (no login needed) ----
export type ApiCountry = {code:string; name:string; phone_code:string};
export type ApiState = {state_id:number; state_code:string; state_name:string};
export type ApiCity = {city_id:number; city_name:string};

export function getCountries() {
  return get<ApiCountry[]>('/locations/countries');
}

export function getStates(countryCode:string) {
  return get<ApiState[]>('/locations/countries/' + encodeURIComponent(countryCode) + '/states');
}

// A state can have ~1900 cities
export function getCities(stateId:number|string) {
  return get<ApiCity[]>('/locations/states/' + encodeURIComponent(String(stateId)) + '/cities');
}

// ---- Admin panel (all calls send the login cookie; the backend checks the permissions) ----
export type ApiMe = ApiUser & {
  is_staff:boolean; is_super_admin:boolean; roles:{role_code:string; role_name:string}[]; permissions:string[];
};

export type ApiAdminStats = {
  orders_today:number; orders_total:number; revenue_total:string|number|null;
  orders_by_status:Record<string,number>; designs_published:number; customers_total:number;
  recent_orders:{order_public_code:string; placed_at:string; customer:string; order_total:string|number; order_status:string}[];
};
export function getAdminStats() {
  return request<ApiAdminStats>('GET', '/admin/stats', undefined, true);
}

export type ApiAdminOrderRow = {
  order_public_code:string; placed_at:string; contact_email:string; customer_name:string|null;
  item_count:number; order_total:string|number; order_status:string; payment_status:string;
};
export function getAdminOrders({status, search, limit = 20, offset = 0}:{status?:string; search?:string; limit?:number; offset?:number} = {}) {
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  if (search) q.set('search', search);
  q.set('limit', String(limit));
  q.set('offset', String(offset));
  return request<{items:ApiAdminOrderRow[]; total:number}>('GET', '/admin/orders?' + q.toString(), undefined, true);
}

export type ApiAdminOrder = {
  order_public_code:string; placed_at:string; order_status:string; payment_status:string;
  item_subtotal:string|number; discount_total:string|number; discount_name:string|null;
  shipping_total:string|number; tax_total:string|number; order_total:string|number;
  contact_email:string; customer:{user_id:number; full_name:string; email:string}|null;
  shipping_address:{recipient_name:string; phone_number:string; line_1:string; line_2:string|null; city:string; state_region:string; postal_code:string; country_code:string}|null;
  items:{title:string; preview_url:string|null; product_name:string|null; color_name:string|null; size_code:string|null; quantity:number; unit_price:string|number; line_total:string|number; item_status:string}[];
  payments:{payment_public_code:string; action_type:string; provider_code:string; provider_reference:string|null; currency_code:string; amount:string|number; payment_status:string; reason:string|null; processed_at:string|null}[];
  status_history:{status_code:string; status_message:string|null; is_customer_visible:boolean; changed_at:string; changed_by_name:string|null}[];
};
export function getAdminOrder(code:string) {
  return request<ApiAdminOrder>('GET', '/admin/orders/' + encodeURIComponent(code), undefined, true);
}
export function changeOrderStatus(code:string, body:{new_status:string; message?:string; customer_visible:boolean}) {
  return request<ApiAdminOrder>('POST', '/admin/orders/' + encodeURIComponent(code) + '/status', body, true);
}
export function markOrderPaid(code:string) {
  return request<ApiAdminOrder>('POST', '/admin/orders/' + encodeURIComponent(code) + '/mark-paid', undefined, true);
}

export type ApiAdminUser = {
  user_id:number; full_name:string; email:string; account_status:string; last_login_at:string|null;
  roles:{role_code:string; role_name:string}[];
};
export function getAdminUsers(search = '') {
  return request<ApiAdminUser[]>('GET', '/admin/users' + (search ? '?search=' + encodeURIComponent(search) : ''), undefined, true);
}
export function createAdminUser(body:{full_name:string; email:string; password:string; roles:string[]}) {
  return request<ApiAdminUser>('POST', '/admin/users', body, true);
}
export function setUserRoles(userId:number, roles:string[]) {
  return request<ApiAdminUser>('PUT', '/admin/users/' + userId + '/roles', {roles}, true);
}
export function setUserDisabled(userId:number, disabled:boolean) {
  return request<ApiAdminUser>('POST', '/admin/users/' + userId + (disabled ? '/disable' : '/enable'), undefined, true);
}

export type ApiAdminRole = {
  role_code:string; role_name:string; description:string|null; is_system:boolean; is_staff:boolean;
  permissions:string[]; user_count:number;
};
export type ApiPermissionModule = {module:string; permissions:{permission_code:string; action:string; label:string}[]};
export function getAdminRoles() {
  return request<ApiAdminRole[]>('GET', '/admin/roles', undefined, true);
}
export function getAdminPermissions() {
  return request<ApiPermissionModule[]>('GET', '/admin/permissions', undefined, true);
}
export function createRole(body:{role_code:string; role_name:string; description:string; permissions:string[]}) {
  return request<ApiAdminRole>('POST', '/admin/roles', body, true);
}
export function updateRole(code:string, body:{role_name:string; description:string; permissions:string[]}) {
  return request<ApiAdminRole>('PUT', '/admin/roles/' + encodeURIComponent(code), body, true);
}
export function deleteRole(code:string) {
  return request<{message:string}>('DELETE', '/admin/roles/' + encodeURIComponent(code), undefined, true);
}

export type ApiCountrySetting = {code:string; name:string; phone_code:string; is_shipping_enabled:boolean; display_order:number; states_count:number};
export function getCountrySettings() {
  return request<ApiCountrySetting[]>('GET', '/admin/settings/countries', undefined, true);
}
export function setCountryShipping(code:string, enabled:boolean) {
  return request<ApiCountrySetting>('PUT', '/admin/settings/countries/' + encodeURIComponent(code), {is_shipping_enabled: enabled}, true);
}

// ---- Admin: designs ----
export type ApiAdminCategory = {
  category_id:number; name:string; slug:string; status:string;
  niches:{category_id:number; name:string; slug:string; status:string}[];
};
export function getAdminCategories() {
  return request<ApiAdminCategory[]>('GET', '/admin/categories', undefined, true);
}

// Active products (public endpoint), used for the product checkboxes of a new design
export function getActiveProducts() {
  return get<{product_id:number; product_name:string; product_type:string}[]>('/products');
}

export type ApiAdminDesignRow = {
  public_design_code:string; title:string; preview_url:string|null; category_name:string|null;
  design_status:string; source_platform:string; enabled_products:number; times_ordered:number;
  created_at:string; first_published_at:string|null;
};
export function getAdminDesigns({status, categoryId, search, source, limit = 24, offset = 0}:{status?:string; categoryId?:string; search?:string; source?:string; limit?:number; offset?:number} = {}) {
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  if (categoryId) q.set('category_id', categoryId);
  if (search) q.set('search', search);
  if (source) q.set('source', source);
  q.set('limit', String(limit));
  q.set('offset', String(offset));
  return request<{items:ApiAdminDesignRow[]; total:number}>('GET', '/admin/designs?' + q.toString(), undefined, true);
}

export type ApiAdminDesign = {
  public_design_code:string; title:string; description:string|null; design_status:string;
  source_platform:string; source_reference:string|null; background_type:string|null;
  first_published_at:string|null; last_published_at:string|null; created_at:string; updated_at:string;
  preview_url:string|null; artwork_url:string|null;
  image:{mime_type:string|null; file_size_bytes:number|null; original_name:string|null};
  uploaded_by:string|null;
  category:{category_id:number|null; name:string|null; parent:{category_id:number; name:string}|null};
  tags:string[];
  products:{product_id:number; product_name:string; product_type:string; is_enabled:boolean}[];
  times_ordered:number;
};
export function getAdminDesign(code:string) {
  return request<ApiAdminDesign>('GET', '/admin/designs/' + encodeURIComponent(code), undefined, true);
}
// multipart: image, title, description, category_id, tags ("a,b"), product_ids ("1,2"), status (draft|published)
export function createDesign(form:FormData) {
  return request<ApiAdminDesign>('POST', '/admin/designs', form, true);
}
export function updateDesign(code:string, body:{title?:string; description?:string|null; category_id?:number; tags?:string[]; product_ids?:number[]}) {
  return request<ApiAdminDesign>('PATCH', '/admin/designs/' + encodeURIComponent(code), body, true);
}
export function replaceDesignImage(code:string, file:File) {
  const form = new FormData();
  form.append('image', file);
  return request<ApiAdminDesign>('POST', '/admin/designs/' + encodeURIComponent(code) + '/image', form, true);
}
export function setDesignStatus(code:string, status:string) {
  return request<ApiAdminDesign>('POST', '/admin/designs/' + encodeURIComponent(code) + '/status', {status}, true);
}
export function bulkDesignStatus(codes:string[], status:string) {
  return request<{updated:number; skipped:{code:string; reason:string}[]}>('POST', '/admin/designs/bulk-status', {codes, status}, true);
}

// Converts an API design into the Design type the existing JSX uses.
// rating / reviews / colors are not in the database, so they are 0 (the UI hides them).
export function toDesign(a:ApiDesign):Design {
  const prices = [a.starting_price, ...(a.products || []).map(p => p.starting_price)]
    .filter(x => x !== null && x !== undefined)
    .map(Number)
    .filter(n => n > 0);
  return {
    id: a.public_design_code,
    name: a.title,
    price: prices.length ? Math.min(...prices) : 0,
    rating: 0,
    reviews: 0,
    category: a.category_name || '',
    colors: 0,
    image: imageUrl(a.preview_url),
    description: a.description || null,
    swatches: (a.colors || []).map(c => ({name: c.color_name, hex: c.color_hex})),
  };
}
