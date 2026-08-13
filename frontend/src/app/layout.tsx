import type { Metadata } from "next";
import { Newsreader, Martian_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const martianMono = Martian_Mono({
  variable: "--font-martian-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Cherga",
  description: "A cash box that no one has to hold.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${martianMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex flex-1 flex-col px-[18px] pb-24 text-[17px] leading-[1.55]">
          <div className="mx-auto w-full max-w-[760px] flex-1">
            <SiteHeader />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
