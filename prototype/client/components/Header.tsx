import { Link } from "react-router-dom";
import { ShoppingCart, Search } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  cartCount?: number;
}

export default function Header({ cartCount = 0 }: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">✦</span>
          </div>
          <span className="font-bold text-lg hidden sm:inline">Artistry</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Home
          </Link>
          <Link
            to="/shop"
            className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Shop
          </Link>
          <a
            href="#"
            className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Collections
          </a>
          <a
            href="#"
            className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            About
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex relative">
            <input
              type="text"
              placeholder="Search designs..."
              className="w-48 px-4 py-2 rounded-lg border border-border bg-secondary/20 text-sm placeholder-foreground/50 focus:outline-none focus:border-primary"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-foreground/40" />
          </div>

          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="md:hidden p-2 hover:bg-secondary/20 rounded-lg transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          <Link
            to="/cart"
            className="relative p-2 hover:bg-secondary/20 rounded-lg transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {isSearchOpen && (
        <div className="md:hidden border-t border-border bg-background p-4">
          <input
            type="text"
            placeholder="Search designs..."
            className="w-full px-4 py-2 rounded-lg border border-border bg-secondary/20 text-sm placeholder-foreground/50 focus:outline-none focus:border-primary"
          />
        </div>
      )}
    </header>
  );
}
