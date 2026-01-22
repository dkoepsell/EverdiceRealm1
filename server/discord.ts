// Everdice Discord Bot Integration
// Uses DISCORD_BOT_TOKEN environment variable for bot authentication
// This module is designed to fail gracefully without crashing the main app

import { Client, GatewayIntentBits, TextChannel, EmbedBuilder } from 'discord.js';

let discordClient: Client | null = null;
let isConnected = false;
let connectionError: string | null = null;

// Initialize Discord client (called on startup, fails gracefully)
export async function initDiscord(): Promise<boolean> {
  try {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      connectionError = 'Discord bot token not configured - add DISCORD_BOT_TOKEN secret';
      console.log('[Discord] No bot token found');
      return false;
    }

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds
      ]
    });

    discordClient.once('ready', () => {
      console.log(`[Discord] Bot connected as ${discordClient?.user?.tag}`);
      isConnected = true;
      connectionError = null;
    });

    discordClient.on('error', (error) => {
      console.error('[Discord] Client error:', error.message);
      connectionError = error.message;
      isConnected = false;
    });

    discordClient.on('disconnect', () => {
      console.log('[Discord] Disconnected');
      isConnected = false;
    });

    await discordClient.login(token);
    return true;
  } catch (error: any) {
    console.error('[Discord] Failed to initialize:', error.message);
    connectionError = error.message;
    isConnected = false;
    discordClient = null;
    return false;
  }
}

// Get Discord connection status (for API endpoints)
export function getDiscordStatus() {
  return {
    connected: isConnected,
    error: connectionError,
    username: discordClient?.user?.tag || null,
    guilds: discordClient?.guilds?.cache?.map(g => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount
    })) || []
  };
}

// Send a message to a Discord channel
export async function sendToChannel(channelId: string, message: string | EmbedBuilder): Promise<boolean> {
  if (!discordClient || !isConnected) {
    console.log('[Discord] Cannot send message - not connected');
    return false;
  }

  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      console.error('[Discord] Channel not found or not a text channel:', channelId);
      return false;
    }

    if (typeof message === 'string') {
      await channel.send(message);
    } else {
      await channel.send({ embeds: [message] });
    }
    return true;
  } catch (error: any) {
    console.error('[Discord] Failed to send message:', error.message);
    return false;
  }
}

// Create a session start embed
export function createSessionStartEmbed(campaignTitle: string, sessionNumber: number, dmName: string) {
  return new EmbedBuilder()
    .setColor(0xD4A574) // Amber/parchment color
    .setTitle(`🗡️ Session ${sessionNumber}: ${campaignTitle}`)
    .setDescription('A new chapter begins...')
    .addFields(
      { name: 'Dungeon Master', value: dmName, inline: true },
      { name: 'Session', value: `#${sessionNumber}`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'Everdice • Your Adventure Awaits' });
}

// Create a session end/recap embed
export function createRecapEmbed(campaignTitle: string, sessionNumber: number, recap: string) {
  return new EmbedBuilder()
    .setColor(0x8B5CF6) // Purple color
    .setTitle(`📜 Session ${sessionNumber} Recap: ${campaignTitle}`)
    .setDescription(recap.slice(0, 4000)) // Discord limit
    .setTimestamp()
    .setFooter({ text: 'Everdice • Until Next Time' });
}

// Create a dice roll embed
export function createRollEmbed(characterName: string, rollType: string, result: number, breakdown: string) {
  const isNat20 = breakdown.includes('20');
  const isNat1 = breakdown.includes('(1)') || result === 1;
  
  let color = 0x3B82F6; // Blue default
  let title = `🎲 ${characterName} - ${rollType}`;
  
  if (isNat20) {
    color = 0x22C55E; // Green for crit
    title = `✨ CRITICAL! ${characterName} - ${rollType}`;
  } else if (isNat1 && result < 10) {
    color = 0xEF4444; // Red for fumble
    title = `💀 Critical Fail! ${characterName} - ${rollType}`;
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: 'Result', value: `**${result}**`, inline: true },
      { name: 'Roll', value: breakdown, inline: true }
    );
}

// Graceful shutdown
export async function shutdownDiscord() {
  if (discordClient) {
    console.log('[Discord] Shutting down...');
    discordClient.destroy();
    discordClient = null;
    isConnected = false;
  }
}
