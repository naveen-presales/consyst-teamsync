import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import consystLogo from "@/assets/consyst-logo.png";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

const WINDOW_MS = 3 * 60 * 1000;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState(WINDOW_MS);
  const [issuedAt, setIssuedAt] = useState<number | null>(null);

  // Wait for Supabase to consume the recovery hash and establish a session.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        const token = session?.access_token;
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            // iat is in seconds; treat link as valid for 3 minutes from issuance.
            const iatMs = (payload.iat ?? Math.floor(Date.now() / 1000)) * 1000;
            setIssuedAt(iatMs);
          } catch {
            setIssuedAt(Date.now());
          }
        }
        setReady(true);
      }
    });
    // Fallback if session already loaded
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const token = data.session.access_token;
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setIssuedAt((payload.iat ?? Math.floor(Date.now() / 1000)) * 1000);
        } catch {
          setIssuedAt(Date.now());
        }
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (issuedAt == null) return;
    const tick = () => {
      const left = issuedAt + WINDOW_MS - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) setExpired(true);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [issuedAt]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expired) return toast.error("Reset link expired. Please request a new one.");
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="w-full max-w-sm p-7">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src={consystLogo} alt="Consyst" className="h-10 w-auto object-contain" />
          <div className="text-center">
            <div className="font-semibold leading-tight">Reset password</div>
            <div className="text-xs text-muted-foreground">
              {expired
                ? "This reset link has expired."
                : ready
                  ? `Link expires in ${mm}:${ss}`
                  : "Validating link…"}
            </div>
          </div>
        </div>

        {expired ? (
          <div className="text-center text-sm space-y-3">
            <p className="text-muted-foreground">
              For security, reset links are only valid for 3 minutes.
            </p>
            <Link to="/forgot-password" className="text-accent underline text-xs">
              Request a new link
            </Link>
          </div>
        ) : ready ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Open this page from the link in your email.
          </p>
        )}
      </Card>
    </div>
  );
}
