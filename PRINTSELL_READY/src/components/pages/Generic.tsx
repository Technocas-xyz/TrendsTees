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
export function Generic({ kind }: { kind: string }) {
  return (
    <div className="container page">
      <h1>{kind === "account" ? "Customer Account" : "Bundle Deals"}</h1>
      <p className="muted">
        {kind === "account"
          ? "Account sign-in and registration will connect to the FastAPI backend later."
          : "Bundle pricing will become available when real product pricing is connected."}
      </p>
      <div className="empty">
        <Package size={54} />
        <h2>Coming Soon</h2>
        <Link className="red-button" href="/designs">
          BROWSE DESIGNS <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
