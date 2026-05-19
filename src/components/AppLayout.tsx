import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import {
  LayoutDashboard,
  Briefcase,
  Star,
  Users,
  ListChecks,
  CheckSquare,
  LogOut,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

  // Re-sync roles/profile on route change so role updates take effect without re-login
  useEffect(() => { refresh(); }, [pathname]);

  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/opportunities", label: "Opportunities", icon: Briefcase, show: true },
    { to: "/ratings", label: "Ratings", icon: Star, show: isVp || isAdmin },
    { to: "/admin/users", label: "Users", icon: Users, show: isAdmin || isVp },
    { to: "/admin/questions", label: "Rating questions", icon: ListChecks, show: isAdmin },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-accent text-accent-foreground grid place-items-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground">Presales</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">Opportunity Tracker</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {items.filter((i) => i.show).map((i) => {
            const active = pathname === i.to || pathname.startsWith(i.to + "/");
            const Icon = i.icon;
            return (
              <Link
                key={i.to}
                to={i.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
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
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
