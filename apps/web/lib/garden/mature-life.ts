import type { PlantStateSnapshot } from '@plant/plant-core';

export const MATURE_STAGES = ['active_growth', 'flourish', 'stress', 'dormant', 'recovery'] as const;
export type MatureStage = typeof MATURE_STAGES[number];
export type Season = 'winter' | 'spring' | 'summer' | 'fall';

export interface GardenConditions {
  temperatureC: number;
  precipitationMm: number;
  humidity: number;
  season: Season;
}

export interface MatureLifeState {
  stage: MatureStage;
  health: number;
  hydration: number;
  structuralGrowth: number;
  foliageDensity: number;
  flowerCount: number;
  consecutiveUnhealthyDays: number;
  consecutiveFavorableDays: number;
  dormantSince: string | null;
  lastSimulatedDate: string;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(value * 10) / 10;
const dayAfter = (date: string) => new Date(`${date}T00:00:00Z`).getTime() + 86_400_000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export function initialMatureLife(snapshot: PlantStateSnapshot, publishedDay: string): MatureLifeState {
  return {
    stage: 'active_growth', health: snapshot.health, hydration: snapshot.hydration,
    structuralGrowth: clamp(snapshot.totalGrowth, 300, 480), foliageDensity: clamp(snapshot.health),
    flowerCount: clamp(snapshot.flowerCount, 0, 5), consecutiveUnhealthyDays: 0,
    consecutiveFavorableDays: 0, dormantSince: null, lastSimulatedDate: publishedDay,
  };
}

/** Pure one-day boundary. No randomness: the same state, date and biome weather always yield the same result. */
export function simulateMatureDay(state: MatureLifeState, date: string, weather: GardenConditions): MatureLifeState {
  if (date <= state.lastSimulatedDate) return state;
  const coldDormancy = weather.season === 'winter' && weather.temperatureC < 8;
  const heatStress = weather.temperatureC > 36;
  const temperatureGood = weather.temperatureC >= 10 && weather.temperatureC <= 30;
  const moistureDelta = weather.precipitationMm >= 4 ? 12 : weather.precipitationMm > 0 ? 5 : weather.humidity >= 70 ? -2 : -7;
  const hydration = round(clamp(state.hydration + moistureDelta - (heatStress ? 4 : 0)));
  const unhealthy = hydration < 35 || heatStress || (!coldDormancy && weather.temperatureC < 2);
  const favorable = hydration >= 55 && hydration <= 100 && temperatureGood && !coldDormancy;
  const unhealthyDays = unhealthy ? state.consecutiveUnhealthyDays + 1 : 0;
  const favorableDays = favorable ? state.consecutiveFavorableDays + 1 : 0;
  let stage: MatureStage = state.stage;
  if (coldDormancy) stage = 'dormant';
  else if (state.stage === 'dormant' || (state.stage === 'stress' && favorable)) stage = 'recovery';
  else if (unhealthyDays >= 2 || state.health < 45) stage = 'stress';
  else if (state.stage === 'recovery' && state.health >= 72 && hydration >= 55) stage = 'active_growth';
  else if (favorableDays >= 3 && state.health >= 88) stage = 'flourish';
  else if (!favorable && state.stage === 'flourish') stage = 'active_growth';

  let healthDelta = unhealthy ? (unhealthyDays >= 4 ? -5 : -3) : favorable ? (stage === 'recovery' ? 3 : 2) : 0;
  let structuralDelta = 0, foliageDelta = 0, flowerDelta = 0;
  if (stage === 'active_growth') { structuralDelta = favorable ? 1.5 : 0; foliageDelta = favorable ? 2 : 0; }
  if (stage === 'flourish') { structuralDelta = 2; foliageDelta = 3; flowerDelta = 1; }
  if (stage === 'stress') { structuralDelta = -1; foliageDelta = -4; flowerDelta = -1; }
  if (stage === 'dormant') { healthDelta = 0; foliageDelta = -2; flowerDelta = -2; }
  if (stage === 'recovery') { structuralDelta = 0.5; foliageDelta = 2; flowerDelta = state.health >= 75 ? 1 : 0; }
  return {
    stage, hydration, health: round(clamp(state.health + healthDelta)),
    // Adult damage is deliberately bounded at 75% of canonical maturity.
    structuralGrowth: round(clamp(state.structuralGrowth + structuralDelta, 300, 480)),
    foliageDensity: round(clamp(state.foliageDensity + foliageDelta)),
    flowerCount: Math.round(clamp(state.flowerCount + flowerDelta, 0, 5)),
    consecutiveUnhealthyDays: unhealthyDays, consecutiveFavorableDays: favorableDays,
    dormantSince: stage === 'dormant' ? state.dormantSince ?? date : null,
    lastSimulatedDate: date,
  };
}

export function catchUpMatureLife(state: MatureLifeState, throughDate: string, conditionsFor: (date: string) => GardenConditions): MatureLifeState {
  let result = state;
  for (let time = dayAfter(state.lastSimulatedDate); time <= new Date(`${throughDate}T00:00:00Z`).getTime(); time += 86_400_000) {
    const date = isoDay(time);
    result = simulateMatureDay(result, date, conditionsFor(date));
  }
  return result;
}

/** Renderer adapter preserves the immutable snapshot and its adult extension stage. */
export function matureRenderSnapshot(snapshot: PlantStateSnapshot, life: MatureLifeState): PlantStateSnapshot {
  const totalGrowth = clamp(life.structuralGrowth, 300, 400);
  return { ...snapshot, growthStage: 4, growthProgress: totalGrowth - 300, totalGrowth, health: life.health, hydration: life.hydration, flowerCount: life.flowerCount };
}
