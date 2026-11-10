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
export function Wishlist({
  wishlist,
  onWish,
}: {
  wishlist: number[];
  onWish: (id: number) => void;
}) {
  const ds = designs.filter((x) => wishlist.includes(x.id));
  return (
    <div className="container page">
      <h1>Your Wishlist</h1>
      <p className="muted">Your saved designs on this browser.</p>
      {ds.length ? (
        <div className="products four">
          {ds.map((d) => (
            <ProductCard key={d.id} d={d} onWish={onWish} wished={true} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Heart size={55} />
          <h2>No saved designs yet</h2>
          <Link className="red-button" href="/dog-designs">
            BROWSE DESIGNS
          </Link>
        </div>
      )}
    </div>
  );
}
