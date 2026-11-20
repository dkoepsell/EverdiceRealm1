/**
 * Count which 5e rules each player has seen fire (user_rules_seen). Feeds
 * "The rule underneath" (expanded the first few times) and Rules Learned.
 * Never throws: rules bookkeeping must not break a turn.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { userRulesSeen } from "@shared/schema";
import { RULE_EXPLAINERS } from "@shared/rules/ruleExplainers";

export interface RuleFired {
  id: string;
  name: string;
  body: string;
  /** How many times this player has now seen it fire (including this one). */
  count: number;
  /** Optional context line, e.g. "10 + Wisdom +2 + proficiency +2 = 14 vs DC 12". */
  detail?: string;
}

export async function recordRulesFired(
  userId: number,
  fired: { id: string; detail?: string }[],
): Promise<RuleFired[]> {
  const unique = Array.from(new Map(fired.filter((f) => RULE_EXPLAINERS[f.id]).map((f) => [f.id, f])).values());
  const out: RuleFired[] = [];
  for (const f of unique) {
    const ex = RULE_EXPLAINERS[f.id];
    let count = 1;
    try {
      const now = new Date().toISOString();
      const [row] = await db
        .insert(userRulesSeen)
        .values({ userId, ruleId: f.id, count: 1, lastSeenAt: now })
        .onConflictDoUpdate({
          target: [userRulesSeen.userId, userRulesSeen.ruleId],
          set: { count: sql`${userRulesSeen.count} + 1`, lastSeenAt: now },
        })
        .returning();
      count = row?.count ?? 1;
    } catch (err) {
      console.warn("[rulesSeen] record failed:", (err as Error)?.message);
    }
    out.push({ id: f.id, name: ex.name, body: ex.body, count, ...(f.detail ? { detail: f.detail } : {}) });
  }
  return out;
}

export async function rulesSeenFor(userId: number) {
  try {
    return await db.select().from(userRulesSeen).where(eq(userRulesSeen.userId, userId));
  } catch (err) {
    console.warn("[rulesSeen] read failed:", (err as Error)?.message);
    return [];
  }
}

export async function ruleSeenCount(userId: number, ruleId: string): Promise<number> {
  try {
    const [row] = await db.select().from(userRulesSeen)
      .where(and(eq(userRulesSeen.userId, userId), eq(userRulesSeen.ruleId, ruleId)));
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}
