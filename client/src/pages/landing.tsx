import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { 
  Sparkles, 
  Users, 
  BookOpen, 
  ArrowRight, 
  Map,
  Zap,
  CheckCircle,
  Wand2,
  Compass,
  Crown,
  Shield,
  Play,
  Brain,
  Swords,
  ScrollText
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { motion } from "framer-motion";
import everdiceBackground from "@assets/image_1768599782346.png";
import GuestQuickPlay from "@/components/GuestQuickPlay";

export default function LandingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showGuestPlay, setShowGuestPlay] = useState(false);
  const [hasPlayedAsGuest, setHasPlayedAsGuest] = useState(false);
  
  useEffect(() => {
    const guestPlayed = localStorage.getItem('everdice_guest_played');
    setHasPlayedAsGuest(!!guestPlayed);
  }, []);
  
  const handleGuestPlayComplete = () => {
    localStorage.setItem('everdice_guest_played', 'true');
    setShowGuestPlay(false);
    setLocation('/auth?from=demo');
  };
  
  const handleGuestPlayStart = () => {
    if (hasPlayedAsGuest) {
      setLocation('/auth');
    } else {
      setShowGuestPlay(true);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        className="relative min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: `url(${everdiceBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
        
        <div className="container mx-auto px-4 py-24 relative z-10">
          <div className="max-w-[720px] mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p 
                className="text-base mb-5 italic max-w-[500px] mx-auto"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                Open a door. Roll the dice. See what happens next.
              </p>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent leading-tight tracking-tight">
                Play D&D without scheduling stress, prep overload, or lost story threads.
              </h1>
              
              <p 
                className="text-xl leading-relaxed mb-4 max-w-[640px] mx-auto font-medium"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                Solo. With friends. Or as the Dungeon Master.
              </p>

              <p 
                className="text-sm font-medium mb-8"
                style={{ color: '#E6C77A' }}
              >
                Early beta. Feedback shapes the system. Free to play.
              </p>

              <div className="flex flex-col items-center gap-4">
                {user ? (
                  <Link href="/dashboard">
                    <Button 
                      size="lg" 
                      className="text-base px-8 py-6 font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25"
                    >
                      Continue Your Adventure
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Button 
                      size="lg" 
                      onClick={handleGuestPlayStart}
                      className="text-lg px-10 py-7 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/30 animate-pulse hover:animate-none"
                    >
                      <Play className="mr-2 h-6 w-6" />
                      {hasPlayedAsGuest ? "Sign Up to Keep Playing" : "Run the 2-Minute Demo"}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground/70">
                      {hasPlayedAsGuest 
                        ? "You've tried the demo! Create a free account to continue your adventures."
                        : "No signup required. Jump straight into a quest."}
                    </p>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <Link href="/auth">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-sm border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        >
                          Already have an account? Sign in
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Memory Engine — Core Differentiator */}
      <section className="py-20 bg-gradient-to-b from-amber-950/15 to-transparent">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <Brain className="h-10 w-10 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Everdice is a memory engine for your campaign.
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
              It tracks consequences so you don't have to.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
              {[
                "Characters and progression",
                "Quests and unresolved threads",
                "NPC relationships",
                "Combat and initiative",
                "Spell slots and inventory",
                "Session summaries"
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50">
                  <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-foreground font-medium">You make the rulings. You decide what happens.</p>
              <p className="text-muted-foreground">Everdice remembers.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How You Want to Play */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Start Where You Are
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0 }}
          >
            <Link href={user ? "/dashboard" : "/auth"}>
              <Card className="h-full cursor-pointer group hover:shadow-xl transition-all duration-300 border-2 hover:border-emerald-500/50 bg-gradient-to-b from-emerald-500/5 to-transparent">
                <CardContent className="pt-8 pb-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Compass className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Play Solo</h3>
                  <p className="text-muted-foreground text-sm">
                    Learn through story and exploration. No audience. No pressure.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Link href={user ? "/dashboard" : "/auth"}>
              <Card className="h-full cursor-pointer group hover:shadow-xl transition-all duration-300 border-2 hover:border-amber-500/50 bg-gradient-to-b from-amber-500/5 to-transparent">
                <CardContent className="pt-8 pb-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Play Together</h3>
                  <p className="text-muted-foreground text-sm">
                    Invite friends or family. Run co-op adventures at your pace.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link href={user ? "/dm-toolkit" : "/auth"}>
              <Card className="h-full cursor-pointer group hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-500/50 bg-gradient-to-b from-purple-500/5 to-transparent">
                <CardContent className="pt-8 pb-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Crown className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Run Games</h3>
                  <p className="text-muted-foreground text-sm">
                    Become the Dungeon Master with guided setup that respects your authority.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Quick Demo CTA */}
      {!user && (
        <section className="container mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-xl mx-auto text-center"
          >
            <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
              <CardContent className="p-8">
                <Swords className="h-8 w-8 mx-auto mb-3 text-emerald-400" />
                <h3 className="text-xl font-bold mb-2">See it in action</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  No forms. No setup. Just play.
                </p>
                <Button 
                  size="lg" 
                  onClick={handleGuestPlayStart}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25"
                >
                  <Play className="mr-2 h-5 w-5" />
                  {hasPlayedAsGuest ? "Sign Up to Continue" : "Try the Demo"}
                </Button>
                <p className="text-xs text-muted-foreground/60 mt-3">No signup required.</p>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      )}

      {/* For Dungeon Masters — 5-Minute Promise */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Card className="max-w-4xl mx-auto bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-500/5 border-purple-500/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <CardContent className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-sm font-medium mb-4">
                    <Zap className="h-4 w-4" />
                    For Dungeon Masters
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-4">
                    Run Your First Session in 5 Minutes
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    No experience required. Guided setup walks you through defining your scenario, adding NPCs, setting the opening scene, and starting play.
                  </p>

                  <p className="text-foreground font-medium mb-6">
                    No railroading. No AI takeover. You stay the DM.
                  </p>

                  <Link href={user ? "/dm-toolkit" : "/auth"}>
                    <Button size="lg" className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/25">
                      <Zap className="h-5 w-5 mr-2" />
                      Try DM Mode
                    </Button>
                  </Link>
                </div>
                
                <div className="hidden md:block w-48 text-center">
                  <div className="w-32 h-32 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/20">
                    <BookOpen className="h-16 w-16 text-purple-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Why Campaigns Fade — moved down, concise */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Why Most Campaigns Fade
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-6">
            People don't stop playing D&D because they stop loving it.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-8">
            {[
              "Prep takes too long",
              "Notes get messy",
              "NPCs disappear",
              "Consequences get forgotten"
            ].map((reason) => (
              <div key={reason} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                {reason}
              </div>
            ))}
          </div>
          <p className="text-foreground leading-relaxed font-medium">
            Everdice acts as your campaign's memory. It tracks what changes — so you don't have to.
          </p>
        </motion.div>
      </section>

      {/* Discord Integration — compact */}
      <section className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Card className="bg-gradient-to-r from-[#5865F2]/10 to-[#5865F2]/5 border-[#5865F2]/20">
            <CardContent className="p-8 text-center">
              <SiDiscord className="h-8 w-8 mx-auto mb-3 text-[#5865F2]" />
              <h3 className="text-xl font-bold mb-2">Works With Discord</h3>
              <p className="text-muted-foreground text-sm mb-1">
                Build your campaign here. Run sessions in Discord. Keep chat and voice where your group already is.
              </p>
              <p className="text-xs text-muted-foreground/60">No lock-in. No forced workflow.</p>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* A Living World */}
      <section className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Card className="max-w-3xl mx-auto bg-gradient-to-r from-primary/10 to-amber-500/10 border-primary/20">
            <CardContent className="p-8 text-center">
              <Map className="h-10 w-10 mx-auto mb-3 text-amber-500" />
              <h3 className="text-xl font-bold mb-2">A Living World (Optional)</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-xl mx-auto">
                Everdice includes a ready-to-use shared world. Use it as written. Remix it. Or ignore it entirely.
              </p>
              <Link href="/world-map">
                <Button variant="outline" size="sm">
                  Explore the World
                  <Map className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 pb-24">
        <div className="max-w-2xl mx-auto text-center">
          <ScrollText className="h-10 w-10 mx-auto mb-4 text-amber-500" />
          <h2 className="text-3xl font-bold mb-3">Your campaign deserves a memory.</h2>
          <p className="text-muted-foreground mb-8">
            {user 
              ? "Continue your epic adventures." 
              : "Run a quick demo and see what happens when consequences persist."}
          </p>
          {!user && !hasPlayedAsGuest && (
            <Button 
              size="lg" 
              onClick={handleGuestPlayStart}
              className="text-lg px-10 py-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Play className="mr-2 h-5 w-5" />
              Run the 2-Minute Demo
            </Button>
          )}
          {!user && hasPlayedAsGuest && (
            <Link href="/auth">
              <Button size="lg" className="text-lg px-10 py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
          {user && (
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-10 py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                Go to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
          <p className="text-sm text-muted-foreground/60 mt-6">
            Early beta. Feedback shapes the system.
          </p>
        </div>
      </section>

      {/* Guest Quick Play Modal */}
      {showGuestPlay && (
        <GuestQuickPlay 
          onComplete={handleGuestPlayComplete}
          onCancel={() => setShowGuestPlay(false)}
        />
      )}
    </div>
  );
}
