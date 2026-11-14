"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tr, type Lang } from "@/lib/i18n";

const LINKS = [
  { href: "/", label: "Bosh sahifa" },
  { href: "/events", label: "Tadbirlar" },
  { href: "/pulse", label: "Pulse" },
  { href: "/clubs", label: "Klublar" },
];

export function HeaderNav({ authed = true, lang }: { authed?: boolean; lang: Lang }) {
  const path = usePathname();
  if (!authed) return null;
  return (
    <nav className="ml-6 hidden items-center gap-5 md:flex">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`border-b-2 pb-0.5 text-[12.5px] font-semibold tracking-[0.01em] transition-colors ${active ? "border-hairline text-text-primary" : "border-transparent text-text-tertiary hover:border-glass hover:text-text-primary"}`}
          >
            {tr(lang, l.label)}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({
  isAuthed,
  hasAdmin,
  lang,
}: {
  isAuthed: boolean;
  hasAdmin: boolean;
  lang: Lang;
}) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Bosh", icon: "home" },
    { href: "/events", label: "Tadbirlar", icon: "calendar" },
    { href: "/pulse", label: "Pulse", icon: "pulse" },
    { href: "/clubs", label: "Klublar", icon: "users" },
    ...(hasAdmin ? [{ href: "/admin", label: "Boshqaruv", icon: "grid" }] : []),
    { href: isAuthed ? "/profile" : "/login", label: isAuthed ? "Profil" : "Kirish", icon: "user" },
  ];

  return (
    <nav className="site-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 md:hidden">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#1D1A17] px-2 py-2 shadow-[0_18px_40px_-16px_rgba(29,26,23,0.55)]">
        {items.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={tr(lang, item.label)}
              title={tr(lang, item.label)}
              className={
                active
                  ? "flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white"
                  : "flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white"
              }
            >
              <NavIcon name={item.icon} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6 9.5V20h12V9.5" />
      </svg>
    );
  }
  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5.5" width="17" height="15" rx="4" />
        <path d="M8 3.5v4M16 3.5v4M3.5 10.5h17" />
      </svg>
    );
  }
  if (name === "pulse") {
    return (
      <svg {...common}>
        <path d="M3 12h4l2.5-5 3.5 10 2.5-5h5.5" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg {...common}>
        <circle cx="9" cy="9" r="3.2" />
        <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
        <path d="M16 6.6a3 3 0 0 1 0 5.4M17.5 14.8c2 .6 3.2 2.3 3.2 4.7" />
      </svg>
    );
  }
  if (name === "grid") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
    </svg>
  );
}

export function AdminSidebar({
  items,
  lang,
}: {
  items: { href: string; label: string; icon: string }[];
  lang: Lang;
}) {
  const path = usePathname();
  return (
    <nav className="hidden w-48 shrink-0 flex-col gap-0.5 border-r border-hairline pr-3 md:flex">
      <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.13em] text-text-tertiary">
        {tr(lang, "Bo'limlar")}
      </p>
      {items.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex items-center rounded-2xl px-2 py-2 text-[12.5px] font-semibold transition-colors ${active ? "nav-active" : "text-text-tertiary hover:bg-subtle hover:text-text-primary"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <div className="-mx-4 mb-4 overflow-x-auto border-b border-hairline px-4 md:hidden">
      <div className="flex w-max items-center gap-4">
        {items.map((i) => {
          const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`whitespace-nowrap border-b-2 pb-2 text-[12px] font-semibold ${active ? "border-hairline text-text-primary" : "border-transparent text-text-tertiary"}`}
            >
              {i.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}