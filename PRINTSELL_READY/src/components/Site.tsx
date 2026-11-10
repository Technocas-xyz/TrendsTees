"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { designs, CART, ORDER, type CartItem, type DemoOrder } from "./data";

import { getStored, saved, Header, Bottom } from "./shared";
import { Home } from "./pages/Home";
import { Listing } from "./pages/Listing";
import { Detail } from "./pages/Detail";
import { Choose } from "./pages/Choose";
import { Customize } from "./pages/Customize";
import { Cart } from "./pages/Cart";
import { ShippingPage } from "./pages/ShippingPage";
import { PaymentPage } from "./pages/PaymentPage";
import { ConfirmationPage } from "./pages/ConfirmationPage";
import { Tracking } from "./pages/Tracking";
import { Wishlist } from "./pages/Wishlist";
import { Generic } from "./pages/Generic";
export default function Site({ path }: { path: string }) {
  const [cart, setCart] = useState<CartItem[]>([]),
    [wishlist, setWishlist] = useState<number[]>([]),
    [order, setOrder] = useState<DemoOrder | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setCart(getStored<CartItem[]>(CART, []));
    setWishlist(getStored<number[]>("printandsell-wishlist", []));
    setOrder(getStored<DemoOrder | null>(ORDER, null));
    setLoaded(true);
  }, [path]);
  function add(x: CartItem) {
    const next = [...cart, x];
    if (!saved(CART, next)) return false;
    setCart(next);
    return true;
  }
  function update(id: string, step: number) {
    const next = cart.map((x) =>
      x.cartId === id
        ? { ...x, quantity: Math.min(999, Math.max(1, x.quantity + step)) }
        : x,
    );
    setCart(next);
    saved(CART, next);
  }
  function remove(id: string) {
    const next = cart.filter((x) => x.cartId !== id);
    setCart(next);
    saved(CART, next);
  }
  function onWish(id: number) {
    setWishlist((v) => {
      const n = v.includes(id) ? v.filter((x) => x !== id) : [...v, id];
      saved("printandsell-wishlist", n);
      return n;
    });
  }
  const parts = path.split("/").filter(Boolean),
    designId = Number(parts[1]),
    d = designs.find((x) => x.id === designId) || designs[0];
  const [search] = useState(
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("search") || "",
  );
  const [productParam] = useState(
    typeof window === "undefined"
      ? "tshirts"
      : new URLSearchParams(window.location.search).get("product") || "tshirts",
  );
  let page: React.ReactNode;
  if (path === "/") page = <Home onWish={onWish} wishlist={wishlist} />;
  else if (
    path === "/animals-pets" ||
    path === "/dog-designs" ||
    path === "/designs"
  )
    page = (
      <Listing
        dogs={path === "/dog-designs"}
        search={search}
        onWish={onWish}
        wishlist={wishlist}
      />
    );
  else if (parts[0] === "designs" && parts[1] && parts.length === 2)
    page = <Detail d={d} onWish={onWish} wished={wishlist.includes(d.id)} />;
  else if (parts[0] === "designs" && parts[2] === "choose-product")
    page = <Choose d={d} />;
  else if (parts[0] === "designs" && parts[2] === "customize")
    page = (
      <Customize
        d={d}
        productId={loaded ? productParam : "tshirts"}
        add={add}
      />
    );
  else if (path === "/cart")
    page = <Cart cart={cart} update={update} remove={remove} />;
  else if (path === "/checkout/shipping") page = <ShippingPage cart={cart} />;
  else if (path === "/checkout/payment") page = <PaymentPage cart={cart} />;
  else if (path === "/checkout/confirmation")
    page = <ConfirmationPage order={order} />;
  else if (path === "/track-order") page = <Tracking order={order} />;
  else if (path === "/wishlist")
    page = <Wishlist wishlist={wishlist} onWish={onWish} />;
  else if (path === "/account" || path === "/bundle-deals")
    page = <Generic kind={parts[0]} />;
  else
    page = (
      <div className="container page empty">
        <h1>Page Not Found</h1>
        <Link href="/" className="red-button">
          GO HOME
        </Link>
      </div>
    );
  return (
    <>
      <Header count={cart.reduce((s, x) => s + x.quantity, 0)} />
      {page}
      <Bottom />
    </>
  );
}
