import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RulesReference } from "@/components/education/RulesReference";
import { DMGuide } from "@/components/education/DMGuide";
import { LearningPathContent } from "@/components/education/LearningPathContent";
import { 
  BookOpen, 
  Users, 
  Crown, 
  Target,
  Dice6,
  Sword,
  Shield,
  GraduationCap,
  TrendingUp,
  Star,
  CheckCircle,
  XCircle,
  RotateCcw,
  MessageSquare,
  Zap,
  Heart,
  Brain,
  Eye,
  Sparkles
} from "lucide-react";

// Practice Module Data
const SKILL_CHECK_SCENARIOS = [
  {
    id: 1,
    title: "The Locked Chest",
    description: "You find an ornate chest in the dungeon. The lock looks complex but not impossible.",
    skill: "Sleight of Hand (Dexterity)",
    dc: 15,
    hint: "Sleight of Hand uses your Dexterity modifier. A DC 15 is moderately difficult.",
    successText: "Click! The lock springs open, revealing gold coins and a mysterious amulet.",
    failText: "Your lockpick snaps. The chest remains locked, and you've alerted nearby guards."
  },
  {
    id: 2,
    title: "The Suspicious Merchant",
    description: "A merchant claims this sword is enchanted, but something feels off about his story.",
    skill: "Insight (Wisdom)",
    dc: 12,
    hint: "Insight uses your Wisdom modifier. A DC 12 is relatively easy for observant characters.",
    successText: "You notice his eyes dart away - he's lying! The sword is just ordinary steel with fancy paint.",
    failText: "He seems genuine to you. You pay 50 gold for what turns out to be a worthless fake."
  },
  {
    id: 3,
    title: "Climbing the Tower",
    description: "The ancient tower's exterior is crumbling, but you need to reach the top window.",
    skill: "Athletics (Strength)",
    dc: 14,
    hint: "Athletics uses your Strength modifier. The crumbling stone makes it moderately challenging.",
    successText: "You find solid handholds and pull yourself up gracefully to the window ledge.",
    failText: "A stone gives way! You fall 10 feet and take 1d6 bludgeoning damage."
  },
  {
    id: 4,
    title: "The Ancient Tome",
    description: "A dusty tome written in an archaic dialect sits on the pedestal. What secrets does it hold?",
    skill: "History (Intelligence)",
    dc: 13,
    hint: "History uses your Intelligence modifier. Understanding old texts requires knowledge of the past.",
    successText: "You recognize this as the lost chronicle of King Aldric, containing the location of his hidden vault!",
    failText: "The archaic text proves too difficult. You can only make out fragments about an old war."
  },
  {
    id: 5,
    title: "Convincing the Guard",
    description: "The castle guard blocks your path. You need to get inside for the mission.",
    skill: "Persuasion (Charisma)",
    dc: 16,
    hint: "Persuasion uses your Charisma modifier. Guards are trained to be skeptical - this is challenging.",
    successText: "Your silver tongue works wonders. The guard nods and steps aside, wishing you well.",
    failText: "The guard narrows his eyes suspiciously and calls for backup. Time to run!"
  },
  {
    id: 6,
    title: "Tracking in the Forest",
    description: "The bandits fled into the woods. Fresh tracks lead in multiple directions.",
    skill: "Survival (Wisdom)",
    dc: 14,
    hint: "Survival uses your Wisdom modifier. Reading tracks requires careful observation.",
    successText: "You notice bent twigs and disturbed leaves - the real trail leads east toward the river!",
    failText: "The tracks are confusing. You follow a false trail and lose precious time."
  }
];

const COMBAT_SCENARIOS = [
  {
    id: 1,
    title: "Goblin Ambush",
    setup: "Three goblins spring from behind rocks! You're a Level 1 Fighter with AC 16 and 12 HP.",
    rounds: [
      {
        situation: "Round 1: Two goblins rush you while one hangs back with a shortbow.",
        options: [
          { text: "Attack the archer first (ranged threat)", correct: false, explanation: "Moving to the archer provokes opportunity attacks from the melee goblins and leaves you surrounded." },
          { text: "Attack one melee goblin (reduce numbers)", correct: true, explanation: "Excellent! Reducing enemy numbers quickly decreases incoming damage. Focus fire is a key tactic." },
          { text: "Dodge action (defensive)", correct: false, explanation: "Dodging is too passive here. You have good AC and need to deal damage before they overwhelm you." }
        ]
      },
      {
        situation: "Round 2: One goblin is down. The archer hits you for 5 damage (7 HP left). The other melee goblin attacks.",
        options: [
          { text: "Finish the melee goblin", correct: true, explanation: "Right choice! Eliminating the second melee threat means only ranged attacks, which you can approach safely." },
          { text: "Use Second Wind (heal)", correct: false, explanation: "You're not in critical danger yet. Better to reduce threats first, then heal when needed." },
          { text: "Disengage and run", correct: false, explanation: "Running lets them pick you off. Your best defense is a good offense here." }
        ]
      },
      {
        situation: "Round 3: Only the archer remains, 30 feet away. You have 7 HP.",
        options: [
          { text: "Dash to close distance", correct: false, explanation: "Dashing uses your action. You'd reach the goblin but couldn't attack this turn." },
          { text: "Move and throw a handaxe", correct: true, explanation: "Perfect! Moving your speed (usually 30 ft) gets you close, and you can still attack with a thrown weapon." },
          { text: "Second Wind then move", correct: false, explanation: "Healing is smart, but the lone archer is low threat. Better to finish the fight quickly." }
        ]
      }
    ]
  },
  {
    id: 2,
    title: "The Ogre's Cave",
    setup: "A large Ogre blocks the cave entrance. You're a Level 3 Rogue with 24 HP and Sneak Attack.",
    rounds: [
      {
        situation: "Round 1: The Ogre hasn't noticed you yet. Your ally (Fighter) is 60 feet away.",
        options: [
          { text: "Rush in and attack directly", correct: false, explanation: "Losing surprise and fighting alone against an Ogre is dangerous. Rogues need tactical positioning." },
          { text: "Wait for your ally to engage first", correct: true, explanation: "Perfect! When the Fighter engages, you get Sneak Attack. Patience wins fights for Rogues." },
          { text: "Try to sneak past the Ogre", correct: false, explanation: "You came to fight. Sneaking past wastes the tactical opportunity and leaves threats behind you." }
        ]
      },
      {
        situation: "Round 2: The Fighter has engaged! The Ogre swings its club. You're behind the Ogre.",
        options: [
          { text: "Attack with Sneak Attack damage", correct: true, explanation: "Excellent! You have advantage or an ally within 5 feet - full Sneak Attack applies. Deal massive damage!" },
          { text: "Use Cunning Action to Hide", correct: false, explanation: "You're already in position for Sneak Attack. Hiding wastes the opportunity." },
          { text: "Throw a dagger from range", correct: false, explanation: "You're already in melee range for Sneak Attack. Ranged attack would do less damage." }
        ]
      },
      {
        situation: "Round 3: The Ogre turns to face you! The Fighter is still adjacent.",
        options: [
          { text: "Attack again (ally adjacent)", correct: true, explanation: "Your ally is still adjacent, so Sneak Attack still applies! Keep the pressure on." },
          { text: "Disengage and retreat", correct: false, explanation: "Running would waste your Sneak Attack opportunity. The Fighter is tanking - use it!" },
          { text: "Use Help action on the Fighter", correct: false, explanation: "Your Sneak Attack damage far outweighs giving the Fighter advantage. Attack!" }
        ]
      }
    ]
  }
];

const ROLEPLAY_SCENARIOS = [
  {
    id: 1,
    title: "The Grieving Widow",
    context: "Lady Miriam lost her husband to the undead plague. She holds information about the necromancer's location.",
    npcMood: "Sad and distrustful of adventurers who 'always come too late'",
    dialogueOptions: [
      { 
        text: "We're sorry for your loss. We want to stop this from happening to others.", 
        response: "She softens slightly. 'That's what they all say... but you seem different. Very well, I'll tell you what I know.'",
        result: "success",
        skill: "Empathy - acknowledging her pain builds trust"
      },
      { 
        text: "We need information about the necromancer. Where is he?", 
        response: "Her eyes harden. 'You adventurers are all the same. Get out of my house.'",
        result: "failure",
        skill: "Too direct - she's grieving and needs compassion first"
      },
      { 
        text: "We'll avenge your husband! Tell us where to find the villain!", 
        response: "She looks skeptical. 'Revenge won't bring him back. I don't trust your motives.'",
        result: "partial",
        skill: "Well-intentioned but too aggressive - she wants peace, not vengeance"
      }
    ]
  },
  {
    id: 2,
    title: "The Corrupt Official",
    context: "Baron Caldwell has been taking bribes from smugglers. You have evidence but need him to confess.",
    npcMood: "Arrogant, dismissive, confident in his power",
    dialogueOptions: [
      { 
        text: "Baron, we have witnesses. Confess now and the Duke may show mercy.", 
        response: "He pales. 'Witnesses? I... perhaps we can discuss this privately.'",
        result: "success",
        skill: "Intimidation through evidence - showing you have proof breaks his confidence"
      },
      { 
        text: "We know what you've done, criminal! Justice will be served!", 
        response: "He laughs coldly. 'Guards! Arrest these trespassers for threatening a noble.'",
        result: "failure",
        skill: "Too aggressive without leverage - he has authority here"
      },
      { 
        text: "Perhaps we can come to an... arrangement, Baron?", 
        response: "He raises an eyebrow. 'Go on...' He's interested but now suspicious of your motives.",
        result: "partial",
        skill: "Opens negotiation but may compromise your mission"
      }
    ]
  },
  {
    id: 3,
    title: "The Rival Adventurer",
    context: "Theron, a competing adventurer, beat you to the dungeon entrance. He's not sharing.",
    npcMood: "Competitive, cocky, but respects strength",
    dialogueOptions: [
      { 
        text: "The dungeon is dangerous. We'd both benefit from working together.", 
        response: "He considers this. 'Two shares instead of one... but we'd survive. Fine, temporary alliance.'",
        result: "success",
        skill: "Appeal to mutual benefit - adventurers understand survival"
      },
      { 
        text: "Step aside or we'll make you.", 
        response: "He draws his sword with a grin. 'I was hoping you'd say that. Let's dance!'",
        result: "failure",
        skill: "Escalating to violence wastes resources before the real dungeon"
      },
      { 
        text: "May the best team win. We'll take a different entrance.", 
        response: "He shrugs. 'Your funeral. There's only one safe path, and I've got it.'",
        result: "partial",
        skill: "Avoids conflict but you may miss important loot or face harder challenges"
      }
    ]
  }
];

function PracticeModules() {
  const [practiceMode, setPracticeMode] = useState<'menu' | 'skills' | 'combat' | 'roleplay'>('menu');
  const [currentScenario, setCurrentScenario] = useState(0);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const [combatRound, setCombatRound] = useState(0);
  const [combatScore, setCombatScore] = useState(0);
  const [selectedRoleplayOption, setSelectedRoleplayOption] = useState<number | null>(null);
  const [completedScenarios, setCompletedScenarios] = useState<number[]>([]);

  const rollD20 = () => {
    const result = Math.floor(Math.random() * 20) + 1;
    setRollResult(result);
    setShowOutcome(true);
  };

  const nextScenario = () => {
    if (!completedScenarios.includes(currentScenario)) {
      setCompletedScenarios([...completedScenarios, currentScenario]);
    }
    setRollResult(null);
    setShowOutcome(false);
    setSelectedRoleplayOption(null);
    setCombatRound(0);
    
    const maxScenarios = practiceMode === 'skills' ? SKILL_CHECK_SCENARIOS.length 
      : practiceMode === 'combat' ? COMBAT_SCENARIOS.length 
      : ROLEPLAY_SCENARIOS.length;
    
    if (currentScenario + 1 < maxScenarios) {
      setCurrentScenario(currentScenario + 1);
    } else {
      setCurrentScenario(0);
      setPracticeMode('menu');
      setCombatScore(0);
    }
  };

  const resetModule = () => {
    setCurrentScenario(0);
    setRollResult(null);
    setShowOutcome(false);
    setSelectedRoleplayOption(null);
    setCombatRound(0);
    setCombatScore(0);
    setCompletedScenarios([]);
    setPracticeMode('menu');
  };

  if (practiceMode === 'menu') {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold font-fantasy mb-2">Practice Your Skills</h2>
          <p className="text-muted-foreground">
            Interactive modules to help you master D&D mechanics
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
            onClick={() => { setPracticeMode('skills'); setCurrentScenario(0); setCompletedScenarios([]); }}
            data-testid="practice-skills-card"
          >
            <CardHeader className="text-center">
              <Dice6 className="h-12 w-12 text-primary mx-auto mb-2" />
              <CardTitle>Skill Check Trainer</CardTitle>
              <CardDescription>
                Practice different scenarios and learn when to use each skill
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2"><Target className="h-4 w-4 text-green-500" /> {SKILL_CHECK_SCENARIOS.length} scenarios</li>
                <li className="flex items-center gap-2"><Brain className="h-4 w-4 text-blue-500" /> Learn ability/skill pairings</li>
                <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" /> DC difficulty explanations</li>
              </ul>
              <Button className="w-full mt-4" data-testid="button-start-skills">Start Training</Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
            onClick={() => { setPracticeMode('combat'); setCurrentScenario(0); setCombatRound(0); setCombatScore(0); }}
            data-testid="practice-combat-card"
          >
            <CardHeader className="text-center">
              <Sword className="h-12 w-12 text-primary mx-auto mb-2" />
              <CardTitle>Combat Simulator</CardTitle>
              <CardDescription>
                Learn tactical combat decision-making through guided examples
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /> {COMBAT_SCENARIOS.length} tactical encounters</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-blue-500" /> Action economy lessons</li>
                <li className="flex items-center gap-2"><Heart className="h-4 w-4 text-red-500" /> Resource management</li>
              </ul>
              <Button className="w-full mt-4" data-testid="button-start-combat">Start Training</Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
            onClick={() => { setPracticeMode('roleplay'); setCurrentScenario(0); setSelectedRoleplayOption(null); }}
            data-testid="practice-roleplay-card"
          >
            <CardHeader className="text-center">
              <MessageSquare className="h-12 w-12 text-primary mx-auto mb-2" />
              <CardTitle>Roleplay Scenarios</CardTitle>
              <CardDescription>
                Practice social encounters and character interaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-green-500" /> {ROLEPLAY_SCENARIOS.length} NPC interactions</li>
                <li className="flex items-center gap-2"><Eye className="h-4 w-4 text-purple-500" /> Read NPC motivations</li>
                <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-orange-500" /> Dialogue strategies</li>
              </ul>
              <Button className="w-full mt-4" data-testid="button-start-roleplay">Start Training</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Skill Check Trainer
  if (practiceMode === 'skills') {
    const scenario = SKILL_CHECK_SCENARIOS[currentScenario];
    const isSuccess = rollResult !== null && rollResult >= scenario.dc;
    
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={resetModule} data-testid="button-back-menu">
            <RotateCcw className="h-4 w-4 mr-2" /> Back to Menu
          </Button>
          <Badge variant="outline">Scenario {currentScenario + 1} / {SKILL_CHECK_SCENARIOS.length}</Badge>
        </div>

        <Progress value={((currentScenario + 1) / SKILL_CHECK_SCENARIOS.length) * 100} className="h-2" />

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {scenario.title}
            </CardTitle>
            <CardDescription className="text-base">{scenario.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="font-semibold text-sm mb-1">Required Check:</p>
              <p className="text-lg font-bold text-primary">{scenario.skill}</p>
              <p className="text-sm text-muted-foreground mt-2">DC (Difficulty Class): {scenario.dc}</p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm"><strong>Hint:</strong> {scenario.hint}</p>
            </div>

            {!showOutcome ? (
              <Button onClick={rollD20} className="w-full" size="lg" data-testid="button-roll-check">
                <Dice6 className="h-5 w-5 mr-2" />
                Roll d20 for {scenario.skill.split(' ')[0]}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className={`p-6 rounded-lg text-center ${isSuccess ? 'bg-green-100 dark:bg-green-950 border-2 border-green-500' : 'bg-red-100 dark:bg-red-950 border-2 border-red-500'}`}>
                  <div className="text-4xl font-bold mb-2">{rollResult}</div>
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                    {isSuccess ? (
                      <><CheckCircle className="h-6 w-6 text-green-600" /> Success!</>
                    ) : (
                      <><XCircle className="h-6 w-6 text-red-600" /> Failed</>
                    )}
                  </div>
                  <p className="text-sm mt-2 text-muted-foreground">
                    Rolled {rollResult} vs DC {scenario.dc}
                  </p>
                </div>

                <Card className={isSuccess ? 'border-green-500' : 'border-red-500'}>
                  <CardContent className="pt-4">
                    <p className="text-sm">{isSuccess ? scenario.successText : scenario.failText}</p>
                  </CardContent>
                </Card>

                <Button onClick={nextScenario} className="w-full" data-testid="button-next-scenario">
                  {currentScenario + 1 < SKILL_CHECK_SCENARIOS.length ? 'Next Scenario' : 'Complete Training'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Combat Simulator
  if (practiceMode === 'combat') {
    const scenario = COMBAT_SCENARIOS[currentScenario];
    const round = scenario.rounds[combatRound];
    
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={resetModule} data-testid="button-back-menu">
            <RotateCcw className="h-4 w-4 mr-2" /> Back to Menu
          </Button>
          <div className="flex gap-2">
            <Badge variant="outline">Encounter {currentScenario + 1} / {COMBAT_SCENARIOS.length}</Badge>
            <Badge variant="secondary">Score: {combatScore} / {scenario.rounds.length}</Badge>
          </div>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sword className="h-5 w-5 text-primary" />
              {scenario.title}
            </CardTitle>
            <CardDescription className="text-base">{scenario.setup}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <Badge className="mb-2">Round {combatRound + 1}</Badge>
              <p className="font-medium">{round.situation}</p>
            </div>

            {selectedRoleplayOption === null ? (
              <div className="space-y-2">
                <p className="font-semibold text-sm">What do you do?</p>
                {round.options.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full text-left justify-start h-auto py-3 px-4"
                    onClick={() => {
                      setSelectedRoleplayOption(index);
                      if (option.correct) setCombatScore(combatScore + 1);
                    }}
                    data-testid={`button-combat-option-${index}`}
                  >
                    {option.text}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {round.options.map((option, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border-2 ${
                      option.correct ? 'bg-green-50 dark:bg-green-950 border-green-500' : 
                      index === selectedRoleplayOption ? 'bg-red-50 dark:bg-red-950 border-red-500' : 
                      'bg-muted border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {option.correct && <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />}
                      {!option.correct && index === selectedRoleplayOption && <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-medium">{option.text}</p>
                        <p className="text-sm text-muted-foreground mt-1">{option.explanation}</p>
                      </div>
                    </div>
                  </div>
                ))}

                <Button 
                  onClick={() => {
                    if (combatRound + 1 < scenario.rounds.length) {
                      setCombatRound(combatRound + 1);
                      setSelectedRoleplayOption(null);
                    } else {
                      nextScenario();
                    }
                  }} 
                  className="w-full"
                  data-testid="button-next-round"
                >
                  {combatRound + 1 < scenario.rounds.length ? 'Next Round' : 
                   currentScenario + 1 < COMBAT_SCENARIOS.length ? 'Next Encounter' : 'Complete Training'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Roleplay Scenarios
  if (practiceMode === 'roleplay') {
    const scenario = ROLEPLAY_SCENARIOS[currentScenario];
    
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={resetModule} data-testid="button-back-menu">
            <RotateCcw className="h-4 w-4 mr-2" /> Back to Menu
          </Button>
          <Badge variant="outline">Scenario {currentScenario + 1} / {ROLEPLAY_SCENARIOS.length}</Badge>
        </div>

        <Progress value={((currentScenario + 1) / ROLEPLAY_SCENARIOS.length) * 100} className="h-2" />

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {scenario.title}
            </CardTitle>
            <CardDescription className="text-base">{scenario.context}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm"><strong>NPC Mood:</strong> {scenario.npcMood}</p>
            </div>

            {selectedRoleplayOption === null ? (
              <div className="space-y-2">
                <p className="font-semibold text-sm">How do you respond?</p>
                {scenario.dialogueOptions.map((option, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full text-left justify-start h-auto py-3 px-4"
                    onClick={() => setSelectedRoleplayOption(index)}
                    data-testid={`button-roleplay-option-${index}`}
                  >
                    "{option.text}"
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {scenario.dialogueOptions.map((option, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border-2 ${
                      option.result === 'success' ? 'bg-green-50 dark:bg-green-950 border-green-500' : 
                      option.result === 'failure' && index === selectedRoleplayOption ? 'bg-red-50 dark:bg-red-950 border-red-500' : 
                      option.result === 'partial' && index === selectedRoleplayOption ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-500' :
                      'bg-muted border-transparent opacity-60'
                    }`}
                  >
                    <p className="font-medium mb-2">"{option.text}"</p>
                    {(option.result === 'success' || index === selectedRoleplayOption) && (
                      <>
                        <p className="text-sm italic mb-2">{option.response}</p>
                        <Badge variant={option.result === 'success' ? 'default' : option.result === 'partial' ? 'secondary' : 'destructive'}>
                          {option.skill}
                        </Badge>
                      </>
                    )}
                  </div>
                ))}

                <Button onClick={nextScenario} className="w-full" data-testid="button-next-scenario">
                  {currentScenario + 1 < ROLEPLAY_SCENARIOS.length ? 'Next Scenario' : 'Complete Training'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

const LEARNING_PATHS = [
  {
    title: "New Player",
    description: "Just starting your D&D journey? Start here!",
    icon: GraduationCap,
    color: "bg-green-100 text-green-800 border-green-200",
    darkColor: "dark:bg-green-900 dark:text-green-200 dark:border-green-800",
    steps: [
      "Learn basic dice mechanics and ability scores",
      "Understand the core skills and when to use them",
      "Practice character creation and roleplay",
      "Learn combat basics and action economy",
      "Experience your first campaign session"
    ],
    timeEstimate: "2-3 hours",
    completionReward: "Basic Player Badge"
  },
  {
    title: "Experienced Player",
    description: "Ready to deepen your understanding?",
    icon: TrendingUp,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    darkColor: "dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800",
    steps: [
      "Master advanced combat tactics and positioning",
      "Learn spell interactions and optimization",
      "Understand party dynamics and teamwork",
      "Practice creative problem-solving approaches",
      "Explore multiclassing and character builds"
    ],
    timeEstimate: "4-5 hours",
    completionReward: "Advanced Player Badge"
  },
  {
    title: "Aspiring DM",
    description: "Want to run your own games?",
    icon: Crown,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    darkColor: "dark:bg-purple-900 dark:text-purple-200 dark:border-purple-800",
    steps: [
      "Learn session preparation and planning",
      "Understand encounter design and balance",
      "Practice improvisation and player engagement",
      "Master NPC creation and world-building",
      "Run your first campaign session"
    ],
    timeEstimate: "6-8 hours",
    completionReward: "Dungeon Master Badge"
  }
];

const QUICK_REFERENCES = [
  {
    title: "Ability Scores",
    icon: Target,
    items: [
      "Strength: Physical power, athletics, melee attacks",
      "Dexterity: Agility, stealth, ranged attacks, AC",
      "Constitution: Health, stamina, concentration",
      "Intelligence: Reasoning, memory, investigation",
      "Wisdom: Awareness, insight, perception",
      "Charisma: Force of personality, social skills"
    ]
  },
  {
    title: "Action Types",
    icon: Sword,
    items: [
      "Action: Attack, cast spell, dash, dodge, help, hide",
      "Bonus Action: Special abilities, some spells",
      "Movement: Up to your speed, can be split",
      "Reaction: Opportunity attacks, some spells",
      "Free: Drop item, speak, draw weapon"
    ]
  },
  {
    title: "Advantage/Disadvantage",
    icon: Dice6,
    items: [
      "Advantage: Roll 2d20, use higher result",
      "Disadvantage: Roll 2d20, use lower result",
      "Sources: Positioning, spells, conditions, help",
      "They cancel out: Never stack multiples",
      "Affects: Attack rolls, ability checks, saves"
    ]
  }
];

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900 py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-6 right-8 md:right-16 opacity-15">
          <BookOpen className="h-14 w-14 md:h-20 md:w-20 text-emerald-400" />
        </div>
        <div className="absolute top-16 right-20 md:right-40 opacity-10">
          <GraduationCap className="h-10 w-10 md:h-16 md:w-16 text-teal-300" />
        </div>
        <div className="absolute bottom-6 right-12 md:right-28 opacity-10">
          <Dice6 className="h-12 w-12 md:h-16 md:w-16 text-emerald-300" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <Star className="h-3 w-3" />
              <span>Start Your Journey</span>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-white mb-2">D&D Learning Center</h1>
          <p className="text-white/60">Master the art of D&D through guided learning paths and practice</p>
        </div>
      </section>
      
      <div className="container mx-auto p-4 max-w-7xl">

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="paths" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Lessons
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="dm-guide" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              DM Guide
            </TabsTrigger>
            <TabsTrigger value="practice" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Practice
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-8">
              {/* Learning Paths */}
              <section>
                <h2 className="text-2xl font-bold font-fantasy mb-4">Choose Your Learning Path</h2>
                <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
                  {LEARNING_PATHS.map((path, index) => {
                    const IconComponent = path.icon;
                    return (
                      <Card 
                        key={index} 
                        className={`${path.color} ${path.darkColor} border-2 hover:shadow-lg transition-shadow cursor-pointer`}
                        onClick={() => setActiveTab("paths")}
                        data-testid={`overview-path-${index}`}
                      >
                        <CardHeader>
                          <div className="flex items-center gap-3 mb-2">
                            <IconComponent className="h-6 w-6" />
                            <CardTitle className="text-xl">{path.title}</CardTitle>
                          </div>
                          <CardDescription className="text-current/80">
                            {path.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Learning Steps:</h4>
                            <ol className="space-y-1 text-sm">
                              {path.steps.map((step, stepIndex) => (
                                <li key={stepIndex} className="flex items-start gap-2">
                                  <Badge variant="outline" className="flex-shrink-0 text-xs bg-current/10">
                                    {stepIndex + 1}
                                  </Badge>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-current/20">
                            <span className="text-xs">Est. {path.timeEstimate}</span>
                            <Badge variant="secondary" className="text-xs">
                              🏆 {path.completionReward}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>

              {/* Quick References */}
              <section>
                <h2 className="text-2xl font-bold font-fantasy mb-4">Quick Reference Cards</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {QUICK_REFERENCES.map((ref, index) => {
                    const IconComponent = ref.icon;
                    return (
                      <Card key={index}>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <IconComponent className="h-5 w-5 text-primary" />
                            {ref.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {ref.items.map((item, itemIndex) => (
                              <li key={itemIndex} className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>

              {/* Getting Started */}
              <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <GraduationCap className="h-6 w-6" />
                    Ready to Start Learning?
                  </CardTitle>
                  <CardDescription>
                    Jump into our interactive tools and guided experiences
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-semibold">For Players:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Explore the Rules Reference for instant lookup</li>
                      <li>• Create characters with guided explanations</li>
                      <li>• Practice with skill check scenarios</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">For DMs:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Use the DM Guide for session prep</li>
                      <li>• Practice with encounter design tools</li>
                      <li>• Learn improvisation techniques</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="paths">
            <LearningPathContent />
          </TabsContent>

          <TabsContent value="rules">
            <RulesReference />
          </TabsContent>

          <TabsContent value="dm-guide">
            <DMGuide />
          </TabsContent>

          <TabsContent value="practice">
            <PracticeModules />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}