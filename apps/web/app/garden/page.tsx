import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PUBLIC_BIOMES } from '../../lib/garden/public';
import { getPublicGardenOverview } from '../../lib/garden/server';

export const dynamic = 'force-dynamic';

export default async function GardenOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const legacy = await searchParams;
  if (typeof legacy.biome === 'string' && typeof legacy.garden === 'string') {
    const selected = typeof legacy.plant === 'string' ? `?plant=${encodeURIComponent(legacy.plant)}` : '';
    redirect(`/garden/${encodeURIComponent(legacy.biome)}/${encodeURIComponent(legacy.garden)}${selected}`);
  }
  const overview = await getPublicGardenOverview();
  return (
    <section aria-labelledby="garden-title">
      <p className="eyebrow">Community gardens</p>
      <h1 id="garden-title">Explore plants grown by the community.</h1>
      <p>Published plants are immutable snapshots. Browsing never changes their garden or lifecycle state.</p>
      <div className="biome-list">
        {PUBLIC_BIOMES.map((biome) => {
          const gardens = overview[biome];
          const newest = gardens[0];
          return <article className="biome-card" key={biome}>
            <h2>{biome[0].toUpperCase() + biome.slice(1)} biome</h2>
            {newest ? <>
              <p><strong>Newest: Garden {newest.gardenNumber}</strong></p>
              <p>Status: <span className="status-label">{newest.status}</span> · {newest.occupiedPlantCount} of 72 plots occupied</p>
              <Link className="garden-link" href={`/garden/${biome}/${newest.gardenNumber}`}>Visit garden {newest.gardenNumber}</Link>
              {gardens.length > 1 && <nav aria-label={`Older ${biome} gardens`} className="older-gardens">
                Older gardens: {gardens.slice(1).map((garden) => <Link key={garden.id} href={`/garden/${biome}/${garden.gardenNumber}`}>{garden.gardenNumber}</Link>)}
              </nav>}
            </> : <p className="empty-garden">No garden has been planted in this biome yet.</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
