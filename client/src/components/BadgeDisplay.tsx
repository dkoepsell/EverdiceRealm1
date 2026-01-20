import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Award, Star, Sparkles, Trophy, Shield, Crown, BookOpen, Swords, Users, HelpCircle } from "lucide-react";

interface BadgeData {
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  color: string;
  rarity: string;
  earnedAt?: string;
}

interface UserBadgeData {
  id: number;
  userId: number;
  badgeId: number;
  earnedAt: string;
  context: any;
  isFeatured: boolean;
  isHidden: boolean;
  badge: BadgeData;
}

const tierColors: Record<string, string> = {
  bronze: "from-amber-700 to-amber-500",
  silver: "from-gray-400 to-gray-300",
  gold: "from-yellow-500 to-amber-400",
  platinum: "from-purple-500 to-indigo-400"
};

const tierBorderColors: Record<string, string> = {
  bronze: "border-amber-600",
  silver: "border-gray-400",
  gold: "border-yellow-500",
  platinum: "border-purple-500"
};

const categoryIcons: Record<string, any> = {
  learning: BookOpen,
  gameplay: Swords,
  social: Users,
  dm: Crown
};

function BadgeIcon({ badge, size = "md" }: { badge: BadgeData; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8 text-lg",
    md: "w-12 h-12 text-2xl",
    lg: "w-16 h-16 text-3xl"
  };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center bg-gradient-to-br ${tierColors[badge.tier] || tierColors.bronze} border-2 ${tierBorderColors[badge.tier] || tierBorderColors.bronze} shadow-lg`}
      style={{ boxShadow: `0 0 10px ${badge.color}40` }}
    >
      <span>{badge.icon}</span>
    </div>
  );
}

export function BadgeDisplayCompact({ userId, maxBadges = 5 }: { userId?: number; maxBadges?: number }) {
  const { data: userBadges, isLoading } = useQuery<UserBadgeData[]>({
    queryKey: userId ? ["/api/users", userId, "badges"] : ["/api/my-badges"],
    enabled: true
  });

  if (isLoading) {
    return (
      <div className="flex gap-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!userBadges || userBadges.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No badges earned yet</p>
    );
  }

  const displayBadges = userBadges.slice(0, maxBadges);
  const remaining = userBadges.length - maxBadges;

  return (
    <TooltipProvider>
      <div className="flex gap-1 flex-wrap">
        {displayBadges.map((ub) => (
          <Tooltip key={ub.id}>
            <TooltipTrigger asChild>
              <div className="cursor-pointer hover:scale-110 transition-transform">
                <BadgeIcon badge={ub.badge} size="sm" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <p className="font-semibold">{ub.badge.name}</p>
                <p className="text-xs text-muted-foreground">{ub.badge.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Earned: {new Date(ub.earnedAt).toLocaleDateString()}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            +{remaining}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export function BadgeShowcase({ userId }: { userId?: number }) {
  const { data: userBadges, isLoading } = useQuery<UserBadgeData[]>({
    queryKey: userId ? ["/api/users", userId, "badges"] : ["/api/my-badges"],
    enabled: true
  });

  const { data: allBadges } = useQuery<BadgeData[]>({
    queryKey: ["/api/badges"]
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-muted mb-2" />
              <div className="w-20 h-4 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const earnedBadgeIds = new Set(userBadges?.map(ub => ub.badgeId) || []);

  return (
    <div className="space-y-6">
      {userBadges && userBadges.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Earned Badges ({userBadges.length})
          </h3>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {userBadges.map((ub) => (
              <Card key={ub.id} className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <BadgeIcon badge={ub.badge} size="md" />
                  <p className="font-semibold text-sm mt-2">{ub.badge.name}</p>
                  <p className="text-xs text-muted-foreground">{ub.badge.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs capitalize">
                    {ub.badge.tier}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(ub.earnedAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {allBadges && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Available Badges
          </h3>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {allBadges.filter(b => !earnedBadgeIds.has(b.id)).map((badge) => (
              <Card key={badge.id} className="opacity-60 hover:opacity-80 transition-opacity">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted border-2 border-dashed border-muted-foreground/30">
                    <span className="grayscale">{badge.icon}</span>
                  </div>
                  <p className="font-semibold text-sm mt-2 text-muted-foreground">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs capitalize opacity-50">
                    {badge.tier}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {(!userBadges || userBadges.length === 0) && (!allBadges || allBadges.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Badges Yet</h3>
            <p className="text-sm text-muted-foreground">
              Complete learning paths, finish adventures, and master skills to earn badges!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function BadgeMini({ badge }: { badge: BadgeData }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 cursor-pointer hover:scale-105 transition-transform">
            <span className="text-sm">{badge.icon}</span>
            <span className="text-xs font-medium">{badge.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{badge.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default BadgeShowcase;
