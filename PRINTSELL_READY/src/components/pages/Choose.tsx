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
export function Choose({ d }: { d: Design }) {
  const [selected, setSelected] = useState(types[0].id);
  const p = types.find((x) => x.id === selected)!;
  return (
    <div className="container page">
      <Crumb
        items={[
          { name: "Dog Designs", href: "/dog-designs" },
          { name: d.name, href: "/designs/" + d.id },
          { name: "Choose Product" },
        ]}
      />
      <Link className="back" href={"/designs/" + d.id}>
        <ArrowLeft size={17} /> Back to Design
      </Link>
      <h1>Choose a Product</h1>
      <p className="muted">
        Select the perfect product for your {d.name} design.
      </p>
      <div className="two-col">
        <section>
          <h2>Select Product Type</h2>
          <div className="type-grid">
            {types.map((t) => (
              <button
                key={t.id}
                className={"type-card " + (selected === t.id ? "selected" : "")}
                onClick={() => setSelected(t.id)}
              >
                <div>
                  <Shirt size={43} strokeWidth={1.1} />
                </div>
                <b>{t.name}</b>
                <small>From {money(t.price)}</small>
                {selected === t.id && (
                  <Check className="type-check" size={20} />
                )}
              </button>
            ))}
          </div>
        </section>
        <aside className="panel">
          <h2>Product Preview</h2>
          <Placeholder label={d.name + " — " + p.name} tall />
          <div className="line">
            <span>Selected Design</span>
            <b>{d.name}</b>
          </div>
          <div className="line">
            <span>Selected Product</span>
            <b>{p.name}</b>
          </div>
          <div className="line">
            <span>Starting Price</span>
            <b>{money(p.price)}</b>
          </div>
          <Link
            className="red-button block"
            href={"/designs/" + d.id + "/customize?product=" + selected}
          >
            CONTINUE TO CUSTOMIZE <ArrowRight size={18} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
