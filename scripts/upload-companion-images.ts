import { ObjectStorageService } from "../server/replit_integrations/object_storage/objectStorage";
import { db } from "../server/db";
import { npcs } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";

const objectStorageService = new ObjectStorageService();

const companionImageMap: Record<string, string> = {
  "Valeria Swiftongue": "attached_assets/generated_images/valeria_swiftongue_half-elf_bard.png",
  "Grimshaw the Guardian": "attached_assets/generated_images/grimshaw_half-orc_mercenary_guardian.png",
  "Lyra Moonshadow": "attached_assets/generated_images/lyra_moonshadow_elf_healer.png",
  "Fizwick Gearloose": "attached_assets/generated_images/fizwick_gnome_tinkerer_expert.png",
};

async function main() {
  console.log("Starting companion image upload...");

  try {
    for (const [companionName, imagePath] of Object.entries(companionImageMap)) {
      if (!fs.existsSync(imagePath)) {
        console.log(`Image not found: ${imagePath}`);
        continue;
      }

      const fileName = `companion_${companionName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}.png`;
      console.log(`Uploading ${companionName} image...`);
      
      const imageUrl = await objectStorageService.uploadPublicFile(imagePath, fileName);
      console.log(`Uploaded to: ${imageUrl}`);

      await db.update(npcs)
        .set({ portraitUrl: imageUrl })
        .where(eq(npcs.name, companionName));
      console.log(`Updated database for ${companionName}`);
    }

    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
