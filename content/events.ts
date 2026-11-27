/**
 * TechXcelerate competitions — the single source of truth for the realm map,
 * the online/offline panels, the camera route and the event details.
 *
 * ⚠️  CONFIRM BEFORE LAUNCH. The project had no event data; names below come from the
 * PRD (§11 "Brochure issues"). Everything not stated there is marked TBA, and the
 * fields listed in `MISSING_EVENT_DATA` must be supplied by the organisers.
 */
import type { LandmarkKey } from "./realm-map";
import { site, TBA } from "./site";

export type EventMode = "online" | "offline";

export type RealmEvent = {
  id: string;
  /** Final spelling still to be confirmed where noted. */
  name: string;
  /**
   * Online/offline split is PROVISIONAL: the PRD says 5 online + 5 offline but not which.
   * `modeConfirmed: false` until the organisers confirm.
   */
  mode: EventMode;
  modeConfirmed: boolean;
  category: string;
  landmark: LandmarkKey;
  description: string;
  dateTime: string;
  venue: string;
  teamSize: string;
  rules: string[];
  fee: string;
  /** Registration goes through the site's existing registration section. */
  registerHref: string;
};

const common = {
  dateTime: `${site.dates} · day and time ${TBA}`,
  description: TBA,
  category: TBA,
  rules: [] as string[],
  fee: "Free (registration currently has no fee)",
  registerHref: site.hero.register.href,
  modeConfirmed: false,
};

/** Order = order of discovery along the golden pathway (alternates offline / online). */
export const EVENTS: RealmEvent[] = [
  { ...common, id: "hackathon", name: "Hackathon", mode: "offline", landmark: "citadel", venue: `On campus · ${TBA}`, teamSize: `Up to 3 (to confirm)` },
  { ...common, id: "promptathon", name: "Promptathon", mode: "online", landmark: "observatory", venue: `Online · platform ${TBA}`, teamSize: "2 (brochure rules; badge says up to 3)" },
  { ...common, id: "dataforge", name: "DataForge", mode: "offline", landmark: "workshop", venue: `On campus · ${TBA}`, teamSize: `Up to 3 (to confirm)` },
  { ...common, id: "ctf", name: "CTF", mode: "online", landmark: "castle", venue: `Online · platform ${TBA}`, teamSize: "2 (brochure rules; badge says up to 3)" },
  { ...common, id: "it-manager", name: "IT Manager", mode: "offline", landmark: "palace", venue: `On campus · ${TBA}`, teamSize: "Solo" },
  { ...common, id: "valorant", name: "Valorant", mode: "online", landmark: "exhibition", venue: `Online · platform ${TBA}`, teamSize: "2 (brochure rules; game format to confirm)" },
  { ...common, id: "event-9", name: `Competition ${TBA}`, mode: "offline", landmark: "lighthouse", venue: `On campus · ${TBA}`, teamSize: TBA },
  { ...common, id: "anime-design", name: "Anime Design", mode: "online", landmark: "garden", venue: `Online · platform ${TBA}`, teamSize: "2 (brochure rules; badge says up to 3)" },
  { ...common, id: "event-10", name: `Competition ${TBA}`, mode: "offline", landmark: "village", venue: `On campus · ${TBA}`, teamSize: TBA },
  { ...common, id: "tech-quiz", name: "Tech Quiz", mode: "online", landmark: "library", venue: `Online · platform ${TBA}`, teamSize: "2 (brochure rules; badge says up to 3)" },
];

/** Everything the organisers still need to supply (shown in the README, not on the site). */
export const MISSING_EVENT_DATA = [
  "Names of the two remaining competitions (event-9, event-10)",
  "Which five competitions are online and which five offline (current split is provisional)",
  "Category, description and rules for every competition",
  "Day and time for each competition, and on-campus venues",
  "Final team sizes (brochure badge vs rules conflict) and Valorant game format",
  "Final spellings: DataForge / DataForce, Promptathon / Prompt-a-Thon",
] as const;

export const isTBA = (v: string) => v.includes(TBA);
