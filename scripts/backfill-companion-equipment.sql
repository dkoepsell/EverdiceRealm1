-- One-time backfill: give every existing companion a class-appropriate
-- weapon, armor, (shield), starting kit, and some gold — matching what newly
-- generated companions now receive (server/combatManager.ts:getCompanionStartingEquipment).
--
-- Run on the server (where the local Postgres lives):
--   set -a; source /root/EverdiceRealm1/.env; set +a
--   psql "$DATABASE_URL" -f /root/EverdiceRealm1/scripts/backfill-companion-equipment.sql
--
-- Idempotent: only fills fields that are currently empty. Existing gold,
-- weapons, armor, and equipment are preserved.

BEGIN;

-- 1) Base NPC companion records: weapon / armor / shield / gold / consumables.
UPDATE npcs n SET
  equipped_weapon = COALESCE(NULLIF(n.equipped_weapon, ''),
    CASE n.occupation
      WHEN 'Fighter' THEN 'Longsword'      WHEN 'Paladin' THEN 'Longsword'
      WHEN 'Cleric'  THEN 'Mace'           WHEN 'Barbarian' THEN 'Greataxe'
      WHEN 'Ranger'  THEN 'Shortbow'       WHEN 'Rogue' THEN 'Rapier'
      WHEN 'Bard'    THEN 'Rapier'         WHEN 'Druid' THEN 'Scimitar'
      WHEN 'Monk'    THEN 'Quarterstaff'   WHEN 'Warlock' THEN 'Light Crossbow'
      WHEN 'Wizard'  THEN 'Quarterstaff'   WHEN 'Sorcerer' THEN 'Dagger'
      ELSE 'Longsword' END),
  equipped_armor = COALESCE(NULLIF(n.equipped_armor, ''),
    CASE n.occupation
      WHEN 'Fighter' THEN 'Chain Mail'     WHEN 'Paladin' THEN 'Chain Mail'
      WHEN 'Cleric'  THEN 'Scale Mail'     WHEN 'Barbarian' THEN 'Hide Armor'
      WHEN 'Ranger'  THEN 'Leather Armor'  WHEN 'Rogue' THEN 'Leather Armor'
      WHEN 'Bard'    THEN 'Leather Armor'  WHEN 'Druid' THEN 'Leather Armor'
      WHEN 'Monk'    THEN 'Traveler''s Clothes' WHEN 'Warlock' THEN 'Leather Armor'
      WHEN 'Wizard'  THEN 'Robes'          WHEN 'Sorcerer' THEN 'Robes'
      ELSE 'Chain Mail' END),
  equipped_shield = COALESCE(n.equipped_shield,
    CASE n.occupation
      WHEN 'Fighter' THEN 'Shield'  WHEN 'Paladin' THEN 'Shield'
      WHEN 'Cleric'  THEN 'Shield'  WHEN 'Druid' THEN 'Wooden Shield'
      ELSE NULL END),
  gold = CASE WHEN COALESCE(n.gold, 0) <= 0
    THEN 30 + floor(random() * 31)::int + (GREATEST(1, COALESCE(n.level, 1)) - 1) * 20
    ELSE n.gold END,
  consumables = CASE WHEN n.consumables IS NULL OR n.consumables = '[]'::jsonb
    THEN '[{"name":"Potion of Healing","quantity":2,"type":"healing","effect":"Restores 2d4+2 HP","healDice":"2d4","healBonus":2}]'::jsonb
    ELSE n.consumables END,
  updated_at = now()::text
WHERE (n.is_companion = true OR n.is_stock_companion = true);

-- 2) Equipment list (runs after step 1 so it reuses the now-equipped gear).
UPDATE npcs n SET
  equipment = array_remove(
    ARRAY[n.equipped_weapon, n.equipped_armor, n.equipped_shield,
          'Backpack', 'Bedroll', 'Rations (5 days)', 'Waterskin'],
    NULL)
WHERE (n.is_companion = true OR n.is_stock_companion = true)
  AND (n.equipment IS NULL OR array_length(n.equipment, 1) IS NULL);

-- 3) Campaign links: the party UI shows a companion's gold from campaign_npcs.
UPDATE campaign_npcs cn SET gold = n.gold
FROM npcs n
WHERE cn.npc_id = n.id
  AND (n.is_companion = true OR n.is_stock_companion = true)
  AND COALESCE(cn.gold, 0) <= 0;

COMMIT;
