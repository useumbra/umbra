"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import packageJson from "../../package.json";
import { clearLocalData, getSetting, saveSetting } from "@/lib/storage";
import { ThemeToggle } from "./ThemeToggle";

type WorkspaceShellProps = {
  children: ReactNode;
};

type WorkspaceIconName =
  "chat" | "image" | "video" | "code" | "connectors" | "credits" | "leak";

const workspaceLinks: {
  href: string;
  label: string;
  icon: WorkspaceIconName;
}[] = [
  { href: "/app", label: "Chat", icon: "chat" },
  { href: "/image", label: "Image", icon: "image" },
  { href: "/video", label: "Video", icon: "video" },
  { href: "/code", label: "Code", icon: "code" },
];

const toolLinks: {
  href: string;
  label: string;
  icon: WorkspaceIconName;
}[] = [
  { href: "/connectors", label: "Connectors", icon: "connectors" },
  { href: "/credits", label: "Credits", icon: "credits" },
  { href: "/leak-check", label: "Leak check", icon: "leak" },
];

function WorkspaceIcon({ name }: { name: WorkspaceIconName }) {
  if (name === "chat")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3.5 4.5h13v8h-7l-3.5 3v-3h-2.5z" />
        <path d="M6.5 8h7M6.5 10.5h4" />
      </svg>
    );
  if (name === "image")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <circle cx="7" cy="7" r="1.25" />
        <path d="m4.5 14 3.5-3.5 2.5 2 2-2 3 3.5" />
      </svg>
    );
  if (name === "video")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="5" width="10" height="10" rx="2" />
        <path d="m13 8 4-2v8l-4-2z" />
      </svg>
    );
  if (name === "code")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m7 5-4 5 4 5M13 5l4 5-4 5M11.5 3.5l-3 13" />
      </svg>
    );
  if (name === "connectors")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7.5 12.5 12.5 7.5M6 14a3 3 0 0 1 0-4.25l1.25-1.25M14 6a3 3 0 0 1 0 4.25l-1.25 1.25" />
      </svg>
    );
  if (name === "credits")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="6.5" />
        <path d="M10 6.5v7M12.5 8.25c-.5-.5-1.25-.75-2.25-.75-1.25 0-2 .5-2 1.25 0 1.75 4.25.75 4.25 2.5 0 .75-.75 1.25-2.25 1.25-1 0-1.75-.25-2.25-.75" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3 16 5.5v4.25c0 3.25-2.25 5.75-6 7.25-3.75-1.5-6-4-6-7.25V5.5z" />
      <path d="M10 7v3.5M10 13h.01" />
    </svg>
  );
}

function WorkspaceNav({
  links,
  pathname,
  onNavigate,
}: {
  links: typeof workspaceLinks;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="workspace-nav">
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            href={link.href}
            key={link.href}
            className={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <WorkspaceIcon name={link.icon} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    void getSetting("workspaceCollapsed", false).then(setCollapsed);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setSettingsOpen(false);
    setWipeConfirm(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setCollapsed((value) => {
          const next = !value;
          void saveSetting("workspaceCollapsed", next);
          return next;
        });
      }
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setSettingsOpen(false);
        setWipeConfirm(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      void saveSetting("workspaceCollapsed", next);
      return next;
    });
  };

  const wipe = async () => {
    if (!wipeConfirm) {
      setWipeConfirm(true);
      return;
    }
    setWiping(true);
    await clearLocalData();
    window.location.reload();
  };

  return (
    <div
      className={`workspace-frame${collapsed ? " workspace-collapsed" : ""}${drawerOpen ? " workspace-drawer-open" : ""}`}
    >
      {drawerOpen && (
        <button
          className="workspace-backdrop"
          type="button"
          aria-label="Close workspace navigation"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside
        className="workspace-sidebar"
        id="workspace-sidebar"
        aria-label="Workspace navigation"
      >
        <div className="workspace-sidebar-header">
          <Link
            href="/"
            className="wordmark"
            onClick={() => setDrawerOpen(false)}
          >
            <span className="mark">◒</span>
            <span className="workspace-wordmark">umbra</span>
          </Link>
          <button
            className="workspace-collapse"
            type="button"
            aria-label={
              collapsed
                ? "Expand workspace navigation"
                : "Collapse workspace navigation"
            }
            title="Toggle sidebar (Ctrl+B)"
            onClick={toggleCollapsed}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <div className="workspace-sidebar-scroll">
          <div className="workspace-section-label">Workspace</div>
          <WorkspaceNav
            links={workspaceLinks}
            pathname={pathname}
            onNavigate={() => setDrawerOpen(false)}
          />
          <div className="workspace-section-label">Tools</div>
          <WorkspaceNav
            links={toolLinks}
            pathname={pathname}
            onNavigate={() => setDrawerOpen(false)}
          />
        </div>
        <div className="workspace-sidebar-footer">
          <div className="workspace-footer-row">
            <ThemeToggle />
            <button
              className="workspace-settings-trigger"
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="workspace-settings"
              onClick={() => {
                setSettingsOpen((value) => !value);
                setWipeConfirm(false);
              }}
            >
              <span>Settings</span>
              <span aria-hidden="true">⋯</span>
            </button>
          </div>
          {settingsOpen && (
            <div className="workspace-settings" id="workspace-settings">
              <div className="workspace-settings-heading">Appearance</div>
              <div className="workspace-settings-theme">
                <span>Theme</span>
                <ThemeToggle />
              </div>
              <div className="workspace-settings-heading">Local data</div>
              <p>Chats, memory, media, this device only.</p>
              <button
                className="workspace-wipe"
                type="button"
                disabled={wiping}
                onClick={() => void wipe()}
              >
                {wiping
                  ? "Wiping…"
                  : wipeConfirm
                    ? "Confirm wipe"
                    : "Wipe local data"}
              </button>
              {wipeConfirm && !wiping && (
                <p className="workspace-wipe-warning">
                  This permanently clears Umbra data from this browser.
                </p>
              )}
              <div className="workspace-settings-heading">About</div>
              <p>Umbra v{packageJson.version}</p>
              <Link href="/leak-check" onClick={() => setSettingsOpen(false)}>
                Verify privacy
              </Link>
            </div>
          )}
        </div>
      </aside>
      <div className="workspace-content">
        <div className="workspace-mobile-bar">
          <button
            className="workspace-mobile-menu"
            type="button"
            aria-expanded={drawerOpen}
            aria-controls="workspace-sidebar"
            onClick={() => setDrawerOpen(true)}
          >
            <span aria-hidden="true">☰</span>
            <span>Workspace</span>
          </button>
          <Link href="/" className="wordmark">
            <span className="mark">◒</span>
            <span>umbra</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
