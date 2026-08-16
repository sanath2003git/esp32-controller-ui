"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Home, UserRound } from "lucide-react";

const tabs = [
  { label: "Home", href: "/", icon: Home },
  { label: "Playground", href: "/playground", icon: Gamepad2 },
  { label: "Profile", href: "/profile", icon: UserRound },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {tabs.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={label}
              href={href}
              className={[
                "flex flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-white/45 hover:text-white/75",
              ].join(" ")}
              aria-label={label}
            >
              <Icon size={18} className={isActive ? "text-primary" : "text-current"} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
