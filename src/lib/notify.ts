import { supabase } from "@/integrations/supabase/client";

export type NotifyInput = {
  recipient_id: string;
  actor_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  opportunity_id?: string | null;
  
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

/** Assigned architects for an opportunity, optionally excluding one user id. */
export async function getAssignedArchitectIds(oppId: string, excludeId?: string): Promise<string[]> {
  const { data } = await supabase
    .from("opportunity_architects")
    .select("user_id")
    .eq("opportunity_id", oppId);
  const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id as string)));
  return excludeId ? ids.filter((id) => id !== excludeId) : ids;
}

/** Assigned architects + creator (deduped, optionally excluding actor). */
export async function getOppArchitectRecipients(
  oppId: string,
  createdBy: string | null | undefined,
  excludeId?: string,
): Promise<string[]> {
  const ids = new Set(await getAssignedArchitectIds(oppId));
  if (createdBy) ids.add(createdBy);
  if (excludeId) ids.delete(excludeId);
  return Array.from(ids);
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/** Delete the current user's notifications older than 14 days. */
export async function purgeOldNotifications(userId: string) {
  const cutoff = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();
  await supabase.from("notifications").delete().eq("recipient_id", userId).lt("created_at", cutoff);
}
