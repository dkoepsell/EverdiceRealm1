import { ObjectStorageService } from "../server/replit_integrations/object_storage/objectStorage";
import { db } from "../server/db";
import { monsters } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const objectStorageService = new ObjectStorageService();

const monsterImageMap: Record<string, string> = {
  "Cragtooth Loper": "attached_assets/generated_images/cragtooth_loper_beast_creature.png",
  "Cragscale Basilisk": "attached_assets/generated_images/cragscale_basilisk_stone_creature.png",
};

const newMonsters = [
  {
    name: "Giant Wolf Spider",
    type: "Beast",
    size: "Medium",
    challenge_rating: "1/4",
    armor_class: 13,
    hit_points: 11,
    speed: "40 ft., climb 40 ft.",
    stats: "STR 12, DEX 16, CON 13, INT 3, WIS 12, CHA 4",
    skills: ["Perception +3", "Stealth +7"],
    senses: ["Blindsight 10 ft.", "Darkvision 60 ft."],
    description: "Smaller than a giant spider, a giant wolf spider hunts prey across open ground or hides in a burrow or crevice, or in a hidden cavity beneath debris.",
    lore: "Giant wolf spiders are ambush predators that pounce on prey. They are solitary hunters, using their keen senses to track prey. Their bite can paralyze victims with venom.",
    imagePath: "attached_assets/generated_images/giant_wolf_spider_monster.png",
    imageFileName: "monster_giant_wolf_spider.png",
  },
  {
    name: "Dire Wolf",
    type: "Beast",
    size: "Large",
    challenge_rating: "1",
    armor_class: 14,
    hit_points: 37,
    speed: "50 ft.",
    stats: "STR 17, DEX 15, CON 15, INT 3, WIS 12, CHA 7",
    skills: ["Perception +3", "Stealth +4"],
    senses: ["Darkvision 60 ft."],
    description: "A dire wolf is a massive wolf that stands as tall as a horse at the shoulder. They hunt in packs, coordinating attacks on prey much larger than themselves.",
    lore: "Pack Tactics: The dire wolf has advantage on attack rolls against a creature if at least one of the wolf's allies is within 5 feet of the creature. Dire wolves are often used as mounts by goblins and orcs.",
    imagePath: "attached_assets/generated_images/dire_wolf_beast_monster.png",
    imageFileName: "monster_dire_wolf.png",
  },
  {
    name: "Owlbear",
    type: "Monstrosity",
    size: "Large",
    challenge_rating: "3",
    armor_class: 13,
    hit_points: 59,
    speed: "40 ft.",
    stats: "STR 20, DEX 12, CON 17, INT 3, WIS 12, CHA 7",
    skills: ["Perception +3"],
    senses: ["Darkvision 60 ft."],
    description: "An owlbear's screech echoes through dark valleys and benighted forests, striking fear into the hearts of woodland creatures. With its powerful beak and crushing claws, it is a formidable predator.",
    lore: "An owlbear is a monstrous cross between a giant owl and a bear. It attacks anything that looks like food, fighting to the death. Owlbears are notoriously ill-tempered.",
    imagePath: "attached_assets/generated_images/owlbear_hybrid_monster.png",
    imageFileName: "monster_owlbear.png",
  },
  {
    name: "Skeleton",
    type: "Undead",
    size: "Medium",
    challenge_rating: "1/4",
    armor_class: 13,
    hit_points: 13,
    speed: "30 ft.",
    stats: "STR 10, DEX 14, CON 15, INT 6, WIS 8, CHA 5",
    immunities: ["Poison"],
    senses: ["Darkvision 60 ft."],
    description: "Skeletons are the animated bones of the dead, mindless automatons that obey the orders of their evil masters. Their hollow eye sockets blaze with sinister points of light.",
    lore: "Skeletons can be created by necromancers or dark magic. They follow simple commands and fight until destroyed. They are immune to exhaustion and cannot be frightened.",
    imagePath: "attached_assets/generated_images/skeleton_warrior_undead.png",
    imageFileName: "monster_skeleton.png",
  },
  {
    name: "Goblin",
    type: "Humanoid",
    size: "Small",
    challenge_rating: "1/4",
    armor_class: 15,
    hit_points: 7,
    speed: "30 ft.",
    stats: "STR 8, DEX 14, CON 10, INT 10, WIS 8, CHA 8",
    skills: ["Stealth +6"],
    senses: ["Darkvision 60 ft."],
    languages: ["Common", "Goblin"],
    description: "Goblins are small, black-hearted humanoids that lair in despoiled dungeons and other dismal settings. Individually weak, they gather in large numbers to torment other creatures.",
    lore: "Nimble Escape: The goblin can take the Disengage or Hide action as a bonus action on each of its turns. Goblins are cowardly and prefer ambushes and traps.",
    imagePath: "attached_assets/generated_images/goblin_scout_humanoid.png",
    imageFileName: "monster_goblin.png",
  },
];

async function main() {
  console.log("Starting monster image upload...");

  try {
    for (const [monsterName, imagePath] of Object.entries(monsterImageMap)) {
      if (!fs.existsSync(imagePath)) {
        console.log(`Image not found: ${imagePath}`);
        continue;
      }

      const fileName = `monster_${monsterName.toLowerCase().replace(/\s+/g, '_')}.png`;
      console.log(`Uploading ${monsterName} image...`);
      
      const imageUrl = await objectStorageService.uploadPublicFile(imagePath, fileName);
      console.log(`Uploaded to: ${imageUrl}`);

      await db.update(monsters)
        .set({ imageUrl })
        .where(eq(monsters.name, monsterName));
      console.log(`Updated database for ${monsterName}`);
    }

    for (const monster of newMonsters) {
      if (!fs.existsSync(monster.imagePath)) {
        console.log(`Image not found: ${monster.imagePath}`);
        continue;
      }

      console.log(`Processing ${monster.name}...`);
      
      const imageUrl = await objectStorageService.uploadPublicFile(monster.imagePath, monster.imageFileName);
      console.log(`Uploaded to: ${imageUrl}`);

      const existingMonster = await db.select().from(monsters).where(eq(monsters.name, monster.name));
      
      if (existingMonster.length === 0) {
        await db.insert(monsters).values({
          name: monster.name,
          type: monster.type,
          size: monster.size,
          challenge_rating: monster.challenge_rating,
          armor_class: monster.armor_class,
          hit_points: monster.hit_points,
          speed: monster.speed,
          stats: monster.stats,
          skills: monster.skills || [],
          senses: monster.senses || [],
          immunities: monster.immunities || [],
          languages: monster.languages || [],
          description: monster.description,
          lore: monster.lore,
          imageUrl,
          created_by: 1,
          is_public: true,
        });
        console.log(`Created new monster: ${monster.name}`);
      } else {
        await db.update(monsters)
          .set({ imageUrl })
          .where(eq(monsters.name, monster.name));
        console.log(`Updated existing monster: ${monster.name}`);
      }
    }

    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
