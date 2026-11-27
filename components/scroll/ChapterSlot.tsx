import { chapters, type ChapterId } from "@/content/site";

/**
 * Temporary slot for chapters II–VIII.
 * Teammates: pass your section component as children; the scenery for each
 * chapter will be added around it by the scroll-experience owner.
 */
export default function ChapterSlot({ id, children }: { id: ChapterId; children?: React.ReactNode }) {
  const c = chapters.find((x) => x.id === id)!;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-chapter={id}
      className="relative flex min-h-svh items-center justify-center bg-navy-950 px-6 py-24 text-ivory odd:bg-navy-900"
    >
      {children ?? (
        <div className="text-center">
          <p className="label text-xs opacity-60">Chapter {c.numeral}</p>
          <h2 id={`${id}-title`} className="mt-3 font-display text-4xl sm:text-5xl">
            {c.title}
          </h2>
          <p className="mt-3 font-serif text-lg italic opacity-60">Scenery and content coming soon</p>
        </div>
      )}
    </section>
  );
}
