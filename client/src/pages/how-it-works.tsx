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