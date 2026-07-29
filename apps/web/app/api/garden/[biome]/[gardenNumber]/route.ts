import { isPublicBiome } from '../../../../../lib/garden/public';
import { getPublicGarden } from '../../../../../lib/garden/server';
type Params = Promise<{ biome: string; gardenNumber: string }>;
export async function GET(_: Request, { params }: { params: Params }) {
  const { biome, gardenNumber: raw } = await params;
  const number = Number(raw);
  if (!isPublicBiome(biome) || !Number.isSafeInteger(number) || number < 1 || String(number) !== raw) return Response.json({ error: 'garden-not-found' }, { status: 404 });
  const garden = await getPublicGarden(biome, number);
  return garden ? Response.json({ garden }) : Response.json({ error: 'garden-not-found' }, { status: 404 });
}
