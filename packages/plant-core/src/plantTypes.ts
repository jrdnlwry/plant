export const plantTypes = ['fern', 'succulent', 'blossom', 'vine', 'sapling'] as const;
export type PlantType = typeof plantTypes[number];

export const defaultPlantType: PlantType = 'fern';

export const plantTypeDefinitions = {
  fern: { label: 'Fern', silhouette: 'frond' },
  succulent: { label: 'Succulent', silhouette: 'rosette' },
  blossom: { label: 'Blossom', silhouette: 'flower' },
  vine: { label: 'Vine', silhouette: 'tendril' },
  sapling: { label: 'Sapling', silhouette: 'canopy' },
} as const satisfies Record<PlantType, { label: string; silhouette: string }>;

export function isPlantType(value: unknown): value is PlantType {
  return typeof value === 'string' && (plantTypes as readonly string[]).includes(value);
}
