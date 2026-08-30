import assert from "node:assert";
import { formatWorldContext, type WorldContext } from "../server/lib/worldContext";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

const grimfen: WorldContext = {
  regionId: 4,
  regionName: "The Grimfen Marshes",
  regionDescription: "A drowned country of peat and black water.",
  terrain: "marsh",
  levelRange: "5-10",
  instability: 45,
  danger: 59,
  mood: "tense",
  locationId: null,
  locationName: null,
  locationType: null,
  knownLocations: ["Ashenveil", "The Sunken Shrine"],
  events: ["The levees failed at Ashenveil"],
  rumors: ["Word around the fire is that the water is rising early this year"],
  otherTravelers: ["Kethra Vale", "Bramwell"],
  otherTravelerCount: 5,
};

console.log("formatWorldContext");

test("names the region and its live state", () => {
  const out = formatWorldContext(grimfen);
  assert.match(out, /Location: The Grimfen Marshes/);
  assert.match(out, /mood: tense/);
  assert.match(out, /danger 59\/100/);
  assert.match(out, /instability 45\/100/);
});

test("prefers a specific location over the bare region", () => {
  const out = formatWorldContext({ ...grimfen, locationId: 9, locationName: "Ashenveil", locationType: "settlement" });
  assert.match(out, /Location: Ashenveil, The Grimfen Marshes/);
});

test("offers known places so the narrator reuses them", () => {
  const out = formatWorldContext(grimfen);
  assert.match(out, /Known places in this region: Ashenveil, The Sunken Shrine/);
});

test("surfaces other travelers by name, as memory not company", () => {
  const out = formatWorldContext(grimfen);
  assert.match(out, /5 adventurer\(s\) including Kethra Vale, Bramwell/);
  assert.match(out, /never as present company/);
});

test("forbids renaming the region", () => {
  const out = formatWorldContext(grimfen);
  assert.match(out, /Do NOT invent or rename the region/);
  assert.match(out, /becomes part of The Grimfen Marshes permanently/);
});

test("omits empty sections rather than emitting blanks", () => {
  const bare: WorldContext = {
    ...grimfen,
    regionDescription: null,
    knownLocations: [],
    events: [],
    rumors: [],
    otherTravelers: [],
    otherTravelerCount: 0,
  };
  const out = formatWorldContext(bare);
  assert.doesNotMatch(out, /Known places/);
  assert.doesNotMatch(out, /Recent events/);
  assert.doesNotMatch(out, /Rumors circulating/);
  assert.doesNotMatch(out, /Others who have travelled/);
  assert.doesNotMatch(out, /Region character/);
});

test("falls back to the old free-text location when unanchored", () => {
  assert.strictEqual(formatWorldContext(null, "Ravenhollow"), "Location: Ravenhollow");
  assert.strictEqual(formatWorldContext(null), "Location: Unknown");
  assert.strictEqual(formatWorldContext(null, ""), "Location: Unknown");
});

test("caps long region descriptions so the prompt stays tight", () => {
  const out = formatWorldContext({ ...grimfen, regionDescription: "x".repeat(500) });
  const line = out.split("\n").find((l) => l.startsWith("Region character:"))!;
  assert.ok(line.length < 230, `region description line was ${line.length} chars`);
});

console.log(`\n${passed}/8 passed`);
