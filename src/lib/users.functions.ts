import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AccessStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "pending"]),
});

async function assertCanManageUsers(context: { supabase: any; userId: string }) {
  const { data: roles, error: rolesErr } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (rolesErr) throw new Error(rolesErr.message);
  const allowed = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "vp");
  if (!allowed) throw new Error("Not authorized");
}

export const setUserAccessStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AccessStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageUsers(context);

    if (data.status === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email_confirm: true,
      });
      if (confirmErr) throw new Error(confirmErr.message);
    }

    const { error } = await context.supabase
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const confirmApprovedUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageUsers(context);

    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("status", "approved");
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const profile of profiles ?? []) {
      const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
        email_confirm: true,
      });
      if (confirmErr) throw new Error(confirmErr.message);
    }

    return { ok: true, confirmed: profiles?.length ?? 0 };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId: callerId } = context;

    if (callerId === data.userId) {
      throw new Error("You cannot delete your own account");
    }

    await assertCanManageUsers(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
