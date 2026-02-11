import OpenAI from "openai";
import { db } from "../db";
import { llmConfigs } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_MODEL = "gpt-4o";

const appOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function getAppOpenAI(): OpenAI {
  return appOpenAI;
}

export async function getAIClient(userId?: number): Promise<{ client: OpenAI; model: string; isCustom: boolean }> {
  if (!userId) {
    return { client: appOpenAI, model: DEFAULT_MODEL, isCustom: false };
  }

  try {
    const configs = await db
      .select()
      .from(llmConfigs)
      .where(and(eq(llmConfigs.userId, userId), eq(llmConfigs.isActive, true)))
      .limit(1);

    if (configs.length === 0) {
      return { client: appOpenAI, model: DEFAULT_MODEL, isCustom: false };
    }

    const config = configs[0];
    const clientOptions: any = {
      apiKey: config.apiKey,
    };

    if (config.endpoint) {
      clientOptions.baseURL = config.endpoint;
    }

    const client = new OpenAI(clientOptions);
    const model = config.model || DEFAULT_MODEL;

    return { client, model, isCustom: true };
  } catch (error) {
    console.error("Error loading user LLM config, falling back to app default:", error);
    return { client: appOpenAI, model: DEFAULT_MODEL, isCustom: false };
  }
}

export async function testAIConnection(
  provider: string,
  apiKey: string,
  endpoint?: string,
  model?: string
): Promise<{ success: boolean; message: string; modelUsed?: string }> {
  try {
    const clientOptions: any = { apiKey };
    if (endpoint) {
      clientOptions.baseURL = endpoint;
    }

    const client = new OpenAI(clientOptions);
    const testModel = model || DEFAULT_MODEL;

    const response = await client.chat.completions.create({
      model: testModel,
      messages: [{ role: "user", content: "Say 'Connection successful' in exactly two words." }],
      max_tokens: 10,
    });

    const reply = response.choices?.[0]?.message?.content || "";
    return {
      success: true,
      message: `Connected successfully. Response: "${reply.trim()}"`,
      modelUsed: testModel,
    };
  } catch (error: any) {
    let message = "Connection failed.";
    if (error.status === 401) {
      message = "Invalid API key. Please check your key and try again.";
    } else if (error.status === 404) {
      message = `Model "${model || DEFAULT_MODEL}" not found. Check your model name or endpoint.`;
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      message = "Could not reach the endpoint. Check the URL and make sure your LLM service is running.";
    } else if (error.message) {
      message = `Connection failed: ${error.message}`;
    }
    return { success: false, message };
  }
}
