import Image from "next/image";
import Link from "next/link";

export type AppNavTab = { key: string; title: string; href: string };

export function AppNav({
  tabs,
  active,
}: {
  tabs: AppNavTab[];
  active: string;
}) {
  return (
    <nav className="secretary-nav" aria-label="التنقل الرئيسي">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`secretary-nav-item${active === tab.key ? " active" : ""}`}
          aria-current={active === tab.key ? "page" : undefined}
        >
          <Image
            src={`/rashaqa/nav-${tab.key}${active === tab.key ? "-active" : ""}.svg`}
            width={54}
            height={30}
            alt=""
            unoptimized
          />
          <span>{tab.title}</span>
        </Link>
      ))}
    </nav>
  );
}
