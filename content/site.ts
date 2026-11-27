/**
 * Site-wide content (FR-03).
 * Edit values here — no component changes needed.
 * Anything not yet supplied stays as TBA.
 */

export const TBA = "TBA";

export const site = {
  name: "TechXcelerate",
  shortName: "TXC",
  label: "Inter-Institutional IT Fest",
  dates: "4–5 February 2027",
  datesShort: "4–5 Feb 2027",
  organiser: {
    department: "Department of Computational Studies",
    school: "School of Computational and Physical Sciences",
    university: "Kristu Jayanti (Deemed to be University)",
  },
  venue: TBA,
  /** Countdown target. The start time is a placeholder until the schedule is confirmed. */
  startsAt: "2027-02-04T09:00:00+05:30",
  stats: [
    { value: "10", label: "Competitions" },
    { value: "5", label: "Online" },
    { value: "5", label: "Offline" },
    { value: "2", label: "Days" },
  ],
  hero: {
    intro: "A Journey Beyond the Ordinary",
    subtitle: "Discover a Realm of Endless Possibilities",
    enter: { label: "Enter the Realm", href: "#realm-map" },
    register: { label: "Register", href: "#throne-room" },
  },
  social: [] as { label: string; href: string }[],
} as const;

/** The eight chapters of "The Ascent" (PRD Section 4). Order = scroll order. */
export const chapters = [
  { id: "valley", numeral: "I", title: "The Valley", menu: "Home" },
  { id: "ascent", numeral: "II", title: "The Ascent", menu: "About" },
  { id: "banners", numeral: "III", title: "The Seven Banners", menu: "Domains" },
  { id: "great-hall", numeral: "IV", title: "The Great Hall", menu: "Events" },
  { id: "courtyard", numeral: "V", title: "The Courtyard", menu: "College" },
  { id: "schedule", numeral: "VI", title: "The Schedule", menu: "Schedule" },
  { id: "throne-room", numeral: "VII", title: "The Throne Room", menu: "Register" },
  { id: "raven-tower", numeral: "VIII", title: "The Raven Tower", menu: "Contact" },
] as const;

export type ChapterId = (typeof chapters)[number]["id"];

/** Links shown in the top navigation (Register is styled separately). */
export const navLinks = chapters.filter((c) => !["valley", "throne-room"].includes(c.id));
