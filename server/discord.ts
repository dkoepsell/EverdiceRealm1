// Everdice Discord Bot Integration
// Full slash command support for playing D&D campaigns through Discord
// Uses DISCORD_BOT_TOKEN environment variable for bot authentication

import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction, Events, ChannelType, ThreadChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const DISCORD_APP_ID = '1463731212848992426';

let discordClient: Client | null = null;
let isConnected = false;
let connectionError: string | null = null;

// Slash commands definition
const commands = [
  new SlashCommandBuilder()
    .setName('everdice')
    .setDescription('Everdice D&D Campaign Commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('link')
        .setDescription('Link an Everdice campaign to this channel')
        .addStringOption(option =>
          option.setName('code')
            .setDescription('Campaign deployment code from Everdice')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('roll')
        .setDescription('Roll dice')
        .addStringOption(option =>
          option.setName('dice')
            .setDescription('Dice notation (e.g., 1d20+5, 2d6, 1d20 advantage)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('What is this roll for?')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('recap')
        .setDescription('Get the latest campaign recap'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Show current campaign status'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlink')
        .setDescription('Unlink this channel from its campaign'))
    .toJSON()
];

// Register slash commands with Discord
async function registerCommands(): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return false;

  try {
    const rest = new REST({ version: '10' }).setToken(token);
    console.log('[Discord] Registering slash commands...');
    
    await rest.put(
      Routes.applicationCommands(DISCORD_APP_ID),
      { body: commands }
    );
    
    console.log('[Discord] Slash commands registered successfully');
    return true;
  } catch (error: any) {
    console.error('[Discord] Failed to register commands:', error.message);
    return false;
  }
}

// Dice rolling logic
function rollDice(notation: string): { total: number; breakdown: string; rolls: number[]; isNat20: boolean; isNat1: boolean } {
  const normalized = notation.toLowerCase().trim();
  let isAdvantage = normalized.includes('advantage') || normalized.includes('adv');
  let isDisadvantage = normalized.includes('disadvantage') || normalized.includes('dis');
  
  // Clean notation
  let cleanNotation = normalized.replace(/advantage|disadvantage|adv|dis/gi, '').trim();
  
  // Parse dice notation: XdY+Z or XdY-Z
  const match = cleanNotation.match(/(\d*)d(\d+)([+-]\d+)?/);
  if (!match) {
    // Just a number
    const num = parseInt(cleanNotation) || 0;
    return { total: num, breakdown: `${num}`, rolls: [num], isNat20: false, isNat1: false };
  }
  
  const count = parseInt(match[1]) || 1;
  const sides = parseInt(match[2]);
  const modifier = parseInt(match[3]) || 0;
  
  let rolls: number[] = [];
  
  // Roll dice
  if (isAdvantage || isDisadvantage) {
    // For advantage/disadvantage, roll 2d20 and take best/worst
    const roll1 = Math.floor(Math.random() * sides) + 1;
    const roll2 = Math.floor(Math.random() * sides) + 1;
    rolls = [roll1, roll2];
    const chosen = isAdvantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
    const total = chosen + modifier;
    const advType = isAdvantage ? 'Advantage' : 'Disadvantage';
    const breakdown = `${advType}: [${roll1}, ${roll2}] → ${chosen}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''} = ${total}`;
    return { 
      total, 
      breakdown, 
      rolls, 
      isNat20: chosen === 20 && sides === 20, 
      isNat1: chosen === 1 && sides === 20 
    };
  }
  
  // Normal roll
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;
  
  let breakdown = '';
  if (count === 1) {
    breakdown = `[${rolls[0]}]`;
  } else {
    breakdown = `[${rolls.join(' + ')}] = ${sum}`;
  }
  if (modifier !== 0) {
    breakdown += ` ${modifier > 0 ? '+' : ''}${modifier} = ${total}`;
  }
  
  return { 
    total, 
    breakdown, 
    rolls, 
    isNat20: count === 1 && rolls[0] === 20 && sides === 20,
    isNat1: count === 1 && rolls[0] === 1 && sides === 20
  };
}

// Create dice roll embed for Discord
function createDiceRollEmbed(username: string, notation: string, result: ReturnType<typeof rollDice>, reason?: string) {
  let color = 0x3B82F6; // Blue default
  let title = `🎲 ${username} rolls ${notation}`;
  
  if (result.isNat20) {
    color = 0x22C55E; // Green for nat 20
    title = `✨ NATURAL 20! ${username} rolls ${notation}`;
  } else if (result.isNat1) {
    color = 0xEF4444; // Red for nat 1
    title = `💀 NATURAL 1! ${username} rolls ${notation}`;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: 'Result', value: `**${result.total}**`, inline: true },
      { name: 'Breakdown', value: result.breakdown, inline: true }
    );
  
  if (reason) {
    embed.addFields({ name: 'For', value: reason, inline: false });
  }
  
  return embed;
}

// Handle slash command interactions
async function handleInteraction(interaction: ChatInputCommandInteraction, storage: any) {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== 'everdice') return;

  const subcommand = interaction.options.getSubcommand();
  const channelId = interaction.channelId;
  const guildId = interaction.guildId;

  try {
    switch (subcommand) {
      case 'link': {
        const code = interaction.options.getString('code', true);
        
        // Find campaign by deployment code
        const campaign = await storage.getCampaignByDeploymentCode(code);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ Campaign not found. Make sure you have the correct deployment code from Everdice.',
            ephemeral: true
          });
          return;
        }
        
        // Update campaign with Discord channel info
        await storage.updateCampaign(campaign.id, {
          discordGuildId: guildId,
          discordChannelId: channelId,
          isDiscordDeployed: true
        });
        
        const embed = new EmbedBuilder()
          .setColor(0xD4A574)
          .setTitle('🗡️ Campaign Linked!')
          .setDescription(`**${campaign.title}** is now connected to this channel.`)
          .addFields(
            { name: 'Session', value: `#${campaign.currentSession}`, inline: true },
            { name: 'Difficulty', value: campaign.difficulty, inline: true }
          )
          .setFooter({ text: 'Everdice • Your Adventure Awaits' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'roll': {
        const dice = interaction.options.getString('dice', true);
        const reason = interaction.options.getString('reason') || undefined;
        
        const result = rollDice(dice);
        const embed = createDiceRollEmbed(interaction.user.displayName, dice, result, reason);
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'recap': {
        // Find campaign linked to this channel
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel. Use `/everdice link <code>` to connect a campaign.',
            ephemeral: true
          });
          return;
        }
        
        // Get latest session data for recap
        const sessions = await storage.getCampaignSessions(campaign.id);
        const currentSession = sessions.find((s: any) => s.sessionNumber === campaign.currentSession);
        
        let recapText = 'No story entries yet. Start playing to generate a recap!';
        if (currentSession?.storyState) {
          const storyState = typeof currentSession.storyState === 'string' 
            ? JSON.parse(currentSession.storyState) 
            : currentSession.storyState;
          
          if (storyState.narrative) {
            recapText = storyState.narrative.slice(0, 3500);
          } else if (storyState.currentScene) {
            recapText = storyState.currentScene.slice(0, 3500);
          }
        }
        
        const embed = new EmbedBuilder()
          .setColor(0x8B5CF6)
          .setTitle(`📜 ${campaign.title} - Session ${campaign.currentSession} Recap`)
          .setDescription(recapText)
          .setTimestamp()
          .setFooter({ text: 'Everdice • The Story So Far' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'status': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel. Use `/everdice link <code>` to connect a campaign.',
            ephemeral: true
          });
          return;
        }
        
        // Get participants
        const participants = await storage.getCampaignParticipants(campaign.id);
        const characterNames = [];
        for (const p of participants) {
          const char = await storage.getCharacter(p.characterId);
          if (char) characterNames.push(`${char.name} (${char.class} ${char.level})`);
        }
        
        const embed = new EmbedBuilder()
          .setColor(0xD4A574)
          .setTitle(`⚔️ ${campaign.title}`)
          .setDescription(campaign.description || 'An epic adventure awaits...')
          .addFields(
            { name: 'Session', value: `#${campaign.currentSession}`, inline: true },
            { name: 'Difficulty', value: campaign.difficulty, inline: true },
            { name: 'Style', value: campaign.narrativeStyle, inline: true }
          );
        
        if (characterNames.length > 0) {
          embed.addFields({ name: 'Adventurers', value: characterNames.join('\n'), inline: false });
        }
        
        embed.setFooter({ text: 'Everdice • Your Adventure Awaits' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'unlink': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        await storage.updateCampaign(campaign.id, {
          discordGuildId: null,
          discordChannelId: null,
          isDiscordDeployed: false
        });
        
        await interaction.reply({
          content: `✅ **${campaign.title}** has been unlinked from this channel.`,
          ephemeral: false
        });
        break;
      }
    }
  } catch (error: any) {
    console.error('[Discord] Command error:', error);
    await interaction.reply({
      content: '❌ Something went wrong. Please try again.',
      ephemeral: true
    });
  }
}

// Initialize Discord client with slash command support
export async function initDiscord(storage?: any): Promise<boolean> {
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

    discordClient.once('ready', async () => {
      console.log(`[Discord] Bot connected as ${discordClient?.user?.tag}`);
      isConnected = true;
      connectionError = null;
      
      // Register slash commands on startup
      await registerCommands();
    });

    // Handle slash command interactions
    if (storage) {
      discordClient.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        await handleInteraction(interaction, storage);
      });
    }

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

// Get Discord connection status
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
    .setColor(0xD4A574)
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
    .setColor(0x8B5CF6)
    .setTitle(`📜 Session ${sessionNumber} Recap: ${campaignTitle}`)
    .setDescription(recap.slice(0, 4000))
    .setTimestamp()
    .setFooter({ text: 'Everdice • Until Next Time' });
}

// Create a dice roll embed
export function createRollEmbed(characterName: string, rollType: string, result: number, breakdown: string) {
  const isNat20 = breakdown.includes('20');
  const isNat1 = breakdown.includes('(1)') || result === 1;
  
  let color = 0x3B82F6;
  let title = `🎲 ${characterName} - ${rollType}`;
  
  if (isNat20) {
    color = 0x22C55E;
    title = `✨ CRITICAL! ${characterName} - ${rollType}`;
  } else if (isNat1 && result < 10) {
    color = 0xEF4444;
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

// Post campaign event to Discord (for auto-posting from Everdice)
export async function postCampaignEvent(
  campaign: any, 
  eventType: 'session_start' | 'session_end' | 'story_update' | 'player_choice' | 'combat_round', 
  data?: any
): Promise<boolean> {
  console.log('[Discord postCampaignEvent] Called with:', { eventType, channelId: campaign.discordChannelId, isDeployed: campaign.isDiscordDeployed });
  
  if (!campaign.discordChannelId || !campaign.isDiscordDeployed) {
    console.log('[Discord postCampaignEvent] Skipping - campaign not deployed');
    return false;
  }

  try {
    let embed: EmbedBuilder;
    
    switch (eventType) {
      case 'session_start':
        embed = createSessionStartEmbed(campaign.title, campaign.currentSession, data?.dmName || 'The DM');
        break;
      case 'session_end':
        embed = createRecapEmbed(campaign.title, campaign.currentSession, data?.recap || 'Session complete!');
        break;
      case 'story_update':
        embed = new EmbedBuilder()
          .setColor(0x3B82F6)
          .setDescription(data?.content?.slice(0, 4000) || 'The adventure continues...')
          .setFooter({ text: 'Everdice • Live Update' });
        break;
      case 'player_choice':
        embed = new EmbedBuilder()
          .setColor(0xD4A574) // Amber for player actions
          .setTitle(`⚔️ ${data?.characterName || 'A hero'} takes action`)
          .setDescription(data?.choice?.slice(0, 500) || 'Made a decision...');
        if (data?.rollResult) {
          const isNat20 = data.rollResult === 20;
          const isNat1 = data.rollResult === 1;
          embed.addFields({
            name: isNat20 ? '✨ Natural 20!' : isNat1 ? '💀 Natural 1!' : '🎲 Roll Result',
            value: `**${data.rollResult}**`,
            inline: true
          });
          if (isNat20) embed.setColor(0x22C55E);
          if (isNat1) embed.setColor(0xEF4444);
        }
        embed.setFooter({ text: 'Everdice • Player Action' });
        break;
      case 'combat_round':
        embed = new EmbedBuilder()
          .setColor(0xEF4444) // Red for combat
          .setTitle(`⚔️ Combat Round ${data?.round || ''}`)
          .setDescription(data?.description?.slice(0, 1000) || 'The battle rages on...');
        if (data?.combatants && data.combatants.length > 0) {
          const combatantList = data.combatants
            .slice(0, 10)
            .map((c: any) => `${c.type === 'enemy' ? '👹' : '🛡️'} ${c.name}: ${c.currentHp}/${c.maxHp} HP`)
            .join('\n');
          embed.addFields({ name: 'Combatants', value: combatantList, inline: false });
        }
        embed.setFooter({ text: 'Everdice • Combat Update' });
        break;
      default:
        return false;
    }
    
    console.log('[Discord postCampaignEvent] Sending to channel...');
    const result = await sendToChannel(campaign.discordChannelId, embed);
    console.log('[Discord postCampaignEvent] Send result:', result);
    return result;
  } catch (error: any) {
    console.error('[Discord] Failed to post campaign event:', error.message);
    return false;
  }
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
