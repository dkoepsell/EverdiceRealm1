import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { 
  Sparkles, 
  Users, 
  Dice5, 
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
  MessageCircle,
  Shield
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { motion } from "framer-motion";
import everdiceBackground from "@assets/image_1768599782346.png";
import creatorAvatar from "@assets/image_1769476073776.png";

const features = [
  {
    icon: Sparkles,
    title: "Simple to Learn",
    description: "Start playing in minutes. No complex setup, no software tutorials, no pressure."
  },
  {
    icon: Dice5,
    title: "Real Dice, Real Imagination",
    description: "Roll physical dice. Talk freely. Improvise. Everdice quietly handles continuity and notes."
  },
  {
    icon: BookOpen,
    title: "Campaigns That Remember",
    description: "Characters persist. Stories don't vanish between sessions. Pick up right where you left off."
  },
  {
    icon: MessageCircle,
    title: "Works With Discord",
    description: "Build campaigns in Everdice, deploy to Discord. Chat stays there, continuity stays here."
  }
];

const audienceBlocks = [
  {
    icon: Heart,
    title: "For parents",
    description: "A safe, ad-free way to introduce kids to collaborative storytelling and imagination.",
    color: "text-rose-400"
  },
  {
    icon: GraduationCap,
    title: "For teachers and clubs",
    description: "A structured environment for teamwork, reading, and creative play.",
    color: "text-blue-400"
  },
  {
    icon: Wand2,
    title: "For first-time Dungeon Masters",
    description: "Guidance without loss of control. You stay the DM. Everdice just keeps things organized.",
    color: "text-purple-400"
  }
];

export default function LandingPage() {
  const { user } = useAuth();
  const [userCount, setUserCount] = useState(0);
  
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
                Play D&D your way — solo, together, or as a Dungeon Master.
              </h1>
              
              <p 
                className="text-lg leading-relaxed mb-4 max-w-[640px] mx-auto"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                Everdice helps people start and keep playing Dungeons & Dragons without pressure, prep overload, or complicated virtual tabletops.
              </p>

              <p 
                className="text-base mb-8 max-w-[580px] mx-auto"
                style={{ color: '#C9B896' }}
              >
                It works just as well for a first-ever adventure as it does for long-running campaigns that need continuity and structure.
              </p>

              <p 
                className="text-sm font-medium mb-6"
                style={{ color: '#E6C77A' }}
              >
                Beginner-friendly. DM-respectful. Free during beta.
              </p>

              <div className="flex flex-col items-center gap-3">
                <Link href={user ? "/dashboard" : "/auth"}>
                  <Button 
                    size="lg" 
                    className="text-base px-7 py-6 font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25"
                  >
                    {user ? "Continue Your Adventure" : "Start a Campaign"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                
                {!user && (
                  <p className="text-sm text-muted-foreground/80">
                    Safe for families • You stay in control • No cost to try
                  </p>
                )}
                
                {userCount > 0 && (
                  <div className="flex flex-wrap justify-center gap-3 mt-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                      <Users className="h-3 w-3" />
                      <span>{userCount.toLocaleString()} adventurers have joined</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Why Everdice Exists */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-6">
            Why Everdice Exists
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-4">
            Most people don't stop playing D&D because they don't love it.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            They stop because schedules clash, tables drift, or getting started feels harder than it should.
          </p>
          <p className="text-foreground leading-relaxed">
            Everdice is built to remove those barriers. You can play solo, learn the game at your own pace, bring friends in later, or step into the DM role when you're ready. The system supports you without taking over.
          </p>
        </motion.div>
      </section>

      {/* Choose How You Want to Play */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Choose How You Want to Play
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Most people begin solo. Many invite others on their second or third visit.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Solo */}
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
                  <p className="text-muted-foreground text-sm mb-4">
                    Learn D&D through story and play. No pressure. No audience. Just you, the world, and the dice.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Together */}
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
                  <p className="text-muted-foreground text-sm mb-4">
                    Run co-op adventures with friends or family. Invite your party when it makes sense.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Run Games */}
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
                  <p className="text-muted-foreground text-sm mb-4">
                    Try being the Dungeon Master with guided setup and structure that helps without railroading.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Built for Real Tables */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-sm font-medium mb-4">
              <Dice5 className="h-4 w-4" />
              Real Tables, Not Replacements
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Built for Real Tables, Not Replacements
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Everdice isn't a virtual tabletop and doesn't try to be one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {[
              "You roll physical dice",
              "You talk freely",
              "You improvise",
              "Stories don't vanish"
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/50">
                <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-muted-foreground">
            Everdice quietly handles continuity, notes, characters, and campaign memory so you can focus on roleplaying.
          </p>
        </motion.div>
      </section>

      {/* Feature Icons Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg hover:border-primary/30 transition-all duration-300 bg-card/50 backdrop-blur">
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
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
              Works Where Your Group Already Is
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              If your group uses Discord, Everdice can meet you there.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] font-bold text-lg">
                1
              </div>
              <h3 className="font-semibold mb-2">Build in Everdice</h3>
              <p className="text-sm text-muted-foreground">
                Create your campaign, NPCs, story, and structure here.
              </p>
            </div>

            <div className="text-center p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#5865F2]/10 flex items-center justify-center text-[#5865F2] font-bold text-lg">
                2
              </div>
              <h3 className="font-semibold mb-2">Deploy to Discord</h3>
              <p className="text-sm text-muted-foreground">
                Link your campaign to your Discord server for sessions and coordination.
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
            No lock-in. No forced workflow changes.
          </p>
        </motion.div>
      </section>

      {/* Audience Blocks */}
      <section className="py-16 bg-gradient-to-b from-amber-950/20 to-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              Designed for First Adventures and Long Campaigns
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {audienceBlocks.map((block, i) => (
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
            No public exposure. No social pressure. Explore freely.
          </motion.p>
        </div>
      </section>

      {/* Run Your First Session */}
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
                    Run Your First Session in About 5 Minutes
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    You don't need experience to start. Guided setup walks you through creating an adventure step by step. Add characters, set the scene, introduce NPCs, and start playing.
                  </p>
                  
                  <p className="text-foreground font-medium mb-6">
                    Tell the story. Everdice handles the bookkeeping.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { icon: Clock, text: "5-minute setup" },
                      { icon: Users, text: "Add NPCs easily" },
                      { icon: Map, text: "Set your scene" },
                      { icon: CheckCircle, text: "Start playing" }
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="h-4 w-4 text-purple-400" />
                        {text}
                      </div>
                    ))}
                  </div>

                  <Link href={user ? "/dm-toolkit" : "/auth"}>
                    <Button size="lg" className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg shadow-purple-500/25">
                      <Zap className="h-5 w-5 mr-2" />
                      Become a DM
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

      {/* Living World Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-amber-500/10 border-primary/20">
          <CardContent className="p-8 md:p-12 text-center">
            <Map className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              A Living World to Explore
            </h2>
            <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
              Everdice includes a shared world with regions, quests, and narrative hooks ready to use or adapt.
            </p>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto text-sm">
              Use it as written, remix it, or ignore it entirely. The world is there if you want it.
            </p>
            <Link href="/world-map">
              <Button variant="outline" size="lg">
                View the World Map
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
            Create a character and start your first adventure in minutes.
          </p>
          {!user && (
            <Link href="/auth">
              <Button size="lg" className="text-lg px-10 py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                Start Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
          {user && (
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-10 py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                Continue Your Adventure
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
          
          <div className="mt-8 pt-6 border-t border-border/30 text-sm text-muted-foreground">
            <span>Questions, bugs, or ideas? </span>
            <a 
              href="mailto:drkoepsell@gmail.com?subject=Everdice Feedback" 
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
            >
              Message KoeppyLoco
            </a>
            <span>. Every message gets read.</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-lg font-semibold mb-2">Everdice</h3>
          <p className="text-sm text-muted-foreground">
            A companion for tabletop adventures.<br />
            We handle the bookkeeping so you can focus on roleplaying and fun.
          </p>
        </div>
      </footer>
    </div>
  );
}
