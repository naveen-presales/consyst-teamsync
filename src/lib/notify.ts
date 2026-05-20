import { supabase } from "@/integrations/supabase/client";

export type NotifyInput = {
  recipient_id: string;
  actor_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  opportunity_id?: string | null;
  todo_id?: string | null;
};

export async function notify(input: NotifyInput | NotifyInput[]) {
  const rows = Array.isArray(input) ? input : [input];
  if (rows.length === 0) return;
  await supabase.from("notifications").insert(rows as any);
}

/** Returns user_ids that have admin or vp role. */
export async function getVpAdminIds(excludeId?: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["vp", "admin"]);
  const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id as string)));
  return excludeId ? ids.filter((id) => id !== excludeId) : ids;
}
