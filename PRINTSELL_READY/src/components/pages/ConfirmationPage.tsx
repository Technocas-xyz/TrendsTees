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
export function ConfirmationPage({ order }: { order: DemoOrder | null }) {
  if (!order)
    return (
      <div className="container page">
        <div className="empty">
          <Package size={60} />
          <h1>No Demo Order Found</h1>
          <p>Complete the demo checkout to view confirmation.</p>
          <Link className="red-button" href="/cart">
            RETURN TO CART <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  return (
    <div className="container page">
      <Steps active={3} />
      <div className="confirm-head">
        <Check size={55} />
        <h1>Demo Order Confirmed!</h1>
        <p>
          Your checkout preview has been completed. No real order has been
          placed or paid for.
        </p>
        <div className="notice">
          ⚠ Demo only — not a receipt or payment confirmation.
        </div>
      </div>
      <div className="reference">
        <div>
          <small>Demo Reference Number</small>
          <b>{order.demoId}</b>
        </div>
        <div>
          <small>Checkout Date</small>
          <b>{new Date(order.createdAt).toLocaleDateString()}</b>
        </div>
        <div>
          <small>Payment Status</small>
          <b>NOT PAID</b>
        </div>
      </div>
      <div className="two-col">
        <section className="stack">
          <div className="panel">
            <h2>
              <Package /> Order Items
            </h2>
            {order.items.map((x) => (
              <div className="mini-item" key={x.cartId}>
                <div className="mini-pic">
                  <Shirt />
                </div>
                <div>
                  <b>
                    {x.designName} — {x.productName}
                  </b>
                  <small>
                    {x.color || "Transfer"} / {x.size} / {x.placement} · Qty{" "}
                    {x.quantity}
                  </small>
                </div>
                <b>{money(x.quantity * x.unitPrice)}</b>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>
              <MapPin /> Shipping Information
            </h2>
            <p>
              {order.shipping.firstName} {order.shipping.lastName}
              <br />
              {order.shipping.address}
              <br />
              {order.shipping.city}, {order.shipping.state} {order.shipping.zip}
              <br />
              {order.shipping.email}
            </p>
          </div>
          <div className="panel">
            <h2>
              <CreditCard /> Payment Information
            </h2>
            <p>
              {order.paymentMethod === "paypal"
                ? "PayPal"
                : "Credit / Debit Card"}{" "}
              (Demo)
              <br />
              <b>Not paid</b>
            </p>
          </div>
        </section>
        <aside className="stack">
          <ItemSummary items={order.items} />
          <div className="panel">
            <h2>What Happens Next?</h2>
            <p>
              ✓ Demo checkout saved locally.
              <br />◷ Backend order submission will be connected later.
              <br />
              🚚 Real shipment tracking is not active.
            </p>
          </div>
        </aside>
      </div>
      <div className="center-actions">
        <Link className="red-button" href="/track-order">
          TRACK DEMO ORDER <ArrowRight size={18} />
        </Link>
        <Link className="outline-button" href="/dog-designs">
          CONTINUE SHOPPING
        </Link>
        <Link className="outline-button" href="/">
          BACK TO HOME
        </Link>
      </div>
    </div>
  );
}
