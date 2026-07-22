"use client";
import { useEffect, useRef } from "react";
import { useCart } from "react-use-cart";

export default function CartButton({ product, className = "" }) {
  const { addItem, items } = useCart();
  const buttonRef = useRef(null);
  const isAnimating = useRef(false);

  function AddProduct() {
    addItem(product);
    console.log("added product: ", product);
  }

  useEffect(() => {
    const productsInCart = items.map((item) => item);
    console.log(productsInCart);
  }, [items]);

  const handleClick = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    AddProduct();

    const button = buttonRef.current;
    const cartIcon = document.querySelector('img[alt="Cart"]');
    if (!button || !cartIcon) {
      isAnimating.current = false;
      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    const startX = buttonRect.left + buttonRect.width / 2;
    const startY = buttonRect.top + buttonRect.height / 2;
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;

    const duration = 750;
    const easing = "cubic-bezier(0.25, 0.1, 0.25, 1)";

    const createFlyer = (size, color, delay) => {
      const flyer = document.createElement("div");
      flyer.style.cssText = `
        position: fixed;
        left: ${startX}px;
        top: ${startY}px;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
        transition: left ${duration}ms ${easing}, top ${duration}ms ${easing}, transform ${duration}ms ${easing}, opacity ${duration}ms ${easing};
        box-shadow: 0 0 12px ${color};
      `;
      document.body.appendChild(flyer);

      setTimeout(() => {
        flyer.style.left = `${endX}px`;
        flyer.style.top = `${endY}px`;
        flyer.style.transform = "translate(-50%, -50%) scale(0.05)";
        flyer.style.opacity = "0";
      }, delay);

      setTimeout(() => {
        if (flyer.parentNode) flyer.remove();
      }, duration + delay + 50);
    };

    createFlyer(22, "#4ade80", 0);
    createFlyer(18, "#86efac", 60);
    createFlyer(14, "#bbf7d0", 120);

    cartIcon.style.transition = "transform 180ms ease-out";
    cartIcon.style.transform = "scale(1.5)";
    setTimeout(() => {
      cartIcon.style.transform = "scale(1)";
    }, 180);

    setTimeout(() => {
      isAnimating.current = false;
    }, duration + 200);
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`block w-full rounded-lg border border-slate-900 bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800 ${className}`}
      onClick={handleClick}
    >
      Legg i handlekurv
    </button>
  );
}