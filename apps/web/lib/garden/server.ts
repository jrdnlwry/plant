import 'server-only';
import type { GardenBiome } from '@plant/plant-core';
import { createAdminClient } from '../supabase/admin';
import { serializePublicGarden, type PublicGarden, type PublicGardenSummary } from './public';

export async function getPublicGarden(biome: GardenBiome, gardenNumber: number): Promise<PublicGarden | null> {
  const admin = createAdminClient();
  const { data: garden, error } = await admin.from('gardens').select('id,biome,garden_number,status,rows,columns')
    .eq('biome', biome).eq('garden_number', gardenNumber).maybeSingle();
  if (error) {
    console.error('Public garden lookup failed', { biome, gardenNumber, code: error.code });
    throw error;
  }
  if (!garden) return null;
  const [{ data: plots, error: plotError }, { data: plants, error: plantError }, { data: numbers, error: numberError }] = await Promise.all([
    admin.from('garden_plots').select('id,row_number,column_number,plot_type').eq('garden_id', garden.id).order('row_number').order('column_number'),
    admin.from('garden_plants').select('id,plot_id,owner_public_id,plant_type,visual_seed,canonical_snapshot,status,added_to_garden_at,source_created_at,matured_at,current_mature_stage,garden_health,garden_hydration,structural_growth,foliage_density,garden_flower_count,consecutive_unhealthy_days,consecutive_favorable_days,dormant_since,last_simulated_date').eq('garden_id', garden.id).eq('status', 'active'),
    admin.from('gardens').select('garden_number').eq('biome', biome).order('garden_number'),
  ]);
  if (plotError || plantError || numberError) {
    const failure = plotError ?? plantError ?? numberError;
    console.error('Public garden data lookup failed', { gardenId: garden.id, code: failure?.code });
    throw failure;
  }
  const ownerIds = [...new Set((plants ?? []).map((plant) => plant.owner_public_id))];
  const contributorResult = ownerIds.length
    ? await admin.from('public_contributors').select('public_id,display_first_name,state_code,visibility_status').in('public_id', ownerIds)
    : { data: [], error: null };
  if (contributorResult.error) {
    console.error('Public garden contributor lookup failed', { gardenId: garden.id, code: contributorResult.error.code });
    throw contributorResult.error;
  }
  const allNumbers = (numbers ?? []).map((item) => item.garden_number);
  const index = allNumbers.indexOf(gardenNumber);
  return serializePublicGarden(garden, plots ?? [], plants ?? [], contributorResult.data ?? [], {
    previous: index > 0 ? allNumbers[index - 1] : null,
    next: index >= 0 && index < allNumbers.length - 1 ? allNumbers[index + 1] : null,
  });
}

export async function getPublicGardenOverview(): Promise<Record<GardenBiome, PublicGardenSummary[]>> {
  const result: Record<GardenBiome, PublicGardenSummary[]> = { south: [], north: [], west: [], central: [] };
  const admin = createAdminClient();
  const { data: gardens, error } = await admin.from('gardens').select('id,biome,garden_number,status,rows,columns').order('garden_number', { ascending: false });
  if (error) throw error;
  if (!gardens?.length) return result;
  const gardenIds = gardens.map((garden) => garden.id);
  const { data: plants, error: plantsError } = await admin.from('garden_plants').select('garden_id').in('garden_id', gardenIds).eq('status', 'active');
  if (plantsError) throw plantsError;
  const counts = new Map<string, number>();
  for (const plant of plants ?? []) counts.set(plant.garden_id, (counts.get(plant.garden_id) ?? 0) + 1);
  for (const garden of gardens) result[garden.biome as GardenBiome].push({
    id: garden.id, biome: garden.biome, gardenNumber: garden.garden_number, status: garden.status,
    rows: garden.rows, columns: garden.columns, occupiedPlantCount: counts.get(garden.id) ?? 0,
    availableGardenNumbers: gardens.filter((item) => item.biome === garden.biome).map((item) => item.garden_number),
  });
  return result;
}
