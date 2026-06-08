import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import consystLogo from "@/assets/consyst-logo.png";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Always attempt reset; never reveal whether the email is registered.
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Swallow errors to avoid account enumeration.
    } finally {
      setSent(true);
      toast.success("If an account exists for that email, a reset link has been sent.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="w-full max-w-sm p-7">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src={consystLogo} alt="Consyst" className="h-10 w-auto object-contain" />
          <div className="text-center">
            <div className="font-semibold leading-tight">Forgot password</div>
            <div className="text-xs text-muted-foreground">
              We'll email you a reset link valid for 3 minutes
            </div>
          </div>
        </div>
        {sent ? (
          <div className="text-sm text-center space-y-3">
            <p>Check your inbox for the reset link.</p>
            <p className="text-xs text-muted-foreground">
              The link will stop working 3 minutes after you opened this request.
            </p>
            <Link to="/login" className="text-accent underline text-xs">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              <Link to="/login" className="text-accent underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
