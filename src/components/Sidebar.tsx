"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: "📋" },
  { href: "/plan", label: "Study Plans", icon: "📚" },
  { href: "/review", label: "Review Queue", icon: "🔄" },
  { href: "/progress", label: "Progress", icon: "📊" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-56 border-r bg-card p-4 flex flex-col">
      <Link href="/" className="text-xl font-bold mb-8 px-2">
        OYO
      </Link>
      <nav className="flex-1 space-y-1">
        {nav.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <span>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="text-xs text-muted-foreground px-2">
        Local AI Learning System
      </div>
    </aside>
  );
}
