import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { WhatsNewCards } from "@/components/whats-new/WhatsNew";
import { RELEASE_TITLE } from "@shared/whatsNew";

/** Public page, so a Discord post or email can link straight to it. */
export default function WhatsNewPage() {
  const { user } = useAuth();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-serif text-3xl text-amber-200">{RELEASE_TITLE}</h1>
      <p className="mt-2 text-stone-300">
        Everdice teaches real D&D by playing it. Here's what's new, and some fun ways to try it, alone or with friends.
      </p>
      <div className="mt-6"><WhatsNewCards /></div>
      <div className="mt-8 flex flex-wrap gap-3">
        {user ? (
          <Link href="/campaigns"><Button>Back to your campaigns</Button></Link>
        ) : (
          <>
            <Link href="/auth"><Button>Start playing free</Button></Link>
            <Link href="/how-it-works"><Button variant="outline">How it works</Button></Link>
          </>
        )}
      </div>
    </main>
  );
}
