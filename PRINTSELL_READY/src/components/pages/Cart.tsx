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
export function Cart({
  cart,
  update,
  remove,
}: {
  cart: CartItem[];
  update: (id: string, n: number) => void;
  remove: (id: string) => void;
}) {
  const subtotal = cart.reduce((s, x) => s + x.unitPrice * x.quantity, 0);
  const [code, setCode] = useState(""),
    [message, setMessage] = useState("");
  return (
    <div className="container page">
      <Crumb items={[{ name: "Shopping Cart" }]} />
      <h1>Shopping Cart</h1>
      <p className="muted">Review your items before checkout.</p>
      {cart.length === 0 ? (
        <div className="empty">
          <ShoppingCart size={56} />
          <h2>Your Cart Is Empty</h2>
          <p>Add some designs to your cart to get started.</p>
          <Link className="red-button" href="/dog-designs">
            EXPLORE DESIGNS <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section>
            <div className="cart-title">
              <h2>Your Items ({cart.reduce((s, x) => s + x.quantity, 0)})</h2>
              <Link href="/dog-designs">Continue Shopping</Link>
            </div>
            {cart.map((x) => (
              <article className="cart-item" key={x.cartId}>
                <div className="item-pic">
                  <Placeholder />
                </div>
                <div>
                  <Link className="item-name" href={"/designs/" + x.designId}>
                    {x.designName} — {x.productName}
                  </Link>
                  <p className="muted">
                    {x.color && (
                      <>
                        Color: {x.color}
                        <br />
                      </>
                    )}
                    Size: {x.size}
                    <br />
                    Placement: {x.placement}
                  </p>
                  <strong>{money(x.unitPrice)} each</strong>
                  <div className="cart-controls">
                    <div className="quantity">
                      <button onClick={() => update(x.cartId, -1)}>
                        <Minus size={16} />
                      </button>
                      <b>{x.quantity}</b>
                      <button onClick={() => update(x.cartId, 1)}>
                        <Plus size={16} />
                      </button>
                    </div>
                    <button
                      className="text-button danger"
                      onClick={() => remove(x.cartId)}
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  </div>
                </div>
                <b>{money(x.unitPrice * x.quantity)}</b>
              </article>
            ))}
            <Link className="back" href="/dog-designs">
              <ArrowLeft size={17} /> Continue Shopping
            </Link>
          </section>
          <aside className="panel sticky">
            <h2>Order Summary</h2>
            <div className="line">
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <div className="line">
              <span>Shipping</span>
              <span>Calculated later</span>
            </div>
            <div className="line">
              <span>Discount</span>
              <span>{money(0)}</span>
            </div>
            <div className="line total">
              <b>Current Subtotal</b>
              <b>{money(subtotal)}</b>
            </div>
            <small className="muted">
              Tax and shipping are not yet calculated.
            </small>
            <h3>Have a Discount Code?</h3>
            <div className="promo-input">
              <input
                placeholder="Promo code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                onClick={() =>
                  setMessage("Discount codes require backend integration.")
                }
              >
                APPLY
              </button>
            </div>
            {message && <p className="tiny">{message}</p>}
            <p className="shipping-note">
              <Truck size={18} />{" "}
              {subtotal >= 75
                ? "Eligible for free standard shipping (subject to checkout)"
                : "Spend " +
                  money(75 - subtotal) +
                  " more to reach $75 threshold."}
            </p>
            <Link className="red-button block" href="/checkout/shipping">
              PROCEED TO CHECKOUT <ArrowRight size={18} />
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
