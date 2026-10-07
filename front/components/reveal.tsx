"use client";

import { useEffect, useRef, useState } from "react";

type Variant = "up" | "blur" | "scale" | "left" | "right";

/** `true` dès que l'élément a été vu une fois. On n'observe plus après. */
export function useInView<T extends HTMLElement>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Vieux navigateurs (Safari < 12.1) : pas d'observateur, on montre tout. */
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return [ref, seen] as const;
}

/** L'utilisateur a demandé moins d'animation au niveau système. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    /* Safari < 14 ne connaît que `addListener` sur une MediaQueryList :
       appeler `addEventListener` y lève une exception qui fait tomber tout le site. */
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", on);
      return () => mq.removeEventListener("change", on);
    }
    mq.addListener(on);
    return () => mq.removeListener(on);
  }, []);
  return reduced;
}

/**
 * Révèle son contenu quand il entre dans le viewport.
 * `stagger` fait entrer les enfants directs les uns après les autres.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  variant = "up",
  stagger,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  variant?: Variant;
  stagger?: number;
}) {
  const [ref, seen] = useInView<HTMLDivElement>();

  const anim = stagger ? "stagger" : `reveal-${variant}`;

  return (
    <div
      ref={ref}
      className={`${seen ? anim : "reveal"} ${className}`}
      style={
        {
          animationDelay: `${delay}ms`,
          ...(stagger ? { "--step": `${stagger}ms` } : null),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
