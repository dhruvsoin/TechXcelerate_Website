import type { LandmarkKey } from "@/content/realm-map";

/** Small engraved line icons, one per landmark style. */
const PATHS: Record<LandmarkKey, string> = {
  citadel: "M3 20h18M5 20V9l2-2 2 2v11M15 20V9l2-2 2 2v11M9 20v-6h6v6M9 12h6M11 14h2",
  observatory: "M4 20h16M6 20v-6h12v6M6 14a6 6 0 0 1 12 0M12 8l5-4M10 17h4",
  workshop: "M3 20h18M4 20v-8l5 3v-3l5 3V8h3v12M17 5v3M12 17a1.5 1.5 0 1 0 0 .01",
  castle: "M3 20h18M5 20v-9h3v-2h2v2h4v-2h2v2h3v9M12 4l2 3h-4l2-3M10 20v-4a2 2 0 0 1 4 0v4",
  palace: "M3 20h18M4 20v-8h16v8M8 12a4 4 0 0 1 8 0M12 6v2M7 20v-5M12 20v-5M17 20v-5",
  exhibition: "M3 20h18M4 20v-6a8 8 0 0 1 16 0v6M8 20v-6a4 4 0 0 1 8 0v6M12 6V3l3 1-3 1",
  lighthouse: "M7 21h10M9 21l1-13h4l1 13M10 8l-1-2h6l-1 2M12 4V3M4 7l3 1M20 7l-3 1M10 13h4",
  garden: "M4 20h16M12 20v-6M8 14a4 4 0 0 1 8 0M6 20a2 2 0 0 1 0-4M18 20a2 2 0 0 0 0-4M12 10V7M10 8h4",
  village: "M3 20h18M5 20v-6l4-4 4 4v6M13 20v-8l3-3 3 3v8M8 20v-3h2v3",
  library: "M3 20h18M5 9h14M6 9l6-4 6 4M7 9v9M10 9v9M14 9v9M17 9v9M5 18h14",
};

export default function EventIcon({ landmark, className = "" }: { landmark: LandmarkKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d={PATHS[landmark]} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
