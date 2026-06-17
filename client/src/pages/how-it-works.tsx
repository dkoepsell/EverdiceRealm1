import { ExternalLink, Book, Users, Dices, Sparkles, BookOpen, GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function HowItWorks() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
          How Realm of the Everdice Works
        </h1>
        <p className="text-lg text-muted-foreground">
          Your companion for learning, playing, and mastering the art of tabletop role-playing
        </p>
      </div>

      <div className="prose prose-lg dark:prose-invert max-w-none mb-10">
        <p>
          Welcome to Realm of the Everdice — a tool designed to enhance your tabletop 
          role-playing experience, not replace it. We're passionate about Dungeons & Dragons 
          and believe in the magic that happens when friends gather around a table (virtual or physical) 
          to embark on adventures together.
        </p>
        
        <p>
          Our goal is to make the D&D experience more accessible to newcomers while providing 
          valuable tools for veterans to enhance their campaigns and develop their skills as players and Dungeon Masters.
        </p>
      </div>

      <div className="grid gap-8 mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Book className="mr-2 h-5 w-5 text-primary" />
              Our Philosophy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              We believe in encouraging people to play the official tabletop Dungeons & Dragons games.
              Realm of the Everdice is designed as a supplementary tool that helps with:
            </p>
            <ul className="space-y-2 ml-6 list-disc">
              <li>Learning the mechanics of D&D in a guided, interactive way</li>
              <li>Creating and managing characters with visual representation</li>
              <li>Collaborating on adventures with friends</li>
              <li>Developing Dungeon Master skills with guided training and tools</li>
              <li>Casual play when gathering in person isn't possible</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-primary" />
              What We're Really Teaching: Your Imagination
            </CardTitle>
            <CardDescription>
              The whole point of theater-of-the-mind play — and the skill we exist to build.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              At a real table, no one hands you a menu of buttons. The Dungeon Master describes a
              scene, and you say what your character <em>does</em> — in your own words. That leap,
              from choosing an option to declaring intent in free prose, <strong>is</strong> the
              game. It's also a creative muscle, and like any muscle it grows with use.
            </p>
            <p>
              Most apps quietly train the opposite habit: they reduce a living world to four
              clickable choices. Realm of the Everdice is built to do the reverse. We start with
              support and then deliberately take it away as you grow — so that the suggestions make
              themselves obsolete and you're left doing the real thing: imagining, then describing.
            </p>

            <h3 className="font-semibold text-base mt-2">How the guidance fades</h3>
            <p>
              Solo play uses a <strong>fading scaffold</strong>. It watches <em>how</em> you play —
              not a setting you configure — and eases off as you find your voice:
            </p>
            <ul className="space-y-2 ml-6 list-disc">
              <li>
                <strong>Guided</strong> — a handful of in-fiction nudges ("the desk drawer sits
                slightly ajar") instead of bare commands, so you learn to read a scene for
                possibilities. The open prose box is always there too.
              </li>
              <li>
                <strong>Hybrid</strong> — fewer hints, tucked behind an "ideas?" reveal; the prose
                box becomes the main way you act.
              </li>
              <li>
                <strong>Open</strong> — no hints on screen; a single "need a nudge?" button if you
                ever want one.
              </li>
              <li>
                <strong>Pure</strong> — just you and the world. This is tabletop D&D.
              </li>
            </ul>
            <p>
              Along the way the game gently coaches the <em>craft</em> of declaring action. A vague
              move ("I attack") earns a quick in-fiction "with what, and how?" — and the more vivid
              your description, the richer the consequences you get back. That feedback loop, input
              quality shaping output quality, is the lesson. It teaches transferable D&D, not "how
              to use this app": when a roll happens, early on we explain the rule behind it
              (the ability, the skill, the target number), then say less as you internalize it.
            </p>

            <h3 className="font-semibold text-base mt-2">For experienced players</h3>
            <p>
              Already fluent? You can skip the scaffolding entirely. <strong>Expert mode</strong>
              turns the suggestions off for good and brings in an <strong>oracle</strong> — yes /
              yes-but / no-and answers and unexpected complications in the Mythic GME and Ironsworn
              tradition — so the friction comes from surprise, not from a menu.
            </p>
            <p className="text-muted-foreground text-sm">
              The destination is the same for everyone: confident, unscaffolded, imaginative play —
              the kind that carries straight to a table with friends.
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <GraduationCap className="mr-2 h-6 w-6 text-primary" />
        Learning the Game
      </h2>

      <div className="grid gap-6 md:grid-cols-2 mb-12">
        <Card>
          <CardHeader>
            <CardTitle>Official Resources</CardTitle>
            <CardDescription>The best places to start your journey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-1">D&D Beyond</h3>
              <p className="text-sm mb-2">The official digital toolset for Dungeons & Dragons</p>
              <a 
                href="https://www.dndbeyond.com/sources/basic-rules" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm text-primary hover:underline"
              >
                Free Basic Rules <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
            <div>
              <h3 className="font-medium mb-1">Starter Set</h3>
              <p className="text-sm mb-2">The perfect physical introduction to the game</p>
              <a 
                href="https://dnd.wizards.com/products/starter-set" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm text-primary hover:underline"
              >
                D&D Starter Set <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
            <div>
              <h3 className="font-medium mb-1">Official D&D Website</h3>
              <p className="text-sm mb-2">News, products, and resources from Wizards of the Coast</p>
              <a 
                href="https://dnd.wizards.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm text-primary hover:underline"
              >
                Visit Official Site <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Community Resources</CardTitle>
            <CardDescription>Learn from the wider D&D community</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-1">Critical Role</h3>
              <p className="text-sm mb-2">Watch professional voice actors play D&D</p>
              <a 
                href="https://critrole.com/faq/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm text-primary hover:underline"
              >
                Beginner's Guide <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
            <div>
              <h3 className="font-medium mb-1">Reddit D&D Communities</h3>
              <p className="text-sm mb-2">Discussion forums for players of all levels</p>
              <a 
                href="https://www.reddit.com/r/DnD/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm text-primary hover:underline"
              >
                r/DnD <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
            <div>
              <h3 className="font-medium mb-1">YouTube Tutorials</h3>
              <p className="text-sm mb-2">Visual guides to gameplay and rules</p>
              <a 
                href="https://www.youtube.com/watch?v=0TsicWGho7c" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm text-primary hover:underline"
              >
                D&D Starter Guide <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <Sparkles className="mr-2 h-6 w-6 text-primary" />
        How Realm of the Everdice Helps
      </h2>

      <div className="grid gap-6 mb-12">
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Dices className="mr-2 h-5 w-5 text-primary" />
                Learn Mechanics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Our interactive campaigns walk you through common gameplay mechanics, explaining when and why to roll dice, how skills work, and the basics of combat.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Users className="mr-2 h-5 w-5 text-primary" />
                Collaborative Play
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Join campaigns with friends, take turns controlling the narrative, and build stories together with our shared campaign tools.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <BookOpen className="mr-2 h-5 w-5 text-primary" />
                DM Training
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Learn to become a Dungeon Master with tools that help you create balanced encounters, compelling NPCs, and dynamic story arcs.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="bg-muted p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Playing Tips for Newcomers</h2>
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">Start small:</span> Begin with a simple one-shot adventure rather than a complex campaign.
          </p>
          <p className="text-sm">
            <span className="font-medium">Focus on storytelling:</span> D&D is about collaborative storytelling, not winning or losing.
          </p>
          <p className="text-sm">
            <span className="font-medium">Learn by doing:</span> Don't worry about knowing all the rules upfront; learn as you play.
          </p>
          <p className="text-sm">
            <span className="font-medium">Be respectful:</span> Ensure everyone at your table feels comfortable and included.
          </p>
          <p className="text-sm">
            <span className="font-medium">Have fun:</span> The most important rule in D&D is to enjoy yourself!
          </p>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Ready to Start Your Adventure?</h2>
        <p className="text-muted-foreground">
          Create a character, join a campaign, or start your own journey as a Dungeon Master.
        </p>
      </div>

      <div className="text-sm text-center text-muted-foreground">
        <p>
          Dungeons & Dragons and D&D are trademarks of Wizards of the Coast LLC.
          Realm of the Everdice is not affiliated with Wizards of the Coast.
        </p>
      </div>
    </div>
  );
}