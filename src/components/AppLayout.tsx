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
  Activity,
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
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 240;
    const saved = Number(window.localStorage.getItem("sidebar-width"));
    return saved >= 180 && saved <= 480 ? saved : 240;
  });

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(480, Math.max(180, startW + ev.clientX - startX));
      setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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
    { to: "/status", label: "Status", icon: Activity, show: isVp || isAdmin },
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
      {/* Floating notification bell — top-right across all app pages */}
      <div className="fixed top-3 right-4 z-50">
        <NotificationBell />
      </div>

      {/* Desktop sidebar (resizable) */}
      <aside
        className="hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar relative"
        style={{ width: sidebarWidth }}
      >
        <div className="px-4 py-4 flex items-center gap-2 border-b border-sidebar-border">
          <img src={consystLogo} alt="Consyst" className="h-10 w-auto shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <div className="font-brand text-2xl font-extrabold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
              TeamSync
            </div>
          </div>
        </div>

        {navContent()}

        {/* Drag handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={startResize}
          onDoubleClick={() => setSidebarWidth(240)}
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-sidebar-accent active:bg-sidebar-accent transition-colors"
        />
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
              <div className="px-4 py-4 flex items-center gap-2 border-b border-sidebar-border">
                <img src={consystLogo} alt="Consyst" className="h-10 w-auto shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="font-brand text-2xl font-extrabold tracking-tight whitespace-nowrap">TeamSync</div>
                </div>
              </div>
              {navContent(() => setMobileOpen(false))}
            </SheetContent>
          </Sheet>
          <img src={consystLogo} alt="Consyst" className="h-9 w-auto shrink-0 object-contain" />
          <div className="font-brand text-xl font-extrabold tracking-tight whitespace-nowrap min-w-0 flex-1">TeamSync</div>
          {/* Reserve room so the fixed bell doesn't overlap the title */}
          <div className="w-10 shrink-0" aria-hidden />
        </header>


        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

