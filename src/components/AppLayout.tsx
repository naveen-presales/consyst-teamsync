import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import {
  LayoutDashboard,
  Briefcase,
  Star,
  Users,
  ListChecks,
  Target,
  LogOut,
  Sun,
  Moon,
  Menu,
} from "lucide-react";
import consystLogo from "@/assets/consyst-logo.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  show: boolean;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, isVp, signOut, refresh } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Re-sync roles/profile on route change so role updates take effect without re-login
  useEffect(() => { refresh(); }, [pathname]);

  // Auto-close mobile sheet when route changes
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/opportunities", label: "Opportunities", icon: Briefcase, show: true },
    { to: "/goals", label: "Goals", icon: Target, show: true },
    { to: "/ratings", label: "Ratings", icon: Star, show: isVp || isAdmin },
    { to: "/admin/users", label: "Users", icon: Users, show: isAdmin || isVp },
    { to: "/admin/questions", label: "Rating questions", icon: ListChecks, show: isAdmin },
  ];

  const navContent = (onNav?: () => void) => (
    <>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.filter((i) => i.show).map((i) => {
          const active = pathname === i.to || pathname.startsWith(i.to + "/");
          const Icon = i.icon;
          return (
            <Link
              key={i.to}
              to={i.to}
              onClick={onNav}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="h-4 w-4" />
              {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="px-2">
          <div className="text-sm font-medium truncate">{profile?.full_name || profile?.email}</div>
          <div className="text-[11px] text-muted-foreground truncate">{profile?.email}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={toggle}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={async () => {
            onNav?.();
            await signOut();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <img src={consystLogo} alt="Consyst" className="h-7 w-auto object-contain" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted-foreground">TeamSync</div>
          </div>
          <NotificationBell />
        </div>
        {navContent()}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 h-12 border-b bg-background/95 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar flex flex-col">
              <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
                <img src={consystLogo} alt="Consyst" className="h-7 w-auto object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground">TeamSync</div>
                </div>
              </div>
              {navContent(() => setMobileOpen(false))}
            </SheetContent>
          </Sheet>
          <img src={consystLogo} alt="Consyst" className="h-6 w-auto object-contain" />
          <div className="text-xs text-muted-foreground">TeamSync</div>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
