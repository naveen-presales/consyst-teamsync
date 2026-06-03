import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth, type Role } from "@/lib/auth";
import { deleteUser } from "@/lib/users.functions";
import { notify } from "@/lib/notify";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { isAdmin, isVp, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteUserFn = useServerFn(deleteUser);

  useEffect(() => { if (!isAdmin && !isVp) navigate({ to: "/dashboard" }); }, [isAdmin, isVp]);

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
    if (user && id !== user.id) {
      await notify({
        recipient_id: id, actor_id: user.id, type: "account_status",
        title: status === "approved" ? "Account approved" : status === "rejected" ? "Account rejected" : "Account set to pending",
        body: status === "approved" ? "You now have access to TeamSync." : status === "rejected" ? "Your access request was rejected." : null,
        link: status === "approved" ? "/dashboard" : null,
      });
    }
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
    if (user && userId !== user.id) {
      await notify({
        recipient_id: userId, actor_id: user.id, type: "role_change",
        title: on ? `Role added: ${role}` : `Role removed: ${role}`,
        body: null, link: "/dashboard",
      });
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
                          <label key={r} className={`flex items-center gap-1.5 text-xs ${!isAdmin ? "opacity-60" : ""}`}>
                            <Checkbox
                              checked={roles.includes(r)}
                              disabled={!isAdmin}
                              onCheckedChange={(v) => toggleRole(p.id, r, !!v)}
                            />
                            {r}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {p.status !== "approved" && <Button size="sm" onClick={() => setStatus(p.id, "approved")}>Approve</Button>}
                        {p.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "rejected")}>Reject</Button>}
                        {p.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setPendingDelete({ id: p.id, label: p.full_name || p.email || "this user" })}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              All data related to the account, including any data created within this app, will be permanently deleted from the database. This action is irreversible and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingDelete) return;
                setDeleting(true);
                try {
                  await deleteUserFn({ data: { userId: pendingDelete.id } });
                  toast.success("User deleted");
                  setPendingDelete(null);
                  qc.invalidateQueries({ queryKey: ["admin-profiles"] });
                  qc.invalidateQueries({ queryKey: ["admin-roles"] });
                } catch (err: any) {
                  toast.error(err?.message || "Failed to delete user");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
