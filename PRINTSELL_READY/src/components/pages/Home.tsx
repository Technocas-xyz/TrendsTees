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
export function Home({
  onWish,
  wishlist,
}: {
  onWish: (id: number) => void;
  wishlist: number[];
}) {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">CUSTOM PRINTED. MADE FOR YOU.</span>
          <h1>
            FIND DESIGNS
            <br />
            YOU'LL <em>LOVE.</em>
          </h1>
          <p>
            Discover thousands of original designs on premium products. Find the
            perfect style for every occasion.
          </p>
          <div className="hero-points">
            <span>
              <Star /> Top Quality
            </span>
            <span>
              <Shirt /> Made to Order
            </span>
            <span>
              <ShieldCheck /> Secure Checkout
            </span>
            <span>
              <Truck /> Fast Delivery
            </span>
          </div>
          <div className="hero-buttons">
            <Link className="red-button" href="/designs">
              EXPLORE DESIGNS <ArrowRight size={18} />
            </Link>
            <Link className="outline-button" href="/bundle-deals">
              <Tag size={18} /> SHOP BUNDLE DEALS
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-circle" />
          <div className="hero-placeholder">
            <Shirt size={110} strokeWidth={1} />
            <strong>Product mockups coming soon</strong>
          </div>
        </div>
      </section>
      <section className="metrics">
        <div>
          <Star />{" "}
          <p>
            <b>100,000+</b>
            <small>Happy Customers</small>
          </p>
        </div>
        <div>
          <ShieldCheck />
          <p>
            <b>Trusted by Thousands</b>
            <small>All over the USA</small>
          </p>
        </div>
        <div>
          <Star />
          <p>
            <b>4.8/5</b>
            <small>Customer Rating</small>
          </p>
        </div>
      </section>
      <div className="container">
        <div className="section-heading">
          <div>
            <h2>BROWSE BY INTEREST</h2>
            <p>Choose what you like and explore amazing designs.</p>
          </div>
          <Link className="light-button" href="/animals-pets">
            VIEW ALL
          </Link>
        </div>
        <div className="interests">
          {interests.map((x, i) => (
            <Link
              href={i === 0 ? "/animals-pets" : "/designs"}
              className="interest"
              key={x}
            >
              <span>{x}</span>
            </Link>
          ))}
        </div>
        <div className="section-heading gap-top">
          <div>
            <h2>TRENDING DESIGNS</h2>
            <p>Handpicked popular designs customers love right now.</p>
          </div>
          <Link className="light-button" href="/designs">
            VIEW ALL DESIGNS
          </Link>
        </div>
        <div className="products six">
          {designs.slice(0, 6).map((d) => (
            <ProductCard
              key={d.id}
              d={d}
              onWish={onWish}
              wished={wishlist.includes(d.id)}
            />
          ))}
        </div>
        <div className="promos">
          <Link href="/bundle-deals">
            <Gift />
            <b>Bundle Deals</b>
            <span>More designs. Better value.</span>
          </Link>
          <Link href="/designs">
            <Package />
            <b>Bulk Discounts</b>
            <span>Great for teams and groups.</span>
          </Link>
          <Link href="/cart">
            <ShieldCheck />
            <b>Secure Shopping</b>
            <span>Easy, convenient checkout.</span>
          </Link>
        </div>
        <div className="section-heading">
          <div>
            <h2>SHOP BY PRODUCT</h2>
            <p>Choose the product that suits your style.</p>
          </div>
        </div>
        <div className="shop-products">
          {types.map((t) => (
            <Link href={"/designs/1/choose-product"} key={t.id}>
              <span>
                <Shirt size={38} />
              </span>
              <b>{t.name}</b>
            </Link>
          ))}
        </div>
        <section id="how-it-works" className="how">
          <h2>HOW IT WORKS</h2>
          <div>
            <article>
              <Search />
              <b>1. Find a Design</b>
              <p>Browse your favorite designs.</p>
            </article>
            <article>
              <Shirt />
              <b>2. Choose a Product</b>
              <p>Select your favorite style.</p>
            </article>
            <article>
              <Check />
              <b>3. Customize</b>
              <p>Pick color, size and quantity.</p>
            </article>
            <article>
              <Truck />
              <b>4. Checkout</b>
              <p>Review your demo order.</p>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}
