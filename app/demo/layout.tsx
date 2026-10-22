import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Mayaana — V1 Demo",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
