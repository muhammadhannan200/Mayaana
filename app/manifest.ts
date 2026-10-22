import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "معاينة",
    short_name: "معاينة",
    description:
      "نظام لإدارة العيادة ومتابعة المرضى والزيارات والقياسات والبرامج الغذائية.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/icons/mayaana.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/mayaana-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
