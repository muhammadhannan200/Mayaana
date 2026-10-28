import "@/app/globals.css";
import "@/app/secretary/secretary.css";
import { Noto_Sans_Arabic } from "next/font/google";

const font = Noto_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
