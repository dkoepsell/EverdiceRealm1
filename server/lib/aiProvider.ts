import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { llmConfigs } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

const appOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function getAppOpenAI(): OpenAI {
  return appOpenAI;
}

function makeAnthropicAdapter(apiKey: string): OpenAI {
  const anthropic = new Anthropic({ apiKey });

  const adapter: any = {
    chat: {
      completions: {
        create: async (params: any) => {
          const messages = params.messages || [];
          const systemMessages = messages
            .filter((m: any) => m.role === "system")
            .map((m: any) => m.content)
            .join("\n\n");
          const nonSystemMessages = messages
            .filter((m: any) => m.role !== "system")
            .map((m: any) => ({ role: m.role, content: m.content }));

          if (nonSystemMessages.length === 0) {
            nonSystemMessages.push({ role: "user", content: "Begin." });
          }

          const requestParams: any = {
            model: params.model || DEFAULT_ANTHROPIC_MODEL,
            max_tokens: params.max_tokens || 1024,
            messages: nonSystemMessages,
          };
          if (systemMessages) {
            requestParams.system = systemMessages;
          }
          if (params.temperature !== undefined) {
            requestParams.temperature = Math.min(params.temperature, 1.0);
          }

          if (params.stream) {
            try {
              const stream = await anthropic.messages.stream(requestParams);
              return {
                [Symbol.asyncIterator]: async function* () {
                  try {
                    for await (const event of stream) {
                      if (
                        event.type === "content_block_delta" &&
                        event.delta.type === "text_delta"
                      ) {
                        yield {
                          choices: [
                            {
                              delta: { content: event.delta.text, role: "assistant" },
                              finish_reason: null,
                            },
                          ],
                        };
                      } else if (event.type === "message_stop") {
                        yield {
                          choices: [{ delta: {}, finish_reason: "stop" }],
                        };
                      }
                    }
                  } catch (streamIterErr: any) {
                    if (streamIterErr?.status === 404 || streamIterErr?.error?.error?.type === "not_found_error") {
                      console.warn(`Anthropic streaming model not found — falling back to app default AI (${DEFAULT_MODEL})`);
                      const fallback = await appOpenAI.chat.completions.create({ ...params, model: DEFAULT_MODEL });
                      for await (const chunk of fallback as any) {
                        yield chunk;
                      }
                    } else {
                      throw streamIterErr;
                    }
                  }
                },
              };
            } catch (streamInitErr: any) {
              if (streamInitErr?.status === 404 || streamInitErr?.error?.error?.type === "not_found_error") {
                console.warn(`Anthropic streaming model "${requestParams.model}" not found — falling back to app default AI (${DEFAULT_MODEL})`);
                return appOpenAI.chat.completions.create({ ...params, model: DEFAULT_MODEL });
              }
              if (streamInitErr?.status === 401 || streamInitErr?.status === 403) {
                console.warn(`Anthropic streaming API key invalid — falling back to app default AI (${DEFAULT_MODEL})`);
                return appOpenAI.chat.completions.create({ ...params, model: DEFAULT_MODEL });
              }
              throw streamInitErr;
            }
          }

          try {
            const response = await anthropic.messages.create(requestParams);
            const content =
              response.content?.[0]?.type === "text"
                ? response.content[0].text
                : "";

            return {
              choices: [
                {
                  message: { role: "assistant", content },
                  finish_reason: response.stop_reason || "stop",
                },
              ],
              usage: {
                prompt_tokens: response.usage?.input_tokens || 0,
                completion_tokens: response.usage?.output_tokens || 0,
                total_tokens:
                  (response.usage?.input_tokens || 0) +
                  (response.usage?.output_tokens || 0),
              },
            };
          } catch (anthropicErr: any) {
            if (anthropicErr?.status === 404 || anthropicErr?.error?.error?.type === "not_found_error") {
              console.warn(`Anthropic model "${requestParams.model}" not found on this account — falling back to app default AI (${DEFAULT_MODEL})`);
              return appOpenAI.chat.completions.create({ ...params, model: DEFAULT_MODEL });
            }
            if (anthropicErr?.status === 401 || anthropicErr?.status === 403) {
              console.warn(`Anthropic API key invalid or unauthorized — falling back to app default AI (${DEFAULT_MODEL})`);
              return appOpenAI.chat.completions.create({ ...params, model: DEFAULT_MODEL });
            }
            throw anthropicErr;
          }
        },
      },
    },
  };

  return adapter as OpenAI;
}

export async function getAIClient(
  userId?: number
): Promise<{ client: OpenAI; model: string; isCustom: boolean }> {
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

    if (config.provider === "anthropic") {
      const client = makeAnthropicAdapter(config.apiKey);
      const model = config.model || DEFAULT_ANTHROPIC_MODEL;
      return { client, model, isCustom: true };
    }

    const clientOptions: any = { apiKey: config.apiKey };
    if (config.endpoint) {
      clientOptions.baseURL = config.endpoint;
    }

    const client = new OpenAI(clientOptions);
    const model = config.model || DEFAULT_MODEL;
    return { client, model, isCustom: true };
  } catch (error) {
    console.error(
      "Error loading user LLM config, falling back to app default:",
      error
    );
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
    if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey });
      const testModel = model || DEFAULT_ANTHROPIC_MODEL;

      // First, discover what models are actually on this account
      let availableModels: string[] = [];
      try {
        const modelsPage = await anthropic.models.list({ limit: 20 });
        availableModels = modelsPage.data?.map((m: any) => m.id) || [];
      } catch (listErr: any) {
        if (listErr?.status === 401 || listErr?.status === 403) {
          return { success: false, message: "Invalid Anthropic API key. Please check your key in the Anthropic console at console.anthropic.com and try again." };
        }
        if (listErr?.status === 403) {
          return { success: false, message: "Your Anthropic API key does not have permission to access the API. Make sure billing is enabled at console.anthropic.com/settings/billing." };
        }
        // If model listing fails for other reasons, fall through to direct test
      }

      if (availableModels.length > 0 && !availableModels.includes(testModel)) {
        const suggestions = availableModels.slice(0, 3).join(", ");
        return {
          success: false,
          message: `Model "${testModel}" is not on your account. Your available models include: ${suggestions}. Update your model selection to one of these.`,
        };
      }

      try {
        const response = await anthropic.messages.create({
          model: testModel,
          max_tokens: 16,
          messages: [{ role: "user", content: "Say 'Connection successful' in exactly two words." }],
        });
        const reply = response.content?.[0]?.type === "text" ? response.content[0].text : "";
        return {
          success: true,
          message: `Connected successfully using ${testModel}. Response: "${reply.trim()}"`,
          modelUsed: testModel,
        };
      } catch (err: any) {
        if (err?.status === 404 || err?.error?.error?.type === "not_found_error") {
          if (availableModels.length > 0) {
            return {
              success: false,
              message: `Model "${testModel}" is not available. Your account has access to: ${availableModels.slice(0, 3).join(", ")}. Select one of these from the model dropdown.`,
            };
          }
          return {
            success: false,
            message: `No Claude models are accessible with this API key. Please ensure your Anthropic account has billing enabled at console.anthropic.com/settings/billing, then generate a new API key.`,
          };
        }
        if (err?.status === 401 || err?.status === 403) {
          return { success: false, message: "Invalid Anthropic API key. Check your key at console.anthropic.com." };
        }
        throw err;
      }
    }

    const clientOptions: any = { apiKey };
    if (endpoint) {
      clientOptions.baseURL = endpoint;
    }

    const client = new OpenAI(clientOptions);
    const testModel = model || DEFAULT_MODEL;

    const response = await client.chat.completions.create({
      model: testModel,
      messages: [
        {
          role: "user",
          content: "Say 'Connection successful' in exactly two words.",
        },
      ],
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
    if (error.status === 401 || error.status === 403) {
      message = "Invalid API key. Please check your key and try again.";
    } else if (error.status === 404) {
      message = `Model not found. Check your model name or endpoint.`;
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      message =
        "Could not reach the endpoint. Check the URL and make sure your LLM service is running.";
    } else if (error.message) {
      message = `Connection failed: ${error.message}`;
    }
    return { success: false, message };
  }
}
