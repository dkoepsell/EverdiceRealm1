/**
 * The party-wide fog merge from storage.getExploredHexes.
 *
 * Kept as a standalone copy of the reducer rather than importing storage.ts, which pulls
 * in a live DB connection. If the rules in storage.ts change, change them here too.
 */
import assert from "node:assert";

interface Row {
  userId: number;
  hexQ: number;
  hexR: number;
  state: string | null;
}

const rank = (state: string | null) =>
  state === "visited" ? 3 : state === "noted" ? 2 : state === "seen" ? 1 : 0;

function mergeFog(rows: Row[], userId: number): Row[] {
  const byHex = new Map<string, Row>();
  for (const row of rows) {
    const key = `${row.hexQ},${row.hexR}`;
    const existing = byHex.get(key);
    if (!existing) {
      byHex.set(key, row);
      continue;
    }
    const rowIsMine = row.userId === userId;
    const existingIsMine = existing.userId === userId;
    const better = rowIsMine !== existingIsMine ? rowIsMine : rank(row.state) > rank(existing.state);
    if (better) byHex.set(key, row);
  }
  return Array.from(byHex.values());
}

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

console.log("shared fog of war");

test("a companion's hex is visible to me", () => {
  // The whole point: ground someone else walked is no longer black for me.
  const merged = mergeFog([{ userId: 2, hexQ: 1, hexR: 1, state: "visited" }], 1);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].hexQ, 1);
});

test("one entry per hex, no duplicates across the party", () => {
  const merged = mergeFog(
    [
      { userId: 1, hexQ: 0, hexR: 0, state: "seen" },
      { userId: 2, hexQ: 0, hexR: 0, state: "seen" },
      { userId: 3, hexQ: 0, hexR: 0, state: "seen" },
    ],
    1
  );
  assert.strictEqual(merged.length, 1);
});

test("my own record of a hex wins over a companion's", () => {
  const merged = mergeFog(
    [
      { userId: 2, hexQ: 0, hexR: 0, state: "visited" },
      { userId: 1, hexQ: 0, hexR: 0, state: "seen" },
    ],
    1
  );
  assert.strictEqual(merged[0].userId, 1);
});

test("my record still wins when it comes first", () => {
  const merged = mergeFog(
    [
      { userId: 1, hexQ: 0, hexR: 0, state: "seen" },
      { userId: 2, hexQ: 0, hexR: 0, state: "visited" },
    ],
    1
  );
  assert.strictEqual(merged[0].userId, 1);
});

test("between companions, the more revealing state wins", () => {
  const merged = mergeFog(
    [
      { userId: 2, hexQ: 5, hexR: 5, state: "seen" },
      { userId: 3, hexQ: 5, hexR: 5, state: "visited" },
    ],
    1
  );
  assert.strictEqual(merged[0].state, "visited");
});

test("a visited hex never degrades to merely seen", () => {
  const merged = mergeFog(
    [
      { userId: 3, hexQ: 5, hexR: 5, state: "visited" },
      { userId: 2, hexQ: 5, hexR: 5, state: "seen" },
    ],
    1
  );
  assert.strictEqual(merged[0].state, "visited");
});

test("distinct hexes are all kept", () => {
  const merged = mergeFog(
    [
      { userId: 1, hexQ: 0, hexR: 0, state: "seen" },
      { userId: 2, hexQ: 1, hexR: 0, state: "seen" },
      { userId: 2, hexQ: 0, hexR: 1, state: "noted" },
    ],
    1
  );
  assert.strictEqual(merged.length, 3);
});

test("an unknown state ranks below every real one", () => {
  const merged = mergeFog(
    [
      { userId: 2, hexQ: 0, hexR: 0, state: null },
      { userId: 3, hexQ: 0, hexR: 0, state: "seen" },
    ],
    1
  );
  assert.strictEqual(merged[0].state, "seen");
});

test("solo play is unchanged — every hex still returned once", () => {
  const merged = mergeFog(
    [
      { userId: 1, hexQ: 0, hexR: 0, state: "visited" },
      { userId: 1, hexQ: 1, hexR: 0, state: "seen" },
    ],
    1
  );
  assert.strictEqual(merged.length, 2);
});

console.log(`\n${passed}/9 passed`);
