import CinematicRealmExperience from "@/components/realm/CinematicRealmExperience";
import ChapterSlot from "@/components/scroll/ChapterSlot";

export default function Home() {
  return (
    <main>
      <CinematicRealmExperience />
      <ChapterSlot id="ascent" />
      <ChapterSlot id="banners" />
      <ChapterSlot id="great-hall" />
      <ChapterSlot id="courtyard" />
      <ChapterSlot id="schedule" />
      <ChapterSlot id="throne-room" />
      <ChapterSlot id="raven-tower" />
    </main>
  );
}
