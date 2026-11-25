// Store-wide settings used by the Header, Home page and Footer. Change a value here and it updates everywhere.
export const STORE_NAME = 'PrintSteez';
export const COPYRIGHT_YEAR = 2026;

// Orders at or above this subtotal ship free. The backend has its own rule (SHIPPING_METHODS in main.py): keep both in sync.
export const FREE_SHIPPING_THRESHOLD = 75;
export const FREE_SHIPPING_LABEL = '$' + FREE_SHIPPING_THRESHOLD;

// Card logos in the footer. Keep false until a real payment gateway exists (checkout is demo-only).
export const SHOW_PAYMENT_ICONS = false;

// Promo banner (top bar). The promo system is not built yet, so it stays hidden.
export const SHOW_PROMO_BANNER = false;
export const PROMO_CODE = 'STEEZ10';
export const PROMO_TEXT = 'for 10% Off Your First Order';

// Curated collections: banner image (title and button are drawn in it) + the interest it links to.
// There is no "nature" interest yet, so Nature points to animals for now.
export const COLLECTIONS:{name:string;img:string;category:string;alt:string}[] = [
  {name:'Nature Collection', img:'/collections/nature.png', category:'animals', alt:'Nature Collection: wilderness-inspired graphic tees. Shop Collection'},
  {name:'Anime Collection', img:'/collections/anime.png', category:'anime', alt:'Anime Collection: iconic styles for anime fans. Shop Collection'},
  {name:'Retro Collection', img:'/collections/retro.png', category:'vintage', alt:'Retro Collection: vintage vibes, modern tees. Shop Collection'},
];

// Sizes customers can see and choose, in display order. XS is not sold: it never appears in the
// listing filters, facet counts or product size selectors, even if the API returns it.
export const SIZES = ['S','M','L','XL','2XL','3XL'];
export const HIDDEN_SIZES = ['XS'];
export const isHiddenSize = (code:string|null|undefined) => !!code && HIDDEN_SIZES.includes(code.trim().toUpperCase());
