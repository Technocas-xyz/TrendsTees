// Every URL the storefront catch-all route (app/[[...slug]]/page.tsx -> components/Site.tsx) can show.
// The server uses isKnownPath() to answer unknown URLs with a real HTTP 404 (app/not-found.tsx).
// Keep this list in step with the router in Site.tsx.
import {findCollection} from './config';

// Help and legal pages (content in components/pages/InfoPages.tsx)
export const INFO_PAGES = ['faq', 'shipping', 'returns', 'contact', 'about', 'privacy', 'terms', 'cookies'] as const;
export type InfoPageSlug = (typeof INFO_PAGES)[number];
export const isInfoPage = (slug: string): slug is InfoPageSlug => (INFO_PAGES as readonly string[]).includes(slug);

const EXACT = new Set([
  '/', '/designs', '/cart', '/wishlist', '/track-order',
  '/checkout/shipping', '/checkout/payment', '/checkout/confirmation',
  '/animals-pets', '/dog-designs', // older listing pages, kept so old links still open
  ...INFO_PAGES.map(p => '/' + p),
]);

export function isKnownPath(path: string): boolean {
  if (EXACT.has(path)) return true;
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'collections') return parts.length === 2 && findCollection(parts[1]) !== null;
  if (parts[0] === 'designs') {
    // /designs/<code>, /designs/<code>/choose-product, /designs/<code>/customize
    return (parts.length === 2) || (parts.length === 3 && (parts[2] === 'choose-product' || parts[2] === 'customize'));
  }
  return false;
}
