/**
 * World-grid hex geometry, shared by every renderer of the world map.
 *
 * COORDINATE SYSTEM: odd-r offset, pointy-top. Odd rows are shifted half a hex
 * to the right. This is what the player's web map has always drawn
 * (WorldHexMap.tsx hexToPixel) and therefore what the stored q/r in
 * campaign_exploration_state and campaign_exploration_hexes mean on screen.
 *
 * Note this is NOT axial, despite some schema comments and several server-side
 * helpers (getHexNeighbors / getHexesInRadius here, getAdjacentHexCoordinates
 * in server/narrativeHexParser.ts) treating q/r as axial. Those disagree with
 * the renderer about which six hexes touch a given hex; reconciling them is a
 * separate change. Deliberately, this module provides only layout -- position
 * and identity -- and no adjacency, so it cannot add a competing answer to that
 * question. Anything needing neighbours must pick a convention explicitly.
 */

/** Stable string key for a hex, matching the keys in the generator's hex map. */
export function hexId(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Top-left corner of the hex's bounding box, in pixels. Kept identical to
 * WorldHexMap.tsx's hexToPixel so 2D and 3D renderers agree exactly.
 */
export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const hexWidth = Math.sqrt(3) * size;
  const hexHeight = 2 * size;
  const x = q * hexWidth + (r % 2 === 1 ? hexWidth / 2 : 0);
  const y = r * hexHeight * 0.75;
  return { x, y };
}

/** Centre point of a hex, in pixels. */
export function hexCenter(q: number, r: number, size: number): { x: number; y: number } {
  const { x, y } = hexToPixel(q, r, size);
  return { x: x + (Math.sqrt(3) * size) / 2, y: y + size };
}

/** Inverse of hexToPixel. Approximate near hex edges; good enough for picking. */
export function pixelToHex(px: number, py: number, size: number): { q: number; r: number } {
  const hexWidth = Math.sqrt(3) * size;
  const hexHeight = 2 * size;
  const r = Math.round(py / (hexHeight * 0.75));
  const xOffset = r % 2 === 1 ? hexWidth / 2 : 0;
  const q = Math.round((px - xOffset) / hexWidth);
  return { q, r };
}

/** Pixel size of the whole grid, for sizing a canvas or a 3D ground plane. */
export function gridPixelSize(
  width: number,
  height: number,
  size: number,
): { width: number; height: number } {
  const hexWidth = Math.sqrt(3) * size;
  const hexHeight = 2 * size;
  return {
    width: width * hexWidth + hexWidth / 2,
    height: (height - 1) * hexHeight * 0.75 + hexHeight,
  };
}
