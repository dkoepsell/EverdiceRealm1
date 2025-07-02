import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { HelpCircle, Target, TrendingUp, Users, AlertCircle } from "lucide-react";

interface SkillCheckExplainerProps {
  skill: string;
  roll: number;
  modifier: number;
  total: number;
  dc?: number;
  success?: boolean;
  context?: string;
}

const SKILL_INFO: Record<string, {
  description: string;
  ability: string;
  whenToUse: string[];
  tips: string[];
  commonDCs: { easy: number; medium: number; hard: number };
}> = {
  "Animal Handling": {
    description: "Your ability to calm down and control animals",
    ability: "Wisdom",
    whenToUse: [
      "Calming a frightened horse",
      "Training a companion animal",
      "Approaching wild animals safely"
    ],
    tips: [
      "Works best when you're not threatening the animal",
      "Consider the animal's nature and current state",
      "May require multiple attempts for complex training"
    ],
    commonDCs: { easy: 10, medium: 13, hard: 17 }
  },
  "Perception": {
    description: "How aware you are of your surroundings",
    ability: "Wisdom",
    whenToUse: [
      "Looking for hidden doors or traps",
      "Hearing approaching enemies",
      "Spotting important details in a room"
    ],
    tips: [
      "Passive Perception is always active (10 + modifier)",
      "Tell your DM what you're specifically looking for",
      "Works better when you take your time"
    ],
    commonDCs: { easy: 10, medium: 15, hard: 20 }
  },
  "Persuasion": {
    description: "Influencing others through charm and reasoning",
    ability: "Charisma",
    whenToUse: [
      "Convincing someone to help you",
      "Negotiating better deals",
      "Rallying allies in difficult situations"
    ],
    tips: [
      "Explain your reasoning, don't just roll",
      "Consider what the other person wants",
      "Build rapport before making big requests"
    ],
    commonDCs: { easy: 10, medium: 15, hard: 20 }
  },
  "Investigation": {
    description: "Actively searching and reasoning through clues",
    ability: "Intelligence",
    whenToUse: [
      "Searching for specific hidden objects",
      "Analyzing crime scenes",
      "Researching in libraries or archives"
    ],
    tips: [
      "Different from Perception - this is logical deduction",
      "Tell your DM what you're investigating",
      "Take notes on what you discover"
    ],
    commonDCs: { easy: 10, medium: 15, hard: 20 }
  },
  "Stealth": {
    description: "Moving quietly and staying hidden",
    ability: "Dexterity",
    whenToUse: [
      "Sneaking past guards",
      "Hiding from enemies",
      "Moving without making noise"
    ],
    tips: [
      "Consider your armor and equipment weight",
      "Move slowly for better chances",
      "Use cover and shadows to your advantage"
    ],
    commonDCs: { easy: 10, medium: 15, hard: 20 }
  }
};

export function SkillCheckExplainer({ skill, roll, modifier, total, dc, success, context }: SkillCheckExplainerProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const skillInfo = SKILL_INFO[skill];
  const successRate = dc ? Math.min(Math.max((total - dc + 10) * 5, 5), 95) : null;
  
  if (!skillInfo) return null;

  const getDifficultyLabel = (dc: number) => {
    if (dc <= 10) return { label: "Easy", color: "bg-green-500" };
    if (dc <= 15) return { label: "Medium", color: "bg-yellow-500" };
    if (dc <= 20) return { label: "Hard", color: "bg-red-500" };
    return { label: "Very Hard", color: "bg-purple-500" };
  };

  const rollBreakdown = (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
        <span className="font-medium">Roll Breakdown:</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline">d20: {roll}</Badge>
          <span>+</span>
          <Badge variant="outline">{skillInfo.ability} Mod: {modifier >= 0 ? '+' : ''}{modifier}</Badge>
          <span>=</span>
          <Badge variant={success ? "default" : "secondary"}>Total: {total}</Badge>
        </div>
      </div>
      
      {dc && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="font-medium">Target Number (DC):</span>
          <div className="flex items-center gap-2">
            <Badge className={getDifficultyLabel(dc).color}>{dc}</Badge>
            <Badge variant="outline">{getDifficultyLabel(dc).label}</Badge>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {skill} Check Explained
          </DialogTitle>
          <DialogDescription>
            Understanding your {skill} ({skillInfo.ability}) check
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Roll Result */}
          <Card className={`border-2 ${success ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {success ? '✅ Success!' : '❌ Failed'}
                {context && <Badge variant="outline" className="text-xs">{context}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rollBreakdown}
              {successRate && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Success Probability with your modifier:</span>
                    <span className="font-medium">{successRate}%</span>
                  </div>
                  <Progress value={successRate} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skill Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                What is {skill}?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{skillInfo.description}</p>
              
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  When to use {skill}:
                </h4>
                <ul className="text-sm space-y-1">
                  {skillInfo.whenToUse.map((use, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{use}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Pro Tips:
                </h4>
                <ul className="text-sm space-y-1">
                  {skillInfo.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground">💡</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Difficulty Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Difficulty Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg text-center">
                  <div className="font-semibold text-green-800 dark:text-green-200">Easy</div>
                  <div className="text-2xl font-bold text-green-600">DC {skillInfo.commonDCs.easy}</div>
                  <div className="text-xs text-green-700 dark:text-green-300">Routine tasks</div>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg text-center">
                  <div className="font-semibold text-yellow-800 dark:text-yellow-200">Medium</div>
                  <div className="text-2xl font-bold text-yellow-600">DC {skillInfo.commonDCs.medium}</div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300">Challenging</div>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg text-center">
                  <div className="font-semibold text-red-800 dark:text-red-200">Hard</div>
                  <div className="text-2xl font-bold text-red-600">DC {skillInfo.commonDCs.hard}</div>
                  <div className="text-xs text-red-700 dark:text-red-300">Difficult feats</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Learning Note */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">📚</div>
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Learning Opportunity</p>
                  <p className="text-blue-800 dark:text-blue-200">
                    Each skill check is a chance to learn! Consider how your character's background, 
                    personality, and experiences might influence their approach to this challenge.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}