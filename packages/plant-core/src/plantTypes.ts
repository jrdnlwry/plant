export const plantTypes = ['fern', 'succulent', 'blossom', 'vine', 'sapling'] as const;
export type PlantType = typeof plantTypes[number];

export const defaultPlantType: PlantType = 'fern';

export const plantTypeDefinitions = {
  fern: { label: 'Fern', stem: '#2f7d32', leaf: '#4caf50', highlight: '#8bcf5a', silhouette: 'frond' },
  succulent: { label: 'Succulent', stem: '#3f7f5f', leaf: '#66b889', highlight: '#a6d9a8', silhouette: 'rosette' },
  blossom: { label: 'Blossom', stem: '#2f7d32', leaf: '#5fbf5a', highlight: '#f06ca7', flower: '#f06ca7', silhouette: 'flower' },
  vine: { label: 'Vine', stem: '#2f7d32', leaf: '#59a846', highlight: '#a8d65f', silhouette: 'tendril' },
  sapling: { label: 'Sapling', stem: '#6b3f24', leaf: '#4caf50', highlight: '#8bcf5a', silhouette: 'canopy' },
} as const satisfies Record<PlantType, { label: string; stem: string; leaf: string; highlight: string; flower?: string; silhouette: string }>;

export function isPlantType(value: unknown): value is PlantType {
  return typeof value === 'string' && (plantTypes as readonly string[]).includes(value);
}
