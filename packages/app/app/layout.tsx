import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Progena — the genetic layer for autonomous AI agents",
  description:
    "Mint, breed, and own AI agents as on-chain INFTs. Inherit traits across generations. Earn from descendants and prediction rounds. Built on 0G.",
  metadataBase: new URL("https://progena.vercel.app"),
  openGraph: {
    title: "Progena",
    description:
      "The genetic layer for autonomous AI agents. Built on 0G.",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-background text-foreground min-h-screen"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
