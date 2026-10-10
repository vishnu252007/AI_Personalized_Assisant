"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Brain,
  Sparkles,
  CalendarCheck,
  MessageSquare,
  Zap,
  TrendingUp,
  Settings,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

import { prefetchTabData, prefetchOverviewData, prefetchConversationsData } from "@/lib/hooks/use-learn-query";

interface UserInfo {
  id: string;
  email?: string;
  fullName?: string;
}

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name || data.user.email?.split("@")[0],
        });
        // Prefetch critical core data on authenticated session discovery
        prefetchOverviewData().catch(() => {});
        prefetchConversationsData().catch(() => {});
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name || session.user.email?.split("@")[0],
        });
        prefetchOverviewData().catch(() => {});
        prefetchConversationsData().catch(() => {});
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const navLinks = [
    { href: "/dashboard", label: "Today (Plan)", icon: CalendarCheck },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/quiz", label: "Practice", icon: Zap },
    { href: "/progress", label: "Progress", icon: TrendingUp },
    { href: "/settings", label: "Profile", icon: Settings },
  ];

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleTabPrefetch = (href: string) => {
    prefetchTabData(href).catch(() => {});
  };

  return (
    <>
      {/* Top Desktop & Tablet Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 shadow-md shadow-blue-500/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400">
                LearnAI
              </span>
              <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase -mt-1">
                Socratic Engine
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => handleTabPrefetch(link.href)}
                  onFocus={() => handleTabPrefetch(link.href)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Actions (Theme & Auth) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                  <span className="max-w-[110px] truncate hidden sm:inline">{user.fullName}</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                    <div className="px-3 py-2 border-b border-border text-xs">
                      <p className="font-semibold text-foreground truncate">{user.fullName}</p>
                      <p className="text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>Settings & Privacy</span>
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs sm:text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition hover:bg-primary/90"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Get Started</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (Fixed at bottom on mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border flex items-center justify-around py-2 px-2 shadow-lg">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              onTouchStart={() => handleTabPrefetch(link.href)}
              onMouseEnter={() => handleTabPrefetch(link.href)}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors text-[10px] font-semibold gap-0.5",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{link.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
