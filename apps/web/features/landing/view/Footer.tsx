"use client";

import Link from "next/link";

const footerLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Workflows", href: "/workflows" },
  { label: "APIs", href: "/explore" }
];

export function Footer() {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container">
        <div className="flex flex-col items-center gap-6 text-center">
          <Link href="/" className="flex items-center gap-1 font-semibold text-xl">
            <span className="text-foreground">Agent</span>
            <span className="text-primary font-bold">Loom</span>
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-sm text-muted-foreground max-w-md">
            Agent Loom: Stellar-native paid proxies, MCP, and workflows for AI agents.
          </p>
        </div>
      </div>
    </footer>
  );
}
