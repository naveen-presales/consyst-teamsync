import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/pending")({ component: PendingPage });

function PendingPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const rejected = profile?.status === "rejected";

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted grid place-items-center mb-4">
          {rejected ? <XCircle className="h-6 w-6 text-destructive" /> : <Clock className="h-6 w-6 text-accent" />}
        </div>
        <h1 className="text-lg font-semibold">{rejected ? "Access denied" : "Waiting for approval"}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {rejected
            ? "An admin has rejected your access request. Contact your administrator."
            : "Your account is pending review. An admin will approve your access shortly."}
        </p>
        <Button variant="outline" className="mt-5" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
