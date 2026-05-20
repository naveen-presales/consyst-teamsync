import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, Plus, Trash2, AlertTriangle, User, ArrowLeft, Target } from "lucide-react";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/_app/todos")({ component: TodosPage });

type Todo = {
  id: string;
  user_id: string;
  assigned_by: string | null;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};
type Profile = { id: string; full_name: string | null; email: string | null };

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function isBreached(t: Todo) {
  if (!t.assigned_by) return false;
  const end = t.completed_at ? new Date(t.completed_at).getTime() : Date.now();
  return end - new Date(t.created_at).getTime() > TWO_DAYS_MS;
}

function TodosPage() {
  const { user, isVp, isAdmin } = useAuth();
  const isManager = isVp || isAdmin;
  const [selectedArchitect, setSelectedArchitect] = useState<string | null>(null);

  if (isManager && !selectedArchitect) {
    return <ManagerOverview onSelect={setSelectedArchitect} />;
  }
  if (isManager && selectedArchitect) {
    return <ArchitectTodoView architectId={selectedArchitect} viewerId={user!.id} isManagerView onBack={() => setSelectedArchitect(null)} />;
  }
  return <ArchitectTodoView architectId={user!.id} viewerId={user!.id} />;
}

function ManagerOverview({ onSelect }: { onSelect: (id: string) => void }) {
  const architectsQ = useQuery({
    queryKey: ["todos-architects"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("role", "architect");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [] as Profile[];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return (profs ?? []) as Profile[];
    },
  });

  const todosQ = useQuery({
    queryKey: ["todos-all-assigned"],
    queryFn: async () => {
      const { data } = await supabase.from("todos").select("*").not("assigned_by", "is", null);
      return (data ?? []) as Todo[];
    },
  });

  const statsFor = (uid: string) => {
    const list = (todosQ.data ?? []).filter((t) => t.user_id === uid);
    const open = list.filter((t) => t.status !== "done").length;
    const done = list.filter((t) => t.status === "done").length;
    const breached = list.filter(isBreached).length;
    const completedDurations = list
      .filter((t) => t.status === "done" && t.completed_at)
      .map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60));
    const avgHours = completedDurations.length
      ? Math.round((completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length) * 10) / 10
      : null;
    const score = list.length ? Math.max(0, Math.round(((list.length - breached) / list.length) * 100)) : 100;
    return { total: list.length, open, done, breached, avgHours, score };
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">To-Do · Architect KPIs</h1>
        <p className="text-sm text-muted-foreground">Assign tasks to architects and track time-to-complete. Tasks over 2 days affect the metric.</p>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Architect</th>
                <th className="text-left px-4 py-2.5 font-medium">Assigned</th>
                <th className="text-left px-4 py-2.5 font-medium">Open</th>
                <th className="text-left px-4 py-2.5 font-medium">Done</th>
                <th className="text-left px-4 py-2.5 font-medium">Avg time</th>
                <th className="text-left px-4 py-2.5 font-medium">Breaches (&gt;2d)</th>
                <th className="text-left px-4 py-2.5 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {(architectsQ.data ?? []).map((a) => {
                const s = statsFor(a.id);
                return (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => onSelect(a.id)}>
                    <td className="px-4 py-2.5 font-medium">{a.full_name || a.email}</td>
                    <td className="px-4 py-2.5">{s.total}</td>
                    <td className="px-4 py-2.5">{s.open}</td>
                    <td className="px-4 py-2.5">{s.done}</td>
                    <td className="px-4 py-2.5">{s.avgHours !== null ? `${s.avgHours}h` : "—"}</td>
                    <td className="px-4 py-2.5">
                      {s.breached > 0 ? (
                        <span className="inline-flex items-center gap-1 text-destructive font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />{s.breached}
                        </span>
                      ) : s.breached}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-semibold ${s.score < 70 ? "text-destructive" : s.score < 90 ? "text-amber-600" : "text-success"}`}>{s.score}</span>
                    </td>
                  </tr>
                );
              })}
              {(architectsQ.data ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No architects yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ArchitectTodoView({ architectId, viewerId, isManagerView, onBack }: { architectId: string; viewerId: string; isManagerView?: boolean; onBack?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile", architectId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("id", architectId).single();
      return data as Profile;
    },
  });

  const todosQ = useQuery({
    queryKey: ["todos", architectId],
    queryFn: async () => {
      const { data } = await supabase.from("todos").select("*").eq("user_id", architectId).order("created_at", { ascending: false });
      return (data ?? []) as Todo[];
    },
  });

  const assigned = useMemo(() => (todosQ.data ?? []).filter((t) => t.assigned_by), [todosQ.data]);
  const self = useMemo(() => (todosQ.data ?? []).filter((t) => !t.assigned_by), [todosQ.data]);

  const toggleStatus = async (t: Todo) => {
    const nextDone = t.status !== "done";
    const patch: any = { status: nextDone ? "done" : "todo", completed_at: nextDone ? new Date().toISOString() : null };
    const { error } = await supabase.from("todos").update(patch).eq("id", t.id);
    if (error) return toast.error(error.message);
    if (nextDone && t.assigned_by && t.assigned_by !== t.user_id) {
      await notify({
        recipient_id: t.assigned_by, actor_id: t.user_id, type: "todo_completed",
        title: "Assigned task completed", body: t.title, link: "/todos", todo_id: t.id,
      });
    }
    qc.invalidateQueries({ queryKey: ["todos", architectId] });
    qc.invalidateQueries({ queryKey: ["todos-all-assigned"] });
  };

  const remove = async (t: Todo) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("todos").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["todos", architectId] });
    qc.invalidateQueries({ queryKey: ["todos-all-assigned"] });
  };

  // Architects: can self-add; can update VP-assigned status but not delete them
  // Managers viewing: can add assigned tasks
  const showAddSelf = !isManagerView;
  const showAddAssigned = isManagerView;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {isManagerView && (
        <button onClick={onBack} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> All architects
        </button>
      )}

      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isManagerView ? (profileQ.data?.full_name || profileQ.data?.email || "Architect") : "My To-Do"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isManagerView ? "Assign and review tasks. Tasks over 2 days affect the KPI." : "Your personal tasks and tasks assigned by VP."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> {showAddAssigned ? "Assign task" : "Add task"}</Button>
          </DialogTrigger>
          <NewTodoDialog
            architectId={architectId}
            viewerId={viewerId}
            assigned={!!showAddAssigned}
            onCreated={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["todos", architectId] });
              qc.invalidateQueries({ queryKey: ["todos-all-assigned"] });
            }}
          />
        </Dialog>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <TodoColumn
          title="Assigned by VP"
          icon={<Target className="h-4 w-4" />}
          items={assigned}
          onToggle={toggleStatus}
          onDelete={isManagerView ? remove : undefined}
          empty="No tasks assigned by VP."
          showBreach
        />
        <TodoColumn
          title="My self-added"
          icon={<User className="h-4 w-4" />}
          items={self}
          onToggle={toggleStatus}
          onDelete={!isManagerView || isManagerView ? remove : undefined}
          empty={showAddSelf ? "Add your first task to get started." : "No self-added tasks."}
        />
      </div>
    </div>
  );
}

function TodoColumn({ title, icon, items, onToggle, onDelete, empty, showBreach }: {
  title: string; icon: React.ReactNode; items: Todo[];
  onToggle: (t: Todo) => void; onDelete?: (t: Todo) => void;
  empty: string; showBreach?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-medium">{title}</h3>
        <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map((t) => {
          const done = t.status === "done";
          const breached = showBreach && isBreached(t);
          const ageHours = Math.round((Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60));
          return (
            <div key={t.id} className={`group flex items-start gap-2.5 p-2.5 rounded-md border ${breached && !done ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
              <button onClick={() => onToggle(t)} className="mt-0.5 shrink-0">
                {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {done && t.completed_at ? `Done in ${Math.round((new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60))}h` : `${ageHours}h open`}</span>
                  {t.due_at && <span>Due {new Date(t.due_at).toLocaleDateString()}</span>}
                  {breached && !done && (
                    <span className="inline-flex items-center gap-1 text-destructive font-medium">
                      <AlertTriangle className="h-3 w-3" /> Over 2 days
                    </span>
                  )}
                  {breached && done && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" /> KPI breach
                    </span>
                  )}
                </div>
              </div>
              {onDelete && (
                <button onClick={() => onDelete(t)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {items.length === 0 && <div className="text-xs text-muted-foreground p-3 text-center">{empty}</div>}
      </div>
    </Card>
  );
}

function NewTodoDialog({ architectId, viewerId, assigned, onCreated }: { architectId: string; viewerId: string; assigned: boolean; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const payload: any = {
      user_id: architectId,
      assigned_by: assigned ? viewerId : null,
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt || null,
      status: "todo",
    };
    const { error } = await supabase.from("todos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (assigned && architectId !== viewerId) {
      await notify({
        recipient_id: architectId, actor_id: viewerId, type: "todo_assigned",
        title: "New task assigned to you", body: title.trim(), link: "/todos",
      });
    }
    toast.success(assigned ? "Task assigned" : "Task added");
    setTitle(""); setDescription(""); setDueAt("");
    onCreated();
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{assigned ? "Assign a task" : "Add a task"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Due date</Label><Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
        {assigned && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            ⏱ Tasks completed in over 2 days will affect this architect's KPI score.
          </div>
        )}
        <DialogFooter>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : assigned ? "Assign" : "Add"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
