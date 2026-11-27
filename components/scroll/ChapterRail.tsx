"use client";

import { useEffect, useState } from "react";
import { chapters } from "@/content/site";
import { useScroll } from "./SmoothScroll";

/** Fixed diamond markers for the eight chapters; shows where you are and jumps on click. */
export default function ChapterRail() {
  const { scrollTo } = useScroll();
  const [active, setActive] = useState<string>(chapters[0].id);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    chapters.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <nav aria-label="Chapters" className="chapter-rail">
      <ol>
        {chapters.map((c) => {
          const on = active === c.id;
          return (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                aria-current={on ? "location" : undefined}
                className={on ? "is-active" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(`#${c.id}`);
                }}
              >
                <span className="chapter-rail-label">
                  {c.numeral} · {c.title}
                </span>
                <span className="chapter-rail-mark" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
