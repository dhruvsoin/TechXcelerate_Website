import type { Metadata, Viewport } from "next";
import { Cinzel, Cinzel_Decorative, Cormorant_Garamond, Geist } from "next/font/google";
import SmoothScroll from "@/components/scroll/SmoothScroll";
import Header from "@/components/layout/Header";
import SoundToggle from "@/components/scroll/SoundToggle";
import { site } from "@/content/site";
import "./globals.css";

const decorative = Cinzel_Decorative({
  variable: "--font-cinzel-deco",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const display = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const serif = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${site.name} 2027 · ${site.label}`,
  description: `${site.name}: ${site.tagline}. The ${site.label} of the ${site.organiser.department}, ${site.organiser.university}. ${site.dates}.`,
};

export const viewport: Viewport = {
  themeColor: "#0b0f17",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${decorative.variable} ${display.variable} ${serif.variable} ${sans.variable} antialiased`}
    >
      <body className="min-h-full bg-navy-950 text-ivory">
        <a href="#valley" className="skip-link">
          Skip to content
        </a>
        <SmoothScroll>
          <Header />
          {children}
          <SoundToggle />
        </SmoothScroll>
      </body>
    </html>
  );
}
