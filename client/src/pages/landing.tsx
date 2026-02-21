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
  Clock,
  CheckCircle,
  Heart,
  GraduationCap,
  Wand2,
  Compass,
  Crown,
  Shield,
  Play
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { motion } from "framer-motion";
import everdiceBackground from "@assets/image_1768599782346.png";
import GuestQuickPlay from "@/components/GuestQuickPlay";

export default function LandingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [userCount, setUserCount] = useState(0);
  const [showGuestPlay, setShowGuestPlay] = useState(false);
  const [hasPlayedAsGuest, setHasPlayedAsGuest] = useState(false);
  
  useEffect(() => {
    const guestPlayed = localStorage.getItem('everdice_guest_played');
    setHasPlayedAsGuest(!!guestPlayed);
  }, []);
  
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const response = await fetch('/api/user-stats');
        if (response.ok) {
          const data = await response.json();
          setUserCount(data.totalRegistered || 0);
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
      }
    };
    fetchUserStats();
  }, []);
  
  const handleGuestPlayComplete = () => {
    localStorage.setItem('everdice_guest_played', 'true');
    setShowGuestPlay(false);
    setLocation('/hearth?welcome=guest');
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
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent leading-tight tracking-tight">
                Play D&D without the friction.
              </h1>
              
              <p 
                className="text-xl leading-relaxed mb-4 max-w-[640px] mx-auto font-medium"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                Solo. With friends. Or as the Dungeon Master.
              </p>

              <p 
                className="text-base mb-6 max-w-[600px] mx-auto leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                Everdice helps you start and keep playing Dungeons & Dragons without prep overload, social pressure, or complicated virtual tabletops.
              </p>

              <p 
                className="text-sm font-medium mb-8"
                style={{ color: '#E6C77A' }}
              >
                Beginner-friendly. DM-respectful. Free during beta.
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
                      {hasPlayedAsGuest ? "Sign Up to Keep Playing" : "Start Your Adventure"}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground/70">
                      {hasPlayedAsGuest 
                        ? "You've tried the demo! Create a free account to continue your adventures."
                        : "Try a quick adventure right now. Create an account later if you like it."}
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
                
                {!user && (
                  <p className="text-sm text-muted-foreground/80 mt-2">
                    Safe for families &bull; You stay in control &bull; No cost to try
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* The Core Problem */}
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
          <p className="text-muted-foreground leading-relaxed mb-6">
            They stop because:
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-8">
            {[
              "Scheduling gets hard",
              "Prep becomes overwhelming",
              "Story details get lost",
              "New players feel intimidated"
            ].map((reason) => (
              <div key={reason} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                {reason}
              </div>
            ))}
          </div>
          <p className="text-foreground leading-relaxed font-medium mb-2">
            Everdice removes those barriers.
          </p>
          <div className="text-muted-foreground text-sm leading-relaxed space-y-1">
            <p>You can play solo to learn.</p>
            <p>Invite friends when you're ready.</p>
            <p>Step into the DM role with structure that supports you without taking over.</p>
          </div>
        </motion.div>
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

      {/* What Everdice Actually Does */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-4">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              What Everdice Actually Does
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed mb-2">
              Everdice isn't a replacement for D&D.
            </p>
            <p className="text-foreground font-medium max-w-xl mx-auto leading-relaxed mb-8">
              It's a memory engine for your campaign.
            </p>
          </div>

          <p className="text-center text-muted-foreground mb-6">It keeps track of:</p>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {[
              "Characters and progression",
              "Combat and initiative",
              "Quests and inventory",
              "NPCs and locations",
              "Spell slots and abilities",
              "Session notes and recaps"
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50">
                <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>

          <div className="text-center space-y-1 text-muted-foreground">
            <p className="text-foreground font-medium">You tell the story.</p>
            <p>Everdice handles the bookkeeping.</p>
          </div>
        </motion.div>
      </section>

      {/* Campaigns That Remember */}
      <section className="py-16 bg-gradient-to-b from-amber-950/10 to-transparent">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <Sparkles className="h-10 w-10 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Campaigns That Remember
            </h2>
            <p className="text-foreground font-medium mb-6">Your world persists.</p>
            <div className="space-y-2 text-muted-foreground mb-6">
              <p>Characters grow.</p>
              <p>Choices matter.</p>
              <p>Story threads don't disappear.</p>
            </div>
            <p className="text-foreground font-medium">
              Pick up right where you left off.
            </p>
          </motion.div>
        </div>
      </section>

      {/* For Dungeon Masters */}
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
                  <p className="text-muted-foreground mb-4">
                    You don't need experience.
                  </p>
                  <p className="text-muted-foreground mb-6">
                    Guided setup walks you through:
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { icon: Sparkles, text: "Creating your scenario" },
                      { icon: Users, text: "Adding NPCs" },
                      { icon: Map, text: "Setting the scene" },
                      { icon: Play, text: "Starting play" }
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="h-4 w-4 text-purple-400" />
                        {text}
                      </div>
                    ))}
                  </div>

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

      {/* Discord Integration */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#5865F2]/10 text-[#5865F2] px-3 py-1 rounded-full text-sm font-medium mb-4">
              <SiDiscord className="h-4 w-4" />
              Optional Integration
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Play Where Your Group Already Is
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] font-bold text-lg">
                1
              </div>
              <h3 className="font-semibold mb-2">Build in Everdice</h3>
              <p className="text-sm text-muted-foreground">
                Build your campaign in Everdice.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] font-bold text-lg">
                2
              </div>
              <h3 className="font-semibold mb-2">Link to Discord</h3>
              <p className="text-sm text-muted-foreground">
                Link to your Discord server.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] font-bold text-lg">
                3
              </div>
              <h3 className="font-semibold mb-2">Play Naturally</h3>
              <p className="text-sm text-muted-foreground">
                Chat and voice stay in Discord. Everdice keeps the campaign coherent.
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            No lock-in. No workflow disruption.
          </p>
        </motion.div>
      </section>

      {/* Built for Real People */}
      <section className="py-16 bg-gradient-to-b from-amber-950/20 to-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              Built for Real People
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: Heart,
                title: "Parents",
                description: "Safe, ad-free collaborative storytelling.",
                color: "text-rose-400"
              },
              {
                icon: GraduationCap,
                title: "Teachers & Clubs",
                description: "Structured creative play and teamwork.",
                color: "text-blue-400"
              },
              {
                icon: Wand2,
                title: "First-Time DMs",
                description: "Guidance without losing control.",
                color: "text-purple-400"
              }
            ].map((block, i) => (
              <motion.div
                key={block.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-card border border-border mb-4 ${block.color}`}>
                  <block.icon className="h-7 w-7" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{block.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {block.description}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-muted-foreground mt-8"
          >
            No public exposure. No social pressure.
          </motion.p>
        </div>
      </section>

      {/* A Living World */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-amber-500/10 border-primary/20">
          <CardContent className="p-8 md:p-12 text-center">
            <Map className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              A Living World (Optional)
            </h2>
            <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
              Everdice includes a ready-to-use shared world.
            </p>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto text-sm">
              Use it as written. Remix it. Or ignore it entirely. The structure is there if you want it.
            </p>
            <Link href="/world-map">
              <Button variant="outline" size="lg">
                Explore the World
                <Map className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 pb-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Begin?</h2>
          <p className="text-muted-foreground mb-8">
            {user 
              ? "Continue your epic adventures." 
              : "Create a free account to save your progress and unlock full features."}
          </p>
          {!user && !hasPlayedAsGuest && (
            <Button 
              size="lg" 
              onClick={handleGuestPlayStart}
              className="text-lg px-10 py-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Your Adventure
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
          {userCount > 0 && (
            <p className="text-sm text-muted-foreground mt-6">
              {userCount.toLocaleString()} adventurers have joined. Be one of the first to shape what this becomes.
            </p>
          )}
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
