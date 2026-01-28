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
  const startX = 25;
  const cellWidth = 25;
  
  pdf.setFontSize(8);
  pdf.setTextColor(139, 69, 19);
  
  stats.forEach((stat, i) => {
    const x = startX + (i * cellWidth);
    pdf.setFont('helvetica', 'bold');
    pdf.text(stat.label, x + cellWidth/2, y, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${stat.value} (${getModifier(stat.value)})`, x + cellWidth/2, y + 5, { align: 'center' });
  });
  
  return y + 12;
}

export async function exportCharacterPDF(character: CharacterData): Promise<void> {
  const { pdf, bgImage } = await createBasePDF();
  let y = 25;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(139, 10, 10);
  pdf.text(character.name.toUpperCase(), 20, y);
  y += 8;
  
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.setFont('helvetica', 'italic');
  pdf.text(`${character.race} ${character.class}, Level ${character.level}`, 20, y);
  if (character.alignment) {
    pdf.text(` • ${character.alignment}`, 20 + pdf.getTextWidth(`${character.race} ${character.class}, Level ${character.level}`), y);
  }
  y += 8;
  
  y = drawDivider(pdf, y);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(139, 69, 19);
  pdf.text(`Armor Class `, 20, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${character.armorClass}`, 20 + pdf.getTextWidth('Armor Class '), y);
  y += 5;
  
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Hit Points `, 20, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${character.hitPoints}/${character.maxHitPoints}`, 20 + pdf.getTextWidth('Hit Points '), y);
  y += 5;
  
  if (character.background) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Background `, 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(character.background, 20 + pdf.getTextWidth('Background '), y);
    y += 5;
  }
  y += 3;
  
  y = drawDivider(pdf, y);
  
  y = drawStatRow(pdf, [
    { label: 'STR', value: character.strength },
    { label: 'DEX', value: character.dexterity },
    { label: 'CON', value: character.constitution },
    { label: 'INT', value: character.intelligence },
    { label: 'WIS', value: character.wisdom },
    { label: 'CHA', value: character.charisma }
  ], y);
  
  y = drawDivider(pdf, y);
  
  if (character.skills && character.skills.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(139, 69, 19);
    pdf.text('Skills ', 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    const skillsText = character.skills.join(', ');
    const skillLines = pdf.splitTextToSize(skillsText, 160);
    pdf.text(skillLines, 20 + pdf.getTextWidth('Skills '), y);
    y += skillLines.length * 4 + 4;
  }
  
  if (character.equipment && character.equipment.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(139, 69, 19);
    pdf.text('Equipment ', 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    const equipText = character.equipment.join(', ');
    const equipLines = pdf.splitTextToSize(equipText, 160);
    pdf.text(equipLines, 20, y + 5);
    y += equipLines.length * 4 + 8;
  }
  
  const totalGold = (character.gold || 0) + 
                    (character.silver || 0) / 10 + 
                    (character.copper || 0) / 100 + 
                    (character.platinum || 0) * 10;
  if (totalGold > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(139, 69, 19);
    pdf.text('Wealth ', 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    let wealthStr = '';
    if (character.platinum) wealthStr += `${character.platinum} pp, `;
    if (character.gold) wealthStr += `${character.gold} gp, `;
    if (character.silver) wealthStr += `${character.silver} sp, `;
    if (character.copper) wealthStr += `${character.copper} cp`;
    wealthStr = wealthStr.replace(/, $/, '');
    pdf.text(wealthStr, 20 + pdf.getTextWidth('Wealth '), y);
    y += 8;
  }
  
  if (character.appearance) {
    y = drawDivider(pdf, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(139, 10, 10);
    pdf.text('Appearance', 20, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    const appearanceLines = pdf.splitTextToSize(character.appearance, 170);
    pdf.text(appearanceLines, 20, y);
    y += appearanceLines.length * 4 + 5;
  }
  
  if (character.backgroundStory) {
    y = drawDivider(pdf, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(139, 10, 10);
    pdf.text('Background Story', 20, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    const storyLines = pdf.splitTextToSize(character.backgroundStory, 170);
    pdf.text(storyLines, 20, y);
  }
  
  pdf.save(`${character.name.replace(/\s+/g, '_')}_character_sheet.pdf`);
}

export async function exportNpcPDF(npc: NpcData): Promise<void> {
  const { pdf, bgImage } = await createBasePDF();
  let y = 25;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(139, 10, 10);
  pdf.text(npc.name.toUpperCase(), 20, y);
  y += 8;
  
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.setFont('helvetica', 'italic');
  const typeText = `${npc.race} ${npc.occupation}${npc.level ? `, Level ${npc.level}` : ''}`;
  pdf.text(typeText, 20, y);
  y += 8;
  
  y = drawDivider(pdf, y);
  
  if (npc.armorClass) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(139, 69, 19);
    pdf.text(`Armor Class `, 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${npc.armorClass}`, 20 + pdf.getTextWidth('Armor Class '), y);
    y += 5;
  }
  
  if (npc.hitPoints || npc.maxHitPoints) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Hit Points `, 20, y);
    pdf.setFont('helvetica', 'normal');
    const hp = npc.hitPoints || npc.maxHitPoints;
    const maxHp = npc.maxHitPoints || npc.hitPoints;
    pdf.text(`${hp}/${maxHp}`, 20 + pdf.getTextWidth('Hit Points '), y);
    y += 8;
  }
  
  if (npc.strength && npc.dexterity && npc.constitution && npc.intelligence && npc.wisdom && npc.charisma) {
    y = drawDivider(pdf, y);
    y = drawStatRow(pdf, [
      { label: 'STR', value: npc.strength },
      { label: 'DEX', value: npc.dexterity },
      { label: 'CON', value: npc.constitution },
      { label: 'INT', value: npc.intelligence },
      { label: 'WIS', value: npc.wisdom },
      { label: 'CHA', value: npc.charisma }
    ], y);
  }
  
  y = drawDivider(pdf, y);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(139, 69, 19);
  pdf.text('Personality ', 20, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  const personalityLines = pdf.splitTextToSize(npc.personality, 160);
  pdf.text(personalityLines, 20, y + 5);
  y += personalityLines.length * 4 + 8;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(139, 69, 19);
  pdf.text('Appearance ', 20, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  const appearanceLines = pdf.splitTextToSize(npc.appearance, 160);
  pdf.text(appearanceLines, 20, y + 5);
  y += appearanceLines.length * 4 + 8;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(139, 69, 19);
  pdf.text('Motivation ', 20, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);
  const motivationLines = pdf.splitTextToSize(npc.motivation, 160);
  pdf.text(motivationLines, 20, y + 5);
  y += motivationLines.length * 4 + 8;
  
  if (npc.skills && npc.skills.length > 0) {
    y = drawDivider(pdf, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(139, 69, 19);
    pdf.text('Skills ', 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    pdf.text(npc.skills.join(', '), 20 + pdf.getTextWidth('Skills '), y);
    y += 8;
  }
  
  if (npc.equipment && npc.equipment.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(139, 69, 19);
    pdf.text('Equipment ', 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    const equipLines = pdf.splitTextToSize(npc.equipment.join(', '), 160);
    pdf.text(equipLines, 20, y + 5);
  }
  
  pdf.save(`${npc.name.replace(/\s+/g, '_')}_npc.pdf`);
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
