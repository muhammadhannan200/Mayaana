import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "معاينة | إدارة العيادة ومتابعة المرضى",
  description:
    "نظام لإدارة العيادة ومتابعة المرضى والزيارات والقياسات والبرامج الغذائية.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexArabic.variable}>
      <body>{children}</body>
    </html>
  );
}
