import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, type Role } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => { if (!isAdmin) navigate({ to: "/dashboard" }); }, [isAdmin]);

  const profilesQ = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, status").order("created_at", { ascending: false });
      return (data ?? []) as { id: string; full_name: string | null; email: string | null; status: string }[];
    },
  });
  const rolesQ = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return (data ?? []) as { user_id: string; role: Role }[];
    },
  });

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const toggleRole = async (userId: string, role: Role, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Approve access requests and manage roles.</p>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">User</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Roles</th>
                <th className="text-left px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(profilesQ.data ?? []).map((p) => {
                const roles = (rolesQ.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
                return (
                  <tr key={p.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === "approved" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        {(["admin", "architect", "vp"] as Role[]).map((r) => (
                          <label key={r} className="flex items-center gap-1.5 text-xs">
                            <Checkbox checked={roles.includes(r)} onCheckedChange={(v) => toggleRole(p.id, r, !!v)} />
                            {r}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {p.status !== "approved" && <Button size="sm" onClick={() => setStatus(p.id, "approved")}>Approve</Button>}
                        {p.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "rejected")}>Reject</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
