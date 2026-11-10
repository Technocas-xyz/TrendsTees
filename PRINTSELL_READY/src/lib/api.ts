import type {Design} from '@/components/data';

// Base URL of the FastAPI backend (set NEXT_PUBLIC_API_URL to change it)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export type ApiInterest = {category_id:number; category_name:string; category_slug:string; description:string|null; cover_url?:string|null; design_count?:number};
export type ApiNiche = {category_name:string; category_slug:string};
export type ApiDesign = {
  public_design_code:string; title:string; description?:string|null; preview_url:string|null;
  category_name:string|null; category_slug?:string|null;
  starting_price?:string|number|null; // list endpoint
  products?:{starting_price:string|number|null}[]; // detail endpoint
};

// Full image URL for a path like "/media/designs/x.jpg" (null if there is no image)
export function imageUrl(path?:string|null):string|null {
  return path ? API_URL + path : null;
}

// GET helper: throws a clear Error when the API is unreachable or returns an error
async function get<T>(path:string):Promise<T> {
  let res:Response;
  try {
    res = await fetch(API_URL + path, {cache:'no-store'});
  } catch {
    throw new Error('Cannot reach the store API at ' + API_URL + '. Is the backend running?');
  }
  if (!res.ok) {
    let detail = '';
    try { const body = await res.json(); if (typeof body.detail === 'string') detail = body.detail; } catch {}
    throw new Error('Store API error ' + res.status + (detail ? ': ' + detail : ''));
  }
  return res.json() as Promise<T>;
}

export function getInterests() {
  return get<ApiInterest[]>('/interests');
}

// One interest plus its niches (niches can be an empty list)
export function getNiches(slug:string) {
  return get<{interest:ApiInterest; niches:ApiNiche[]}>('/interests/' + encodeURIComponent(slug) + '/niches');
}

export async function getDesigns({categorySlug, search, limit = 100, offset = 0}:{categorySlug?:string; search?:string; limit?:number; offset?:number} = {}) {
  const q = new URLSearchParams();
  if (categorySlug) q.set('category_slug', categorySlug);
  if (search) q.set('search', search);
  q.set('limit', String(limit));
  q.set('offset', String(offset));
  const res = await get<{items:ApiDesign[]}>('/designs?' + q.toString());
  return res.items;
}

export function getDesign(code:string) {
  return get<ApiDesign>('/designs/' + encodeURIComponent(code));
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
