import * as THREE from "three";
import type { VoxelWorld } from "@shared/world/voxelize";
import { BLOCK_KINDS, BLOCK_COLORS } from "@shared/world/blockPalette";

export interface PartyMarker {
  campaignId: number;
  title: string;
  hexQ: number;
  hexR: number;
  isArchived: boolean;
  isCompleted: boolean;
}

/**
 * Draws the voxel world with three.js.
 *
 * Every solid column is one instance of a single box geometry. At ~80k columns
 * a mesh per column would be 80k draw calls and would not run; instancing puts
 * the whole terrain in one. Columns are stretched boxes rather than a stack of
 * cubes for the same reason -- a stack would be a million instances to show
 * sides nobody can see.
 */
export class BlockWorldRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private raf = 0;
  private disposed = false;

  private terrain: THREE.InstancedMesh | null = null;
  private trunks: THREE.InstancedMesh | null = null;
  private leaves: THREE.InstancedMesh | null = null;
  private water: THREE.Mesh | null = null;
  private markerGroup = new THREE.Group();

  // Orbit state. Hand-rolled: OrbitControls ships as an example module, and
  // the CSP on the published page only admits the main three build.
  private target = new THREE.Vector3();
  private radius = 260;
  private theta = Math.PI * 0.25;
  private phi = Math.PI * 0.32;
  private dragging: "orbit" | "pan" | null = null;
  private lastX = 0;
  private lastY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#0e1320");
    this.scene.fog = new THREE.Fog("#0e1320", 380, 900);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.5, 2000);

    const sun = new THREE.DirectionalLight(0xfff2dd, 2.1);
    sun.position.set(0.6, 1, 0.35);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x2a2318, 1.15));
    this.scene.add(this.markerGroup);

    this.attachControls();
  }

  /** Build (or rebuild) the terrain meshes from a voxelised world. */
  setWorld(world: VoxelWorld) {
    this.clearWorld();
    const { width, depth, height, surface, submerged, canopy, treeHeight, waterLevel } = world;

    // Count first so the instanced buffers are exactly the right size.
    let solid = 0, trees = 0;
    for (let i = 0; i < height.length; i++) {
      if (world.hexQ[i] < 0) continue;
      solid++;
      if (canopy[i] !== 255) trees++;
    }

    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const terrain = new THREE.InstancedMesh(box, mat, solid);
    terrain.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const m = new THREE.Matrix4();
    const colour = new THREE.Color();
    const palette = BLOCK_KINDS.map(k => new THREE.Color(BLOCK_COLORS[k]));

    // Centre the world on the origin so orbiting feels natural.
    const ox = -width / 2, oz = -depth / 2;

    let n = 0;
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const i = z * width + x;
        if (world.hexQ[i] < 0) continue;
        const h = Math.max(1, height[i]);
        // One stretched box standing on the floor.
        m.makeScale(1, h, 1);
        m.setPosition(x + ox + 0.5, h / 2, z + oz + 0.5);
        terrain.setMatrixAt(n, m);

        colour.copy(palette[surface[i]]);
        // Slight per-column jitter so large flat areas do not read as plastic.
        const j = 0.92 + ((x * 7919 + z * 104729) % 17) / 100;
        colour.multiplyScalar(j);
        terrain.setColorAt(n, colour);
        n++;
      }
    }
    terrain.instanceMatrix.needsUpdate = true;
    if (terrain.instanceColor) terrain.instanceColor.needsUpdate = true;
    this.terrain = terrain;
    this.scene.add(terrain);

    // Trees: a trunk box and a canopy box per tree.
    if (trees > 0) {
      const trunkMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS.oak_log });
      const leafMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const trunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 1, 0.34), trunkMat, trees);
      const leafMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 1.5, 1.7), leafMat, trees);
      let t = 0;
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const i = z * width + x;
          if (world.hexQ[i] < 0 || canopy[i] === 255) continue;
          const h = Math.max(1, height[i]);
          const th = treeHeight[i] || 3;
          m.makeScale(1, th, 1);
          m.setPosition(x + ox + 0.5, h + th / 2, z + oz + 0.5);
          trunkMesh.setMatrixAt(t, m);
          m.identity();
          m.setPosition(x + ox + 0.5, h + th + 0.5, z + oz + 0.5);
          leafMesh.setMatrixAt(t, m);
          leafMesh.setColorAt(t, palette[canopy[i]]);
          t++;
        }
      }
      trunkMesh.instanceMatrix.needsUpdate = true;
      leafMesh.instanceMatrix.needsUpdate = true;
      if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
      this.trunks = trunkMesh;
      this.leaves = leafMesh;
      this.scene.add(trunkMesh);
      this.scene.add(leafMesh);
    }

    // A single translucent plane for the sea, at the shared water level.
    const waterGeo = new THREE.PlaneGeometry(width, depth);
    const waterMat = new THREE.MeshLambertMaterial({
      color: "#2f6fa8", transparent: true, opacity: 0.72, depthWrite: false,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0.5, waterLevel, 0.5);
    this.water = water;
    this.scene.add(water);

    // Frame the world on first load.
    this.target.set(0, 10, 0);
    this.radius = Math.max(width, depth) * 0.9;
    this.resize();
  }

  /** Place or move the party pins. Cheap enough to redo on every event. */
  setParties(parties: PartyMarker[], hexToWorld: (q: number, r: number) => { x: number; z: number },
             heightAt: (x: number, z: number) => number, worldW: number, worldD: number) {
    for (const child of [...this.markerGroup.children]) {
      this.markerGroup.remove(child);
      const anyChild = child as any;
      anyChild.geometry?.dispose?.();
      anyChild.material?.dispose?.();
    }
    const ox = -worldW / 2, oz = -worldD / 2;
    for (const p of parties) {
      const { x, z } = hexToWorld(p.hexQ, p.hexR);
      const h = heightAt(Math.round(x), Math.round(z));
      const colour = p.isArchived ? "#7c869b" : p.isCompleted ? "#c8a33a" : "#e8503a";
      const pin = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 6, 5),
        new THREE.MeshBasicMaterial({ color: colour }),
      );
      pin.position.set(x + ox + 0.5, h + 6, z + oz + 0.5);
      pin.rotation.x = Math.PI;
      pin.userData = { campaignId: p.campaignId, title: p.title };
      this.markerGroup.add(pin);
    }
  }

  private attachControls() {
    const el = this.canvas;
    el.addEventListener("pointerdown", (e) => {
      this.dragging = e.button === 2 || e.shiftKey ? "pan" : "orbit";
      this.lastX = e.clientX; this.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointerup", (e) => {
      this.dragging = null;
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      if (this.dragging === "orbit") {
        this.theta -= dx * 0.005;
        this.phi = Math.min(Math.PI / 2.05, Math.max(0.08, this.phi - dy * 0.005));
      } else {
        const s = this.radius * 0.0016;
        this.target.x -= (dx * Math.cos(this.theta) - dy * Math.sin(this.theta)) * s;
        this.target.z -= (dx * Math.sin(this.theta) + dy * Math.cos(this.theta)) * s;
      }
    });
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.radius = Math.min(1400, Math.max(18, this.radius * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: false });
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      const r = this.radius, p = this.phi, t = this.theta;
      this.camera.position.set(
        this.target.x + r * Math.sin(p) * Math.cos(t),
        this.target.y + r * Math.cos(p),
        this.target.z + r * Math.sin(p) * Math.sin(t),
      );
      this.camera.lookAt(this.target);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  private clearWorld() {
    for (const mesh of [this.terrain, this.trunks, this.leaves]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.terrain = this.trunks = this.leaves = null;
    if (this.water) {
      this.scene.remove(this.water);
      this.water.geometry.dispose();
      (this.water.material as THREE.Material).dispose();
      this.water = null;
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.clearWorld();
    this.renderer.dispose();
  }
}
