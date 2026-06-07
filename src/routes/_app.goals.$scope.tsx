import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, ArrowLeft, Pencil, Trash2, User as UserIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, addMonths, isBefore, isAfter, isEqual } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/goals/$scope")({ component: ScopePage });

type Scope = "team" | "department" | "individual";
type Measurement = "numeric" | "percentage" | "currency" | "boolean";
type Operator = "gte" | "gt" | "eq" | "lte" | "lt";

interface Goal {
  id: string;
  scope: Scope;
  owner_id: string | null;
  title: string;
  description: string | null;
  target_metric: string | null;
  measurement_type: Measurement;
  operator: Operator;
  target_value: number;
  start_date: string;
  due_date: string;
  duration: string | null;
  created_by: string;
}

interface Progress {
  id: string;
  goal_id: string;
  period_month: string;
  value: number;
  note: string | null;
}

const OP_LABEL: Record<Operator, string> = {
  gte: "≥ (at least)",
  gt: "> (more than)",
  eq: "= (exactly)",
  lte: "≤ (at most)",
  lt: "< (less than)",
};

const MEAS_LABEL: Record<Measurement, string> = {
  numeric: "Numeric",
  percentage: "Percentage",
  currency: "Currency",
  boolean: "Yes/No",
};

function formatValue(v: number, m: Measurement) {
  if (m === "percentage") return `${v}%`;
  if (m === "currency") return `$${v.toLocaleString()}`;
  if (m === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function ScopePage() {
  const { scope } = useParams({ from: "/_app/goals/$scope" });
  const validScope = (["team", "department", "individual"] as Scope[]).includes(scope as Scope)
    ? (scope as Scope)
    : null;
  const { user, isVp, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const canManage =
    validScope === "individual"
      ? true
      : isVp || isAdmin;

  const title =
    validScope === "team"
      ? "Team Goals"
      : validScope === "department"
        ? "Department Goals"
        : "My Goals";

  const goalsQ = useQuery({
    enabled: !!validScope,
    queryKey: ["goals", validScope, user?.id],
    queryFn: async () => {
      let q = supabase.from("goals").select("*").eq("scope", validScope!);
      if (validScope === "individual") q = q.eq("owner_id", user!.id);
      const { data } = await q.order("created_at", { ascending: false });
      return (data ?? []) as Goal[];
    },
  });

  const goalIds = (goalsQ.data ?? []).map((g) => g.id);
  const progressQ = useQuery({
    enabled: goalIds.length > 0,
    queryKey: ["goal-progress", goalIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("goal_progress")
        .select("*")
        .in("goal_id", goalIds);
      return (data ?? []) as Progress[];
    },
  });

  const ownerIds = (goalsQ.data ?? [])
    .map((g) => g.owner_id)
    .filter((x): x is string => !!x);
  const ownersQ = useQuery({
    enabled: ownerIds.length > 0,
    queryKey: ["goal-owners", ownerIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ownerIds);
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const filtered = (goalsQ.data ?? []).filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase()),
  );

  if (!validScope) {
    return <div className="p-6">Unknown goal scope.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/goals">
            <ArrowLeft className="h-4 w-4" /> Goals
          </Link>
        </Button>
      </div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {canManage ? "Create and track goals." : "View-only access."}
          </p>
        </div>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> New{" "}
                {validScope === "individual" ? "Individual" : validScope === "team" ? "Team" : "Department"}{" "}
                Goal
              </Button>
            </DialogTrigger>
            <GoalFormDialog
              scope={validScope}
              onClose={() => setCreateOpen(false)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["goals"] })}
            />
          </Dialog>
        )}
      </header>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-4">
        {goalsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!goalsQ.isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No goals yet.</Card>
        )}
        {filtered.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            progress={(progressQ.data ?? []).filter((p) => p.goal_id === g.id)}
            owner={(ownersQ.data ?? []).find((o) => o.id === g.owner_id) ?? null}
            canManage={canManage && (validScope !== "individual" || g.owner_id === user?.id)}
            onEdit={() => setEditing(g)}
            onDeleted={() => {
              qc.invalidateQueries({ queryKey: ["goals"] });
              qc.invalidateQueries({ queryKey: ["goal-progress"] });
            }}
            onProgressSaved={() => qc.invalidateQueries({ queryKey: ["goal-progress"] })}
          />
        ))}
      </div>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <GoalFormDialog
            scope={validScope}
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => qc.invalidateQueries({ queryKey: ["goals"] })}
          />
        </Dialog>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  progress,
  owner,
  canManage,
  onEdit,
  onDeleted,
  onProgressSaved,
}: {
  goal: Goal;
  progress: Progress[];
  owner: { id: string; full_name: string | null; email: string | null } | null;
  canManage: boolean;
  onEdit: () => void;
  onDeleted: () => void;
  onProgressSaved: () => void;
}) {
  const months = useMemo(() => {
    const start = startOfMonth(parseISO(goal.start_date));
    const end = startOfMonth(parseISO(goal.due_date));
    const out: Date[] = [];
    let cur = start;
    while (isBefore(cur, end) || isEqual(cur, end)) {
      out.push(cur);
      cur = addMonths(cur, 1);
      if (out.length > 36) break;
    }
    return out;
  }, [goal.start_date, goal.due_date]);

  const latest = progress
    .slice()
    .sort((a, b) => (a.period_month < b.period_month ? 1 : -1))[0];

  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [valDraft, setValDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  const startEdit = (monthIso: string) => {
    const existing = progress.find((p) => p.period_month === monthIso);
    setValDraft(existing ? String(existing.value) : "");
    setNoteDraft(existing?.note ?? "");
    setEditingMonth(monthIso);
  };

  const saveProgress = useMutation({
    mutationFn: async () => {
      if (!editingMonth) return;
      const num = Number(valDraft);
      if (Number.isNaN(num)) throw new Error("Enter a valid number");
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const existing = progress.find((p) => p.period_month === editingMonth);
      if (existing) {
        const { error } = await supabase
          .from("goal_progress")
          .update({ value: num, note: noteDraft || null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goal_progress").insert({
          goal_id: goal.id,
          period_month: editingMonth,
          value: num,
          note: noteDraft || null,
          created_by: uid,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Progress saved");
      setEditingMonth(null);
      onProgressSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("goals").delete().eq("id", goal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Goal deleted");
      onDeleted();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <div className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
            <UserIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">{goal.title}</h3>
              <Badge variant="secondary">{MEAS_LABEL[goal.measurement_type]}</Badge>
            </div>
            {goal.description && (
              <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Target</div>
            <div className="text-primary font-semibold">
              {OP_LABEL[goal.operator].split(" ")[0]}{" "}
              {formatValue(goal.target_value, goal.measurement_type)}
            </div>
            {goal.target_metric && (
              <div className="text-xs text-muted-foreground">{goal.target_metric}</div>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Deadline</div>
            <div className="font-semibold">{format(parseISO(goal.due_date), "d MMM yy")}</div>
            {goal.duration && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                {goal.duration}
              </Badge>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Latest</div>
            <div className="font-semibold">
              {latest ? formatValue(latest.value, goal.measurement_type) : "—"}
            </div>
          </div>
          {canManage && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm("Delete this goal?")) del.mutate();
                }}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="border-t bg-muted/30 p-5">
        <div className="text-sm font-semibold mb-3">Monthly Progress</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {months.map((m) => {
            const iso = format(m, "yyyy-MM-dd");
            const entry = progress.find((p) => p.period_month === iso);
            return (
              <div key={iso} className="text-center">
                <div className="text-[11px] text-muted-foreground">{format(m, "MMM yyyy")}</div>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => canManage && startEdit(iso)}
                  className="mt-1 w-full h-10 rounded-md border border-dashed bg-background hover:bg-accent text-sm font-medium grid place-items-center transition-colors disabled:opacity-60"
                  title={entry?.note ?? ""}
                >
                  {entry ? formatValue(entry.value, goal.measurement_type) : "+"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {owner && (
        <div className="border-t px-5 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <UserIcon className="h-3.5 w-3.5" /> Owner: {owner.full_name || owner.email}
        </div>
      )}

      {editingMonth && (
        <Dialog open onOpenChange={(o) => !o && setEditingMonth(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Progress — {format(parseISO(editingMonth), "MMM yyyy")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Value</Label>
                {goal.measurement_type === "boolean" ? (
                  <Select value={valDraft} onValueChange={setValDraft}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Yes</SelectItem>
                      <SelectItem value="0">No</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    step="any"
                    value={valDraft}
                    onChange={(e) => setValDraft(e.target.value)}
                  />
                )}
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingMonth(null)}>
                Cancel
              </Button>
              <Button onClick={() => saveProgress.mutate()} disabled={saveProgress.isPending}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function GoalFormDialog({
  scope,
  initial,
  onClose,
  onSaved,
}: {
  scope: Scope;
  initial?: Goal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetMetric, setTargetMetric] = useState(initial?.target_metric ?? "");
  const [measurement, setMeasurement] = useState<Measurement>(initial?.measurement_type ?? "numeric");
  const [operator, setOperator] = useState<Operator>(initial?.operator ?? "gte");
  const [targetValue, setTargetValue] = useState(
    initial ? String(initial.target_value) : "",
  );
  const [startDate, setStartDate] = useState(
    initial?.start_date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [dueDate, setDueDate] = useState(
    initial?.due_date ?? format(addMonths(new Date(), 3), "yyyy-MM-dd"),
  );
  const [duration, setDuration] = useState(initial?.duration ?? "Custom");

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      const num = Number(targetValue);
      if (Number.isNaN(num)) throw new Error("Target value must be a number");
      const payload = {
        scope,
        owner_id: scope === "individual" ? user!.id : null,
        title: title.trim(),
        description: description.trim() || null,
        target_metric: targetMetric.trim() || null,
        measurement_type: measurement,
        operator,
        target_value: num,
        start_date: startDate,
        due_date: dueDate,
        duration: duration || null,
      };
      if (initial) {
        const { error } = await supabase.from("goals").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("goals")
          .insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Goal updated" : "Goal created");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit Goal" : "New Goal"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <Label>Target Metric (Display)</Label>
          <Input
            value={targetMetric}
            onChange={(e) => setTargetMetric(e.target.value)}
            placeholder="e.g., OP = 15%+"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Measurement Type</Label>
            <Select value={measurement} onValueChange={(v) => setMeasurement(v as Measurement)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numeric">Numeric</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="currency">Currency</SelectItem>
                <SelectItem value="boolean">Yes/No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Operator</Label>
            <Select value={operator} onValueChange={(v) => setOperator(v as Operator)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gte">≥ (at least)</SelectItem>
                <SelectItem value="gt">&gt; (more than)</SelectItem>
                <SelectItem value="eq">= (exactly)</SelectItem>
                <SelectItem value="lte">≤ (at most)</SelectItem>
                <SelectItem value="lt">&lt; (less than)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Target Value *</Label>
          <Input
            type="number"
            step="any"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date *</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Monthly">Monthly</SelectItem>
              <SelectItem value="Quarterly">Quarterly</SelectItem>
              <SelectItem value="Half-yearly">Half-yearly</SelectItem>
              <SelectItem value="Yearly">Yearly</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {initial ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
