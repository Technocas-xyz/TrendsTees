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
export function PaymentPage({ cart }: { cart: CartItem[] }) {
  const router = useRouter();
  const [ship, setShip] = useState<Shipping | null>(null),
    [method, setMethod] = useState("card"),
    [same, setSame] = useState(true),
    [error, setError] = useState("");
  useEffect(() => setShip(getStored<Shipping | null>(SHIPPING, null)), []);
  const subtotal = cart.reduce((s, x) => s + x.unitPrice * x.quantity, 0);
  function confirm() {
    if (!ship || !cart.length || !same) {
      setError(
        "A saved shipping address, cart items and same billing address are required.",
      );
      return;
    }
    const order: DemoOrder = {
      demoId: "DEMO-" + Date.now(),
      createdAt: new Date().toISOString(),
      paymentMethod: method,
      paymentStatus: "NOT_PAID",
      items: cart.map((x) => ({ ...x })),
      shipping: { ...ship },
      subtotal,
    };
    if (!saved(ORDER, order)) {
      setError("Browser storage is unavailable.");
      return;
    }
    router.push("/checkout/confirmation");
  }
  return (
    <div className="container page">
      <Steps active={2} />
      <h1>Payment</h1>
      <p className="muted">
        Review your order and select a demo payment option.
      </p>
      <div className="notice">
        ⚠ Demo checkout only. No real payment will be charged and no real order
        will be placed.
      </div>
      <div className="two-col">
        <div className="stack">
          <section className="panel">
            <h2>
              <MapPin /> Shipping Address{" "}
              <Link className="edit" href="/checkout/shipping">
                Edit
              </Link>
            </h2>
            {ship ? (
              <p>
                {ship.firstName} {ship.lastName}
                <br />
                {ship.address} {ship.apartment}
                <br />
                {ship.city}, {ship.state} {ship.zip}
                <br />
                {ship.email}
              </p>
            ) : (
              <p>
                No shipping details saved.{" "}
                <Link href="/checkout/shipping">Enter address</Link>
              </p>
            )}
          </section>
          <section className="panel">
            <h2>
              <CreditCard /> Payment Method
            </h2>
            {[
              ["card", "Credit / Debit Card"],
              ["paypal", "PayPal"],
            ].map(([id, name]) => (
              <label className="radio-row" key={id}>
                <input
                  type="radio"
                  checked={id === method}
                  onChange={() => setMethod(id)}
                />
                <CreditCard />
                <b>{name} (Demo)</b>
              </label>
            ))}
            <div className="payment-placeholder">
              <ShieldCheck size={35} />
              <b>Secure payment integration coming soon</b>
              <p>
                Real card details will be collected through a payment provider,
                not this demo site.
              </p>
            </div>
          </section>
          <section className="panel">
            <h2>Billing Address</h2>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={same}
                onChange={(e) => setSame(e.target.checked)}
              />{" "}
              Same as shipping address
            </label>
            {!same && (
              <p className="tiny">
                Separate billing addresses will be supported when real checkout
                is connected.
              </p>
            )}
          </section>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <Link href="/checkout/shipping" className="back">
              <ArrowLeft size={16} /> Back to Shipping
            </Link>
            <button
              className="red-button"
              disabled={!ship || !cart.length || !same}
              onClick={confirm}
            >
              CONTINUE TO DEMO CONFIRMATION <ArrowRight size={18} />
            </button>
          </div>
        </div>
        <ItemSummary items={cart} />
      </div>
    </div>
  );
}
