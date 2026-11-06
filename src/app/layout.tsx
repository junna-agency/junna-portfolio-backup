import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Sans } from "next/font/google";
import { ReactLenis } from "lenis/react";

import Splash from "@/components/Splash";
import { site } from "@/content";
import "lenis/dist/lenis.css";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: site.title,
  description: site.description,
};

/* Needed for env(safe-area-inset-*) to be non-zero under the notch / home bar. */
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <ReactLenis root options={{ wheelMultiplier: 0.7, touchMultiplier: 0.7 }}>
        <body className="min-h-full flex flex-col">
          {children}
          <Splash />
        </body>
      </ReactLenis>
    </html>
  );
}
