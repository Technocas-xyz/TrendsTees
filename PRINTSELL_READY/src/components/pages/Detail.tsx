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
export function Detail({
  d,
  onWish,
  wished,
}: {
  d: Design;
  onWish: (id: number) => void;
  wished: boolean;
}) {
  const [preview, setPreview] = useState(0);
  const views = ["T-Shirt", "Hoodie", "Mug", "Sweatshirt"];
  return (
    <div className="container page">
      <Crumb
        items={[
          { name: "Animals & Pets", href: "/animals-pets" },
          { name: "Dogs", href: "/dog-designs" },
          { name: d.name },
        ]}
      />
      <div className="detail-layout">
        <div>
          <div className="detail-main">
            <Placeholder label={d.name + " — " + views[preview]} tall />
            <button className="heart" onClick={() => onWish(d.id)}>
              <Heart fill={wished ? "#df1431" : "none"} />
            </button>
          </div>
          <div className="thumbnails">
            <button onClick={() => setPreview((preview + 3) % 4)}>
              <ChevronLeft />
            </button>
            {views.map((v, i) => (
              <button
                className={preview === i ? "active" : ""}
                onClick={() => setPreview(i)}
                key={v}
              >
                <Shirt />
                <small>{v}</small>
              </button>
            ))}
            <button onClick={() => setPreview((preview + 1) % 4)}>
              <ChevronRight />
            </button>
          </div>
        </div>
        <div className="detail-info">
          <h1>{d.name}</h1>
          <div className="rating">
            <Star fill="#f5a31f" color="#f5a31f" />
            {d.rating} ({d.reviews} reviews)
          </div>
          <p>
            Perfect for dog lovers. Customize this design on your favorite
            products.
          </p>
          <ul>
            <li>✓ High quality print-ready artwork</li>
            <li>✓ Soft and comfortable fabric</li>
            <li>✓ Made to order just for you</li>
            <li>✓ Available on multiple products</li>
          </ul>
          <p className="from">
            From <b>{money(d.price)}</b>
          </p>
          <Link
            className="red-button block"
            href={"/designs/" + d.id + "/choose-product"}
          >
            CHOOSE PRODUCT <ArrowRight size={18} />
          </Link>
          <button className="outline-button block" onClick={() => onWish(d.id)}>
            <Heart fill={wished ? "#df1431" : "none"} />
            {wished ? "ADDED TO WISHLIST" : "ADD TO WISHLIST"}
          </button>
        </div>
      </div>
      <div className="why">
        <h2>Why You'll Love It</h2>
        <div>
          <span>✦ Vibrant Colors</span>
          <span>◷ Long Lasting</span>
          <span>♢ Soft &amp; Durable</span>
          <span>♡ Made to Order</span>
        </div>
      </div>
      <div className="section-heading">
        <h2>PEOPLE ALSO BOUGHT</h2>
      </div>
      <div className="products four">
        {designs
          .filter((x) => x.id !== d.id)
          .slice(0, 4)
          .map((x) => (
            <ProductCard key={x.id} d={x} onWish={onWish} wished={false} />
          ))}
      </div>
    </div>
  );
}
