import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "lenis/dist/lenis.css";
import SmoothScroll from "@/components/smooth-scroll";
import CrashLog from "@/components/crash-log";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Mahan Adeli" }],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE_NAME, title: SITE_TITLE, description: SITE_DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SmoothScroll />
          <CrashLog />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
