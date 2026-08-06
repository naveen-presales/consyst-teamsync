import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { purgeOldNotifications } from "@/lib/notify";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<string>("unsupported");

  useEffect(() => {
    if (typeof window !== "undefined" && typeof Notification !== "undefined") {
      setPerm(Notification.permission);
    }
  }, []);

  const requestPerm = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const res = await Notification.requestPermission();
      setPerm(res);
    } catch { /* ignore */ }
  };

  const load = async () => {
    if (!user) return;
    await purgeOldNotifications(user.id);
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notifs-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        (payload: any) => {
          load();
          if (payload.eventType !== "INSERT") return;
          if (typeof window === "undefined" || typeof Notification === "undefined") return;
          if (Notification.permission !== "granted") return;
          const row = payload.new;
          if (!row) return;
          try {
            const notif = new Notification(row.title, { body: row.body ?? undefined, tag: row.id });
            setTimeout(() => notif.close(), 6000);
            notif.onclick = () => {
              window.focus();
              if (row.link) navigate({ to: row.link });
            };
          } catch { /* ignore */ }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).is("read_at", null);
    load();
  };

  const openItem = async (n: Notif) => {
    if (!n.read_at) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    }
    setOpen(false);
    if (n.link) navigate({ to: n.link });
    else load();
  };

  const clearAll = async () => {
    if (!user || items.length === 0) return;
    await supabase.from("notifications").delete().eq("recipient_id", user.id);
    load();
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-medium">Notifications {unread > 0 && <span className="text-muted-foreground">· {unread} new</span>}</div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread === 0} className="h-7 px-2 text-xs"><Check className="h-3 w-3 mr-1" />Read</Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={items.length === 0} className="h-7 px-2 text-xs"><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No notifications yet.</div>
          ) : items.map((n) => (
            <button
              key={n.id}
              onClick={() => openItem(n)}
              className={cn(
                "w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors flex gap-2",
                !n.read_at && "bg-accent/5",
              )}
            >
              <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", !n.read_at ? "bg-destructive" : "bg-transparent")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
