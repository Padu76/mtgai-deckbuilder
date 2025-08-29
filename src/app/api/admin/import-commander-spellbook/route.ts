// src/app/api/admin/import-commander-spellbook/route.ts
// Integrazione API Commander Spellbook per importare centinaia di combo

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
  },
  admin: {
    key: process.env.NEXT_PUBLIC_ADMIN_KEY!
  }
}

// Generatore UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Mapping risultati Commander Spellbook alle nostre categorie
function mapComboCategory(results: string[]): string {
  const resultsText = results.join(' ').toLowerCase();
  
  if (resultsText.includes('infinite') && resultsText.includes('damage')) return 'infinite_damage';
  if (resultsText.includes('infinite') && resultsText.includes('mana')) return 'infinite_mana';
  if (resultsText.includes('infinite') && resultsText.includes('token')) return 'infinite_tokens';
  if (resultsText.includes('infinite') && resultsText.includes('turn')) return 'infinite_turns';
  if (resultsText.includes('infinite') && resultsText.includes('mill')) return 'infinite_mill';
  if (resultsText.includes('infinite') && resultsText.includes('life')) return 'infinite_life';
  if (resultsText.includes('infinite')) return 'infinite_combo';
  
  if (resultsText.includes('win the game') || resultsText.includes('you win')) return 'instant_win';
  if (resultsText.includes('storm')) return 'storm_combo';
  if (resultsText.includes('lock') || resultsText.includes('stax')) return 'prison_lock';
  if (resultsText.includes('mill')) return 'mill_engine';
  if (resultsText.includes('token')) return 'token_engine';
  if (resultsText.includes('draw') || resultsText.includes('card advantage')) return 'value_engine';
  
  return 'combo_synergy';
}

// Valutazione qualità combo basata su popolarità e semplicità
function evaluateComboQuality(combo: any): number {
  let score = 5; // Base score
  
  // Popularità (se disponibile)
  if (combo.popularity && combo.popularity > 100) score += 2;
  if (combo.popularity && combo.popularity > 500) score += 1;
  
  // Semplicità - meno carte = meglio
  const cardCount = combo.uses?.length || 0;
  if (cardCount <= 2) score += 3;
  else if (cardCount <= 3) score += 1;
  else if (cardCount >= 6) score -= 2;
  
  // Qualità risultati
  const results = combo.produces || [];
  if (results.some((r: string) => r.toLowerCase().includes('infinite'))) score += 2;
  if (results.some((r: string) => r.toLowerCase().includes('win'))) score += 1;
  
  // Penalità per combo troppo complesse o oscure
  const description = combo.description || '';
  if (description.length > 500) score -= 1; // Troppo complessa
  if (description.includes('requires specific board state')) score -= 1;
  
  return Math.max(1, Math.min(10, score));
}

interface ImportStats {
  total_fetched: number;
  high_quality: number;
  medium_quality: number;
  low_quality: number;
  imported: number;
  skipped: number;
  errors: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  stats?: ImportStats;
  errors?: string[];
  log?: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  const log: string[] = [];
  const errors: string[] = [];
  
  try {
    log.push('Starting Commander Spellbook integration...');
    
    // Verifica admin key
    const body = await request.json();
    const adminKey = body.adminKey || request.headers.get('x-admin-key');
    const maxCombos = body.maxCombos || 200; // Limite configurabile
    const minQuality = body.minQuality || 4; // Qualità minima (1-10)
    
    if (adminKey !== config.admin.key) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized: Invalid admin key'
      }, { status: 401 });
    }

    log.push(`Configuration: max ${maxCombos} combos, min quality ${minQuality}/10`);
    
    const supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    log.push('Supabase client initialized');

    // Fetch da Commander Spellbook API
    log.push('Fetching combos from Commander Spellbook API...');
    const response = await fetch('https://backend.commanderspellbook.com/combos/', {
      headers: {
        'User-Agent': 'MTGArenaAI-DeckBuilder/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Commander Spellbook API error: ${response.status}`);
    }

    const data = await response.json();
    const allCombos = data.results || [];
    log.push(`Fetched ${allCombos.length} combos from Commander Spellbook`);

    // Valutazione e filtraggio qualità
    log.push('Evaluating combo quality and filtering...');
    const evaluatedCombos = allCombos.map((combo: any, index: number) => ({
      ...combo,
      originalIndex: index,
      qualityScore: evaluateComboQuality(combo)
    }));

    // Statistiche qualità
    const highQuality = evaluatedCombos.filter((c: any) => c.qualityScore >= 7);
    const mediumQuality = evaluatedCombos.filter((c: any) => c.qualityScore >= 5 && c.qualityScore < 7);
    const lowQuality = evaluatedCombos.filter((c: any) => c.qualityScore < 5);

    log.push(`Quality distribution: ${highQuality.length} high, ${mediumQuality.length} medium, ${lowQuality.length} low`);

    // Filtra per qualità e ordina per score
    const filteredCombos = evaluatedCombos
      .filter((combo: any) => combo.qualityScore >= minQuality)
      .sort((a: any, b: any) => b.qualityScore - a.qualityScore)
      .slice(0, maxCombos);

    log.push(`Selected ${filteredCombos.length} combos for import (quality >= ${minQuality})`);

    // Verifica combo esistenti per evitare duplicati
    const { data: existingCombos, error: checkError } = await supabase
      .from('combos')
      .select('name, result_tag')
      .eq('source', 'commander_spellbook');

    if (checkError) {
      log.push(`Warning checking existing combos: ${checkError.message}`);
    }

    const existingNames = new Set(existingCombos?.map(c => c.name) || []);
    log.push(`Found ${existingNames.size} existing Commander Spellbook combos`);

    // Import combos
    let imported = 0;
    let skipped = 0;
    let importErrors = 0;

    for (let i = 0; i < filteredCombos.length; i++) {
      const combo = filteredCombos[i];
      
      try {
        // Estrai dati combo
        const cardNames = combo.uses?.map((use: any) => use.card?.name).filter(Boolean) || [];
        const results = combo.produces || [];
        const comboName = cardNames.slice(0, 3).join(' + ') || `Combo ${combo.originalIndex}`;
        
        // Skip se mancano carte essenziali
        if (cardNames.length === 0) {
          skipped++;
          continue;
        }

        // Skip duplicati
        if (existingNames.has(comboName)) {
          skipped++;
          continue;
        }

        // Crea combo record
        const comboId = generateUUID();
        const category = mapComboCategory(results);
        const resultTag = results.join(', ') || 'Combo effect';
        
        // Estrai colori dalle carte (semplificato)
        const colorIdentity = extractColorsFromCards(cardNames);
        
        const { error: comboError } = await supabase
          .from('combos')
          .insert({
            id: comboId,
            source: 'commander_spellbook',
            name: comboName,
            result_tag: resultTag,
            color_identity: colorIdentity,
            links: combo.permalink ? [combo.permalink] : [],
            steps: combo.description || `Combo involving ${cardNames.join(', ')}`
          });

        if (comboError) {
          errors.push(`Error inserting combo ${comboName}: ${comboError.message}`);
          importErrors++;
          continue;
        }

        // Processa carte e crea relazioni
        const cardIds: string[] = [];
        for (const cardName of cardNames.slice(0, 6)) { // Limite 6 carte per combo
          const cardId = await findOrCreateCard(supabase, cardName, colorIdentity, log);
          if (cardId) cardIds.push(cardId);
        }

        // Crea relazioni combo-carte
        if (cardIds.length > 0) {
          const comboCardRows = cardIds.map(cardId => ({
            combo_id: comboId,
            card_id: cardId
          }));

          const { error: relationError } = await supabase
            .from('combo_cards')
            .insert(comboCardRows);

          if (relationError) {
            errors.push(`Error creating relationships for ${comboName}: ${relationError.message}`);
          }
        }

        imported++;
        
        if (imported % 20 === 0) {
          log.push(`Import progress: ${imported}/${filteredCombos.length} combos processed`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        }

      } catch (error) {
        errors.push(`Unexpected error processing combo ${i}: ${(error as Error).message}`);
        importErrors++;
      }
    }

    // Statistiche finali
    const { count: finalComboCount } = await supabase
      .from('combos')
      .select('*', { count: 'exact', head: true });

    const stats: ImportStats = {
      total_fetched: allCombos.length,
      high_quality: highQuality.length,
      medium_quality: mediumQuality.length,
      low_quality: lowQuality.length,
      imported,
      skipped,
      errors: importErrors
    };

    log.push('Commander Spellbook integration completed!');
    log.push(`Final database total: ${finalComboCount} combos`);
    log.push(`Import summary: ${imported} imported, ${skipped} skipped, ${importErrors} errors`);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${imported} combos from Commander Spellbook`,
      stats,
      errors: errors.length > 0 ? errors : undefined,
      log
    });

  } catch (error) {
    const errorMessage = (error as Error).message;
    errors.push(`Fatal error: ${errorMessage}`);
    log.push(`Import failed: ${errorMessage}`);

    return NextResponse.json({
      success: false,
      message: 'Commander Spellbook import failed',
      errors,
      log
    }, { status: 500 });
  }
}

// Funzioni helper
async function findOrCreateCard(
  supabase: any,
  cardName: string,
  comboColors: string[] = [],
  log: string[]
): Promise<string | null> {
  try {
    // Cerca carta esistente
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id')
      .ilike('name', cardName)
      .limit(1);

    if (existingCards && existingCards.length > 0) {
      return existingCards[0].id;
    }

    // Crea placeholder
    const cardId = generateUUID();
    const { data: newCard, error: insertError } = await supabase
      .from('cards')
      .insert({
        id: cardId,
        scryfall_id: `cs_placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: cardName,
        mana_value: estimateManaCost(cardName),
        colors: estimateColors(cardName, comboColors),
        color_identity: comboColors,
        types: estimateTypes(cardName),
        oracle_text: `${cardName} - Imported from Commander Spellbook. Will be updated by Scryfall sync.`,
        legal_standard: false,
        legal_historic: true,
        legal_brawl: true, // EDH cards are typically Brawl legal
        in_arena: false,
        tags: ['commander_spellbook', 'placeholder', 'needs_scryfall_update']
      })
      .select('id')
      .single();

    if (insertError) {
      log.push(`Error creating card ${cardName}: ${insertError.message}`);
      return null;
    }

    return cardId;

  } catch (error) {
    log.push(`Unexpected error with card ${cardName}: ${(error as Error).message}`);
    return null;
  }
}

function extractColorsFromCards(cardNames: string[]): string[] {
  const colors = new Set<string>();
  
  cardNames.forEach(name => {
    const cardColors = estimateColors(name, []);
    cardColors.forEach(color => colors.add(color));
  });
  
  return Array.from(colors);
}

function estimateManaCost(cardName: string): number {
  const name = cardName.toLowerCase();
  
  // Commander staples e carte famose
  if (name.includes('mana crypt') || name.includes('mox')) return 0;
  if (name.includes('sol ring')) return 1;
  if (name.includes('demonic tutor')) return 2;
  if (name.includes('necropotence')) return 3;
  if (name.includes('rhystic study')) return 3;
  if (name.includes('smothering tithe')) return 4;
  if (name.includes('cyclonic rift')) return 7;
  
  // Pattern generici
  if (name.includes('tutor') || name.includes('search')) return 3;
  if (name.includes('commander') || name.includes('legendary')) return 5;
  if (name.includes('angel') || name.includes('demon') || name.includes('dragon')) return 6;
  if (name.includes('artifact')) return 2;
  if (name.includes('enchantment')) return 3;
  
  return 4; // Default per carte EDH
}

function estimateColors(cardName: string, fallbackColors: string[]): string[] {
  const name = cardName.toLowerCase();
  const colors: string[] = [];
  
  // Carte specifiche EDH
  if (name.includes('cyclonic rift') || name.includes('rhystic study')) colors.push('U');
  if (name.includes('demonic tutor') || name.includes('necropotence')) colors.push('B');
  if (name.includes('smothering tithe') || name.includes('wrath')) colors.push('W');
  if (name.includes('cultivate') || name.includes('rampant growth')) colors.push('G');
  if (name.includes('lightning') || name.includes('burn')) colors.push('R');
  
  // Pattern generici
  if (name.includes('white') || name.includes('plains')) colors.push('W');
  if (name.includes('blue') || name.includes('island')) colors.push('U');
  if (name.includes('black') || name.includes('swamp')) colors.push('B');
  if (name.includes('red') || name.includes('mountain')) colors.push('R');
  if (name.includes('green') || name.includes('forest')) colors.push('G');
  
  if (colors.length === 0 && fallbackColors.length > 0) {
    colors.push(...fallbackColors.slice(0, 2));
  }
  
  return [...new Set(colors)];
}

function estimateTypes(cardName: string): string[] {
  const name = cardName.toLowerCase();
  
  if (name.includes('commander') || name.includes('legendary creature')) return ['Legendary', 'Creature'];
  if (name.includes('angel') || name.includes('demon') || name.includes('dragon')) return ['Creature'];
  if (name.includes('tutor') || name.includes('wrath')) return ['Sorcery'];
  if (name.includes('counterspell')) return ['Instant'];
  if (name.includes('mana') || name.includes('sol ring')) return ['Artifact'];
  if (name.includes('study') || name.includes('tithe')) return ['Enchantment'];
  if (name.includes('planeswalker')) return ['Planeswalker'];
  
  return ['Unknown'];
}