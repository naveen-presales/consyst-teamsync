import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { signUpUser } from "@/lib/signup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import consystLogo from "@/assets/consyst-logo.png";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const signUp = useServerFn(signUpUser);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@consyst\.biz$/i.test(email.trim())) {
      return toast.error("invalid credentials");
    }
    setLoading(true);
    try {
      const res = await signUp({ data: { email: email.trim(), password, fullName } });
      if (res.firstUser) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) {
          toast.error(signInErr.message);
          setLoading(false);
          return;
        }
        toast.success("Welcome, admin");
        navigate({ to: "/dashboard" });
      } else {
        toast.success("Account created. Awaiting admin approval.");
        navigate({ to: "/login" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="w-full max-w-sm p-7">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src={consystLogo} alt="Consyst" className="h-10 w-auto object-contain" />
          <div className="text-center">
            <div className="font-semibold leading-tight">Request access</div>
            <div className="text-xs text-muted-foreground">First user becomes admin</div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-5">
          Have an account? <Link to="/login" className="text-accent underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
