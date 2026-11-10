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
export function Tracking({ order }: { order: DemoOrder | null }) {
  const [reference, setReference] = useState(""),
    [visible, setVisible] = useState(false),
    [message, setMessage] = useState("");
  function track(e: React.FormEvent) {
    e.preventDefault();
    if (
      !order ||
      reference.trim().toUpperCase() !== order.demoId.toUpperCase()
    ) {
      setMessage("Demo reference not found in this browser.");
      setVisible(false);
      return;
    }
    setVisible(true);
    setMessage("");
  }
  return (
    <div className="container page">
      <Crumb items={[{ name: "Track Order" }]} />
      <div className="center-heading">
        <Package size={38} />
        <h1>Track Your Order</h1>
        <p className="muted">
          Enter your demo reference number to view your checkout preview.
        </p>
      </div>
      <form className="track-form panel" onSubmit={track}>
        <label>Demo Order Reference</label>
        <div className="track-row">
          <input
            required
            placeholder="DEMO-123456789"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <button className="red-button">
            <Search size={17} /> TRACK ORDER
          </button>
        </div>
        <p className="tiny">
          Only the demo order saved on this browser is available.
        </p>
        {order && (
          <button
            type="button"
            className="link-button"
            onClick={() => setReference(order.demoId)}
          >
            Use saved reference: {order.demoId}
          </button>
        )}
        {message && <p className="error">{message}</p>}
      </form>
      {visible && order && (
        <>
          <div className="notice">
            ⚠ DEMO TRACKING ONLY — no payment, production, shipment or delivery
            has occurred.
          </div>
          <div className="reference">
            <div>
              <small>Reference Number</small>
              <b>{order.demoId}</b>
            </div>
            <div>
              <small>Checkout Date</small>
              <b>{new Date(order.createdAt).toLocaleDateString()}</b>
            </div>
            <div>
              <small>Status</small>
              <b>DEMO ONLY — NOT PAID</b>
            </div>
          </div>
          <div className="panel">
            <h2>Order Progress</h2>
            <div className="timeline">
              {[
                "Checkout Preview",
                "Payment Verification",
                "Production",
                "Shipped",
                "Delivered",
              ].map((x, i) => (
                <div className="timeline-item" key={x}>
                  <span className={i === 0 ? "done" : ""}>
                    {i === 0 ? "✓" : "○"}
                  </span>
                  <div>
                    <b>{x}</b>
                    <p className="muted">
                      {i === 0
                        ? "Demo checkout saved"
                        : "Not started — backend integration pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="two-col gap-top">
            <div className="panel">
              <h2>Order Items</h2>
              {order.items.map((x) => (
                <div key={x.cartId} className="mini-item">
                  <div className="mini-pic">
                    <Shirt />
                  </div>
                  <div>
                    <b>
                      {x.designName} — {x.productName}
                    </b>
                    <small>
                      Qty {x.quantity} · Size {x.size}
                    </small>
                  </div>
                  <b>{money(x.quantity * x.unitPrice)}</b>
                </div>
              ))}
            </div>
            <div className="panel">
              <h2>Shipping Address</h2>
              <p>
                {order.shipping.firstName} {order.shipping.lastName}
                <br />
                {order.shipping.address}
                <br />
                {order.shipping.city}, {order.shipping.state}{" "}
                {order.shipping.zip}
              </p>
              <hr />
              <div className="line total">
                <b>Subtotal</b>
                <b>{money(order.subtotal)}</b>
              </div>
            </div>
          </div>
        </>
      )}
      <div className="center-actions">
        <Link className="outline-button" href="/">
          BACK TO HOME
        </Link>
        <Link className="red-button" href="/dog-designs">
          CONTINUE SHOPPING <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
