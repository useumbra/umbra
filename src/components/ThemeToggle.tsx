"use client";
import { useEffect, useState } from "react";
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(localStorage.getItem("umbra-theme") === "light"); }, []);
  const toggle = () => { const next = !light; setLight(next); document.documentElement.classList.toggle("light", next); localStorage.setItem("umbra-theme", next ? "light" : "dark"); };
  return <button className="icon-button" onClick={toggle} aria-label="Toggle color theme">{light ? "☾" : "☼"}</button>;
}
