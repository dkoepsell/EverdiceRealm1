import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, Colors, ChatInputCommandInteraction } from 'discord.js';
import { storage } from '../storage';

let discordClient: Client | null = null;
let isReady = false;

const EVERDICE_COLOR = 0xE6A23C;

export async function initDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.log('[Discord] Bot token or client ID not configured - Discord integration disabled');
    return null;
  }

  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
      ]
    });

    discordClient.once('ready', async () => {
      console.log(`[Discord] Bot logged in as ${discordClient?.user?.tag}`);
      isReady = true;
      await registerSlashCommands(token, clientId);
    });

    discordClient.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await handleSlashCommand(interaction);
    });

    await discordClient.login(token);
    return discordClient;
  } catch (error) {
    console.error('[Discord] Failed to initialize bot:', error);
    return null;
  }
}

async function registerSlashCommands(token: string, clientId: string) {
  const commands = [
    new SlashCommandBuilder()
      .setName('everdice')
      .setDescription('Everdice campaign companion commands')
      .addSubcommand(sub =>
        sub.setName('link')
          .setDescription('Link an Everdice campaign to this channel')
          .addStringOption(opt =>
            opt.setName('code')
              .setDescription('Campaign deployment code')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub.setName('unlink')
          .setDescription('Unlink the campaign from this channel')
      )
      .addSubcommand(sub =>
        sub.setName('roll')
          .setDescription('Roll dice')
          .addStringOption(opt =>
            opt.setName('dice')
              .setDescription('Dice notation (e.g., 1d20+5, 2d6, 1d20 advantage)')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('reason')
              .setDescription('Reason for the roll')
              .setRequired(false)
          )
      )
      .addSubcommand(sub =>
        sub.setName('recap')
          .setDescription('Get the latest session recap')
      )
      .addSubcommand(sub =>
        sub.setName('status')
          .setDescription('Show current campaign status')
      )
      .addSubcommand(sub =>
        sub.setName('start-session')
          .setDescription('Announce the start of a new session')
      )
      .addSubcommand(sub =>
        sub.setName('end-session')
          .setDescription('End the current session and generate a recap')
      )
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('[Discord] Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log('[Discord] Slash commands registered successfully');
  } catch (error) {
    console.error('[Discord] Failed to register commands:', error);
  }
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'link':
        await handleLinkCommand(interaction);
        break;
      case 'unlink':
        await handleUnlinkCommand(interaction);
        break;
      case 'roll':
        await handleRollCommand(interaction);
        break;
      case 'recap':
        await handleRecapCommand(interaction);
        break;
      case 'status':
        await handleStatusCommand(interaction);
        break;
      case 'start-session':
        await handleStartSessionCommand(interaction);
        break;
      case 'end-session':
        await handleEndSessionCommand(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown command', ephemeral: true });
    }
  } catch (error) {
    console.error('[Discord] Command error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: `Error: ${errorMessage}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Error: ${errorMessage}`, ephemeral: true });
    }
  }
}

async function handleLinkCommand(interaction: ChatInputCommandInteraction) {
  const code = interaction.options.getString('code', true);
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;

  if (!guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const campaign = await storage.getCampaignByDeploymentCode(code);
  if (!campaign) {
    await interaction.reply({ 
      content: 'Campaign not found. Make sure the deployment code is correct.', 
      ephemeral: true 
    });
    return;
  }

  await storage.updateCampaign(campaign.id, {
    discordGuildId: guildId,
    discordChannelId: channelId,
  });

  const embed = new EmbedBuilder()
    .setColor(EVERDICE_COLOR)
    .setTitle('Campaign Linked!')
    .setDescription(`**${campaign.title}** is now linked to this channel.`)
    .addFields(
      { name: 'Difficulty', value: campaign.difficulty, inline: true },
      { name: 'Session', value: `${campaign.currentSession}/${campaign.totalChapters}`, inline: true }
    )
    .setFooter({ text: 'Use /everdice status to see campaign details' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleUnlinkCommand(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId;

  const campaign = await storage.getCampaignByDiscordChannel(channelId);
  if (!campaign) {
    await interaction.reply({ 
      content: 'No campaign is linked to this channel.', 
      ephemeral: true 
    });
    return;
  }

  await storage.updateCampaign(campaign.id, {
    discordGuildId: null,
    discordChannelId: null,
  });

  await interaction.reply({ 
    content: `Campaign **${campaign.title}** has been unlinked from this channel.`,
    ephemeral: true 
  });
}

async function handleRollCommand(interaction: ChatInputCommandInteraction) {
  const diceNotation = interaction.options.getString('dice', true);
  const reason = interaction.options.getString('reason');

  const result = parseDiceRoll(diceNotation);
  
  const embed = new EmbedBuilder()
    .setColor(result.isCritical ? Colors.Gold : result.isFumble ? Colors.Red : EVERDICE_COLOR)
    .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
    .setTitle(result.isCritical ? 'CRITICAL HIT!' : result.isFumble ? 'CRITICAL FUMBLE!' : 'Dice Roll')
    .setDescription(`**${diceNotation}**${reason ? `\n*${reason}*` : ''}`)
    .addFields(
      { name: 'Result', value: `\`${result.total}\``, inline: true },
      { name: 'Rolls', value: result.rolls.join(', '), inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

function parseDiceRoll(notation: string): { total: number; rolls: number[]; isCritical: boolean; isFumble: boolean } {
  const isAdvantage = notation.toLowerCase().includes('advantage');
  const isDisadvantage = notation.toLowerCase().includes('disadvantage');
  
  const cleanNotation = notation.toLowerCase()
    .replace('advantage', '')
    .replace('disadvantage', '')
    .trim();
  
  const match = cleanNotation.match(/(\d+)?d(\d+)([+-]\d+)?/i);
  if (!match) {
    return { total: 0, rolls: [], isCritical: false, isFumble: false };
  }

  const numDice = parseInt(match[1] || '1');
  const dieSize = parseInt(match[2]);
  const modifier = parseInt(match[3] || '0');

  const rolls: number[] = [];
  
  if ((isAdvantage || isDisadvantage) && numDice === 1 && dieSize === 20) {
    const roll1 = Math.floor(Math.random() * dieSize) + 1;
    const roll2 = Math.floor(Math.random() * dieSize) + 1;
    const chosenRoll = isAdvantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
    rolls.push(roll1, roll2);
    const total = chosenRoll + modifier;
    return { 
      total, 
      rolls, 
      isCritical: chosenRoll === 20, 
      isFumble: chosenRoll === 1 
    };
  }

  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * dieSize) + 1);
  }

  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;

  return { 
    total, 
    rolls, 
    isCritical: numDice === 1 && dieSize === 20 && rolls[0] === 20,
    isFumble: numDice === 1 && dieSize === 20 && rolls[0] === 1
  };
}

async function handleRecapCommand(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId;

  const campaign = await storage.getCampaignByDiscordChannel(channelId);
  if (!campaign) {
    await interaction.reply({ 
      content: 'No campaign is linked to this channel. Use `/everdice link <code>` first.', 
      ephemeral: true 
    });
    return;
  }

  await interaction.deferReply();

  const sessions = await storage.getCampaignSessions(campaign.id);
  const latestSession = sessions.sort((a, b) => b.sessionNumber - a.sessionNumber)[0];

  if (!latestSession) {
    await interaction.editReply({ content: 'No sessions found for this campaign.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(EVERDICE_COLOR)
    .setTitle(`${campaign.title} - Chapter ${latestSession.sessionNumber} Recap`)
    .setDescription(latestSession.narrative || 'No recap available yet.')
    .addFields(
      { name: 'Status', value: latestSession.isCompleted ? 'Completed' : 'In Progress', inline: true }
    )
    .setFooter({ text: 'Everdice Campaign Companion' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleStatusCommand(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId;

  const campaign = await storage.getCampaignByDiscordChannel(channelId);
  if (!campaign) {
    await interaction.reply({ 
      content: 'No campaign is linked to this channel. Use `/everdice link <code>` first.', 
      ephemeral: true 
    });
    return;
  }

  const participants = await storage.getCampaignParticipants(campaign.id);
  const playerCount = participants.filter(p => p.role === 'player').length;

  const embed = new EmbedBuilder()
    .setColor(EVERDICE_COLOR)
    .setTitle(campaign.title)
    .setDescription(campaign.description || 'An Everdice adventure')
    .addFields(
      { name: 'Chapter', value: `${campaign.currentSession}/${campaign.totalChapters}`, inline: true },
      { name: 'Difficulty', value: campaign.difficulty, inline: true },
      { name: 'Players', value: playerCount.toString(), inline: true },
      { name: 'Status', value: campaign.isCompleted ? 'Completed' : campaign.isArchived ? 'Archived' : 'Active', inline: true }
    )
    .setFooter({ text: 'Everdice Campaign Companion' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleStartSessionCommand(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId;

  const campaign = await storage.getCampaignByDiscordChannel(channelId);
  if (!campaign) {
    await interaction.reply({ 
      content: 'No campaign is linked to this channel. Use `/everdice link <code>` first.', 
      ephemeral: true 
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`Session ${campaign.currentSession} Has Begun!`)
    .setDescription(`**${campaign.title}**\n\nThe adventure continues...`)
    .addFields(
      { name: 'Chapter', value: `${campaign.currentSession}/${campaign.totalChapters}`, inline: true },
      { name: 'Difficulty', value: campaign.difficulty, inline: true }
    )
    .setFooter({ text: 'May your rolls be ever in your favor!' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleEndSessionCommand(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId;

  const campaign = await storage.getCampaignByDiscordChannel(channelId);
  if (!campaign) {
    await interaction.reply({ 
      content: 'No campaign is linked to this channel. Use `/everdice link <code>` first.', 
      ephemeral: true 
    });
    return;
  }

  await interaction.deferReply();

  const sessions = await storage.getCampaignSessions(campaign.id);
  const currentSession = sessions.find(s => s.sessionNumber === campaign.currentSession);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`Session ${campaign.currentSession} Has Ended`)
    .setDescription(`**${campaign.title}**\n\n${currentSession?.narrative || 'Another chapter in your adventure has concluded.'}`)
    .setFooter({ text: 'Until next time, adventurers!' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export async function postToDiscordChannel(channelId: string, embed: EmbedBuilder): Promise<boolean> {
  if (!discordClient || !isReady) {
    console.log('[Discord] Bot not ready, cannot post to channel');
    return false;
  }

  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (channel && channel.isTextBased() && 'send' in channel) {
      await channel.send({ embeds: [embed] });
      return true;
    }
  } catch (error) {
    console.error('[Discord] Failed to post to channel:', error);
  }
  return false;
}

export function createSessionEmbed(title: string, description: string, fields?: { name: string; value: string; inline?: boolean }[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EVERDICE_COLOR)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Everdice Campaign Companion' })
    .setTimestamp();

  if (fields) {
    embed.addFields(fields);
  }

  return embed;
}

export function getDiscordClient() {
  return discordClient;
}

export function isDiscordReady() {
  return isReady;
}

// Event posting functions for live session updates
export async function postChapterStarted(channelId: string, campaignTitle: string, chapterNumber: number, chapterTitle: string, narrative: string): Promise<boolean> {
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`Chapter ${chapterNumber}: ${chapterTitle}`)
    .setDescription(`**${campaignTitle}**\n\n${narrative.slice(0, 400)}${narrative.length > 400 ? '...' : ''}`)
    .addFields(
      { name: 'Status', value: 'In Progress', inline: true }
    )
    .setFooter({ text: 'A new chapter begins!' })
    .setTimestamp();

  return postToDiscordChannel(channelId, embed);
}

export async function postChapterCompleted(channelId: string, campaignTitle: string, chapterNumber: number, chapterTitle: string, xpAwarded: number, silverAwarded: number): Promise<boolean> {
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle(`Chapter ${chapterNumber} Complete!`)
    .setDescription(`**${campaignTitle}**\n\nThe party has completed "${chapterTitle}"`)
    .addFields(
      { name: 'XP Earned', value: `${xpAwarded} XP`, inline: true },
      { name: 'Silver Earned', value: `${silverAwarded} silver`, inline: true }
    )
    .setFooter({ text: 'Well done, adventurers!' })
    .setTimestamp();

  return postToDiscordChannel(channelId, embed);
}

export async function postCombatStarted(channelId: string, campaignTitle: string, enemies: string[], location?: string): Promise<boolean> {
  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('Combat Initiated!')
    .setDescription(`**${campaignTitle}**${location ? `\n*Location: ${location}*` : ''}\n\nThe party faces:\n${enemies.map(e => `- ${e}`).join('\n')}`)
    .setFooter({ text: 'Roll for initiative!' })
    .setTimestamp();

  return postToDiscordChannel(channelId, embed);
}

export async function postCombatEnded(channelId: string, campaignTitle: string, victory: boolean, xpGained?: number): Promise<boolean> {
  const embed = new EmbedBuilder()
    .setColor(victory ? Colors.Green : Colors.DarkRed)
    .setTitle(victory ? 'Victory!' : 'Retreat!')
    .setDescription(`**${campaignTitle}**\n\n${victory ? 'The party emerges victorious from battle!' : 'The party has been forced to retreat...'}${xpGained ? `\n\n**XP Earned:** ${xpGained}` : ''}`)
    .setFooter({ text: victory ? 'The heroes prevail!' : 'Live to fight another day...' })
    .setTimestamp();

  return postToDiscordChannel(channelId, embed);
}

export async function postQuestUpdate(channelId: string, campaignTitle: string, questTitle: string, status: 'accepted' | 'completed' | 'failed', rewards?: { xp?: number; gold?: number; silver?: number }): Promise<boolean> {
  const statusColors = {
    accepted: Colors.Blue,
    completed: Colors.Green,
    failed: Colors.Red
  };
  
  const statusText = {
    accepted: 'Quest Accepted',
    completed: 'Quest Completed!',
    failed: 'Quest Failed'
  };

  const embed = new EmbedBuilder()
    .setColor(statusColors[status])
    .setTitle(statusText[status])
    .setDescription(`**${campaignTitle}**\n\n*${questTitle}*`);

  if (rewards && status === 'completed') {
    const rewardParts = [];
    if (rewards.xp) rewardParts.push(`${rewards.xp} XP`);
    if (rewards.gold) rewardParts.push(`${rewards.gold} gold`);
    if (rewards.silver) rewardParts.push(`${rewards.silver} silver`);
    if (rewardParts.length > 0) {
      embed.addFields({ name: 'Rewards', value: rewardParts.join(' | '), inline: false });
    }
  }

  embed.setFooter({ text: 'Everdice Campaign Companion' }).setTimestamp();
  return postToDiscordChannel(channelId, embed);
}

export async function postCharacterDeath(channelId: string, campaignTitle: string, characterName: string, characterClass: string): Promise<boolean> {
  const embed = new EmbedBuilder()
    .setColor(Colors.DarkRed)
    .setTitle('A Hero Has Fallen')
    .setDescription(`**${campaignTitle}**\n\n${characterName}, the ${characterClass}, has fallen in battle.`)
    .setFooter({ text: 'May their memory live on...' })
    .setTimestamp();

  return postToDiscordChannel(channelId, embed);
}

export async function postLevelUp(channelId: string, campaignTitle: string, characterName: string, newLevel: number): Promise<boolean> {
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle('Level Up!')
    .setDescription(`**${campaignTitle}**\n\n${characterName} has reached **Level ${newLevel}**!`)
    .setFooter({ text: 'Growing stronger!' })
    .setTimestamp();

  return postToDiscordChannel(channelId, embed);
}
