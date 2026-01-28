import jsPDF from 'jspdf';
import parchmentBackground from '@assets/image_1769559285466.png';

interface StatBlockData {
  name: string;
  type?: string;
  size?: string;
  alignment?: string;
  armorClass?: number;
  hitPoints?: number;
  maxHitPoints?: number;
  speed?: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  skills?: string[];
  equipment?: string[];
  specialAbilities?: { name: string; description: string }[];
  actions?: { name: string; description: string }[];
  description?: string;
  challenge?: string;
  portraitUrl?: string;
}

interface CharacterData {
  name: string;
  race: string;
  class: string;
  level: number;
  background?: string | null;
  alignment?: string | null;
  armorClass: number;
  hitPoints: number;
  maxHitPoints: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  skills?: string[] | null;
  equipment?: string[] | null;
  gold?: number | null;
  silver?: number | null;
  copper?: number | null;
  platinum?: number | null;
  appearance?: string | null;
  backgroundStory?: string | null;
  portraitUrl?: string | null;
}

interface ItemData {
  name: string;
  type: string;
  rarity?: string;
  description?: string;
  damageDice?: string;
  damageType?: string;
  weaponType?: string;
  weaponRange?: string;
  attackBonus?: number;
  properties?: string[];
  baseAC?: number;
  armorType?: string;
  weight?: number;
  value?: number;
  requiresAttunement?: boolean;
  magicBonus?: number;
  specialEffect?: string;
}

interface LocationData {
  name: string;
  description?: string;
  environment?: string;
  climate?: string;
  terrain?: string;
  notable_features?: string[];
  inhabitants?: string[];
  secrets?: string;
  hooks?: string[];
}

interface NpcData {
  name: string;
  race: string;
  occupation: string;
  personality: string;
  appearance: string;
  motivation: string;
  level?: number;
  hitPoints?: number;
  maxHitPoints?: number;
  armorClass?: number;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  skills?: string[];
  equipment?: string[];
  portraitUrl?: string;
  // Combat and ability fields for D&D stat blocks
  speed?: string;
  savingThrows?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses?: string;
  languages?: string;
  challenge?: string;
  combatAbilities?: { name: string; description: string }[];
  supportAbilities?: { name: string; description: string }[];
  actions?: { name: string; description: string }[];
  legendaryActions?: { name: string; description: string }[];
  traits?: { name: string; description: string }[];
}

function getModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

async function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function createBasePDF(): Promise<{ pdf: jsPDF; bgImage: string | null }> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  try {
    const bgImage = await loadImageAsBase64(parchmentBackground);
    pdf.addImage(bgImage, 'PNG', 0, 0, 210, 297);
    return { pdf, bgImage };
  } catch (error) {
    console.warn('Could not load parchment background, using plain background');
    pdf.setFillColor(245, 235, 220);
    pdf.rect(0, 0, 210, 297, 'F');
    return { pdf, bgImage: null };
  }
}

function drawDivider(pdf: jsPDF, y: number, width: number = 170): number {
  pdf.setDrawColor(139, 69, 19);
  pdf.setLineWidth(0.5);
  pdf.line(20, y, 20 + width, y);
  return y + 3;
}

function drawStatRow(pdf: jsPDF, stats: { label: string; value: number }[], y: number): number {
  const startX = 20;
  const cellWidth = 28;
  
  pdf.setFontSize(10);
  pdf.setTextColor(139, 69, 19);
  
  stats.forEach((stat, i) => {
    const x = startX + (i * cellWidth);
    pdf.setFont('times', 'bold');
    pdf.text(stat.label, x + cellWidth/2, y, { align: 'center' });
    pdf.setFont('times', 'normal');
    pdf.setFontSize(13);
    pdf.text(`${stat.value}`, x + cellWidth/2, y + 6, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`(${getModifier(stat.value)})`, x + cellWidth/2, y + 11, { align: 'center' });
    pdf.setTextColor(139, 69, 19);
    pdf.setFontSize(10);
  });
  
  return y + 16;
}

function drawNotesSection(pdf: jsPDF, title: string, y: number, lineCount: number = 6): number {
  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(139, 10, 10);
  pdf.text(title, 20, y);
  y += 5;
  
  pdf.setDrawColor(180, 160, 140);
  pdf.setLineWidth(0.2);
  for (let i = 0; i < lineCount; i++) {
    pdf.line(20, y + (i * 6), 190, y + (i * 6));
  }
  
  return y + (lineCount * 6) + 4;
}

function parseEquipmentItem(item: string): string {
  // Try to parse JSON objects and extract just the name
  if (item.startsWith('{') || item.includes('"name"')) {
    try {
      const parsed = JSON.parse(item);
      return parsed.name || item;
    } catch {
      // Try to extract name with regex
      const nameMatch = item.match(/"name"\s*:\s*"([^"]+)"/);
      if (nameMatch) return nameMatch[1];
    }
  }
  return item;
}

export async function exportCharacterPDF(character: CharacterData): Promise<void> {
  const { pdf, bgImage } = await createBasePDF();
  let y = 20;
  const portraitSize = 50;
  const hasPortrait = character.portraitUrl && !character.portraitUrl.includes('placeholder');
  
  // Try to load portrait
  let portraitImage: string | null = null;
  if (hasPortrait && character.portraitUrl) {
    try {
      portraitImage = await loadImageAsBase64(character.portraitUrl);
    } catch {
      console.warn('Could not load character portrait');
    }
  }
  
  // Character Name - large title with fantasy styling
  const nameX = portraitImage ? 78 : 20;
  const maxNameWidth = portraitImage ? 120 : 170;
  const characterName = character.name.toUpperCase();
  
  // Auto-scale font size to fit name
  let nameFontSize = 28;
  pdf.setFont('times', 'bolditalic');
  pdf.setFontSize(nameFontSize);
  while (pdf.getTextWidth(characterName) > maxNameWidth && nameFontSize > 16) {
    nameFontSize -= 1;
    pdf.setFontSize(nameFontSize);
  }
  
  pdf.setTextColor(120, 10, 10);
  pdf.text(characterName, nameX, y + 10);
  
  // Decorative underline for classical feel
  const nameWidth = pdf.getTextWidth(characterName);
  pdf.setDrawColor(139, 69, 19);
  pdf.setLineWidth(0.5);
  pdf.line(nameX, y + 13, nameX + Math.min(nameWidth, maxNameWidth), y + 13);
  
  // Subtitle line
  pdf.setFontSize(12);
  pdf.setTextColor(80, 80, 80);
  pdf.setFont('times', 'italic');
  let subtitle = `${character.race} ${character.class}, Level ${character.level}`;
  if (character.alignment) subtitle += ` • ${character.alignment}`;
  pdf.text(subtitle, nameX, y + 21);
  
  // Draw portrait if available
  if (portraitImage) {
    try {
      pdf.addImage(portraitImage, 'JPEG', 20, y, portraitSize, portraitSize);
      // Portrait border
      pdf.setDrawColor(139, 69, 19);
      pdf.setLineWidth(1.5);
      pdf.rect(20, y, portraitSize, portraitSize);
    } catch {
      console.warn('Failed to add portrait to PDF');
    }
  }
  
  y = portraitImage ? y + portraitSize + 5 : y + 30;
  
  y = drawDivider(pdf, y);
  
  // Combat Stats Row
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(139, 69, 19);
  
  const statsY = y;
  pdf.text('Armor Class', 20, statsY);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(14);
  pdf.setTextColor(40, 40, 40);
  pdf.text(`${character.armorClass}`, 20, statsY + 6);
  
  pdf.setFont('times', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(139, 69, 19);
  pdf.text('Hit Points', 65, statsY);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(14);
  pdf.setTextColor(40, 40, 40);
  pdf.text(`${character.hitPoints} / ${character.maxHitPoints}`, 65, statsY + 6);
  
  if (character.background) {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(139, 69, 19);
    pdf.text('Background', 120, statsY);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(40, 40, 40);
    pdf.text(character.background, 120, statsY + 6);
  }
  
  y = statsY + 14;
  y = drawDivider(pdf, y);
  
  // Ability Scores
  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(139, 10, 10);
  pdf.text('ABILITY SCORES', 20, y);
  y += 6;
  
  y = drawStatRow(pdf, [
    { label: 'STR', value: character.strength },
    { label: 'DEX', value: character.dexterity },
    { label: 'CON', value: character.constitution },
    { label: 'INT', value: character.intelligence },
    { label: 'WIS', value: character.wisdom },
    { label: 'CHA', value: character.charisma }
  ], y);
  
  y = drawDivider(pdf, y);
  
  // Skills
  if (character.skills && character.skills.length > 0) {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(139, 10, 10);
    pdf.text('SKILLS', 20, y);
    y += 5;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    const skillsText = character.skills.join(', ');
    const skillLines = pdf.splitTextToSize(skillsText, 170);
    pdf.text(skillLines, 20, y);
    y += skillLines.length * 4.5 + 4;
  }
  
  // Equipment - clean formatting
  if (character.equipment && character.equipment.length > 0) {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(139, 10, 10);
    pdf.text('EQUIPMENT', 20, y);
    y += 5;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    // Parse equipment items to clean up JSON
    const cleanEquipment = character.equipment.map(item => parseEquipmentItem(item));
    const equipText = cleanEquipment.join(', ');
    const equipLines = pdf.splitTextToSize(equipText, 170);
    pdf.text(equipLines, 20, y);
    y += equipLines.length * 4.5 + 4;
  }
  
  // Wealth
  const totalGold = (character.gold || 0) + 
                    (character.silver || 0) / 10 + 
                    (character.copper || 0) / 100 + 
                    (character.platinum || 0) * 10;
  if (totalGold > 0) {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(139, 10, 10);
    pdf.text('WEALTH', 20, y);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    let wealthStr = '';
    if (character.platinum) wealthStr += `${character.platinum} pp, `;
    if (character.gold) wealthStr += `${character.gold} gp, `;
    if (character.silver) wealthStr += `${character.silver} sp, `;
    if (character.copper) wealthStr += `${character.copper} cp`;
    wealthStr = wealthStr.replace(/, $/, '');
    pdf.text(wealthStr, 48, y);
    y += 8;
  }
  
  // Appearance
  if (character.appearance) {
    y = drawDivider(pdf, y);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(139, 10, 10);
    pdf.text('APPEARANCE', 20, y);
    y += 5;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    const appearanceLines = pdf.splitTextToSize(character.appearance, 170);
    pdf.text(appearanceLines, 20, y);
    y += appearanceLines.length * 4.5 + 4;
  }
  
  // Background Story
  if (character.backgroundStory) {
    y = drawDivider(pdf, y);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(139, 10, 10);
    pdf.text('BACKSTORY', 20, y);
    y += 5;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    const storyLines = pdf.splitTextToSize(character.backgroundStory, 170);
    pdf.text(storyLines, 20, y);
    y += storyLines.length * 4.5 + 4;
  }
  
  // Notes section with lines
  y = drawDivider(pdf, y);
  y = drawNotesSection(pdf, 'SESSION NOTES', y, 8);
  
  pdf.save(`${character.name.replace(/\s+/g, '_')}_character_sheet.pdf`);
}

export async function exportNpcPDF(npc: NpcData): Promise<void> {
  const { pdf, bgImage } = await createBasePDF();
  let y = 20;
  
  // Helper to draw inline stat
  const drawInlineStat = (label: string, value: string, xPos: number = 20) => {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(139, 10, 10);
    pdf.text(label, xPos, y);
    pdf.setFont('times', 'normal');
    pdf.setTextColor(40, 40, 40);
    pdf.text(value, xPos + pdf.getTextWidth(label) + 2, y);
  };
  
  // Helper to draw action/ability entry
  const drawAbilityEntry = (name: string, description: string) => {
    pdf.setFont('times', 'bolditalic');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    pdf.text(`${name}. `, 20, y);
    pdf.setFont('times', 'normal');
    const nameWidth = pdf.getTextWidth(`${name}. `);
    const descLines = pdf.splitTextToSize(description, 165 - nameWidth);
    if (descLines.length === 1) {
      pdf.text(descLines[0], 20 + nameWidth, y);
      y += 5;
    } else {
      pdf.text(descLines[0], 20 + nameWidth, y);
      y += 5;
      for (let i = 1; i < descLines.length; i++) {
        pdf.text(descLines[i], 20, y);
        y += 4.5;
      }
    }
    y += 2;
  };
  
  // Title - Monster/NPC name
  pdf.setFont('times', 'bold');
  pdf.setFontSize(26);
  pdf.setTextColor(120, 10, 10);
  pdf.text(npc.name, 20, y);
  y += 6;
  
  // Type line (race, occupation, alignment)
  pdf.setFontSize(10);
  pdf.setTextColor(40, 40, 40);
  pdf.setFont('times', 'italic');
  const typeText = `${npc.race} ${npc.occupation}${npc.level ? `, CR ${npc.level}` : ''}`;
  pdf.text(typeText, 20, y);
  y += 6;
  
  // Red decorative line
  pdf.setDrawColor(139, 10, 10);
  pdf.setLineWidth(1);
  pdf.line(20, y, 190, y);
  y += 5;
  
  // Core stats block
  if (npc.armorClass) {
    drawInlineStat('Armor Class ', `${npc.armorClass}`);
    y += 5;
  }
  
  if (npc.hitPoints || npc.maxHitPoints) {
    const hp = npc.maxHitPoints || npc.hitPoints || 0;
    const hitDice = npc.level ? `(${npc.level}d8 + ${Math.floor(((npc.constitution || 10) - 10) / 2) * (npc.level || 1)})` : '';
    drawInlineStat('Hit Points ', `${hp} ${hitDice}`);
    y += 5;
  }
  
  if (npc.speed) {
    drawInlineStat('Speed ', npc.speed);
    y += 5;
  } else {
    drawInlineStat('Speed ', '30 ft.');
    y += 5;
  }
  
  // Red decorative line
  pdf.setDrawColor(139, 10, 10);
  pdf.setLineWidth(1);
  pdf.line(20, y, 190, y);
  y += 5;
  
  // Ability Scores
  if (npc.strength && npc.dexterity && npc.constitution && npc.intelligence && npc.wisdom && npc.charisma) {
    y = drawStatRow(pdf, [
      { label: 'STR', value: npc.strength },
      { label: 'DEX', value: npc.dexterity },
      { label: 'CON', value: npc.constitution },
      { label: 'INT', value: npc.intelligence },
      { label: 'WIS', value: npc.wisdom },
      { label: 'CHA', value: npc.charisma }
    ], y);
  }
  
  // Red decorative line
  pdf.setDrawColor(139, 10, 10);
  pdf.setLineWidth(1);
  pdf.line(20, y, 190, y);
  y += 5;
  
  // Secondary stats
  if (npc.savingThrows) {
    drawInlineStat('Saving Throws ', npc.savingThrows);
    y += 5;
  }
  
  if (npc.skills && npc.skills.length > 0) {
    drawInlineStat('Skills ', npc.skills.join(', '));
    y += 5;
  }
  
  if (npc.damageResistances) {
    drawInlineStat('Damage Resistances ', npc.damageResistances);
    y += 5;
  }
  
  if (npc.damageImmunities) {
    drawInlineStat('Damage Immunities ', npc.damageImmunities);
    y += 5;
  }
  
  if (npc.conditionImmunities) {
    drawInlineStat('Condition Immunities ', npc.conditionImmunities);
    y += 5;
  }
  
  if (npc.senses) {
    drawInlineStat('Senses ', npc.senses);
    y += 5;
  }
  
  if (npc.languages) {
    drawInlineStat('Languages ', npc.languages);
    y += 5;
  }
  
  if (npc.challenge) {
    drawInlineStat('Challenge ', npc.challenge);
    y += 5;
  } else if (npc.level) {
    drawInlineStat('Challenge ', `${npc.level} (${npc.level * 200} XP)`);
    y += 5;
  }
  
  // Red decorative line
  pdf.setDrawColor(139, 10, 10);
  pdf.setLineWidth(1);
  pdf.line(20, y, 190, y);
  y += 6;
  
  // Traits section (personality, appearance, motivation as traits)
  if (npc.traits && npc.traits.length > 0) {
    npc.traits.forEach(trait => drawAbilityEntry(trait.name, trait.description));
  }
  
  // Personality as a trait
  if (npc.personality) {
    drawAbilityEntry('Personality', npc.personality);
  }
  
  // Appearance as a trait
  if (npc.appearance) {
    drawAbilityEntry('Appearance', npc.appearance);
  }
  
  // Motivation as a trait
  if (npc.motivation) {
    drawAbilityEntry('Motivation', npc.motivation);
  }
  
  // Actions Section Header
  const allActions = [
    ...(npc.actions || []),
    ...(npc.combatAbilities || []),
    ...(npc.supportAbilities || [])
  ];
  
  if (allActions.length > 0) {
    y += 2;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(120, 10, 10);
    pdf.text('Actions', 20, y);
    y += 2;
    pdf.setDrawColor(120, 10, 10);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y);
    y += 5;
    
    allActions.forEach(action => drawAbilityEntry(action.name, action.description));
  }
  
  // Legendary Actions Section
  if (npc.legendaryActions && npc.legendaryActions.length > 0) {
    y += 2;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(120, 10, 10);
    pdf.text('Legendary Actions', 20, y);
    y += 2;
    pdf.setDrawColor(120, 10, 10);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y);
    y += 5;
    
    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    const legendaryIntro = pdf.splitTextToSize('The creature can take 3 legendary actions, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature\'s turn. The creature regains spent legendary actions at the start of its turn.', 170);
    pdf.text(legendaryIntro, 20, y);
    y += legendaryIntro.length * 4.5 + 4;
    
    npc.legendaryActions.forEach(action => drawAbilityEntry(action.name, action.description));
  }
  
  // Equipment section
  if (npc.equipment && npc.equipment.length > 0) {
    y += 2;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(120, 10, 10);
    pdf.text('Equipment', 20, y);
    y += 2;
    pdf.setDrawColor(120, 10, 10);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y);
    y += 5;
    
    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    const cleanEquipment = npc.equipment.map(item => parseEquipmentItem(item));
    const equipText = cleanEquipment.join(', ');
    const equipLines = pdf.splitTextToSize(equipText, 170);
    pdf.text(equipLines, 20, y);
  }
  
  pdf.save(`${npc.name.replace(/\s+/g, '_')}_statblock.pdf`);
}

// Monster data interface matching the monsters schema
interface MonsterData {
  name: string;
  type: string;
  size: string;
  challenge_rating: string;
  armor_class?: number;
  hit_points?: number;
  speed?: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  description?: string;
  notes?: string;
  imageUrl?: string;
  // Extended D&D stat block fields
  alignment?: string;
  saving_throws?: string;
  skills?: string;
  damage_resistances?: string;
  damage_immunities?: string;
  condition_immunities?: string;
  senses?: string;
  languages?: string;
  special_abilities?: { name: string; description: string }[];
  actions?: { name: string; description: string }[];
  legendary_actions?: { name: string; description: string }[];
  reactions?: { name: string; description: string }[];
}

export async function exportMonsterPDF(monster: MonsterData): Promise<void> {
  const { pdf, bgImage } = await createBasePDF();
  let y = 20;
  
  // Try to load monster image
  let monsterImage: string | null = null;
  if (monster.imageUrl) {
    try {
      monsterImage = await loadImageAsBase64(monster.imageUrl);
    } catch {
      console.warn('Could not load monster image');
    }
  }
  
  // Helper to draw inline stat
  const drawInlineStat = (label: string, value: string, xPos: number = 20) => {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(139, 10, 10);
    pdf.text(label, xPos, y);
    pdf.setFont('times', 'normal');
    pdf.setTextColor(40, 40, 40);
    pdf.text(value, xPos + pdf.getTextWidth(label) + 2, y);
  };
  
  // Helper to draw action/ability entry
  const drawAbilityEntry = (name: string, description: string) => {
    pdf.setFont('times', 'bolditalic');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    pdf.text(`${name}. `, 20, y);
    pdf.setFont('times', 'normal');
    const nameWidth = pdf.getTextWidth(`${name}. `);
    const descLines = pdf.splitTextToSize(description, 165 - nameWidth);
    if (descLines.length === 1) {
      pdf.text(descLines[0], 20 + nameWidth, y);
      y += 5;
    } else {
      pdf.text(descLines[0], 20 + nameWidth, y);
      y += 5;
      for (let i = 1; i < descLines.length; i++) {
        pdf.text(descLines[i], 20, y);
        y += 4.5;
      }
    }
    y += 2;
  };
  
  // Draw monster image if available
  const imageSize = 45;
  const contentX = monsterImage ? 75 : 20;
  const maxTitleWidth = monsterImage ? 115 : 170;
  
  if (monsterImage) {
    try {
      pdf.addImage(monsterImage, 'JPEG', 20, y, imageSize, imageSize);
      pdf.setDrawColor(139, 69, 19);
      pdf.setLineWidth(1.5);
      pdf.rect(20, y, imageSize, imageSize);
    } catch {
      console.warn('Failed to add monster image to PDF');
    }
  }
  
  // Title - Monster name
  pdf.setFont('times', 'bold');
  let titleSize = 26;
  pdf.setFontSize(titleSize);
  while (pdf.getTextWidth(monster.name) > maxTitleWidth && titleSize > 16) {
    titleSize -= 1;
    pdf.setFontSize(titleSize);
  }
  pdf.setTextColor(120, 10, 10);
  pdf.text(monster.name, contentX, y + 10);
  
  // Type line (size, type, alignment)
  pdf.setFontSize(10);
  pdf.setTextColor(40, 40, 40);
  pdf.setFont('times', 'italic');
  const typeText = `${monster.size} ${monster.type}${monster.alignment ? `, ${monster.alignment}` : ''}`;
  pdf.text(typeText, contentX, y + 20);
  
  y = monsterImage ? y + imageSize + 5 : y + 28;
  
  // Red decorative line
  pdf.setDrawColor(139, 10, 10);
  pdf.setLineWidth(1);
  pdf.line(20, y, 190, y);
  y += 5;
  
  // Core stats block
  if (monster.armor_class) {
    drawInlineStat('Armor Class ', `${monster.armor_class}`);
    y += 5;
  }
  
  if (monster.hit_points) {
    const conMod = monster.constitution ? Math.floor((monster.constitution - 10) / 2) : 0;
    const hitDice = Math.ceil(monster.hit_points / 4.5);
    const hitDiceStr = `(${hitDice}d8${conMod !== 0 ? (conMod > 0 ? ` + ${conMod * hitDice}` : ` - ${Math.abs(conMod * hitDice)}`) : ''})`;
    drawInlineStat('Hit Points ', `${monster.hit_points} ${hitDiceStr}`);
    y += 5;
  }
  
  drawInlineStat('Speed ', monster.speed || '30 ft.');
  y += 5;
  
  // Red decorative line
  pdf.setDrawColor(139, 10, 10);
  pdf.setLineWidth(1);
  pdf.line(20, y, 190, y);
  y += 5;
  
  // Ability Scores
  if (monster.strength && monster.dexterity && monster.constitution && monster.intelligence && monster.wisdom && monster.charisma) {
    y = drawStatRow(pdf, [
      { label: 'STR', value: monster.strength },
      { label: 'DEX', value: monster.dexterity },
      { label: 'CON', value: monster.constitution },
      { label: 'INT', value: monster.intelligence },
      { label: 'WIS', value: monster.wisdom },
      { label: 'CHA', value: monster.charisma }
    ], y);
  }
  
  // Red decorative line
  pdf.setDrawColor(139, 10, 10);
  pdf.setLineWidth(1);
  pdf.line(20, y, 190, y);
  y += 5;
  
  // Secondary stats
  if (monster.saving_throws) {
    drawInlineStat('Saving Throws ', monster.saving_throws);
    y += 5;
  }
  
  if (monster.skills) {
    drawInlineStat('Skills ', monster.skills);
    y += 5;
  }
  
  if (monster.damage_resistances) {
    drawInlineStat('Damage Resistances ', monster.damage_resistances);
    y += 5;
  }
  
  if (monster.damage_immunities) {
    drawInlineStat('Damage Immunities ', monster.damage_immunities);
    y += 5;
  }
  
  if (monster.condition_immunities) {
    drawInlineStat('Condition Immunities ', monster.condition_immunities);
    y += 5;
  }
  
  if (monster.senses) {
    drawInlineStat('Senses ', monster.senses);
    y += 5;
  }
  
  if (monster.languages) {
    drawInlineStat('Languages ', monster.languages);
    y += 5;
  }
  
  // Challenge Rating
  const xpByCR: Record<string, number> = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
    '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000,
    '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000
  };
  const xp = xpByCR[monster.challenge_rating] || parseInt(monster.challenge_rating) * 200 || 0;
  drawInlineStat('Challenge ', `${monster.challenge_rating} (${xp.toLocaleString()} XP)`);
  y += 5;
  
  // Red decorative line
  pdf.setDrawColor(139, 10, 10);
  pdf.setLineWidth(1);
  pdf.line(20, y, 190, y);
  y += 6;
  
  // Special Abilities / Traits
  if (monster.special_abilities && monster.special_abilities.length > 0) {
    monster.special_abilities.forEach(ability => drawAbilityEntry(ability.name, ability.description));
  }
  
  // Description as a trait if no special abilities
  if (monster.description && (!monster.special_abilities || monster.special_abilities.length === 0)) {
    const descLines = pdf.splitTextToSize(monster.description, 170);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    pdf.text(descLines, 20, y);
    y += descLines.length * 4.5 + 4;
  }
  
  // Actions Section
  if (monster.actions && monster.actions.length > 0) {
    y += 2;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(120, 10, 10);
    pdf.text('Actions', 20, y);
    y += 2;
    pdf.setDrawColor(120, 10, 10);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y);
    y += 5;
    
    monster.actions.forEach(action => drawAbilityEntry(action.name, action.description));
  }
  
  // Reactions Section
  if (monster.reactions && monster.reactions.length > 0) {
    y += 2;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(120, 10, 10);
    pdf.text('Reactions', 20, y);
    y += 2;
    pdf.setDrawColor(120, 10, 10);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y);
    y += 5;
    
    monster.reactions.forEach(reaction => drawAbilityEntry(reaction.name, reaction.description));
  }
  
  // Legendary Actions Section
  if (monster.legendary_actions && monster.legendary_actions.length > 0) {
    y += 2;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(120, 10, 10);
    pdf.text('Legendary Actions', 20, y);
    y += 2;
    pdf.setDrawColor(120, 10, 10);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y);
    y += 5;
    
    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    const legendaryIntro = pdf.splitTextToSize(`${monster.name} can take 3 legendary actions, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. ${monster.name} regains spent legendary actions at the start of its turn.`, 170);
    pdf.text(legendaryIntro, 20, y);
    y += legendaryIntro.length * 4.5 + 4;
    
    monster.legendary_actions.forEach(action => drawAbilityEntry(action.name, action.description));
  }
  
  // Notes section
  if (monster.notes) {
    y += 2;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(120, 10, 10);
    pdf.text('DM Notes', 20, y);
    y += 2;
    pdf.setDrawColor(120, 10, 10);
    pdf.setLineWidth(0.5);
    pdf.line(20, y, 190, y);
    y += 5;
    
    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(40, 40, 40);
    const notesLines = pdf.splitTextToSize(monster.notes, 170);
    pdf.text(notesLines, 20, y);
  }
  
  pdf.save(`${monster.name.replace(/\s+/g, '_')}_statblock.pdf`);
}

export async function exportItemPDF(item: ItemData): Promise<void> {
  const { pdf, bgImage } = await createBasePDF();
  let y = 25;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(139, 10, 10);
  pdf.text(item.name.toUpperCase(), 20, y);
  y += 8;
  
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.setFont('helvetica', 'italic');
  let typeText = item.type.charAt(0).toUpperCase() + item.type.slice(1);
  if (item.rarity && item.rarity !== 'common') {
    typeText += ` (${item.rarity})`;
  }
  if (item.requiresAttunement) {
    typeText += ' (requires attunement)';
  }
  pdf.text(typeText, 20, y);
  y += 8;
  
  y = drawDivider(pdf, y);
  
  if (item.type === 'weapon') {
    if (item.damageDice) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(139, 69, 19);
      pdf.text('Damage ', 20, y);
      pdf.setFont('helvetica', 'normal');
      let damageText = item.damageDice;
      if (item.magicBonus) damageText += ` + ${item.magicBonus}`;
      if (item.damageType) damageText += ` ${item.damageType}`;
      pdf.text(damageText, 20 + pdf.getTextWidth('Damage '), y);
      y += 5;
    }
    if (item.attackBonus || item.magicBonus) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Attack Bonus ', 20, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`+${(item.attackBonus || 0) + (item.magicBonus || 0)}`, 20 + pdf.getTextWidth('Attack Bonus '), y);
      y += 5;
    }
    if (item.weaponType || item.weaponRange) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Type ', 20, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${item.weaponType || ''} ${item.weaponRange || ''}`.trim(), 20 + pdf.getTextWidth('Type '), y);
      y += 5;
    }
    if (item.properties && item.properties.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Properties ', 20, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(item.properties.join(', '), 20 + pdf.getTextWidth('Properties '), y);
      y += 5;
    }
  }
  
  if (item.type === 'armor' || item.type === 'shield') {
    if (item.baseAC) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(139, 69, 19);
      pdf.text('Armor Class ', 20, y);
      pdf.setFont('helvetica', 'normal');
      let acText = `${item.baseAC}`;
      if (item.magicBonus) acText += ` + ${item.magicBonus}`;
      pdf.text(acText, 20 + pdf.getTextWidth('Armor Class '), y);
      y += 5;
    }
    if (item.armorType) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Type ', 20, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(item.armorType, 20 + pdf.getTextWidth('Type '), y);
      y += 5;
    }
  }
  
  if (item.weight) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(139, 69, 19);
    pdf.text('Weight ', 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${item.weight} lb.`, 20 + pdf.getTextWidth('Weight '), y);
    y += 5;
  }
  
  if (item.value) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Value ', 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${item.value} gp`, 20 + pdf.getTextWidth('Value '), y);
    y += 5;
  }
  
  y += 3;
  y = drawDivider(pdf, y);
  
  if (item.description) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    const descLines = pdf.splitTextToSize(item.description, 170);
    pdf.text(descLines, 20, y);
    y += descLines.length * 4 + 5;
  }
  
  if (item.specialEffect) {
    y = drawDivider(pdf, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(139, 10, 10);
    pdf.text('Special Effect', 20, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    const effectLines = pdf.splitTextToSize(item.specialEffect, 170);
    pdf.text(effectLines, 20, y);
  }
  
  pdf.save(`${item.name.replace(/\s+/g, '_')}_item.pdf`);
}

export async function exportLocationPDF(location: LocationData): Promise<void> {
  const { pdf, bgImage } = await createBasePDF();
  let y = 25;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(139, 10, 10);
  pdf.text(location.name.toUpperCase(), 20, y);
  y += 8;
  
  if (location.environment || location.terrain || location.climate) {
    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    pdf.setFont('helvetica', 'italic');
    let typeText = [location.environment, location.terrain, location.climate]
      .filter(Boolean)
      .join(' • ');
    pdf.text(typeText, 20, y);
    y += 8;
  }
  
  y = drawDivider(pdf, y);
  
  if (location.description) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    const descLines = pdf.splitTextToSize(location.description, 170);
    pdf.text(descLines, 20, y);
    y += descLines.length * 4 + 8;
  }
  
  if (location.notable_features && location.notable_features.length > 0) {
    y = drawDivider(pdf, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(139, 10, 10);
    pdf.text('Notable Features', 20, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    location.notable_features.forEach(feature => {
      pdf.text(`• ${feature}`, 22, y);
      y += 5;
    });
    y += 3;
  }
  
  if (location.inhabitants && location.inhabitants.length > 0) {
    y = drawDivider(pdf, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(139, 10, 10);
    pdf.text('Inhabitants', 20, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    location.inhabitants.forEach(inhabitant => {
      pdf.text(`• ${inhabitant}`, 22, y);
      y += 5;
    });
    y += 3;
  }
  
  if (location.hooks && location.hooks.length > 0) {
    y = drawDivider(pdf, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(139, 10, 10);
    pdf.text('Adventure Hooks', 20, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    location.hooks.forEach(hook => {
      const hookLines = pdf.splitTextToSize(`• ${hook}`, 166);
      pdf.text(hookLines, 22, y);
      y += hookLines.length * 4 + 2;
    });
    y += 3;
  }
  
  if (location.secrets) {
    y = drawDivider(pdf, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(139, 10, 10);
    pdf.text('Secrets (DM Only)', 20, y);
    y += 5;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 60, 60);
    const secretLines = pdf.splitTextToSize(location.secrets, 170);
    pdf.text(secretLines, 20, y);
  }
  
  pdf.save(`${location.name.replace(/\s+/g, '_')}_location.pdf`);
}
