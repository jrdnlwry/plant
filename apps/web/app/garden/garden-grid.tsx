'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PublicGarden, PublicGardenPlant } from '../../lib/garden/public';
import { GardenPlant } from './garden-plant';

const stateNames = new Intl.DisplayNames(['en'], { type: 'region' });
const titleCase = (value: string) => value.replace(/(^|-)([a-z])/g, (_, lead, letter) => `${lead}${letter.toUpperCase()}`);
const date = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));

export function plantAccessibleLabel(plant: PublicGardenPlant, row: number, column: number): string {
  const owner = plant.contributor.firstName ? `, grown by ${plant.contributor.firstName}${plant.contributor.state ? ` from ${stateNames.of(plant.contributor.state)}` : ''}` : '';
  return `${titleCase(plant.plantType)} plant${owner}, garden row ${row + 1} column ${column + 1}`;
}

export function GardenGrid({ garden }: { garden: PublicGarden }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('plant');
  const selectedPlot = garden.plots.find((plot) => plot.plant?.id === requestedId);
  const selected = selectedPlot?.plant ?? null;
  const [announcement, setAnnouncement] = useState('');
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const previousSelection = useRef<string | null>(null);

  const replaceSelection = (plantId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (plantId) params.set('plant', plantId); else params.delete('plant');
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
  };
  const open = (plant: PublicGardenPlant) => {
    previousSelection.current = plant.id;
    setAnnouncement(`${titleCase(plant.plantType)} plant details opened.`);
    replaceSelection(plant.id);
  };
  const close = () => {
    const id = selected?.id ?? previousSelection.current;
    replaceSelection(null);
    setAnnouncement('Plant details closed.');
    requestAnimationFrame(() => id && buttonRefs.current.get(id)?.focus());
  };

  useEffect(() => {
    if (requestedId && !selected) replaceSelection(null);
  // The URL is deliberately normalized only when its requested ID changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId, selected]);
  useEffect(() => {
    if (!selected) return;
    previousSelection.current = selected.id;
    panelHeading.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  return <div className={`garden-workspace${selected ? ' has-selection' : ''}`}>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <div className="garden-scroll" tabIndex={0} aria-label="Scrollable garden grid">
      <div className="garden-grid" role="grid" aria-label={`${titleCase(garden.biome)} garden ${garden.gardenNumber}`} style={{ gridTemplateColumns: `repeat(${garden.columns}, 5rem)`, gridTemplateRows: `repeat(${garden.rows}, 5rem)` }}>
        {garden.plots.map((plot) => <div key={`${plot.row}-${plot.column}`} role="gridcell" className={`garden-cell ${plot.plotType}${plot.plant ? ' occupied' : ''}${selected?.id === plot.plant?.id ? ' selected' : ''}`} style={{ gridRow: plot.row + 1, gridColumn: plot.column + 1 }}>
          {plot.plant && <button ref={(node) => { if (node) buttonRefs.current.set(plot.plant!.id, node); else buttonRefs.current.delete(plot.plant!.id); }} type="button" className="plant-control" aria-label={plantAccessibleLabel(plot.plant, plot.row, plot.column)} aria-pressed={selected?.id === plot.plant.id} onClick={() => open(plot.plant!)}>
            <GardenPlant snapshot={plot.plant.snapshot} />
          </button>}
        </div>)}
      </div>
    </div>
    {selected && selectedPlot && <aside className="plant-details" role="dialog" aria-modal="false" aria-labelledby="plant-detail-title">
      <button type="button" className="detail-close" aria-label="Close plant details" onClick={close}>×</button>
      <p className="eyebrow">Published plant</p>
      <h2 id="plant-detail-title" ref={panelHeading} tabIndex={-1}>{titleCase(selected.plantType)}</h2>
      <dl className="plant-facts">
        <div><dt>Plant ID</dt><dd>{selected.id}</dd></div>
        {selected.contributor.firstName && <div><dt>Contributor</dt><dd>{selected.contributor.firstName}{selected.contributor.state ? ` · ${stateNames.of(selected.contributor.state)}` : ''}</dd></div>}
        <div><dt>Added</dt><dd>{date(selected.addedAt)}</dd></div><div><dt>Created</dt><dd>{date(selected.createdAt)}</dd></div><div><dt>Matured</dt><dd>{date(selected.maturedAt)}</dd></div>
        <div><dt>Health</dt><dd>{selected.snapshot.health}%</dd></div><div><dt>Hydration</dt><dd>{selected.snapshot.hydration}%</dd></div>
        <div><dt>Growth stage</dt><dd>{selected.snapshot.growthStage}</dd></div><div><dt>Growth progress</dt><dd>{selected.snapshot.growthProgress}%</dd></div>
        <div><dt>Structural growth</dt><dd>{selected.snapshot.totalGrowth}</dd></div><div><dt>Flowers</dt><dd>{selected.snapshot.flowerCount}</dd></div>
        <div><dt>Garden</dt><dd>{titleCase(garden.biome)} {garden.gardenNumber}</dd></div><div><dt>Plot</dt><dd>Row {selectedPlot.row + 1}, column {selectedPlot.column + 1}</dd></div>
      </dl>
    </aside>}
  </div>;
}
