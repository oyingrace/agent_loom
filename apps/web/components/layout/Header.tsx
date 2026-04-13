"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogIn, LogOut, Server, Store, Workflow } from "lucide-react";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/user";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/explore", label: "APIs", icon: Store },
  { href: "/mcp-servers", label: "MCP Servers", icon: Server },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    authRequired: true
  }
];

export function Header() {
  const pathname = usePathname();
  const { session, isLoading, signIn, signOut } = useUser();
  const isAuthenticated = !!session;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-1 text-xl font-semibold">
            <span className="text-foreground">Agent</span>
            <span className="font-bold text-primary">Loom</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              if ("authRequired" in link && link.authRequired && !isAuthenticated) {
                return null;
              }
              const Icon = link.icon;
              const isActive =
                pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("gap-2", isActive && "bg-secondary")}
                  >
                    <Icon className="size-4" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <AnimatedThemeToggler />
          {!isAuthenticated ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => signIn()}
              disabled={isLoading}
              className="gap-2"
            >
              <LogIn className="size-4" />
              {isLoading ? "Connecting…" : "Sign In"}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="hidden max-w-[220px] truncate font-mono text-xs text-muted-foreground sm:inline"
                title={session?.accountAddress}
              >
                {session?.accountAddress}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                disabled={isLoading}
                className="gap-2"
              >
                <LogOut className="size-4" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
