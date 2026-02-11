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
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const imageData = response.data?.[0];
    if (!imageData || !imageData.url) {
      throw new Error("No image data returned from OpenAI");
    }
    
    const persistentUrl = await saveAvatarToObjectStorage(imageData.url, `avatars/${randomUUID()}.png`);
    
    return { url: persistentUrl };
  } catch (error: any) {
    console.error("Error generating avatar:", error.message);
    throw new Error(`Failed to generate avatar: ${error.message}`);
  }
}

async function saveAvatarToObjectStorage(imageUrl: string, objectPath: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    
    if (!bucketId) {
      console.warn("No DEFAULT_OBJECT_STORAGE_BUCKET_ID configured, using temporary URL");
      return imageUrl;
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
  } catch (error: any) {
    console.error("Error saving avatar to object storage:", error.message);
    console.warn("Falling back to temporary DALL-E URL");
    return imageUrl;
  }
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
