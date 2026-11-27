"use client";

import { useEffect, useRef, useState } from "react";
import { navLinks, site } from "@/content/site";
import { useScroll } from "@/components/scroll/SmoothScroll";

/** FR-01 — minimal transparent navigation that sits inside the landscape. */
export default function Header() {
  const { scrollTo } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobile menu: lock scroll, focus first link, Escape closes.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    scrollTo(href);
  };

  return (
    <header className={`site-nav ${scrolled ? "site-nav-scrolled" : ""}`}>
      <div className="flex h-20 items-center justify-between px-6 sm:px-10 lg:px-[5.5vw]">
        <a href="#valley" onClick={go("#valley")} className="flex items-center gap-3" aria-label={`${site.name} — home`}>
          <Logo />
          <span className="nav-wordmark max-sm:hidden">{site.name}</span>
        </a>

        <nav aria-label="Main" className="max-lg:hidden">
          <ul className="flex items-center gap-[clamp(1.5rem,2.6vw,3rem)]">
            {navLinks.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} onClick={go(`#${c.id}`)} className="nav-link">
                  {c.menu}
                </a>
              </li>
            ))}
            <li>
              <a href={site.hero.register.href} onClick={go(site.hero.register.href)} className="nav-link nav-link-gold">
                {site.hero.register.label}
              </a>
            </li>
          </ul>
        </nav>

        <button
          ref={btnRef}
          type="button"
          className="nav-menu-btn lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3 w-6" aria-hidden="true">
            <span className={`absolute left-0 h-px w-6 bg-current transition-transform duration-500 ${open ? "top-1/2 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 h-px w-6 bg-current transition-transform duration-500 ${open ? "top-1/2 -rotate-45" : "bottom-0"}`} />
          </span>
          <span>{open ? "Close" : "Menu"}</span>
        </button>
      </div>

      <div
        ref={panelRef}
        id="mobile-menu"
        className={`mobile-menu lg:hidden ${open ? "mobile-menu-open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <ul className="flex flex-col items-center gap-6">
          {[...navLinks, { id: "throne-room", menu: site.hero.register.label, numeral: "✦" }].map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`} onClick={go(`#${c.id}`)} className="mobile-link">
                <span className="mobile-link-num">{c.numeral}</span>
                {c.menu}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

/** Placeholder monogram until the vector logo arrives (PRD §10). */
function Logo() {
  return (
    <svg viewBox="0 0 40 40" className="size-10 text-gold" aria-hidden="true">
      <rect x="7" y="7" width="26" height="26" transform="rotate(45 20 20)" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <rect x="10.5" y="10.5" width="19" height="19" transform="rotate(45 20 20)" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.8" />
      <text x="20" y="24.4" textAnchor="middle" fontSize="11" fill="currentColor" style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, letterSpacing: "0.04em" }}>
        TX
      </text>
    </svg>
  );
}
