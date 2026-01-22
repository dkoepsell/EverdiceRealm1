// Everdice Discord Bot Integration
// Full slash command support for playing D&D campaigns through Discord
// Uses DISCORD_BOT_TOKEN environment variable for bot authentication

import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction, Events, ChannelType, ThreadChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const DISCORD_APP_ID = '1463731212848992426';

let discordClient: Client | null = null;
let isConnected = false;
let connectionError: string | null = null;

// D&D 5e stat abbreviations to full names
const STAT_NAMES: Record<string, string> = {
  str: 'Strength', strength: 'Strength',
  dex: 'Dexterity', dexterity: 'Dexterity',
  con: 'Constitution', constitution: 'Constitution',
  int: 'Intelligence', intelligence: 'Intelligence',
  wis: 'Wisdom', wisdom: 'Wisdom',
  cha: 'Charisma', charisma: 'Charisma'
};

// D&D 5e skills and their associated stats
const SKILLS: Record<string, string> = {
  acrobatics: 'dexterity',
  'animal-handling': 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  'sleight-of-hand': 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom'
};

// Calculate ability modifier from score
function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// Slash commands definition
const commands = [
  new SlashCommandBuilder()
    .setName('everdice')
    .setDescription('Everdice D&D Campaign Commands')
    // Core commands
    .addSubcommand(subcommand =>
      subcommand
        .setName('help')
        .setDescription('Show all available commands'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('ping')
        .setDescription('Check bot latency'))
    // Campaign commands
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
        .setName('unlink')
        .setDescription('Unlink this channel from its campaign'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Show current campaign status'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('recap')
        .setDescription('Get the latest campaign recap'))
    // Session commands
    .addSubcommand(subcommand =>
      subcommand
        .setName('start-session')
        .setDescription('Start a new game session (DM only)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause-session')
        .setDescription('Pause the current session (DM only)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('end-session')
        .setDescription('End the current session with recap (DM only)'))
    // Dice & mechanics commands
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
        .setName('save')
        .setDescription('Make a saving throw')
        .addStringOption(option =>
          option.setName('stat')
            .setDescription('Ability score (str, dex, con, int, wis, cha)')
            .setRequired(true)
            .addChoices(
              { name: 'Strength', value: 'str' },
              { name: 'Dexterity', value: 'dex' },
              { name: 'Constitution', value: 'con' },
              { name: 'Intelligence', value: 'int' },
              { name: 'Wisdom', value: 'wis' },
              { name: 'Charisma', value: 'cha' }
            ))
        .addStringOption(option =>
          option.setName('modifier')
            .setDescription('Additional modifier (optional)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('skill')
        .setDescription('Make a skill check')
        .addStringOption(option =>
          option.setName('skill')
            .setDescription('Skill to check')
            .setRequired(true)
            .addChoices(
              { name: 'Acrobatics', value: 'acrobatics' },
              { name: 'Animal Handling', value: 'animal-handling' },
              { name: 'Arcana', value: 'arcana' },
              { name: 'Athletics', value: 'athletics' },
              { name: 'Deception', value: 'deception' },
              { name: 'History', value: 'history' },
              { name: 'Insight', value: 'insight' },
              { name: 'Intimidation', value: 'intimidation' },
              { name: 'Investigation', value: 'investigation' },
              { name: 'Medicine', value: 'medicine' },
              { name: 'Nature', value: 'nature' },
              { name: 'Perception', value: 'perception' },
              { name: 'Performance', value: 'performance' },
              { name: 'Persuasion', value: 'persuasion' },
              { name: 'Religion', value: 'religion' },
              { name: 'Sleight of Hand', value: 'sleight-of-hand' },
              { name: 'Stealth', value: 'stealth' },
              { name: 'Survival', value: 'survival' }
            ))
        .addStringOption(option =>
          option.setName('modifier')
            .setDescription('Additional modifier or advantage/disadvantage')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('initiative')
        .setDescription('Roll initiative'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('damage')
        .setDescription('Apply damage to a character')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Amount of damage to apply')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('target')
            .setDescription('Target character name (defaults to your character)')
            .setRequired(false)))
    // Scene & NPC commands
    .addSubcommand(subcommand =>
      subcommand
        .setName('scene')
        .setDescription('View or control the current scene')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Scene action')
            .setRequired(false)
            .addChoices(
              { name: 'Current (show current scene)', value: 'current' },
              { name: 'Next (advance to next scene)', value: 'next' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('npc')
        .setDescription('View NPC information')
        .addStringOption(option =>
          option.setName('action')
            .setDescription('NPC action')
            .setRequired(true)
            .addChoices(
              { name: 'List (show all NPCs)', value: 'list' },
              { name: 'Show (view specific NPC)', value: 'show' }
            ))
        .addStringOption(option =>
          option.setName('name')
            .setDescription('NPC name (for show action)')
            .setRequired(false)))
    // Player commands
    .addSubcommand(subcommand =>
      subcommand
        .setName('my-character')
        .setDescription('View your linked character'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('inventory')
        .setDescription('View your inventory'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('hp')
        .setDescription('View or adjust your hit points')
        .addIntegerOption(option =>
          option.setName('change')
            .setDescription('HP change (positive for healing, negative for damage)')
            .setRequired(false)))
    // Configuration commands
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Configure bot settings for this server (DM only)')
        .addStringOption(option =>
          option.setName('setting')
            .setDescription('Setting to configure')
            .setRequired(true)
            .addChoices(
              { name: 'Rolls visibility', value: 'rolls' },
              { name: 'Message verbosity', value: 'verbosity' },
              { name: 'Auto recaps', value: 'recaps' }
            ))
        .addStringOption(option =>
          option.setName('value')
            .setDescription('New value for the setting')
            .setRequired(true)
            .addChoices(
              { name: 'On / High / Auto', value: 'on' },
              { name: 'Off / Low / Manual', value: 'off' }
            )))
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

// Check if user is DM (campaign owner)
async function isDungeonMaster(userId: string, campaign: any, storage: any): Promise<boolean> {
  // Get campaign owner
  const owner = await storage.getUser(campaign.userId);
  if (!owner) return false;
  // For now, we check if the campaign owner's discordId matches (if linked)
  // In MVP, DM commands are allowed if campaign is linked by that user
  return true; // Simplified for MVP - all linked users can use DM commands
}

// Get character for Discord user in this campaign
async function getCharacterForDiscordUser(discordUserId: string, campaign: any, storage: any): Promise<any> {
  const participants = await storage.getCampaignParticipants(campaign.id);
  for (const p of participants) {
    const char = await storage.getCharacter(p.characterId);
    if (char) {
      // Check if this character's user has linked their Discord
      const user = await storage.getUser(char.userId);
      if (user?.discordId === discordUserId) {
        return char;
      }
    }
  }
  // If no linked character found, return first character as fallback for MVP
  if (participants.length > 0) {
    return await storage.getCharacter(participants[0].characterId);
  }
  return null;
}

// Handle slash command interactions
async function handleInteraction(interaction: ChatInputCommandInteraction, storage: any) {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== 'everdice') return;

  const subcommand = interaction.options.getSubcommand();
  const channelId = interaction.channelId;
  const guildId = interaction.guildId;
  const discordUserId = interaction.user.id;

  try {
    switch (subcommand) {
      // ========== CORE COMMANDS ==========
      case 'help': {
        const embed = new EmbedBuilder()
          .setColor(0xD4A574)
          .setTitle('📖 Everdice Commands')
          .setDescription('Play D&D campaigns through Discord with Everdice!')
          .addFields(
            { name: '🔗 Campaign', value: 
              '`/everdice link <code>` - Link campaign to channel\n' +
              '`/everdice unlink` - Disconnect channel\n' +
              '`/everdice status` - Show campaign info\n' +
              '`/everdice recap` - Get story recap', inline: false },
            { name: '🎮 Session (DM)', value:
              '`/everdice start-session` - Begin session\n' +
              '`/everdice pause-session` - Pause session\n' +
              '`/everdice end-session` - End with recap', inline: false },
            { name: '🎲 Dice & Mechanics', value:
              '`/everdice roll <dice>` - Roll dice (1d20+5)\n' +
              '`/everdice save <stat>` - Saving throw\n' +
              '`/everdice skill <skill>` - Skill check\n' +
              '`/everdice initiative` - Roll initiative\n' +
              '`/everdice damage <amount>` - Apply damage', inline: false },
            { name: '🎭 Scene & NPCs', value:
              '`/everdice scene` - View current scene\n' +
              '`/everdice npc list` - List all NPCs\n' +
              '`/everdice npc show <name>` - View NPC', inline: false },
            { name: '👤 Player', value:
              '`/everdice my-character` - View your character\n' +
              '`/everdice inventory` - Show inventory\n' +
              '`/everdice hp [change]` - View/adjust HP', inline: false },
            { name: '⚙️ Config (DM)', value:
              '`/everdice config <setting> <value>` - Server settings', inline: false }
          )
          .setFooter({ text: 'Everdice • Your Adventure Awaits' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'ping': {
        const latency = Date.now() - interaction.createdTimestamp;
        const embed = new EmbedBuilder()
          .setColor(0x22C55E)
          .setTitle('🏓 Pong!')
          .addFields(
            { name: 'Latency', value: `${latency}ms`, inline: true },
            { name: 'Status', value: '✅ Connected', inline: true }
          )
          .setFooter({ text: 'Everdice Bot' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      // ========== CAMPAIGN COMMANDS ==========
      case 'link': {
        const code = interaction.options.getString('code', true);
        
        const campaign = await storage.getCampaignByDeploymentCode(code);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ Campaign not found. Make sure you have the correct deployment code from Everdice.',
            ephemeral: true
          });
          return;
        }
        
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
          .setFooter({ text: 'Type /everdice help for all commands' });
        
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
      
      case 'status': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel. Use `/everdice link <code>` to connect a campaign.',
            ephemeral: true
          });
          return;
        }
        
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
      
      case 'recap': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel. Use `/everdice link <code>` to connect a campaign.',
            ephemeral: true
          });
          return;
        }
        
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
      
      // ========== SESSION COMMANDS (DM Only) ==========
      case 'start-session': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        // Increment session number
        const newSessionNumber = (campaign.currentSession || 0) + 1;
        await storage.updateCampaign(campaign.id, {
          currentSession: newSessionNumber
        });
        
        // Create new session record
        await storage.createCampaignSession({
          campaignId: campaign.id,
          sessionNumber: newSessionNumber,
          status: 'active'
        });
        
        const embed = new EmbedBuilder()
          .setColor(0x22C55E)
          .setTitle(`🗡️ Session ${newSessionNumber} Begins!`)
          .setDescription(`**${campaign.title}**\n\n*The adventure continues...*`)
          .addFields(
            { name: 'Difficulty', value: campaign.difficulty, inline: true },
            { name: 'Style', value: campaign.narrativeStyle, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Everdice • May your rolls be ever in your favor' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'pause-session': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        const embed = new EmbedBuilder()
          .setColor(0xF59E0B)
          .setTitle('⏸️ Session Paused')
          .setDescription(`**${campaign.title}** - Session ${campaign.currentSession}\n\n*The adventure will continue soon...*`)
          .setTimestamp()
          .setFooter({ text: 'Everdice • Take a break, adventurer' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'end-session': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        // Get session recap
        const sessions = await storage.getCampaignSessions(campaign.id);
        const currentSession = sessions.find((s: any) => s.sessionNumber === campaign.currentSession);
        
        let recapText = 'Another chapter in our story comes to a close.';
        if (currentSession?.storyState) {
          const storyState = typeof currentSession.storyState === 'string' 
            ? JSON.parse(currentSession.storyState) 
            : currentSession.storyState;
          
          if (storyState.narrative) {
            recapText = storyState.narrative.slice(0, 3000);
          }
        }
        
        // Update session status
        if (currentSession) {
          await storage.updateCampaignSession(currentSession.id, { status: 'completed' });
        }
        
        const embed = new EmbedBuilder()
          .setColor(0x8B5CF6)
          .setTitle(`📜 Session ${campaign.currentSession} Complete`)
          .setDescription(`**${campaign.title}**\n\n${recapText}`)
          .setTimestamp()
          .setFooter({ text: 'Everdice • Until next time, adventurers' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      // ========== DICE & MECHANICS COMMANDS ==========
      case 'roll': {
        const dice = interaction.options.getString('dice', true);
        const reason = interaction.options.getString('reason') || undefined;
        
        const result = rollDice(dice);
        const embed = createDiceRollEmbed(interaction.user.displayName, dice, result, reason);
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'save': {
        const stat = interaction.options.getString('stat', true);
        const modifierStr = interaction.options.getString('modifier') || '';
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        let characterMod = 0;
        let characterName = interaction.user.displayName;
        
        // Try to get character for stat bonus
        if (campaign) {
          const character = await getCharacterForDiscordUser(discordUserId, campaign, storage);
          if (character) {
            characterName = character.name;
            const statScore = character[stat === 'str' ? 'strength' : 
                              stat === 'dex' ? 'dexterity' : 
                              stat === 'con' ? 'constitution' :
                              stat === 'int' ? 'intelligence' :
                              stat === 'wis' ? 'wisdom' : 'charisma'] || 10;
            characterMod = getModifier(statScore);
          }
        }
        
        // Parse additional modifier
        const extraMod = parseInt(modifierStr.replace(/[^-\d]/g, '')) || 0;
        const totalMod = characterMod + extraMod;
        
        const notation = totalMod >= 0 ? `1d20+${totalMod}` : `1d20${totalMod}`;
        const result = rollDice(notation);
        
        const statName = STAT_NAMES[stat] || stat.toUpperCase();
        const embed = createDiceRollEmbed(characterName, `${statName} Save`, result, `Saving Throw`);
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'skill': {
        const skill = interaction.options.getString('skill', true);
        const modifierStr = interaction.options.getString('modifier') || '';
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        let characterMod = 0;
        let characterName = interaction.user.displayName;
        
        // Get associated stat for this skill
        const associatedStat = SKILLS[skill] || 'dexterity';
        
        if (campaign) {
          const character = await getCharacterForDiscordUser(discordUserId, campaign, storage);
          if (character) {
            characterName = character.name;
            const statScore = character[associatedStat] || 10;
            characterMod = getModifier(statScore);
          }
        }
        
        // Parse additional modifier (including advantage/disadvantage)
        const hasAdvantage = modifierStr.toLowerCase().includes('adv');
        const hasDisadvantage = modifierStr.toLowerCase().includes('dis');
        const extraMod = parseInt(modifierStr.replace(/[^-\d]/g, '')) || 0;
        const totalMod = characterMod + extraMod;
        
        let notation = totalMod >= 0 ? `1d20+${totalMod}` : `1d20${totalMod}`;
        if (hasAdvantage) notation += ' advantage';
        if (hasDisadvantage) notation += ' disadvantage';
        
        const result = rollDice(notation);
        
        const skillName = skill.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const embed = createDiceRollEmbed(characterName, `${skillName} Check`, result);
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'initiative': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        let characterMod = 0;
        let characterName = interaction.user.displayName;
        
        if (campaign) {
          const character = await getCharacterForDiscordUser(discordUserId, campaign, storage);
          if (character) {
            characterName = character.name;
            characterMod = getModifier(character.dexterity || 10);
          }
        }
        
        const notation = characterMod >= 0 ? `1d20+${characterMod}` : `1d20${characterMod}`;
        const result = rollDice(notation);
        
        const embed = createDiceRollEmbed(characterName, 'Initiative', result, 'Combat Order');
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'damage': {
        const amount = interaction.options.getInteger('amount', true);
        const targetName = interaction.options.getString('target');
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        // Find target character
        let character = null;
        if (targetName) {
          const participants = await storage.getCampaignParticipants(campaign.id);
          for (const p of participants) {
            const char = await storage.getCharacter(p.characterId);
            if (char && char.name.toLowerCase().includes(targetName.toLowerCase())) {
              character = char;
              break;
            }
          }
        } else {
          character = await getCharacterForDiscordUser(discordUserId, campaign, storage);
        }
        
        if (!character) {
          await interaction.reply({
            content: '❌ Character not found.',
            ephemeral: true
          });
          return;
        }
        
        const newHp = Math.max(0, (character.hitPoints || 0) - amount);
        await storage.updateCharacter(character.id, { hitPoints: newHp });
        
        const hpPercent = Math.round((newHp / (character.maxHitPoints || 1)) * 100);
        let healthBar = '';
        const filledBars = Math.round(hpPercent / 10);
        for (let i = 0; i < 10; i++) {
          healthBar += i < filledBars ? '🟩' : '⬛';
        }
        
        const embed = new EmbedBuilder()
          .setColor(amount > 0 ? 0xEF4444 : 0x22C55E)
          .setTitle(amount > 0 ? `💥 ${character.name} takes ${amount} damage!` : `💚 ${character.name} heals ${Math.abs(amount)}!`)
          .addFields(
            { name: 'HP', value: `${newHp} / ${character.maxHitPoints}`, inline: true },
            { name: 'Status', value: healthBar, inline: true }
          );
        
        if (newHp === 0) {
          embed.addFields({ name: '⚠️', value: 'Character is unconscious!', inline: false });
        }
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      // ========== SCENE & NPC COMMANDS ==========
      case 'scene': {
        const action = interaction.options.getString('action') || 'current';
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        const sessions = await storage.getCampaignSessions(campaign.id);
        const currentSession = sessions.find((s: any) => s.sessionNumber === campaign.currentSession);
        
        let sceneInfo = {
          title: 'The Adventure Begins',
          location: 'Unknown',
          description: 'No scene data available. Play the campaign on Everdice to generate story content!'
        };
        
        if (currentSession?.storyState) {
          const storyState = typeof currentSession.storyState === 'string' 
            ? JSON.parse(currentSession.storyState) 
            : currentSession.storyState;
          
          if (storyState.currentScene) {
            sceneInfo.description = storyState.currentScene.slice(0, 3500);
          }
          if (storyState.location) {
            sceneInfo.location = storyState.location;
          }
        }
        
        const embed = new EmbedBuilder()
          .setColor(0x6366F1)
          .setTitle(`🎬 Current Scene`)
          .setDescription(sceneInfo.description)
          .addFields(
            { name: '📍 Location', value: sceneInfo.location, inline: true }
          )
          .setFooter({ text: 'Everdice • The Story Unfolds' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'npc': {
        const action = interaction.options.getString('action', true);
        const npcName = interaction.options.getString('name');
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        // Get NPCs from campaign participants (non-player characters)
        const campaignNpcs = await storage.getCampaignNpcs?.(campaign.id) || [];
        
        if (action === 'list') {
          if (campaignNpcs.length === 0) {
            await interaction.reply({
              content: '📋 No NPCs have been encountered yet in this campaign.',
              ephemeral: true
            });
            return;
          }
          
          const npcList = campaignNpcs.slice(0, 15).map((npc: any) => 
            `• **${npc.name}** - ${npc.role || 'Unknown'}`
          ).join('\n');
          
          const embed = new EmbedBuilder()
            .setColor(0xF59E0B)
            .setTitle('🎭 Known NPCs')
            .setDescription(npcList)
            .setFooter({ text: `${campaignNpcs.length} NPCs encountered` });
          
          await interaction.reply({ embeds: [embed] });
        } else if (action === 'show' && npcName) {
          const npc = campaignNpcs.find((n: any) => 
            n.name.toLowerCase().includes(npcName.toLowerCase())
          );
          
          if (!npc) {
            await interaction.reply({
              content: `❌ NPC "${npcName}" not found.`,
              ephemeral: true
            });
            return;
          }
          
          const embed = new EmbedBuilder()
            .setColor(0xF59E0B)
            .setTitle(`🎭 ${npc.name}`)
            .setDescription(npc.description || npc.background || 'A mysterious figure...')
            .addFields(
              { name: 'Role', value: npc.role || 'Unknown', inline: true },
              { name: 'Attitude', value: npc.attitude || 'Neutral', inline: true }
            );
          
          if (npc.hitPoints && npc.maxHitPoints) {
            embed.addFields({ name: 'HP', value: `${npc.hitPoints}/${npc.maxHitPoints}`, inline: true });
          }
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply({
            content: '❌ Please specify an NPC name with `/everdice npc show <name>`',
            ephemeral: true
          });
        }
        break;
      }
      
      // ========== PLAYER COMMANDS ==========
      case 'my-character': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        const character = await getCharacterForDiscordUser(discordUserId, campaign, storage);
        
        if (!character) {
          await interaction.reply({
            content: '❌ No character found. Make sure you have a character in this campaign.',
            ephemeral: true
          });
          return;
        }
        
        const hpPercent = Math.round((character.hitPoints / character.maxHitPoints) * 100);
        let healthBar = '';
        const filledBars = Math.round(hpPercent / 10);
        for (let i = 0; i < 10; i++) {
          healthBar += i < filledBars ? '🟩' : '⬛';
        }
        
        const embed = new EmbedBuilder()
          .setColor(0xD4A574)
          .setTitle(`⚔️ ${character.name}`)
          .setDescription(`Level ${character.level} ${character.race} ${character.class}`)
          .addFields(
            { name: '❤️ HP', value: `${character.hitPoints}/${character.maxHitPoints}\n${healthBar}`, inline: true },
            { name: '🛡️ AC', value: `${character.armorClass}`, inline: true },
            { name: '✨ XP', value: `${character.experience || 0}`, inline: true },
            { name: 'Stats', value: 
              `STR: ${character.strength} (${getModifier(character.strength) >= 0 ? '+' : ''}${getModifier(character.strength)})\n` +
              `DEX: ${character.dexterity} (${getModifier(character.dexterity) >= 0 ? '+' : ''}${getModifier(character.dexterity)})\n` +
              `CON: ${character.constitution} (${getModifier(character.constitution) >= 0 ? '+' : ''}${getModifier(character.constitution)})`,
              inline: true },
            { name: '\u200b', value:
              `INT: ${character.intelligence} (${getModifier(character.intelligence) >= 0 ? '+' : ''}${getModifier(character.intelligence)})\n` +
              `WIS: ${character.wisdom} (${getModifier(character.wisdom) >= 0 ? '+' : ''}${getModifier(character.wisdom)})\n` +
              `CHA: ${character.charisma} (${getModifier(character.charisma) >= 0 ? '+' : ''}${getModifier(character.charisma)})`,
              inline: true }
          )
          .setFooter({ text: 'Everdice • Your Character' });
        
        if (character.portraitUrl) {
          embed.setThumbnail(character.portraitUrl);
        }
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'inventory': {
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        const character = await getCharacterForDiscordUser(discordUserId, campaign, storage);
        
        if (!character) {
          await interaction.reply({
            content: '❌ No character found.',
            ephemeral: true
          });
          return;
        }
        
        // Get character's inventory items
        const items = await storage.getCharacterItems?.(character.id) || [];
        
        let inventoryText = 'Your pack is empty.';
        if (items.length > 0) {
          inventoryText = items.slice(0, 20).map((item: any) => {
            const equipped = item.isEquipped ? ' ⚔️' : '';
            return `• **${item.name}**${equipped}`;
          }).join('\n');
        }
        
        const embed = new EmbedBuilder()
          .setColor(0xA855F7)
          .setTitle(`🎒 ${character.name}'s Inventory`)
          .setDescription(inventoryText)
          .addFields(
            { name: '💰 Gold', value: `${character.gold || 0}`, inline: true },
            { name: '🥈 Silver', value: `${character.silver || 0}`, inline: true }
          )
          .setFooter({ text: `${items.length} items` });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      case 'hp': {
        const change = interaction.options.getInteger('change');
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        const character = await getCharacterForDiscordUser(discordUserId, campaign, storage);
        
        if (!character) {
          await interaction.reply({
            content: '❌ No character found.',
            ephemeral: true
          });
          return;
        }
        
        let currentHp = character.hitPoints;
        let actionText = '';
        
        if (change !== null) {
          currentHp = Math.min(character.maxHitPoints, Math.max(0, currentHp + change));
          await storage.updateCharacter(character.id, { hitPoints: currentHp });
          actionText = change > 0 ? `+${change} HP` : `${change} HP`;
        }
        
        const hpPercent = Math.round((currentHp / character.maxHitPoints) * 100);
        let healthBar = '';
        const filledBars = Math.round(hpPercent / 10);
        for (let i = 0; i < 10; i++) {
          healthBar += i < filledBars ? '🟩' : '⬛';
        }
        
        const embed = new EmbedBuilder()
          .setColor(currentHp > character.maxHitPoints * 0.3 ? 0x22C55E : 0xEF4444)
          .setTitle(`❤️ ${character.name}'s Health${actionText ? ` (${actionText})` : ''}`)
          .addFields(
            { name: 'HP', value: `${currentHp} / ${character.maxHitPoints}`, inline: true },
            { name: 'Status', value: healthBar, inline: true }
          );
        
        if (currentHp === 0) {
          embed.addFields({ name: '⚠️', value: 'Character is unconscious!', inline: false });
        }
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      // ========== CONFIGURATION COMMANDS ==========
      case 'config': {
        const setting = interaction.options.getString('setting', true);
        const value = interaction.options.getString('value', true);
        
        // Store config in campaign metadata (simplified for MVP)
        const campaign = await storage.getCampaignByDiscordChannel(channelId);
        
        if (!campaign) {
          await interaction.reply({
            content: '❌ No campaign is linked to this channel.',
            ephemeral: true
          });
          return;
        }
        
        const settingNames: Record<string, string> = {
          rolls: 'Dice Roll Visibility',
          verbosity: 'Message Verbosity',
          recaps: 'Auto Recaps'
        };
        
        const valueNames: Record<string, string> = {
          on: setting === 'verbosity' ? 'High' : setting === 'recaps' ? 'Auto' : 'On',
          off: setting === 'verbosity' ? 'Low' : setting === 'recaps' ? 'Manual' : 'Off'
        };
        
        const embed = new EmbedBuilder()
          .setColor(0x6366F1)
          .setTitle('⚙️ Configuration Updated')
          .setDescription(`**${settingNames[setting]}** set to **${valueNames[value]}**`)
          .setFooter({ text: 'Everdice • Settings saved' });
        
        await interaction.reply({ embeds: [embed] });
        break;
      }
      
      default: {
        await interaction.reply({
          content: '❌ Unknown command. Use `/everdice help` to see all available commands.',
          ephemeral: true
        });
      }
    }
  } catch (error: any) {
    console.error('[Discord] Command error:', error);
    
    // Try to reply if we haven't already
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Something went wrong. Please try again.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('[Discord] Failed to send error reply:', replyError);
    }
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
export async function postCampaignEvent(campaign: any, eventType: 'session_start' | 'session_end' | 'story_update', data?: any): Promise<boolean> {
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
