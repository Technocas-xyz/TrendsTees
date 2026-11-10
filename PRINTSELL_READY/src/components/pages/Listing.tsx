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
} from "../data";

import {
  money,
  blankShipping,
  categories,
  optionsColors,
  getStored,
  saved,
  Placeholder,
  Header,
  Bottom,
  Crumb,
  ProductCard,
  Steps,
  ItemSummary,
} from "../shared";
export function Listing({
  dogs = false,
  search = "",
  onWish,
  wishlist,
}: {
  dogs?: boolean;
  search?: string;
  onWish: (id: number) => void;
  wishlist: number[];
}) {
  const [tab, setTab] = useState("All Animals & Pets"),
    [price, setPrice] = useState<string[]>([]),
    [sort, setSort] = useState("Popular"),
    [style, setStyle] = useState<string[]>([]),
    [color, setColor] = useState("");
  const base = dogs ? designs.filter((x) => x.category === "Dogs") : designs;
  const visible = base
    .filter(
      (d) =>
        (dogs || tab === "All Animals & Pets" || d.category === tab) &&
        (!search || d.name.toLowerCase().includes(search.toLowerCase())) &&
        (price.length === 0 ||
          price.some((x) =>
            x === "Under $20"
              ? d.price < 20
              : x === "$20 - $30"
                ? d.price >= 20 && d.price < 30
                : x === "$30 - $40"
                  ? d.price >= 30 && d.price <= 40
                  : d.price > 40,
          )),
    )
    .sort((a, b) =>
      sort === "Price: Low to High"
        ? a.price - b.price
        : sort === "Price: High to Low"
          ? b.price - a.price
          : sort === "Top Rated"
            ? b.rating - a.rating
            : 0,
    );
  return (
    <div className="container page">
      <Crumb
        items={
          dogs
            ? [
                { name: "Animals & Pets", href: "/animals-pets" },
                { name: "Dogs" },
              ]
            : [{ name: "Animals & Pets" }]
        }
      />
      <h1>{dogs ? "Dog Designs" : "Animals & Pets"}</h1>
      <p className="muted">
        {dogs
          ? "Celebrate man's best friend with our exclusive dog inspired designs."
          : "Explore designs for pet lovers, dog moms, cat dads, rescue fans, horse lovers and more."}
      </p>
      {!dogs && (
        <div className="tabs">
          {categories.map((t) =>
            t === "Dogs" ? (
              <Link key={t} href="/dog-designs">
                Dogs
              </Link>
            ) : (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ),
          )}
        </div>
      )}
      <div className="toolbar">
        <div>
          <button onClick={() => setSort("Top Rated")}>Trending</button>
          <button onClick={() => setSort("Top Rated")}>Best Selling</button>
          <button onClick={() => setSort("Popular")}>New Arrivals</button>
          <span>{visible.length} Sample Designs</span>
        </div>
        <label>
          Sort by:{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option>Popular</option>
            <option>Top Rated</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
          </select>
        </label>
      </div>
      <div className="listing">
        <aside className="filters">
          <div className="filter-title">
            <b>Filter Designs</b>
            <button
              onClick={() => {
                setPrice([]);
                setStyle([]);
                setColor("");
                setTab("All Animals & Pets");
                setSort("Popular");
              }}
            >
              Clear All
            </button>
          </div>
          <h3>Price</h3>
          {["Under $20", "$20 - $30", "$30 - $40", "Above $40"].map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                checked={price.includes(p)}
                onChange={() =>
                  setPrice((v) =>
                    v.includes(p) ? v.filter((x) => x !== p) : [...v, p],
                  )
                }
              />
              {p}
            </label>
          ))}
          <h3>
            Style <small>(preview)</small>
          </h3>
          {[
            "Text Based",
            "Illustration",
            "Retro / Vintage",
            "Minimal",
            "Funny",
          ].map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={style.includes(s)}
                onChange={() =>
                  setStyle((v) =>
                    v.includes(s) ? v.filter((x) => x !== s) : [...v, s],
                  )
                }
              />
              {s}
            </label>
          ))}
          <h3>
            Color Theme <small>(preview)</small>
          </h3>
          <div className="color-row">
            {optionsColors.slice(0, 5).map((c) => (
              <button
                aria-label={c.name}
                title={c.name}
                onClick={() => setColor(c.name === color ? "" : c.name)}
                className={color === c.name ? "on" : ""}
                key={c.name}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <h3>Best For</h3>
          {[
            "T-Shirts",
            "Hoodies",
            "Sweatshirts",
            "DTF Transfers",
            "All Products",
          ].map((x) => (
            <label key={x}>
              <input type="checkbox" disabled />
              {x}
            </label>
          ))}
          <small className="muted">
            Style, color and product-type filters require catalog attributes.
          </small>
        </aside>
        <div>
          <div className="products four">
            {visible.map((d) => (
              <ProductCard
                key={d.id}
                d={d}
                onWish={onWish}
                wished={wishlist.includes(d.id)}
              />
            ))}
          </div>
          {visible.length === 0 && (
            <div className="empty">
              No matching designs.{" "}
              <button
                onClick={() => {
                  setPrice([]);
                  setTab("All Animals & Pets");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
