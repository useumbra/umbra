"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { brand } from "@/config/brand";
import { ThemeToggle } from "./ThemeToggle";
import { XIcon } from "./XIcon";
import { GitHubIcon } from "./GitHubIcon";
export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const destinations = [
    ["/leak-check", "Leak check"],
    ["/image", "Image"],
    ["/video", "Video"],
    ["/code", "Code"],
    ["/docs", "Docs"],
    ["/connectors", "Connectors"],
    ["/credits", "Credits"],
    ["/developers", "Developers"],
    ["/roadmap", "Roadmap"],
    [brand.appPath, `Open ${brand.products.chat}`],
  ] as const;
  const desktopDestinations = [
    destinations[0],
    destinations[1],
    destinations[2],
    destinations[3],
    destinations[4],
    destinations[9],
  ] as const;
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        <span className="mark">◒</span>
        {brand.wordmark}
      </Link>
      <nav aria-label="Primary navigation">
        {desktopDestinations.map(([href, label]) => (
          <Link
            href={href}
            key={href}
            className={href === brand.appPath ? "nav-cta" : undefined}
          >
            {label}
          </Link>
        ))}
        <ThemeToggle />
      </nav>
      <button
        className="menu-button"
        type="button"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "×" : "☰"}
      </button>
      {open && (
        <div className="mobile-navigation" id="mobile-navigation">
          {destinations.map(([href, label]) => (
            <Link href={href} key={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <a
            href={brand.social.x.url}
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            aria-label={`${brand.name} on X`}
            title={brand.social.x.handle}
          >
            <XIcon />
            <span>Follow on X</span>
          </a>
          <a
            href={brand.social.github.url}
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            aria-label={`${brand.name} on GitHub`}
            title={brand.social.github.handle}
          >
            <GitHubIcon />
            <span>Source on GitHub</span>
          </a>
          <div className="mobile-theme">
            <span>Theme</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
