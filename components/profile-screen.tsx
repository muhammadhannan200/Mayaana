import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import "./profile-screen.css";

export function ProfileSummary({
  name,
  subtitle,
}: {
  name: string;
  subtitle: string;
}) {
  return (
    <section className="profile-summary">
      <span className="profile-avatar" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      <div>
        <h2>{name}</h2>
        <p>{subtitle}</p>
      </div>
    </section>
  );
}

export function ProfileRow({
  icon,
  label,
  value,
  href,
}: {
  icon: "account" | "lock" | "mail";
  label: string;
  value?: string;
  href?: string;
}) {
  const content = (
    <>
      <Icon name={icon} size={20} />
      <span className="profile-row-label">{label}</span>
      {value && (
        <bdi className="profile-row-value" dir="auto">
          {value}
        </bdi>
      )}
      {href && <Icon name="arrow" size={16} />}
    </>
  );
  return href ? (
    <Link className="profile-row" href={href}>
      {content}
    </Link>
  ) : (
    <div className="profile-row">{content}</div>
  );
}

export function ProfileCard({ children }: { children: ReactNode }) {
  return <div className="profile-card">{children}</div>;
}

export function ProfileNote({ children }: { children: ReactNode }) {
  return (
    <p className="profile-note">
      <Icon name="info" size={16} />
      <span>{children}</span>
    </p>
  );
}
