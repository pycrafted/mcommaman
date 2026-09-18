"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "./reveal";
import { IconHeartFull } from "./icons";

/* ------------------------------------------------------------------ CountUp */

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Évite l'avertissement de `useLayoutEffect` au rendu serveur. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Compte de 0 jusqu'à `to` quand le nombre entre à l'écran.
 * `prefix` / `suffix` restent fixes : « 24 h », « 0 F ».
 */
export function CountUp({
  to,
  duration = 1400,
  prefix = "",
  suffix = "",
  className = "",
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [ref, seen] = useInView<HTMLSpanElement>("0px 0px -8% 0px");
  const reduced = useReducedMotion();

  /* Le rendu serveur affiche la valeur finale : sans JavaScript, le chiffre
     reste juste. Le client la remet à zéro avant la première peinture. */
  const [value, setValue] = useState(to);
  useIsoLayoutEffect(() => setValue(0), []);

  useEffect(() => {
    if (!seen) return;
    if (reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(easeOut(p) * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, reduced, to, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

/* ----------------------------------------------------------------- SplitText */

/**
 * Découpe le texte en mots et les fait monter derrière un masque, l'un après
 * l'autre. `\n` force un retour à la ligne.
 */
export function SplitText({
  text,
  delay = 0,
  step = 65,
  className = "",
}: {
  text: string;
  delay?: number;
  step?: number;
  className?: string;
}) {
  const words = text.split(" ");
  let i = -1;

  return (
    <span className={className}>
      {words.map((w, k) => {
        if (w === "\n") return <br key={`br-${k}`} />;
        i += 1;
        const rank = i;
        const spaced = k < words.length - 1 && words[k + 1] !== "\n";
        return (
          <Fragment key={`${w}-${k}`}>
            <span className="word-mask">
              <span style={{ animationDelay: `${delay + rank * step}ms` }}>{w}</span>
            </span>
            {spaced ? " " : null}
          </Fragment>
        );
      })}
    </span>
  );
}

/* ----------------------------------------------------------------- Parallax */

/**
 * Translate son contenu selon la position de l'élément dans le viewport.
 * `speed` positif = l'élément traîne derrière le défilement.
 * Coupé sous 768 px et quand le mouvement réduit est demandé.
 */
export function Parallax({
  children,
  speed = 40,
  className = "",
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || window.innerWidth < 768) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const center = r.top + r.height / 2 - window.innerHeight / 2;
      const shift = (center / window.innerHeight) * speed;
      el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed, reduced]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- ParallaxFond */

/**
 * Fond à défilement différé, pour une bande pleine largeur.
 *
 * `Parallax` déplace l'élément lui-même : posé sur une photo de fond, il
 * découvrirait le vide sur un bord. Ici le cadre découpe et c'est un calque
 * intérieur qui bouge, débordant de `marge` en haut et en bas — il a donc
 * toujours de la matière à faire glisser.
 *
 * `vitesse` est la fraction du déplacement rattrapée. Négative, le calque part
 * dans l'autre sens : deux fonds superposés de vitesses opposées, et la bande
 * prend de la profondeur au lieu de glisser d'un bloc.
 *
 * `zoom` ajoute une mise au point : le contenu entre légèrement agrandi et se
 * pose à l'échelle 1 quand la bande atteint le centre de l'écran.
 */
export function ParallaxFond({
  children,
  vitesse = 0.35,
  zoom = 0,
  marge = 0.15,
  className = "",
}: {
  children: React.ReactNode;
  vitesse?: number;
  zoom?: number;
  marge?: number;
  className?: string;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const calque = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const boite = cadre.current;
    const mobile = calque.current;
    if (!boite || !mobile || reduced) return;

    let raf = 0;
    let visible = true;

    const placer = () => {
      raf = 0;
      const r = boite.getBoundingClientRect();
      const centre = r.top + r.height / 2 - window.innerHeight / 2;
      /* Borné au débord disponible : sur un grand écran, le décalage calculé
         dépasserait la marge et découvrirait un bord vide. */
      const limite = r.height * marge;
      const y = Math.max(-limite, Math.min(limite, -centre * vitesse));
      const loin = Math.min(1, Math.abs(centre) / (window.innerHeight / 2 + r.height / 2));
      mobile.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${(1 + zoom * loin).toFixed(4)})`;
    };

    const onScroll = () => {
      if (!visible || raf) return;
      raf = requestAnimationFrame(placer);
    };

    /* Hors champ, on cesse de calculer. Sans observateur (vieux navigateurs),
       on calcule tout le temps. */
    if (typeof IntersectionObserver === "undefined") {
      visible = true;
      placer();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (raf) cancelAnimationFrame(raf);
      };
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) onScroll();
      },
      { rootMargin: "150px" }
    );
    io.observe(boite);

    placer();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [vitesse, zoom, marge, reduced]);

  return (
    <div ref={cadre} className={className}>
      {/* Débord vertical : le calque glisse sans jamais laisser voir de vide. */}
      <div
        ref={calque}
        className="absolute inset-x-0 will-change-transform"
        style={{ top: `${-marge * 100}%`, bottom: `${-marge * 100}%` }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Marquee */

/** Bandeau défilant en boucle. Le contenu est doublé, la piste translate de 50 %. */
export function Marquee({
  items,
  duration = 34,
  className = "",
}: {
  items: React.ReactNode[];
  duration?: number;
  className?: string;
}) {
  return (
    <div className={`marquee-hold overflow-hidden ${className}`}>
      <div className="marquee" style={{ "--dur": `${duration}s` } as React.CSSProperties}>
        {[0, 1].map((pass) => (
          <div key={pass} className="flex shrink-0" aria-hidden={pass === 1}>
            {items.map((item, i) => (
              <span key={i} className="flex items-center gap-3 whitespace-nowrap px-6">
                {item}
                <IconHeartFull className="h-2.5 w-2.5 shrink-0 text-rose/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Spotlight */

/**
 * Pose `--mx` / `--my` sur l'élément survolé : la classe `.spot` s'en sert pour
 * placer sa lueur, `.tilt` pour l'inclinaison. Un seul écouteur, en rAF.
 */
export function useSpotlight<T extends HTMLElement>(tilt = 0) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last: { x: number; y: number } | null = null;

    const apply = () => {
      raf = 0;
      if (!last) return;
      const r = el.getBoundingClientRect();
      const px = (last.x - r.left) / r.width;
      const py = (last.y - r.top) / r.height;
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      if (tilt) {
        el.style.setProperty("--ry", `${((px - 0.5) * tilt).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${((0.5 - py) * tilt).toFixed(2)}deg`);
      }
    };

    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tilt]);

  return ref;
}

/** Carte qui s'incline légèrement et s'éclaire sous le curseur. */
export function GlowCard({
  children,
  className = "",
  tilt = 0,
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: number;
}) {
  const ref = useSpotlight<HTMLDivElement>(tilt);
  return (
    <div ref={ref} className={`spot ${tilt ? "tilt" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Magnetic */

/** Le bouton se déplace un peu vers le curseur, puis revient. */
export function Magnetic({
  children,
  strength = 10,
  className = "",
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.style.transform = `translate3d(${(dx * strength).toFixed(1)}px, ${(dy * strength * 0.6).toFixed(1)}px, 0)`;
    };
    const onLeave = () => {
      el.style.transform = "translate3d(0,0,0)";
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);

  return (
    <span
      ref={ref}
      className={`inline-block transition-transform duration-400 ease-soft ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Carousel */

/**
 * Rail horizontal qui défile tout seul, en boucle sans couture.
 *
 * La piste est doublée côté client uniquement : le HTML servi ne contient
 * qu'un exemplaire de chaque pièce. Quand le défilement a parcouru la première
 * piste, on retranche sa largeur — le saut tombe sur une image identique, il
 * est invisible.
 *
 * Le défilement s'arrête dès que quelqu'un s'en occupe : survol, traînée,
 * molette, doigt, focus clavier, onglet en arrière-plan. Et il ne
 * démarre pas du tout si le mouvement réduit est demandé, ou si les pièces
 * tiennent déjà dans la largeur.
 */
export function Carousel({
  children,
  label,
  className = "",
  speed = 46,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
  /** Vitesse de croisière, en pixels par seconde. */
  speed?: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLDivElement>(null);
  const [loop, setLoop] = useState(false);

  /* Position tenue en flottant : `scrollLeft` seul perdrait les sous-pixels
     d'une image à l'autre et le défilement avancerait par à-coups. */
  const posRef = useRef(0);
  const hoverRef = useRef(false);
  const holdUntilRef = useRef(0);
  const loopWidthRef = useRef(0);

  const hold = (ms = 2600) => {
    holdUntilRef.current = performance.now() + ms;
  };

  const measure = () => {
    const el = railRef.current;
    const pass = passRef.current;
    if (!el || !pass) return;

    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    const width = pass.offsetWidth + gap;
    loopWidthRef.current = width;

    /* Une piste plus étroite que le rail ne peut pas boucler sans laisser un
       trou : on reste alors sur un rail simple, sans défilement automatique. */
    setLoop(width > el.clientWidth + 40);
  };

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    measure();
    /* Safari < 13.1 n'a pas `ResizeObserver` : on se rabat sur le redimensionnement. */
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (passRef.current) ro.observe(passRef.current);
    return () => ro.disconnect();
  }, [children]);

  /* Moteur du défilement automatique. */
  useEffect(() => {
    const el = railRef.current;
    if (!el || !loop) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    posRef.current = el.scrollLeft;

    const frame = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;

      const paused = hoverRef.current || now < holdUntilRef.current || document.hidden;
      if (paused) {
        /* L'utilisateur mène : on suit sa position au lieu de la nôtre. */
        posRef.current = el.scrollLeft;
      } else {
        const width = loopWidthRef.current;
        posRef.current += (speed * dt) / 1000;
        if (width > 0 && posRef.current >= width) posRef.current -= width;
        el.scrollLeft = posRef.current;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [loop, speed]);

  /* Interactions : traînée à la souris, et mise en pause de tout le reste. */
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    let down: { x: number; scroll: number } | null = null;
    let moved = false;

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hoverRef.current = true;
    };
    const onLeave = () => {
      hoverRef.current = false;
    };

    const onDown = (e: PointerEvent) => {
      hold();
      if (e.pointerType !== "mouse") return;
      down = { x: e.clientX, scroll: el.scrollLeft };
      moved = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        el.classList.add("dragging");
        el.setPointerCapture(e.pointerId);
      }
      if (moved) el.scrollLeft = down.scroll - dx;
    };
    const onUp = (e: PointerEvent) => {
      if (moved) {
        el.classList.remove("dragging");
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        /* Le clic de fin de traînée ne doit pas suivre le lien sous le doigt. */
        const swallow = (c: MouseEvent) => c.preventDefault();
        el.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0);
      }
      down = null;
      moved = false;
      hold();
    };

    const onIntent = () => hold();

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onIntent, { passive: true });
    el.addEventListener("touchstart", onIntent, { passive: true });
    el.addEventListener("focusin", onIntent);

    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onIntent);
      el.removeEventListener("touchstart", onIntent);
      el.removeEventListener("focusin", onIntent);
    };
  }, []);

  const pass = <div ref={passRef} className="flex shrink-0 gap-4">{children}</div>;

  return (
    <div className={className}>
      <div
        ref={railRef}
        className={`rail -mx-5 gap-4 px-5 pb-2 md:-mx-8 md:px-8 lg:-mx-10 lg:px-10 ${loop ? "rail-auto" : ""}`}
        role="group"
        aria-label={label}
      >
        {pass}
        {/* Copie de secours pour la boucle, montée seulement quand elle sert
            et masquée aux lecteurs d'écran : les pièces ne sont annoncées
            qu'une fois. */}
        {loop && (
          <div className="flex shrink-0 gap-4" aria-hidden inert>
            {children}
          </div>
        )}
      </div>

    </div>
  );
}

/* ----------------------------------------------------------------- CursorTag */

/**
 * Pastille qui suit le curseur au-dessus d'un visuel, à la manière des sites
 * de mode. Rien au doigt : elle n'apparaît que sur un pointeur qui survole.
 */
export function CursorTag({
  children,
  label,
  className = "",
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let pos = { x: 0, y: 0 };
    const place = () => {
      raf = 0;
      const tag = tagRef.current;
      if (!tag) return;
      tag.style.left = `${pos.x}px`;
      tag.style.top = `${pos.y}px`;
    };
    const track = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pos = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      track(e);
      if (!raf) raf = requestAnimationFrame(place);
    };

    /* Placée avant d'être montrée : sans ça, elle naîtrait dans le coin
       supérieur gauche avant de rejoindre le curseur d'un bond. */
    const onEnter = (e: PointerEvent) => {
      track(e);
      place();
      setOn(true);
    };
    const onLeave = () => setOn(false);

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {children}
      <span
        ref={tagRef}
        aria-hidden
        className={`cursor-tag rounded-full bg-ink px-4 py-2 text-[11.5px] font-bold uppercase tracking-[.1em] text-white transition-[opacity,scale] duration-300 ease-back ${
          on ? "scale-100 opacity-100" : "scale-0 opacity-0"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ ScrollProgress */

/** Fine barre de lecture, à poser en bas du header collant. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.setProperty("--p", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-transparent">
      <div ref={ref} className="progress h-full bg-linear-to-r from-rose to-gold" />
    </div>
  );
}
