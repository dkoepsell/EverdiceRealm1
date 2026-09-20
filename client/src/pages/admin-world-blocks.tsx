import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Box, Users, Radio, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { generateWorldHexMap, WORLD_SEED } from "@shared/world/worldHexGenerator";
import { hexCenter } from "@shared/world/hexGeometry";
import { voxelizeWorld, BLOCKS_PER_HEX } from "@shared/world/voxelize";
import { BlockWorldRenderer, type PartyMarker } from "@/components/world/BlockWorldRenderer";

interface SnapshotParty {
  campaignId: number; title: string; hexQ: number; hexR: number;
  isArchived: boolean; isCompleted: boolean; updatedAt: string | null; exploredCount: number;
}
interface Snapshot {
  seed: number;
  generatedAt: string;
  regions: any[];
  locations: any[];
  parties: SnapshotParty[];
}

/** Matches the geometry the voxeliser lays hexes out with. */
const HEX_SIZE = BLOCKS_PER_HEX / Math.sqrt(3);

export default function AdminWorldBlocksPage() {
  const { user, isLoading: authLoading } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BlockWorldRenderer | null>(null);
  const [status, setStatus] = useState("Loading world…");
  const [live, setLive] = useState(false);
  const [feed, setFeed] = useState<Array<{ text: string; at: string }>>([]);
  const [parties, setParties] = useState<SnapshotParty[]>([]);

  const isAdmin = !!user?.isAdmin;

  const { data: snapshot, isLoading, error, refetch, isFetching } = useQuery<Snapshot>({
    queryKey: ["/api/admin/world/snapshot"],
    enabled: isAdmin,
    // The global default is staleTime: Infinity, which would freeze this view.
    staleTime: 0,
  });

  useEffect(() => { if (snapshot?.parties) setParties(snapshot.parties); }, [snapshot]);

  // Build the voxel world whenever the snapshot changes.
  const voxels = useMemo(() => {
    if (!snapshot) return null;
    const hexMap = generateWorldHexMap(
      snapshot.regions as any, snapshot.locations as any, snapshot.seed ?? WORLD_SEED,
    );
    return voxelizeWorld(Array.from(hexMap.values()));
  }, [snapshot]);

  // Renderer lifecycle.
  useEffect(() => {
    if (!canvasRef.current || !voxels) return;
    const r = new BlockWorldRenderer(canvasRef.current);
    rendererRef.current = r;
    r.setWorld(voxels);
    r.resize();
    r.start();
    setStatus(`${voxels.width}x${voxels.depth} blocks`);
    const onResize = () => r.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      r.dispose();
      rendererRef.current = null;
    };
  }, [voxels]);

  // Party pins, redrawn whenever a party moves.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !voxels) return;
    const heightAt = (x: number, z: number) => {
      if (x < 0 || z < 0 || x >= voxels.width || z >= voxels.depth) return 12;
      return voxels.height[z * voxels.width + x];
    };
    r.setParties(
      parties as PartyMarker[],
      (q, r2) => { const c = hexCenter(q, r2, HEX_SIZE); return { x: c.x, z: c.y }; },
      heightAt, voxels.width, voxels.depth,
    );
  }, [parties, voxels]);

  // Live feed over the websocket.
  useEffect(() => {
    if (!isAdmin) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "admin_world_subscribe" }));
    ws.onmessage = (e) => {
      let msg: any;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "admin_world_subscribed") { setLive(true); return; }
      if (msg.type === "admin_world_denied") { setLive(false); return; }
      if (msg.type !== "world_event") return;
      const ev = msg.payload;
      let text = "";
      if (ev.type === "party_moved") {
        text = `Campaign ${ev.campaignId} moved to ${ev.hexQ},${ev.hexR}`;
        setParties(prev => {
          const hit = prev.find(p => p.campaignId === ev.campaignId);
          if (!hit) return prev;
          return prev.map(p => p.campaignId === ev.campaignId
            ? { ...p, hexQ: ev.hexQ, hexR: ev.hexR } : p);
        });
      } else if (ev.type === "hex_explored") {
        text = `Campaign ${ev.campaignId} explored ${ev.hexQ},${ev.hexR}`
          + (ev.locationName ? ` — ${ev.locationName}` : "");
      } else if (ev.type === "campaign_status") {
        text = `Campaign ${ev.campaignId} is now ${ev.status}`;
        setParties(prev => prev.map(p => p.campaignId === ev.campaignId
          ? { ...p, isArchived: ev.status === "archived", isCompleted: ev.status === "completed" } : p));
      }
      if (text) setFeed(f => [{ text, at: new Date().toLocaleTimeString() }, ...f].slice(0, 40));
    };
    ws.onclose = () => setLive(false);
    return () => ws.close();
  }, [isAdmin]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>;
  }

  // ProtectedRoute only checks that someone is signed in, so the role check
  // has to live here.
  if (!isAdmin) {
    return <div className="flex h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">Admins only</h1>
      <p className="text-muted-foreground">This view is not available on your account.</p>
    </div>;
  }

  const active = parties.filter(p => !p.isArchived && !p.isCompleted);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0e1320]">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />

      {(isLoading || isFetching) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0e1320]/80">
          <div className="flex items-center gap-3 text-slate-200">
            <Loader2 className="h-5 w-5 animate-spin" />
            Building the world…
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-red-500/40 bg-red-950/60 p-4 text-red-100">
            Could not load the world snapshot. {(error as Error).message}
          </div>
        </div>
      )}

      {/* Overlay: what the world is and who is in it */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-3">
        <div className="pointer-events-auto rounded-lg border border-white/10 bg-black/60 p-3 text-slate-100 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Box className="h-4 w-4" /> World in blocks
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-400">
            seed {snapshot?.seed ?? WORLD_SEED} · {status}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <Radio className={`h-3 w-3 ${live ? "text-emerald-400" : "text-slate-500"}`} />
            <span className={live ? "text-emerald-400" : "text-slate-500"}>
              {live ? "live" : "not live"}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[11px]"
              onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-3 w-3" /> Refresh
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto max-h-[38vh] w-64 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-3 text-slate-100 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" /> Parties
            <span className="ml-auto font-mono text-[11px] text-slate-400">
              {active.length} active / {parties.length}
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {parties.length === 0 && <li className="text-[11px] text-slate-500">No parties on the map yet.</li>}
            {parties.map(p => (
              <li key={p.campaignId} className="flex items-center gap-2 text-[11px]">
                <span className="h-2 w-2 flex-none rounded-full" style={{
                  background: p.isArchived ? "#7c869b" : p.isCompleted ? "#c8a33a" : "#e8503a",
                }} />
                <span className="truncate">{p.title}</span>
                <span className="ml-auto font-mono text-slate-500">{p.hexQ},{p.hexR}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Live feed */}
      <div className="pointer-events-auto absolute bottom-4 left-4 max-h-[26vh] w-80 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-3 text-slate-100 backdrop-blur">
        <div className="text-sm font-semibold">Live feed</div>
        {feed.length === 0 && (
          <p className="mt-1 text-[11px] text-slate-500">
            Nothing yet. Party movement and exploration appear here as they happen.
          </p>
        )}
        <ul className="mt-1 space-y-1">
          {feed.map((f, i) => (
            <li key={i} className="font-mono text-[11px] text-slate-300">
              <span className="text-slate-500">{f.at}</span> {f.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-slate-400">
        drag to orbit · shift-drag or right-drag to pan · scroll to zoom
      </div>
    </div>
  );
}
