import { ImagesResponse } from "openai/resources";
import { objectStorageClient } from "../replit_integrations/object_storage";
import { randomUUID } from "crypto";
import { getAppOpenAI } from "./aiProvider";

export async function generateUserAvatar(options: {
  username: string;
  style?: string;
}): Promise<{ url: string }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  const { username, style = "fantasy" } = options;
  
  const prompt = createAvatarPrompt(username, style);

  const openai = getAppOpenAI();

  try {
    console.log(`Generating avatar with prompt: ${prompt}`);
    
    const response: ImagesResponse = await openai.images.generate({
      model: "gpt-image-1", // current OpenAI image model (dall-e-3 rejects `style` and is deprecated)
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });

    // gpt-image-1 returns base64, not a URL.
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("No image data returned from OpenAI");
    }
    const imageBuffer = Buffer.from(b64, "base64");

    const persistentUrl = await saveAvatarToObjectStorage(imageBuffer, `avatars/${randomUUID()}.png`);

    return { url: persistentUrl };
  } catch (error: any) {
    console.error("Error generating avatar:", error.message);
    throw new Error(`Failed to generate avatar: ${error.message}`);
  }
}

async function saveAvatarToObjectStorage(imageBuffer: Buffer, objectPath: string): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    throw new Error("No DEFAULT_OBJECT_STORAGE_BUCKET_ID configured");
  }

  const bucket = objectStorageClient.bucket(bucketId);
  const fullObjectPath = `public/${objectPath}`;
  const file = bucket.file(fullObjectPath);

  await file.save(imageBuffer, {
    contentType: "image/png",
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  console.log(`Avatar saved to object storage: /objects/${objectPath}`);
  return `/objects/${objectPath}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

function createAvatarPrompt(username: string, style: string): string {
  const nameHash = hashString(username);
  
  const themes = [
    "mystical forest guardian",
    "brave adventurer",
    "wise wizard",
    "noble knight",
    "cunning rogue",
    "ancient dragon keeper",
    "celestial being",
    "elemental master"
  ];
  
  const backgrounds = [
    "magical glowing runes",
    "starlit night sky",
    "mystical forest",
    "ancient stone ruins",
    "crystalline cave",
    "enchanted library",
    "dragon's lair",
    "celestial clouds"
  ];
  
  const theme = themes[Math.abs(nameHash) % themes.length];
  const background = backgrounds[Math.abs(nameHash >> 4) % backgrounds.length];
  
  const skinTones = ["diverse skin tones", "varied ethnicities"];
  const skinTone = skinTones[Math.abs(nameHash >> 2) % skinTones.length];
  
  return `A stunning fantasy portrait avatar for a tabletop RPG player. The portrait shows a ${theme} with ${skinTone}, set against ${background}. The style is painterly and heroic, suitable for a profile picture. The composition is a bust/head-and-shoulders view, with dramatic lighting and rich colors. High quality digital fantasy art, inspired by classic fantasy book covers and RPG character art. No text or watermarks.`;
}
