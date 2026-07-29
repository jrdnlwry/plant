import { getPublicGardenOverview } from '../../../lib/garden/server';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json({ biomes: await getPublicGardenOverview() }); }
