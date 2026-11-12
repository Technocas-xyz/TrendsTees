import type {Design} from '@/components/data';

// Base URL of the FastAPI backend (set NEXT_PUBLIC_API_URL to change it)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export type ApiInterest = {category_id:number; category_name:string; category_slug:string; description:string|null; cover_url?:string|null; design_count?:number};
export type ApiNiche = {category_name:string; category_slug:string};
export type ApiProduct = {product_id:number; product_name:string; product_type:string; starting_price:string|number|null};
export type ApiDesign = {
  public_design_code:string; title:string; description?:string|null; preview_url:string|null;
  category_name:string|null; category_slug?:string|null;
  starting_price?:string|number|null; // list endpoint
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
async function request<T>(method:string, path:string, body?:unknown):Promise<T> {
  let res:Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      cache: 'no-store',
      headers: body === undefined ? undefined : {'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body),
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

export type DesignParams = {categorySlug?:string; search?:string; priceMin?:string; priceMax?:string; productType?:string; sort?:string; limit?:number; offset?:number};

// One page of designs plus the total number of matches
export async function getDesignPage({categorySlug, search, priceMin, priceMax, productType, sort, limit = 100, offset = 0}:DesignParams = {}) {
  const q = new URLSearchParams();
  if (categorySlug) q.set('category_slug', categorySlug);
  if (search) q.set('search', search);
  if (priceMin) q.set('price_min', priceMin);
  if (priceMax) q.set('price_max', priceMax);
  if (productType) q.set('product_type', productType);
  if (sort) q.set('sort', sort);
  q.set('limit', String(limit));
  q.set('offset', String(offset));
  return get<{items:ApiDesign[]; total:number}>('/designs?' + q.toString());
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
  return request<ApiQuote>('POST', '/checkout', body);
}

// POST /checkout/{id}/place-order. 400 = quote expired or already used, 409 = prices changed
export function placeOrder(checkoutSessionId:number, cartToken:string) {
  return request<{order_public_code:string; order_total:string|number}>('POST', '/checkout/' + checkoutSessionId + '/place-order', {cart_token: cartToken});
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
  };
}
