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

// Curated collections, each at /collections/<slug>. The banner is public/collections/<slug>.png (its title and
// "Shop Collection" button are drawn in the image). Which designs belong to it:
//   terms    = designs whose title or one of its tags contains ANY of these words (max 10)
//   category = designs in this interest (and its niches)
// With both set, a design must match both. Add a collection here and it appears on the home page, in the
// header "Collections" menu and at its own URL.
export type Collection = {slug:string; name:string; alt:string; description:string; terms?:string[]; category?:string};
export const COLLECTIONS:Collection[] = [
  {slug:'nature', name:'Nature Collection', alt:'Nature Collection: wilderness-inspired graphic tees. Shop Collection',
   description:'Forests, mountains and wild animals: original nature graphic tees, designed in-house.',
   terms:['nature','forest','mountain','animal']},
  // Anime titles rarely say "anime", so this collection uses the Anime interest instead of words
  {slug:'anime', name:'Anime Collection', alt:'Anime Collection: iconic styles for anime fans. Shop Collection',
   description:'Iconic styles for anime fans, designed in-house by the PrintSteez team.',
   category:'anime'},
  {slug:'retro', name:'Retro Collection', alt:'Retro Collection: vintage vibes, modern tees. Shop Collection',
   description:'Vintage vibes on modern tees: retro, 80s and 90s classics.',
   terms:['retro','vintage','80s','90s','classic']},
];
export const collectionImage = (c:Collection) => '/collections/' + c.slug + '.png';
export const collectionHref = (c:Collection) => '/collections/' + c.slug;
export const findCollection = (slug:string) => COLLECTIONS.find(c => c.slug === slug.toLowerCase()) || null;

// Product types: URL value (/designs?product_type=...) -> label and the API product_type. A type appears in
// menus and links only while it has at least one active product (GET /products).
// long_sleeve is not an allowed product_type in the database yet, so Long Sleeves stays "Coming soon".
export const PRODUCT_TYPES:{slug:string; label:string; api:string}[] = [
  {slug:'tshirt', label:'T-Shirts', api:'tshirt'},
  {slug:'hoodie', label:'Hoodies', api:'hoodie'},
  {slug:'longsleeve', label:'Long Sleeves', api:'long_sleeve'},
  {slug:'sweatshirt', label:'Sweatshirts', api:'sweatshirt'},
];
export const productTypeHref = (slug:string) => '/designs?product_type=' + slug;

// Social profiles. An icon is shown only when its URL is filled in (https only); links open in a new tab.
export const SOCIAL_LINKS:{instagram:string; tiktok:string; youtube:string; x:string; facebook:string} = {
  instagram: '',
  tiktok: '',
  youtube: '',
  x: '',
  facebook: '',
};

// Shipping and returns facts used on the help pages (keep in line with the backend SHIPPING_METHODS)
export const SHIPS_TO = 'the United States';
export const RETURN_DAYS = 30;

// Sizes customers can see and choose, in display order. XS is not sold: it never appears in the
// listing filters, facet counts or product size selectors, even if the API returns it.
export const SIZES = ['S','M','L','XL','2XL','3XL'];
export const HIDDEN_SIZES = ['XS'];
export const isHiddenSize = (code:string|null|undefined) => !!code && HIDDEN_SIZES.includes(code.trim().toUpperCase());
