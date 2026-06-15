import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  fullName: z.string().min(1).max(255),
});

export const signUpUser = createServerFn({ method: "POST" })
  .inputValidator((input) => SignupSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@consyst\.biz$/i.test(email)) {
      throw new Error("invalid credentials");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countErr } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (countErr) throw new Error(countErr.message);

    const isFirstUser = (count ?? 0) === 0;

    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr) {
      const msg = /consyst\.biz|invalid credentials/i.test(createErr.message)
        ? "invalid credentials"
        : createErr.message;
      throw new Error(msg);
    }

    return { firstUser: isFirstUser };
  });
