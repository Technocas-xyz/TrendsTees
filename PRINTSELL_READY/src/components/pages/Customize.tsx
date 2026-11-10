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
export function Customize({
  d,
  productId,
  add,
}: {
  d: Design;
  productId: string;
  add: (item: CartItem) => boolean;
}) {
  const p = types.find((x) => x.id === productId) || types[0];
  const isDtf = p.id === "dtf";
  const cap = p.id === "caps";
  const [color, setColor] = useState("Black"),
    [size, setSize] = useState("M"),
    [qty, setQty] = useState(1),
    [placement, setPlacement] = useState("Front"),
    [success, setSuccess] = useState(false);
  const router = useRouter();
  const actualSize = isDtf ? size + " in" : cap ? "One Size" : size;
  return (
    <div className="container page">
      <Crumb
        items={[
          { name: "Dog Designs", href: "/dog-designs" },
          { name: d.name, href: "/designs/" + d.id },
          { name: "Customize Product" },
        ]}
      />
      <Link className="back" href={"/designs/" + d.id + "/choose-product"}>
        <ArrowLeft size={17} /> Back to Products
      </Link>
      <h1>Customize Your Product</h1>
      <p className="muted">
        Make it yours! Select your options before adding to cart.
      </p>
      <div className="two-col">
        <section className="stack">
          <div className="panel">
            <h2>Product Details</h2>
            <div className="summary-product">
              <div>
                <Shirt size={42} />
              </div>
              <p>
                <b>
                  {d.name} — {p.name}
                </b>
                <small>Custom printed product</small>
                <strong>{money(p.price)}</strong>
              </p>
            </div>
          </div>
          {!isDtf && (
            <div className="panel">
              <h2>Choose Color</h2>
              <p>
                Selected: <b>{color}</b>
              </p>
              <div className="color-row large">
                {optionsColors.map((c) => (
                  <button
                    title={c.name}
                    aria-label={c.name}
                    key={c.name}
                    className={c.name === color ? "on" : ""}
                    style={{ background: c.hex }}
                    onClick={() => {
                      setColor(c.name);
                      setSuccess(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {!cap && (
            <div className="panel">
              <h2>{isDtf ? "Choose Transfer Size" : "Choose Size"}</h2>
              <div className="size-row">
                {(isDtf
                  ? ["4 x 4", "8 x 8", "10 x 10", "12 x 12"]
                  : ["S", "M", "L", "XL", "2XL", "3XL"]
                ).map((x) => (
                  <button
                    key={x}
                    className={size === x ? "active" : ""}
                    onClick={() => {
                      setSize(x);
                      setSuccess(false);
                    }}
                  >
                    {x}
                    {isDtf ? " in" : ""}
                  </button>
                ))}
              </div>
              <small className="muted">
                Sample sizes and pricing; actual availability will be connected
                later.
              </small>
            </div>
          )}
          {!isDtf && (
            <div className="panel">
              <h2>Print Placement</h2>
              <div className="size-row">
                {["Front", "Back"].map((x) => (
                  <button
                    key={x}
                    className={x === placement ? "active" : ""}
                    onClick={() => {
                      setPlacement(x);
                      setSuccess(false);
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="panel">
            <h2>Quantity</h2>
            <div className="quantity">
              <button
                onClick={() => {
                  setQty(Math.max(1, qty - 1));
                  setSuccess(false);
                }}
              >
                <Minus size={16} />
              </button>
              <b>{qty}</b>
              <button
                onClick={() => {
                  setQty(Math.min(999, qty + 1));
                  setSuccess(false);
                }}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </section>
        <aside className="panel sticky">
          <h2>Product Preview</h2>
          <Placeholder tall label={d.name + " — " + p.name} />
          <div className="line">
            <span>Color</span>
            <b>{isDtf ? "N/A" : color}</b>
          </div>
          <div className="line">
            <span>Size</span>
            <b>{actualSize}</b>
          </div>
          <div className="line">
            <span>Placement</span>
            <b>{isDtf ? "Transfer" : placement}</b>
          </div>
          <div className="line">
            <span>Quantity</span>
            <b>{qty}</b>
          </div>
          <div className="line total">
            <b>Estimated Total</b>
            <b>{money(p.price * qty)}</b>
          </div>
          <button
            className="red-button block"
            onClick={() => {
              const ok = add({
                cartId: Date.now() + "-" + Math.random().toString(36).slice(2),
                designId: d.id,
                designName: d.name,
                productId: p.id,
                productName: p.name,
                color: isDtf ? null : color,
                size: actualSize,
                placement: isDtf ? "Transfer" : placement,
                quantity: qty,
                unitPrice: p.price,
              });
              setSuccess(ok);
            }}
          >
            <ShoppingCart size={18} /> ADD TO CART
          </button>
          {success && (
            <>
              <p className="success">✓ Product saved to your browser cart.</p>
              <button
                onClick={() => router.push("/cart")}
                className="outline-button block"
              >
                VIEW CART <ArrowRight size={18} />
              </button>
            </>
          )}
          <p className="tiny">
            Prototype pricing only. No real checkout or payment yet.
          </p>
        </aside>
      </div>
    </div>
  );
}
