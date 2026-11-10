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
export function ShippingPage({ cart }: { cart: CartItem[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Shipping>(blankShipping),
    [error, setError] = useState("");
  useEffect(() => {
    setForm({
      ...blankShipping,
      ...getStored<Partial<Shipping>>(SHIPPING, {}),
    });
  }, []);
  const update = (k: keyof Shipping, v: string) => {
    setForm((x) => ({ ...x, [k]: v }));
    setError("");
  };
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) {
      setError("Your cart is empty. Add a product first.");
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(form.zip)) {
      setError("Please enter a valid US ZIP code.");
      return;
    }
    if (!saved(SHIPPING, form)) {
      setError("Could not save demo shipping information.");
      return;
    }
    router.push("/checkout/payment");
  }
  const fields: [keyof Shipping, string, string, boolean][] = [
    ["firstName", "First Name", "given-name", true],
    ["lastName", "Last Name", "family-name", true],
    ["email", "Email Address", "email", true],
    ["phone", "Phone Number", "tel", true],
    ["address", "Street Address", "address-line1", true],
    ["apartment", "Apartment, Suite, etc.", "address-line2", false],
    ["city", "City", "address-level2", true],
    ["state", "State", "address-level1", true],
    ["zip", "ZIP Code", "postal-code", true],
  ];
  return (
    <div className="container page">
      <Steps active={1} />
      <h1>Checkout — Shipping</h1>
      <p className="muted">Enter demo shipping information to continue.</p>
      <div className="two-col">
        <form onSubmit={submit} className="stack">
          <div className="panel">
            <h2>
              <MapPin size={21} /> Shipping Information
            </h2>
            <div className="form-grid">
              {fields.map(([key, label, auto, required]) => (
                <label
                  key={key}
                  className={
                    key === "address" || key === "apartment" ? "wide" : ""
                  }
                >
                  {label}
                  {required ? " *" : ""}
                  <input
                    required={required}
                    type={
                      key === "email"
                        ? "email"
                        : key === "phone"
                          ? "tel"
                          : "text"
                    }
                    autoComplete={auto}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                    placeholder={label}
                  />
                </label>
              ))}
              <label>
                Country
                <input value="United States" readOnly />
              </label>
            </div>
          </div>
          <div className="panel">
            <h2>
              <Truck size={21} /> Shipping Method
            </h2>
            <div className="radio-row">
              <input type="radio" checked readOnly />
              <span>
                <b>Standard Shipping</b>
                <small>Rate and ETA pending carrier integration</small>
              </span>
              <b>Pending</b>
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="form-actions">
            <Link className="back" href="/cart">
              <ArrowLeft size={16} /> Return to Cart
            </Link>
            <button className="red-button" type="submit">
              CONTINUE TO PAYMENT <ArrowRight size={18} />
            </button>
          </div>
        </form>
        <ItemSummary items={cart} />
      </div>
    </div>
  );
}
