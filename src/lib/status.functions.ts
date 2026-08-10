import { createServerFn } from "@tanstack/react-start";

export const getStatusBoard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_status_board");
  if (error) throw new Error("Unable to load the status board");
  return (data ?? []) as unknown[];
});
