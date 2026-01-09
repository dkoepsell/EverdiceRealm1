import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Map
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Sparkles,
    title: "AI Dungeon Master",
    description: "An intelligent AI guides your adventure, responding to your choices and creating dynamic stories."
  },
  {
    icon: Users,
    title: "Easy Character Creation",
    description: "Create your hero in minutes with guided templates or dive deep with full customization."
  },
  {
    icon: Dice5,
    title: "Real Dice Rolling",
    description: "Experience authentic D&D mechanics with animated dice rolls and skill checks."
  },
  {
    icon: BookOpen,
    title: "Learn as You Play",
    description: "Perfect for beginners - the app teaches you D&D rules as you adventure."
  }
];

const characterTypes = [
  { icon: Sword, name: "Warrior", color: "text-red-400" },
  { icon: Wand2, name: "Wizard", color: "text-purple-400" },
  { icon: Shield, name: "Paladin", color: "text-yellow-400" },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <section className="container mx-auto px-4 pt-12 pb-20 md:pt-20 md:pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Tabletop RPG
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent leading-tight">
              Your AI Dungeon Master Awaits
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Embark on epic adventures with an intelligent AI guiding your story. 
              No experience needed — just bring your imagination.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25">
                    Continue Your Adventure
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth">
                    <Button size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25">
                      Start Your Adventure
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/how-it-works">
                    <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                      Learn More
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>

        <motion.div 
          className="mt-16 flex justify-center gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {characterTypes.map((char, i) => (
            <motion.div
              key={char.name}
              className="flex flex-col items-center gap-2"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              <div className={`p-4 rounded-full bg-card border-2 border-border shadow-lg ${char.color}`}>
                <char.icon className="h-8 w-8" />
              </div>
              <span className="text-sm text-muted-foreground">{char.name}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Everything You Need to Play</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Everdice handles the complex rules so you can focus on the fun.
          </p>
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
        </div>
      </section>
    </div>
  );
}
