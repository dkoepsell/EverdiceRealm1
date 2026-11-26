/**
 * One-shot nights: a guest is signed in only in this browser. This banner
 * offers to keep their hero (and everything they've done) by choosing a
 * username and password: POST /api/table/claim.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function GuestBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const claim = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/table/claim", { username, password, email })).json(),
    onSuccess: (u) => {
      queryClient.setQueryData(["/api/user"], u);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setOpen(false);
      toast({ title: "Saved!", description: "Your hero is yours to keep. Sign in anywhere with your new username." });
    },
    onError: (err: any) => toast({ title: "Couldn't save", description: err.message || "Something went wrong", variant: "destructive" }),
  });

  const isGuest = !!user && typeof user.username === "string" && user.username.startsWith("guest-");
  if (!isGuest) return null;

  return (
    <>
      <div className="relative z-20 border-b border-sky-500/30 bg-sky-900/30" data-testid="guest-banner">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-2 text-center text-sm text-sky-100">
          <span>You're playing as a guest in this browser. Keep your hero and come back any time:</span>
          <Button size="sm" className="h-8 gap-1" onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /> Save my character
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keep your hero</DialogTitle>
            <DialogDescription>Choose a username and password. Your character, campaign seat and progress all stay.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              claim.mutate();
            }}
          >
            <label className="block text-sm">
              Username
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={30} className="mt-1" />
            </label>
            <label className="block text-sm">
              Password (8+ characters)
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} className="mt-1" />
            </label>
            <label className="block text-sm">
              Email (optional, for occasional reminders)
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1" />
            </label>
            <Button type="submit" className="w-full" disabled={claim.isPending}>
              {claim.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save my account
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
