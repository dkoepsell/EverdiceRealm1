// Discord Integration for Everdice - RealmOfEverdice
// Uses Replit's Discord connection integration

import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=discord',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Discord not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableDiscordClient() {
  const token = await getAccessToken();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  await client.login(token);
  return client;
}

// Get list of guilds the bot has access to
export async function getDiscordGuilds() {
  try {
    const client = await getUncachableDiscordClient();
    const guilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount
    }));
    await client.destroy();
    return guilds;
  } catch (error) {
    console.error('Error fetching Discord guilds:', error);
    throw error;
  }
}

// Send a message to a specific channel
export async function sendDiscordMessage(channelId: string, message: string) {
  try {
    const client = await getUncachableDiscordClient();
    const channel = await client.channels.fetch(channelId);
    
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send(message);
    }
    
    await client.destroy();
    return { success: true };
  } catch (error) {
    console.error('Error sending Discord message:', error);
    throw error;
  }
}

// Post an announcement to the Everdice Discord
export async function postAnnouncement(title: string, content: string, channelId?: string) {
  const message = `**${title}**\n\n${content}\n\n*Posted from Everdice*`;
  
  // Use provided channelId or default announcement channel
  const targetChannel = channelId || process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
  
  if (!targetChannel) {
    throw new Error('No announcement channel configured');
  }
  
  return sendDiscordMessage(targetChannel, message);
}

// Post a campaign event to Discord
export async function postCampaignEvent(
  campaignTitle: string, 
  eventType: 'started' | 'completed' | 'session_ended',
  details?: string,
  channelId?: string
) {
  const eventMessages = {
    started: `🎲 **New Campaign Started!**\n\n"${campaignTitle}" has begun!\n${details || ''}`,
    completed: `🏆 **Campaign Completed!**\n\n"${campaignTitle}" has reached its epic conclusion!\n${details || ''}`,
    session_ended: `📜 **Session Complete**\n\n"${campaignTitle}" - another chapter written!\n${details || ''}`
  };
  
  const message = eventMessages[eventType] + '\n\n*— Everdice*';
  const targetChannel = channelId || process.env.DISCORD_EVENTS_CHANNEL_ID;
  
  if (!targetChannel) {
    console.log('No events channel configured, skipping Discord post');
    return { success: false, reason: 'No channel configured' };
  }
  
  return sendDiscordMessage(targetChannel, message);
}

// Post LFG (Looking for Group) to Discord
export async function postLFGToDiscord(
  username: string,
  characterName: string,
  characterClass: string,
  characterLevel: number,
  message: string,
  channelId?: string
) {
  const lfgMessage = `🎭 **Looking for Party!**

**Player:** ${username}
**Character:** ${characterName} (Level ${characterLevel} ${characterClass})

${message}

*Reply here or find them on Everdice!*`;

  const targetChannel = channelId || process.env.DISCORD_LFG_CHANNEL_ID;
  
  if (!targetChannel) {
    console.log('No LFG channel configured, skipping Discord post');
    return { success: false, reason: 'No channel configured' };
  }
  
  return sendDiscordMessage(targetChannel, lfgMessage);
}
