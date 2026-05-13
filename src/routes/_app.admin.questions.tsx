import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/admin/questions")({ component: AdminQuestions });

function AdminQuestions() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  useEffect(() => { if (!isAdmin) navigate({ to: "/dashboard" }); }, [isAdmin]);

  const qsQ = useQuery({
    queryKey: ["admin-rq"],
    queryFn: async () => {
      const { data } = await supabase.from("rating_questions").select("*").order("sort_order");
      return (data ?? []) as { id: string; text: string; sort_order: number; active: boolean }[];
    },
  });

  const add = async () => {
    if (!text.trim()) return;
    const order = (qsQ.data?.length ?? 0) + 1;
    const { error } = await supabase.from("rating_questions").insert({ text: text.trim(), sort_order: order });
    if (error) return toast.error(error.message);
    setText("");
    qc.invalidateQueries({ queryKey: ["admin-rq"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete question? Existing ratings will keep their answers.")) return;
    await supabase.from("rating_questions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-rq"] });
  };
  const toggle = async (id: string, active: boolean) => {
    await supabase.from("rating_questions").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-rq"] });
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Rating questions</h1>
        <p className="text-sm text-muted-foreground">Manage the questions VPs answer for each opportunity.</p>
      </header>

      <Card className="p-4 mb-4 flex gap-2">
        <Input placeholder="New question…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add}><Plus className="h-4 w-4 mr-1.5" /> Add</Button>
      </Card>

      <Card className="divide-y divide-border">
        {(qsQ.data ?? []).map((q) => (
          <div key={q.id} className="p-3 flex items-center gap-3">
            <span className={`flex-1 text-sm ${q.active ? "" : "text-muted-foreground line-through"}`}>{q.text}</span>
            <Button size="sm" variant="ghost" onClick={() => toggle(q.id, !q.active)}>{q.active ? "Disable" : "Enable"}</Button>
            <Button size="sm" variant="ghost" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        {(qsQ.data ?? []).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No questions yet.</div>}
      </Card>
    </div>
  );
}
