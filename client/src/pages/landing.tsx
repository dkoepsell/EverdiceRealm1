import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";
import { 
  Sparkles, 
  Users, 
  Dice5, 
  BookOpen, 
  ArrowRight, 
  Sword,
  Shield,
  Wand2,
  Map,
  Zap,
  Clock,
  CheckCircle,
  Home,
  GraduationCap,
  Heart,
  Compass,
  Crown,
  MessageCircle,
  Link2,
  Headphones
} from "lucide-react";
import { motion } from "framer-motion";
import everdiceBackground from "@assets/image_1768599782346.png";

const features = [
  {
    icon: Sparkles,
    title: "Simple to Learn",
    description: "Start playing in minutes. No complex setup, no software tutorials, no pressure to \"know everything.\""
  },
  {
    icon: Dice5,
    title: "Real Dice, Real Imagination",
    description: "Everdice supports your table instead of replacing it. Roll physical dice, talk freely, improvise boldly."
  },
  {
    icon: BookOpen,
    title: "Campaigns That Remember",
    description: "Keep track of characters, choices, and story arcs so everyone can pick up right where they left off."
  },
  {
    icon: MessageCircle,
    title: "Play Where Your Group Already Is",
    description: "Deploy your campaign to Discord so DMs and players can access sessions, notes, and rolls inside their server."
  }
];

const reassuranceBlocks = [
  {
    icon: Heart,
    title: "Parents",
    description: "A safe, ad-free space to introduce kids to collaborative storytelling and creativity.",
    color: "text-rose-400"
  },
  {
    icon: GraduationCap,
    title: "Teachers",
    description: "Works in classrooms and clubs as a structured way to teach teamwork, reading, and imagination.",
    color: "text-blue-400"
  },
  {
    icon: Wand2,
    title: "First-Time Dungeon Masters",
    description: "Guides you without taking control. You stay the DM. Everdice just keeps things organized.",
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
      {/* Hero Section - Full Viewport */}
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
              {/* Eyebrow / Trust Cue */}
              <div 
                className="text-xs font-semibold tracking-widest uppercase mb-4"
                style={{ color: '#E6C77A' }}
              >
                For families, beginners, and Dungeon Masters
              </div>
              
              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent leading-tight tracking-tight">
                Beginner-Friendly. DM-Respectful.
              </h1>
              
              {/* Subheadline */}
              <p 
                className="text-lg leading-relaxed mb-4 max-w-[640px] mx-auto"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                Everdice makes it easy for anyone to start playing D&D while giving Dungeon Masters 
                the structure they need to run meaningful, long-form campaigns.
              </p>

              {/* Authority Line for Experienced Players */}
              <p 
                className="text-sm italic mb-4 max-w-[580px] mx-auto"
                style={{ color: '#C9B896' }}
              >
                For experienced tables: Everdice stays out of your way and keeps long campaigns coherent.
              </p>

              {/* Discord Integration Line */}
              <p 
                className="text-sm mb-8 max-w-[520px] mx-auto"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                Now with Discord integration. Deploy campaigns to your server for session play, coordination, and continuity.
              </p>

              {/* CTA Button */}
              <div className="flex flex-col items-center gap-3">
                <Link href={user ? "/dashboard" : "/auth"}>
                  <Button 
                    size="lg" 
                    className="text-base px-7 py-6 font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25"
                  >
                    {user ? "Continue Your Adventure" : "Run Your First Campaign (Free Beta)"}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                
                {/* Micro-Trust Line */}
                {!user && (
                  <p className="text-sm text-muted-foreground/80">
                    Safe for families • You stay in control • Free during beta
                  </p>
                )}
                
                {/* Community presence indicators */}
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  {userCount > 0 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                      <Users className="h-3 w-3" />
                      <span>{userCount.toLocaleString()} adventurers have joined Everdice</span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span>KoeppyLoco is online</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Soft fade to next section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Three Pathways Section - Clear Entry Points */}
      <section className="container mx-auto px-4 py-16 -mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Choose Your Path
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Most players start solo. Many try co-op on their second or third visit.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Solo Path */}
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
                    Learn D&D at your own pace. No pressure. Just story.
                  </p>
                  <div className="text-xs text-emerald-500 font-medium">
                    Perfect for beginners
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Together Path */}
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
                    Co-op adventures with friends or family.
                  </p>
                  <div className="text-xs text-amber-500 font-medium">
                    Invite your party
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* DM Path */}
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
                    Try being the Dungeon Master. We'll guide you.
                  </p>
                  <div className="text-xs text-purple-500 font-medium">
                    Experiment freely
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Founder Testimonial Bridge */}
      <section className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <div 
            className="rounded-xl p-8 text-center"
            style={{ 
              background: 'linear-gradient(to bottom, rgba(201, 184, 150, 0.08), rgba(201, 184, 150, 0.03))',
              border: '1px solid rgba(201, 184, 150, 0.15)'
            }}
          >
            <p 
              className="text-base leading-relaxed mb-4 italic"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            >
              "I built Everdice to help my kids learn D&D in a safe, pressure-free way — and to give us a way to keep playing together even when I'm traveling.
            </p>
            <p 
              className="text-base leading-relaxed mb-6 italic"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            >
              It turned out to be just as useful for running serious, long-form campaigns without the overhead of a virtual tabletop."
            </p>
            <div className="flex items-center justify-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{ 
                  background: 'linear-gradient(135deg, #C9B896 0%, #A89070 100%)',
                  color: '#2a2218'
                }}
              >
                KL
              </div>
              <div className="text-left">
                <p className="text-sm font-medium" style={{ color: '#C9B896' }}>KoeppyLoco</p>
                <p className="text-xs text-muted-foreground">Creator of Everdice</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Icons Section */}
      <section className="container mx-auto px-4 py-16 -mt-8">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Everything You Need to Play — Nothing You Don't
            </h2>
            <p className="text-muted-foreground max-w-[680px] mx-auto leading-relaxed">
              Everdice removes technical barriers so new players can focus on imagination, 
              storytelling, and learning the game together.
            </p>
          </motion.div>
        </div>

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

      {/* Discord Integration - How It Works */}
      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-sm font-medium mb-4">
              <MessageCircle className="h-4 w-4" />
              Optional, Not Required
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Everdice + Discord
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              If your group already uses Discord, Everdice can meet you there.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="text-center p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-lg">
                1
              </div>
              <h3 className="font-semibold mb-2">Build in Everdice</h3>
              <p className="text-sm text-muted-foreground">
                World notes, sessions, NPCs, and story continuity live here.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-lg">
                2
              </div>
              <h3 className="font-semibold mb-2">Deploy to Discord</h3>
              <p className="text-sm text-muted-foreground">
                Link your campaign to a Discord server with slash commands and session channels.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center p-6 rounded-xl bg-card/50 border border-border/50">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-lg">
                3
              </div>
              <h3 className="font-semibold mb-2">Run Sessions Naturally</h3>
              <p className="text-sm text-muted-foreground">
                Chat, voice, and dice stay in Discord. Everdice keeps the campaign coherent.
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            No lock-in. No forced workflow change. Use Discord for what it's good at.
          </p>
        </motion.div>
      </section>

      {/* Reassurance Strip - Parents / Teachers / First-Time DMs */}
      <section className="py-12 bg-gradient-to-b from-amber-950/20 to-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              Designed for Learning, Teaching, and First Adventures
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {reassuranceBlocks.map((block, i) => (
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

          {/* Micro-Trust Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-muted-foreground mt-8"
          >
            No accounts required to explore. AI assists, you decide. No public exposure.
          </motion.p>

          {/* For Tinkerers Accordion */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="max-w-xl mx-auto mt-10"
          >
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="tinkerers" className="border-muted-foreground/20">
                <AccordionTrigger 
                  className="text-sm text-muted-foreground hover:text-foreground py-3 justify-center gap-2"
                >
                  For tinkerers and system-builders
                </AccordionTrigger>
                <AccordionContent className="text-center pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Everdice campaigns are backed by a structured adventure format designed to be readable, exportable, and extensible.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    If you care about campaign state, narrative traceability, or building tools around tabletop play, you'll feel at home here.
                  </p>
                  <Link href="/caml">
                    <span className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors">
                      → Learn about the underlying format (CAML)
                    </span>
                  </Link>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Explore the World Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-amber-500/10 border-primary/20">
          <CardContent className="p-8 md:p-12 text-center">
            <Map className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Explore the Realm of Everdice
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Discover a living world with regions to explore, quests to complete, 
              and stories waiting to be written.
            </p>
            <Link href="/world-map">
              <Button variant="outline" size="lg">
                View World Map
                <Map className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Become a DM Section */}
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
                    No experience needed. Our guided setup walks you through creating 
                    an adventure step by step. Just add characters, set the scene, and start telling your story.
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
                      {user ? "Start Quick Setup" : "Become a DM"}
                    </Button>
                  </Link>
                </div>
                
                <div className="hidden md:block w-48 text-center">
                  <div className="w-32 h-32 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/20">
                    <BookOpen className="h-16 w-16 text-purple-400" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">Tell your story,<br/>we handle the rules</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-16 pb-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Begin?</h2>
          <p className="text-muted-foreground mb-8">
            Create your character and start your first adventure in minutes.
          </p>
          {!user && (
            <Link href="/auth">
              <Button size="lg" className="text-lg px-10 py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
          
          {/* Feedback line */}
          <div className="mt-8 pt-6 border-t border-border/30 text-sm text-muted-foreground">
            <span>Questions, bugs, or ideas? </span>
            <a 
              href="mailto:feedback@everdice.app?subject=Everdice Feedback" 
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
            >
              Send feedback to KoeppyLoco
            </a>
            <span> — I read every message!</span>
          </div>
        </div>
      </section>
    </div>
  );
}
