import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isPublicBiome } from '../../../../lib/garden/public';
import { getPublicGarden } from '../../../../lib/garden/server';
import { GardenGrid } from '../../garden-grid';

export const dynamic = 'force-dynamic';
type Params = Promise<{ biome: string; gardenNumber: string }>;

async function load(params: Params) {
  const { biome, gardenNumber: rawNumber } = await params;
  const gardenNumber = Number(rawNumber);
  if (!isPublicBiome(biome) || !Number.isSafeInteger(gardenNumber) || gardenNumber < 1 || String(gardenNumber) !== rawNumber) return null;
  return getPublicGarden(biome, gardenNumber);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const garden = await load(params);
  return garden ? { title: `${garden.biome} garden ${garden.gardenNumber} · Plant Companion` } : { title: 'Garden not found · Plant Companion' };
}

export default async function BiomeGardenPage({ params }: { params: Params }) {
  const garden = await load(params);
  if (!garden) notFound();
  return <section className="garden-route" aria-labelledby="garden-heading">
    <nav className="garden-nav" aria-label="Garden navigation">
      <Link href="/garden">All biomes</Link>
      {garden.previousGardenNumber ? <Link href={`/garden/${garden.biome}/${garden.previousGardenNumber}`}>← Garden {garden.previousGardenNumber}</Link> : <span>No previous garden</span>}
      {garden.nextGardenNumber ? <Link href={`/garden/${garden.biome}/${garden.nextGardenNumber}`}>Garden {garden.nextGardenNumber} →</Link> : <span>No next garden</span>}
    </nav>
    <p className="eyebrow">{garden.biome} biome</p>
    <h1 id="garden-heading">Garden {garden.gardenNumber}</h1>
    <p><span className="status-label">Status: {garden.status}</span> · {garden.occupiedPlantCount} of 72 plantable plots occupied</p>
    <GardenGrid garden={garden} />
  </section>;
}
