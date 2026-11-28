/**
 * TechXcelerate competitions — the single source of truth for the realm map,
 * the online/offline panels, the camera route and the event details.
 *
 * Names and the online/offline split are confirmed by the organisers (5 online, 5 offline).
 * Everything else not yet supplied is marked TBA; the fields listed in `MISSING_EVENT_DATA`
 * must still come from the organisers before launch.
 */
import type { LandmarkKey } from "./realm-map";
import { site, TBA } from "./site";

export type EventMode = "online" | "offline";

export type RealmEvent = {
  id: string;
  /** Final spelling still to be confirmed where noted. */
  name: string;
  /** Online or offline, as confirmed by the organisers (`modeConfirmed`). */
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
  modeConfirmed: true,
};

const ONLINE = `Online · platform ${TBA}`;
const ON_CAMPUS = `On campus · ${TBA}`;

/**
 * Order = order of discovery along the golden pathway (the camera route). Online (5): Hackathon,
 * Promptathon, CTF, Valorant, Tech Quiz. Offline (5): Data Forge, IT Manager, Architecture Pitch,
 * Anime Design, GenesisChain Quest.
 */
export const EVENTS: RealmEvent[] = [
  { ...common, id: "hackathon", name: "Hackathon", mode: "online", landmark: "citadel", venue: ONLINE, teamSize: `Up to 3 (to confirm)` },
  { ...common, id: "promptathon", name: "Promptathon", mode: "online", landmark: "observatory", venue: ONLINE, teamSize: "2 (brochure rules; badge says up to 3)" },
  { ...common, id: "data-forge", name: "Data Forge", mode: "offline", landmark: "workshop", venue: ON_CAMPUS, teamSize: `Up to 3 (to confirm)` },
  { ...common, id: "ctf", name: "CTF", mode: "online", landmark: "castle", venue: ONLINE, teamSize: "2 (brochure rules; badge says up to 3)" },
  { ...common, id: "it-manager", name: "IT Manager", mode: "offline", landmark: "palace", venue: ON_CAMPUS, teamSize: "Solo" },
  { ...common, id: "valorant", name: "Valorant", mode: "online", landmark: "exhibition", venue: ONLINE, teamSize: "2 (brochure rules; game format to confirm)" },
  { ...common, id: "architecture-pitch", name: "Architecture Pitch", mode: "offline", landmark: "lighthouse", venue: ON_CAMPUS, teamSize: TBA },
  { ...common, id: "anime-design", name: "Anime Design", mode: "offline", landmark: "garden", venue: ON_CAMPUS, teamSize: "2 (brochure rules; badge says up to 3)" },
  { ...common, id: "genesischain-quest", name: "GenesisChain Quest", mode: "offline", landmark: "village", venue: ON_CAMPUS, teamSize: TBA },
  { ...common, id: "tech-quiz", name: "Tech Quiz", mode: "online", landmark: "library", venue: ONLINE, teamSize: "2 (brochure rules; badge says up to 3)" },
];

/** Everything the organisers still need to supply (shown in the README, not on the site). */
export const MISSING_EVENT_DATA = [
  "Category, description and rules for every competition",
  "Day and time for each competition, the online platforms and the on-campus venues",
  "Team sizes for Architecture Pitch and GenesisChain Quest",
  "Final team sizes for the rest (brochure badge vs rules conflict) and the Valorant game format",
  "Final spelling: Promptathon / Prompt-a-Thon",
] as const;

export const isTBA = (v: string) => v.includes(TBA);
