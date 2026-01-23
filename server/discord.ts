// Everdice Discord Bot Integration
// Full slash command support for playing D&D campaigns through Discord
// Uses DISCORD_BOT_TOKEN environment variable for bot authentication

import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction, Events, ChannelType, ThreadChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const DISCORD_APP_ID = '1463731212848992426';

let discordClient: Client | null = null;
let isConnected = false;
let connectionError: string | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: NodeJS.Timeout | null = null;
let cachedStorage: any = null; // Store reference for reconnection
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second

// Forward declaration for reconnection
let initializeDiscordFn: ((storage: any) => Promise<boolean>) | null = null;

// Reconnect with exponential backoff
async function attemptReconnect(): Promise<void> {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('[Discord] Max reconnection attempts reached. Manual restart required.');
    return;
  }

  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 60000); // Cap at 60 seconds
  reconnectAttempts++;
  
  console.log(`[Discord] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
  
  reconnectTimeout = setTimeout(async () => {
    try {
      const token = process.env.DISCORD_BOT_TOKEN;
      if (!token) {
        console.error('[Discord] Cannot reconnect - no token');
        return;
      }

      // Destroy existing connection
      if (discordClient) {
        try {
          discordClient.destroy();
        } catch (e) {
          // Ignore destroy errors
        }
        discordClient = null;
      }
      
      // Re-initialize using stored function reference
      if (initializeDiscordFn) {
        await initializeDiscordFn(cachedStorage);
      } else {
        console.error('[Discord] Cannot reconnect - no initialization function stored');
      }
      
    } catch (error: any) {
      console.error('[Discord] Reconnection failed:', error.message);
      attemptReconnect(); // Try again
    }
  }, delay);
}

// Slash commands definition
const commands = [
  new SlashCommandBuilder()
    .setName('everdice')
    .setDescription('Everdice D&D Campaign Commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('link')
        .setDescription('Deploy an Everdice campaign - creates a dedicated channel')
        .addStringOption(option =>
          option.setName('code')
            .setDescription('Campaign deployment code from Everdice')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('connect')
        .setDescription('Connect your Discord account to your Everdice character'))
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
        .setName('dm')
        .setDescription('Send a DM narration to the campaign')
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Your narration or response to players')
            .setRequired(true)))
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

// Create a campaign channel in a "Campaigns" category
async function createCampaignChannel(guildId: string, campaignTitle: string): Promise<{ channelId: string; categoryId: string } | null> {
  if (!discordClient || !isConnected) {
    console.log('[Discord] Cannot create channel - not connected');
    return null;
  }

  try {
    const guild = await discordClient.guilds.fetch(guildId);
    if (!guild) {
      console.error('[Discord] Guild not found:', guildId);
      return null;
    }

    // Find or create "Everdice Campaigns" category
    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === 'Everdice Campaigns'
    );

    if (!category) {
      category = await guild.channels.create({
        name: 'Everdice Campaigns',
        type: ChannelType.GuildCategory,
        reason: 'Everdice campaign channels'
      });
      console.log('[Discord] Created Everdice Campaigns category');
    }

    // Create channel name from campaign title (lowercase, dashes, no special chars)
    const channelName = campaignTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 90) + '-campaign';

    // Create the campaign channel under the category with restricted permissions
    // Deny @everyone view access, allow bot full access
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Everdice Campaign: ${campaignTitle} | Use /everdice connect to join`,
      reason: `Everdice campaign deployment: ${campaignTitle}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: ['ViewChannel', 'SendMessages']
        },
        {
          id: discordClient!.user!.id,
          allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ManageMessages']
        }
      ]
    });

    console.log('[Discord] Created campaign channel:', channel.id);
    return { channelId: channel.id, categoryId: category.id };
  } catch (error: any) {
    console.error('[Discord] Failed to create campaign channel:', error.message);
    return null;
  }
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

        // Check if campaign is already deployed
        if (campaign.isDiscordDeployed && campaign.discordChannelId) {
          await interaction.reply({
            content: `⚠️ This campaign is already deployed to Discord! Use \`/everdice unlink\` in the linked channel first, or continue using the existing deployment.`,
            ephemeral: true
          });
          return;
        }

        await interaction.deferReply();

        // Create a dedicated channel for this campaign
        const channelResult = await createCampaignChannel(guildId!, campaign.title);
        
        if (!channelResult) {
          await interaction.editReply({
            content: '❌ Failed to create campaign channel. Make sure the bot has "Manage Channels" permission.',
          });
          return;
        }
        
        // Update campaign with Discord channel info
        await storage.updateCampaign(campaign.id, {
          discordGuildId: guildId,
          discordChannelId: channelResult.channelId,
          isDiscordDeployed: true
        });
        
        const embed = new EmbedBuilder()
          .setColor(0xD4A574)
          .setTitle('🗡️ Campaign Deployed!')
          .setDescription(`**${campaign.title}** now has its own channel!`)
          .addFields(
            { name: 'Campaign Channel', value: `<#${channelResult.channelId}>`, inline: true },
            { name: 'Session', value: `#${campaign.currentSession}`, inline: true },
            { name: 'Difficulty', value: campaign.difficulty, inline: true }
          )
          .setFooter({ text: 'Everdice • Your Adventure Awaits' });
        
        await interaction.editReply({ embeds: [embed] });

        // Send welcome message in the new channel
        const newChannel = await discordClient!.channels.fetch(channelResult.channelId) as TextChannel;
        if (newChannel) {
          const welcomeEmbed = new EmbedBuilder()
            .setColor(0xD4A574)
            .setTitle(`⚔️ Welcome to ${campaign.title}`)
            .setDescription('This channel is linked to your Everdice campaign. All game events will be posted here automatically.\n\n**Commands:**\n• `/everdice connect` - Link your Discord to your Everdice character\n• `/everdice roll 1d20` - Roll dice\n• `/everdice recap` - Get story recap\n• `/everdice status` - Campaign status')
            .setFooter({ text: 'Everdice • Let the adventure begin!' });
          await newChannel.send({ embeds: [welcomeEmbed] });
        }
        break;
      }

      case 'connect': {
        // Generate a connection code for the user
        const discordUserId = interaction.user.id;
        const discordUsername = interaction.user.username;
        
        // Check if already connected
        const existingUser = await storage.getUserByDiscordId(discordUserId);
        if (existingUser) {
          await interaction.reply({
            content: `✅ You're already connected as **${existingUser.username}** on Everdice!`,
            ephemeral: true
          });
          return;
        }

        // Create a connection code
        const connectionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Store the pending connection
        await storage.createDiscordConnection(discordUserId, discordUsername, connectionCode);

        const embed = new EmbedBuilder()
          .setColor(0x8B5CF6)
          .setTitle('🔗 Connect Your Account')
          .setDescription(`To link your Discord account to Everdice:\n\n1. Go to your **Everdice Profile**\n2. Click **Connect Discord**\n3. Enter this code: **\`${connectionCode}\`**\n\n*This code expires in 10 minutes.*`)
          .setFooter({ text: 'Everdice • Account Connection' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
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

      case 'dm': {
        const message = interaction.options.getString('message', true);
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }

        // Check if user is the campaign owner (DM)
        const discordUserId = interaction.user.id;
        const everdiceUser = await storage.getUserByDiscordId(discordUserId);
        
        if (!everdiceUser || everdiceUser.id !== campaign.userId) {
          await interaction.reply({
            content: '❌ Only the Dungeon Master can use this command.',
            ephemeral: true
          });
          return;
        }

        // Post the DM narration
        const embed = new EmbedBuilder()
          .setColor(0x8B5CF6)
          .setTitle('📖 The Dungeon Master Speaks')
          .setDescription(message.slice(0, 4000))
          .setFooter({ text: `DM: ${interaction.user.displayName}` })
          .setTimestamp();

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
    try {
      // Check if interaction was already replied to or deferred
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: '❌ Something went wrong. Please try again.',
        });
      } else {
        await interaction.reply({
          content: '❌ Something went wrong. Please try again.',
          ephemeral: true
        });
      }
    } catch (replyError: any) {
      // Silently fail if we can't respond (interaction may have expired)
      console.error('[Discord] Failed to send error response:', replyError.message);
    }
  }
}

// Initialize Discord client with slash command support
export async function initDiscord(storage?: any): Promise<boolean> {
  // Store references for reconnection
  initializeDiscordFn = initDiscord;
  if (storage) {
    cachedStorage = storage;
  }
  
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
      reconnectAttempts = 0; // Reset reconnection counter on successful connect
      
      // Clear any pending reconnect timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Register slash commands on startup
      await registerCommands();
    });

    // Handle slash command interactions
    if (storage) {
      discordClient.on(Events.InteractionCreate, async (interaction) => {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
          await handleInteraction(interaction, storage);
          return;
        }
        
        // Handle button clicks for campaign choices
        if (interaction.isButton()) {
          const customId = interaction.customId;
          
          // Parse choice button: choice_<campaignId>_<choiceIndex>
          if (customId.startsWith('choice_')) {
            const parts = customId.split('_');
            const campaignId = parseInt(parts[1]);
            const choiceIndex = parseInt(parts[2]);
            
            if (isNaN(campaignId) || isNaN(choiceIndex)) {
              await interaction.reply({ content: '❌ Invalid choice.', ephemeral: true });
              return;
            }

            // Check if user is connected to Everdice
            const everdiceUser = await storage.getUserByDiscordId(interaction.user.id);
            if (!everdiceUser) {
              await interaction.reply({ 
                content: '❌ Connect your Discord account first with `/everdice connect`', 
                ephemeral: true 
              });
              return;
            }

            // Check if user is a participant in this campaign
            const participants = await storage.getCampaignParticipants(campaignId);
            const isParticipant = participants.some((p: any) => p.userId === everdiceUser.id);
            
            if (!isParticipant) {
              await interaction.reply({ 
                content: '❌ You are not a participant in this campaign.', 
                ephemeral: true 
              });
              return;
            }

            // Get the current session to find the available choices
            const campaign = await storage.getCampaign(campaignId);
            if (!campaign) {
              await interaction.reply({ content: '❌ Campaign not found.', ephemeral: true });
              return;
            }

            const sessions = await storage.getCampaignSessions(campaignId);
            const currentSession = sessions.find((s: any) => s.sessionNumber === campaign.currentSession);
            
            if (!currentSession?.storyState) {
              await interaction.reply({ content: '❌ No active story to make choices in.', ephemeral: true });
              return;
            }

            const storyState = typeof currentSession.storyState === 'string' 
              ? JSON.parse(currentSession.storyState) 
              : currentSession.storyState;

            const choices = storyState.choices || [];
            if (choiceIndex >= choices.length) {
              await interaction.reply({ content: '❌ That choice is no longer available.', ephemeral: true });
              return;
            }

            const selectedChoice = choices[choiceIndex];
            
            // Store the pending choice for the web app to pick up
            await storage.createPendingDiscordChoice({
              campaignId: campaignId,
              sessionNumber: campaign.currentSession,
              discordUserId: interaction.user.id,
              userId: everdiceUser.id,
              choiceIndex: choiceIndex,
              choiceText: selectedChoice
            });

            // Acknowledge the choice
            await interaction.reply({ 
              content: `✅ **${interaction.user.displayName}** chose: "${selectedChoice}"\n\n*The story will advance when processed in Everdice.*`,
              ephemeral: false
            });

            console.log(`[Discord] Choice stored: Campaign ${campaignId}, Choice ${choiceIndex}: "${selectedChoice}" by ${interaction.user.displayName}`);
          }
        }
      });
    }

    discordClient.on('error', (error) => {
      console.error('[Discord] Client error:', error.message);
      connectionError = error.message;
      isConnected = false;
      attemptReconnect();
    });

    discordClient.on('disconnect', () => {
      console.log('[Discord] Disconnected');
      isConnected = false;
      attemptReconnect();
    });

    // Handle shard disconnect/reconnect events
    discordClient.on('shardDisconnect', (event, shardId) => {
      console.log(`[Discord] Shard ${shardId} disconnected`);
      isConnected = false;
      attemptReconnect();
    });

    discordClient.on('shardReconnecting', (shardId) => {
      console.log(`[Discord] Shard ${shardId} reconnecting...`);
    });

    discordClient.on('shardResume', (shardId) => {
      console.log(`[Discord] Shard ${shardId} resumed`);
      isConnected = true;
      reconnectAttempts = 0; // Reset on successful reconnection
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

// Grant a Discord user access to a campaign channel
export async function grantChannelAccess(channelId: string, discordUserId: string): Promise<boolean> {
  if (!discordClient || !isConnected) {
    console.log('[Discord] Cannot grant access - not connected');
    return false;
  }

  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      console.error('[Discord] Channel not found:', channelId);
      return false;
    }

    // Grant view and send permissions to the user
    await channel.permissionOverwrites.create(discordUserId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });

    console.log(`[Discord] Granted channel access to user ${discordUserId}`);
    return true;
  } catch (error: any) {
    console.error('[Discord] Failed to grant channel access:', error.message);
    return false;
  }
}

// Send a message to a Discord channel
export async function sendToChannel(channelId: string, message: string | EmbedBuilder, components?: ActionRowBuilder<ButtonBuilder>[]): Promise<boolean> {
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
      await channel.send({ content: message, components: components || [] });
    } else {
      await channel.send({ embeds: [message], components: components || [] });
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
  if (!campaign.discordChannelId || !campaign.isDiscordDeployed) {
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
        
        // Add choice buttons if choices are provided
        if (data?.choices && Array.isArray(data.choices) && data.choices.length > 0) {
          try {
            // Filter out empty/invalid choices and create buttons
            const validChoices = data.choices
              .filter((choice: any) => typeof choice === 'string' && choice.trim().length > 0)
              .slice(0, 5);
            
            if (validChoices.length > 0) {
              const buttons = validChoices.map((choice: string, index: number) => 
                new ButtonBuilder()
                  .setCustomId(`choice_${campaign.id}_${index}`)
                  .setLabel(choice.trim().slice(0, 80) || `Option ${index + 1}`)
                  .setStyle(ButtonStyle.Primary)
              );
              
              const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
              return await sendToChannel(campaign.discordChannelId, embed, [row]);
            }
          } catch (buttonError: any) {
            console.error('[Discord] Failed to create choice buttons:', buttonError.message);
            // Fall through to send without buttons
          }
        }
        // Send without buttons if no valid choices or button creation failed
        return await sendToChannel(campaign.discordChannelId, embed);
        break;
      case 'player_choice':
        embed = new EmbedBuilder()
          .setColor(0xD4A574) // Amber for player actions
          .setTitle(`⚔️ ${data?.characterName || 'A hero'} takes action`)
          .setDescription(data?.choice?.slice(0, 500) || 'Made a decision...');
        if (data?.rollResult != null && typeof data.rollResult === 'number') {
          const isNat20 = data.rollResult === 20;
          const isNat1 = data.rollResult === 1;
          const rollDisplay = data.rollBreakdown || `**${data.rollResult}**`;
          embed.addFields({
            name: isNat20 ? '✨ Natural 20!' : isNat1 ? '💀 Natural 1!' : '🎲 Roll Result',
            value: rollDisplay,
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
    
    return await sendToChannel(campaign.discordChannelId, embed);
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
