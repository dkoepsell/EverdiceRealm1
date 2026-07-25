import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Users, Users2, Flame, Search, ArrowRight } from "lucide-react";

import BulletinBoardPage from "./bulletin-board";
import GroupsPage from "./groups";

type CommunityTab = "find-a-game" | "guilds" | "hearth";

const VALID_TABS: CommunityTab[] = ["find-a-game", "guilds", "hearth"];

// Legacy deep links (/bulletin, /groups) redirect here with ?tab=...
function tabFromSearch(search: string): CommunityTab {
  const raw = new URLSearchParams(search).get("tab") as CommunityTab | null;
  return raw && VALID_TABS.includes(raw) ? raw : "find-a-game";
}

/**
 * The single Community destination.
 *
 * Playtest feedback: a new player signed up, went looking for "the forums", and
 * couldn't find them. The board existed at /bulletin but was labelled "Find
 * Groups", sat 10th of 11 items inside an unlabelled "More" dropdown, and was
 * linked from exactly one page in the app.
 *
 * "For forums, you want one thing which is people looking for a game to post to
 * find people to play with. That's the one that'll be most popular I think."
 * — so Find a Game is the default tab.
 *
 * The Hearth stays a separate full-viewport route: it's a deliberately immersive
 * fireside scene with its own background and presence overlays, and squeezing it
 * into a tab panel would break it. It gets a prominent card here instead.
 */
export default function CommunityPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [tab, setTab] = useState<CommunityTab>(() => tabFromSearch(search));

  useEffect(() => {
    setTab(tabFromSearch(search));
  }, [search]);

  const { data: invitations = [] } = useQuery<any[]>({
    queryKey: ["/api/invitations/pending"],
    enabled: !!user,
  });
  const pendingInvites = invitations.length;

  const { data: posts = [] } = useQuery<any[]>({
    queryKey: ["/api/bulletin"],
    enabled: !!user,
  });
  const openGames = posts.filter(
    (p: any) => (p.postType === "lfg" || p.postType === "lfp") && p.isActive !== false,
  ).length;

  const handleTabChange = (value: string) => {
    const next = (VALID_TABS as string[]).includes(value) ? (value as CommunityTab) : "find-a-game";
    setTab(next);
    setLocation(`/community?tab=${next}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <section className="relative bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900 py-8 md:py-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-3">
            <Users2 className="h-3 w-3" />
            <span>Community</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">
            Find people to play with
          </h1>
          <p className="text-white/60 max-w-2xl">
            Post that you're looking for a game, answer someone else's call, join a guild,
            or pull up a chair by the fire.
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            <Badge variant="outline" className="border-amber-500/30 text-amber-300">
              <Search className="h-3 w-3 mr-1" />
              {openGames} open {openGames === 1 ? "game" : "games"}
            </Badge>
            {pendingInvites > 0 && (
              <Badge className="bg-red-500 text-white">
                {pendingInvites} pending {pendingInvites === 1 ? "invite" : "invites"}
              </Badge>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger
              value="find-a-game"
              className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
              data-testid="tab-find-a-game"
            >
              <Search className="h-4 w-4 mr-2" />
              Find a Game
            </TabsTrigger>
            <TabsTrigger
              value="guilds"
              className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
              data-testid="tab-guilds"
            >
              <Users className="h-4 w-4 mr-2" />
              Guilds &amp; Parties
              {pendingInvites > 0 && (
                <Badge className="ml-2 bg-red-500 text-white text-xs h-5 px-1.5">
                  {pendingInvites}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="hearth"
              className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
              data-testid="tab-hearth"
            >
              <Flame className="h-4 w-4 mr-2" />
              The Hearth
            </TabsTrigger>
          </TabsList>

          <TabsContent value="find-a-game" className="mt-0">
            <BulletinBoardPage embedded />
          </TabsContent>

          <TabsContent value="guilds" className="mt-0">
            <GroupsPage embedded />
          </TabsContent>

          <TabsContent value="hearth" className="mt-0">
            <Card className="bg-slate-800/60 border-amber-700/40 overflow-hidden">
              <CardContent className="p-8 text-center">
                <Flame className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                <h2 className="text-2xl font-fantasy font-bold text-white mb-2">The Hearth</h2>
                <p className="text-slate-300 max-w-xl mx-auto mb-6">
                  The fireside common room — see who's around, leave a note on the board,
                  raise a toast, and catch up on news of the realm. It opens as a full-screen
                  scene.
                </p>
                <Link href="/hearth">
                  <Button className="bg-amber-600 hover:bg-amber-500 text-white" data-testid="button-open-hearth">
                    Enter the Hearth
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <p className="text-slate-400 text-sm mt-6">
                  Looking for players instead?{" "}
                  <button
                    className="text-amber-400 underline underline-offset-2"
                    onClick={() => handleTabChange("find-a-game")}
                  >
                    Post to Find a Game
                  </button>
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
