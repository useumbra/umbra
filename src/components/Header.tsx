import Link from "next/link";
import { brand } from "@/config/brand";
import { ThemeToggle } from "./ThemeToggle";
export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        <span className="mark">◒</span>
        {brand.wordmark}
      </Link>
      <nav>
        <Link href="/leak-check">Leak check</Link>
        <Link href={brand.appPath} className="nav-cta">
          Open {brand.products.chat}
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
