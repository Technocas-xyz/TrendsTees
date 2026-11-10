"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Heart,
  Search,
  UserRound,
  Truck,
  ShieldCheck,
  PackageCheck,
  Headphones,
  Star,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Shirt,
  Tag,
  Gift,
  Box,
  Check,
  Plus,
  Minus,
  Trash2,
  MapPin,
  CreditCard,
  ClipboardCheck,
  Clock,
  Package,
  Mail,
} from "lucide-react";
import {
  designs,
  interests,
  types,
  CART,
  ORDER,
  SHIPPING,
  type Design,
  type CartItem,
  type Shipping,
  type DemoOrder,
} from "./data";
export const money = (n: number) => "$" + n.toFixed(2);

export function getStored<T>(key: string, fallback: T): T {
  try {
    const x = localStorage.getItem(key);
    return x ? (JSON.parse(x) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saved(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const blankShipping: Shipping = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  apartment: "",
  city: "",
  state: "",
  zip: "",
  country: "United States",
  shippingMethod: "standard",
};
export const categories = [
  "All Animals & Pets",
  "Dogs",
  "Cats",
  "Horses",
  "Farm Animals",
  "Birds",
  "Pet Lovers",
  "Rescue & Adoption",
  "Funny Pets",
];
export const optionsColors = [
  { name: "Black", hex: "#171717" },
  { name: "White", hex: "#ffffff" },
  { name: "Navy", hex: "#1c3155" },
  { name: "Red", hex: "#c91d37" },
  { name: "Gray", hex: "#9b9b9b" },
  { name: "Pink", hex: "#edafc1" },
];

export function Placeholder({
  label = "Product image",
  tall = false,
}: {
  label?: string;
  tall?: boolean;
}) {
  return (
    <div className={"placeholder " + (tall ? "tall" : "")}>
      <Shirt size={52} strokeWidth={1.1} />
      <small>
        {label}
        <br />
        Image will be added later
      </small>
    </div>
  );
}

export function Header({ count }: { count: number }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  return (
    <>
      <div className="benefit-top">
        <span>
          <Truck /> Free Shipping on Orders $75+
        </span>
        <span>
          <PackageCheck /> Premium Quality Prints
        </span>
        <span>
          <Shirt /> Made to Order
        </span>
        <span>
          <Truck /> Fast Delivery
        </span>
        <span>
          <Headphones /> 24/7 Support
        </span>
      </div>
      <header className="header">
        <Link href="/" className="logo">
          PRINT<span>&amp;SELL</span>
        </Link>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/designs?search=" + encodeURIComponent(q));
          }}
        >
          <Search size={19} />
          <input
            placeholder="Search designs, categories, products..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button>Search</button>
        </form>
        <div className="header-actions">
          <Link href="/account">
            <UserRound /> <span>Account / Login</span>
          </Link>
          <Link href="/wishlist">
            <Heart /> <span>Wishlist</span>
          </Link>
          <Link href="/cart">
            <ShoppingCart />
            <span>Cart</span>
            {count > 0 && <b className="cart-count">{count}</b>}
          </Link>
        </div>
      </header>
      <nav className="nav">
        <Link href="/designs">Shop All Designs</Link>
        <Link href="/designs?sort=top">Trending Now</Link>
        <Link href="/new-designs">New Arrivals</Link>
        <Link href="/designs?sort=top">Best Sellers</Link>
        <Link href="/bundle-deals">
          Bundle Deals <b>HOT</b>
        </Link>
        <Link href="/designs/1/choose-product">DTF Transfers</Link>
        <Link href="/#how-it-works">How It Works</Link>
        <Link href="/track-order">Track Order</Link>
      </nav>
    </>
  );
}

export function Bottom() {
  return (
    <>
      <section className="benefits">
        <div>
          <Shirt />
          <b>Made to Order</b>
          <small>Each item is made just for you.</small>
        </div>
        <div>
          <Star />
          <b>Premium Quality</b>
          <small>Vibrant prints on premium materials.</small>
        </div>
        <div>
          <Package />
          <b>No Minimum Orders</b>
          <small>Order one or as many as you want.</small>
        </div>
        <div>
          <Truck />
          <b>Fast &amp; Reliable Shipping</b>
          <small>Quick delivery you can trust.</small>
        </div>
        <div>
          <ShieldCheck />
          <b>Secure Checkout</b>
          <small>Payment gateway coming soon.</small>
        </div>
      </section>
      <footer>
        <div>
          <b className="logo">
            PRINT<span>&amp;SELL</span>
          </b>
          <p>Designs you'll love. Made just for you.</p>
        </div>
        <div>
          <b>SHOP</b>
          <Link href="/animals-pets">Animals &amp; Pets</Link>
          <Link href="/dog-designs">Dog Designs</Link>
          <Link href="/designs">All Designs</Link>
          <Link href="/new-designs">New Designs</Link>
        </div>
        <div>
          <b>HELP</b>
          <Link href="/track-order">Track Demo Order</Link>
          <Link href="/cart">Cart</Link>
          <Link href="/checkout/shipping">Shipping</Link>
        </div>
        <div>
          <b>CHECKOUT</b>
          <p>
            Frontend prototype — real orders and payments are not available yet.
          </p>
        </div>
      </footer>
    </>
  );
}

export function Crumb({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <div className="crumb">
      <Link href="/">Home</Link>
      {items.map((x, i) => (
        <span key={i}>
          ›{" "}
          {x.href ? (
            <Link href={x.href}>{x.name}</Link>
          ) : (
            <strong>{x.name}</strong>
          )}
        </span>
      ))}
    </div>
  );
}

export function ProductCard({
  d,
  onWish,
  wished,
}: {
  d: Design;
  onWish: (id: number) => void;
  wished: boolean;
}) {
  return (
    <div className="product-card">
      <div className="product-picture">
        <Link href={"/designs/" + d.id}>
          <Placeholder />
        </Link>
        <button
          title="Wishlist"
          aria-label={"Wishlist " + d.name}
          className="heart"
          onClick={() => onWish(d.id)}
        >
          <Heart
            fill={wished ? "#df1431" : "none"}
            color={wished ? "#df1431" : "#374151"}
            size={20}
          />
        </button>
      </div>
      <div className="product-info">
        <Link href={"/designs/" + d.id}>{d.name}</Link>
        <p>From {money(d.price)}</p>
        <div className="rating">
          <Star size={15} fill="#f5a31f" color="#f5a31f" /> {d.rating} (
          {d.reviews}) <span>· {d.colors} Colors</span>
        </div>
      </div>
    </div>
  );
}

export function Steps({ active }: { active: number }) {
  return (
    <div className="checkout-steps">
      {["Cart", "Shipping", "Payment", "Confirmation"].map((x, i) => (
        <div className={i <= active ? "step active" : "step"} key={x}>
          <span>{i < active ? "✓" : i + 1}</span>
          {x}
        </div>
      ))}
    </div>
  );
}

export function ItemSummary({ items }: { items: CartItem[] }) {
  const s = items.reduce((v, x) => v + x.unitPrice * x.quantity, 0);
  return (
    <aside className="panel sticky">
      <h2>Order Summary</h2>
      {items.map((x) => (
        <div className="mini-item" key={x.cartId}>
          <div className="mini-pic">
            <Shirt />
          </div>
          <div>
            <b>
              {x.designName} — {x.productName}
            </b>
            <small>
              {x.color ? x.color + " · " : ""}
              {x.size} · Qty {x.quantity}
            </small>
          </div>
          <b>{money(x.unitPrice * x.quantity)}</b>
        </div>
      ))}
      <div className="line">
        <span>Subtotal</span>
        <b>{money(s)}</b>
      </div>
      <div className="line">
        <span>Shipping</span>
        <span>Not calculated</span>
      </div>
      <div className="line">
        <span>Taxes</span>
        <span>Not calculated</span>
      </div>
      <div className="line total">
        <b>Current Subtotal</b>
        <b>{money(s)}</b>
      </div>
      <p className="tiny">
        This is not a final payable total. Payment processing has not been
        implemented.
      </p>
    </aside>
  );
}
