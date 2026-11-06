"use client";

import { useLenis } from "lenis/react";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Fog,
  Group,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

/** Resting pose, then a few degrees either way — 2.5D, not a turntable. */
const BASE_X = 0.08;
const BASE_Y = 0.22;
const PITCH = 0.04;
const YAW = 0.12;
/** Extra turn accumulated while the project list passes the sculpture. */
const PROJECT_PITCH = 0.045;
const PROJECT_YAW = 0.66;

/** Scroll-dock: shrink and slide left into the blank beside the project wheel. */
const DOCK_SCALE = 0.52;
const DOCK_X = -0.8;
const DOCK_Y = -0.14;
/** Finish docking after this fraction of the hero's height. */
const DOCK_TRAVEL = 0.82;
/** Keep the sculpture above the copy instead of filling narrow viewports. */
const MOBILE_HEAD_SCALE = 0.48;
const MOBILE_SCULPTURE_SCALE = 0.4;
const MOBILE_X = 0;
const MOBILE_Y = 0.3;
/** Education handoff used to open the docked sculpture into the background. */
const SCATTER_START_INSET_VH = 0.75;
const SCATTER_TRAVEL_VH = 0.65;
const FIELD_SCALE = 1;
const FIELD_LINE_OPACITY = 0.008;
const FIELD_DOT_OPACITY = 0.18;
const FRUIT_COLOR = 0xff5a00;
const FRUIT_SIZE = 0.08;
const FRUIT_SELECTED_SIZE = 0.11;

/**
 * Half-extent of each point's wander, in the cloud's baked units (the mesh
 * was scaled so its longest axis is 1.4). Far enough to read as alive,
 * close enough that neighbour lines still describe the head.
 */
const AMP = 0.024;

/** Soft dimple around the cursor, in the same units as AMP. */
const REPEL_RADIUS = 0.36;
const REPEL_RADIUS_SQ = REPEL_RADIUS * REPEL_RADIUS;
const REPEL = 0.175;
const REPEL_LERP = 0.14;
const LINE_OPACITY = 0.22;

type Api = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  group: Group;
  posAttr: BufferAttribute;
  restA: Float32Array;
  restB: Float32Array;
  live: Float32Array;
  clocks: Float32Array;
  scatterDirs: Float32Array;
  lineMatA: LineBasicMaterial;
  lineMatB: LineBasicMaterial;
  dotMat: PointsMaterial;
  fruitMats: PointsMaterial[];
  linesA: LineSegments;
  linesB: LineSegments;
  fruits: Points[];
  fruitIndex: number;
  morph: number;
  scatter: number;
  scatterStart: number;
  scatterTravel: number;
  ndc: Vector2;
  ray: Raycaster;
  plane: Plane;
  planeN: Vector3;
  hit: Vector3;
  hitSmooth: Vector3;
  origin: Vector3;
  hasPointer: boolean;
  hitReady: boolean;
  repelMix: number;
  visible: boolean;
  reduced: boolean;
  looping: boolean;
  vh: number;
  heroH: number;
  wide: boolean;
  scroll: number;
  lastP: number;
  veil: HTMLDivElement | null;
};

function pose(a: Api) {
  const p = a.reduced
    ? 0.5
    : Math.min(1, Math.max(0, a.scroll / Math.max(1, a.vh)));
  a.lastP = p;

  // Linear 0–1 over the hero, then smoothstep so the shrink eases in and out.
  const linear = Math.min(
    1,
    Math.max(0, a.scroll / Math.max(1, a.heroH * DOCK_TRAVEL)),
  );
  const morph = linear * linear * (3 - 2 * linear);
  const dock = a.wide ? morph : 0;
  const scatterLinear = Math.min(
    1,
    Math.max(0, (a.scroll - a.scatterStart) / Math.max(1, a.scatterTravel)),
  );
  const scatter = a.reduced
    ? Number(a.scroll >= a.scatterStart)
    : scatterLinear * scatterLinear * (3 - 2 * scatterLinear);
  const projectTurn = a.reduced
    ? 0
    : Math.min(
        1,
        Math.max(
          0,
          (a.scroll - a.heroH) / Math.max(1, a.scatterStart - a.heroH),
        ),
      );
  const dockScale = 1 - (1 - DOCK_SCALE) * dock;
  const mobileScale =
    MOBILE_HEAD_SCALE + (MOBILE_SCULPTURE_SCALE - MOBILE_HEAD_SCALE) * morph;
  const restingScale = a.wide ? dockScale : mobileScale;
  const restingX = a.wide ? DOCK_X * dock : MOBILE_X;
  const restingY = a.wide ? DOCK_Y * dock : MOBILE_Y;
  a.morph = morph;
  a.scatter = scatter;
  a.group.rotation.x =
    (BASE_X + (p - 0.5) * 2 * PITCH + PROJECT_PITCH * projectTurn) *
    (1 - scatter);
  a.group.rotation.y =
    (BASE_Y + (p - 0.5) * 2 * YAW + PROJECT_YAW * projectTurn) * (1 - scatter);
  a.group.scale.setScalar(
    restingScale + (FIELD_SCALE - restingScale) * scatter,
  );
  a.group.position.x = restingX * (1 - scatter);
  a.group.position.y = restingY * (1 - scatter);
  if (a.veil) a.veil.style.opacity = String(1 - dock);
  a.lineMatA.opacity = LINE_OPACITY * (1 - morph);
  a.lineMatB.opacity =
    LINE_OPACITY * morph * (1 - scatter) * (1 - scatter) * (1 - scatter) +
    FIELD_LINE_OPACITY * scatter;
  a.dotMat.opacity = 0.55 + (FIELD_DOT_OPACITY - 0.55) * Math.sqrt(scatter);
  const fruitOpacity =
    Math.min(1, Math.max(0, (morph - 0.72) / 0.28)) *
    (1 - scatter) *
    (1 - scatter);
  for (const material of a.fruitMats) material.opacity = fruitOpacity;
  a.linesA.visible = morph < 0.995;
  a.linesB.visible = morph > 0.005;
  for (const fruit of a.fruits) fruit.visible = fruitOpacity > 0.005;
}

function drift(a: Api, time: number) {
  const { restA, restB, live, clocks, morph, scatter, scatterDirs } = a;
  const n = restA.length / 3;
  const t = morph;

  a.repelMix += ((a.hasPointer ? 1 : 0) - a.repelMix) * REPEL_LERP;
  if (!a.hasPointer && a.repelMix < 0.01) {
    a.hitReady = false;
    a.repelMix = 0;
  }

  let doRepel = a.repelMix > 0.001;
  let hx = 0;
  let hy = 0;
  let hz = 0;
  if (doRepel) {
    // Camera-facing plane through the origin, then into group space, so the
    // dimple tracks the pointer on screen while the 2.5D tilt still applies.
    a.camera.getWorldDirection(a.planeN).negate();
    a.plane.setFromNormalAndCoplanarPoint(a.planeN, a.origin);
    a.ray.setFromCamera(a.ndc, a.camera);
    if (a.ray.ray.intersectPlane(a.plane, a.hit)) {
      a.group.updateMatrixWorld();
      a.group.worldToLocal(a.hit);
      if (!a.hitReady) {
        a.hitSmooth.copy(a.hit);
        a.hitReady = true;
      } else {
        a.hitSmooth.lerp(a.hit, REPEL_LERP);
      }
      hx = a.hitSmooth.x;
      hy = a.hitSmooth.y;
      hz = a.hitSmooth.z;
    } else {
      doRepel = false;
    }
  }

  for (let i = 0; i < n; i++) {
    const c = i * 7;
    const p = i * 3;
    const amp = clocks[c + 6];
    const rx = restA[p] + (restB[p] - restA[p]) * t + scatterDirs[p] * scatter;
    const ry =
      restA[p + 1] +
      (restB[p + 1] - restA[p + 1]) * t +
      scatterDirs[p + 1] * scatter;
    const rz =
      restA[p + 2] +
      (restB[p + 2] - restA[p + 2]) * t +
      scatterDirs[p + 2] * scatter;
    let x = rx + amp * Math.sin(time * clocks[c] + clocks[c + 3]);
    let y = ry + amp * Math.sin(time * clocks[c + 1] + clocks[c + 4]);
    let z = rz + amp * Math.sin(time * clocks[c + 2] + clocks[c + 5]);

    if (doRepel) {
      // Distance against rest, not live, so the pocket does not chase itself.
      const dx = rx - hx;
      const dy = ry - hy;
      const dz = rz - hz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < REPEL_RADIUS_SQ && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const f = 1 - d / REPEL_RADIUS;
        const k = (REPEL * f * f * a.repelMix) / d;
        x += dx * k;
        y += dy * k;
        z += dz * k;
      }
    }

    live[p] = x;
    live[p + 1] = y;
    live[p + 2] = z;
  }
  a.posAttr.needsUpdate = true;
}

/**
 * Pick six distinct tree vertices near deliberately spread canopy targets.
 * Keeping this selection derived from the baked shape pins each fruit to a
 * stable branch coordinate while the tree as a whole rotates with scroll.
 */
function pickFruitIndices(rest: Float32Array) {
  const targets = [
    [-0.2, 0.36, 0.3],
    [0.06, 0.3, 0.4],
    [0.38, 0.18, 0.34],
    [0.24, 0.02, 0.46],
    [-0.3, 0.02, 0.42],
    [-0.42, 0.2, 0.36],
  ];
  const used = new Set<number>();
  return targets.map(([tx, ty, tz]) => {
    let nearest = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rest.length / 3; i++) {
      if (used.has(i)) continue;
      const p = i * 3;
      const dx = rest[p] - tx;
      const dy = rest[p + 1] - ty;
      const dz = rest[p + 2] - tz;
      const distance = dx * dx + dy * dy + dz * dz * 0.35;
      if (distance < nearestDistance) {
        nearest = i;
        nearestDistance = distance;
      }
    }
    used.add(nearest);
    return nearest;
  });
}

function createFruitTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (context) {
    const glow = context.createRadialGradient(16, 16, 1, 16, 16, 16);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.28, "rgba(255,255,255,1)");
    glow.addColorStop(0.62, "rgba(255,255,255,0.55)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 32, 32);
  }
  return new CanvasTexture(canvas);
}

/**
 * Plexus cloud sampled from the head GLB, morphing into the sculpture as the
 * hero docks. Neighbours for both shapes are baked into `hero-cloud.bin`.
 *
 * Points wander on a slow Lissajous inside a small box around their rest
 * position — bounded by construction, so they cannot drift off the form.
 * A mouse/pen also pushes nearby points away; the canvas is behind the type,
 * so that is read from the window, not from hover on the WebGL layer.
 * On large screens the group shrinks and slides left as the hero leaves, so
 * it keeps living in the blank beside the project wheel.
 * The rAF loop runs while the hero, projects, or Education handoff is visible.
 */
export default function HeroCloud({
  rootRef,
}: {
  rootRef: RefObject<HTMLElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const startLoopRef = useRef<() => void>(() => {});

  const draw = useCallback((scroll: number, force = false) => {
    const a = api.current;
    if (!a?.visible) return;
    a.scroll = scroll;
    const p = a.reduced
      ? 0.5
      : Math.min(1, Math.max(0, scroll / Math.max(1, a.vh)));
    if (!force && p === a.lastP && a.looping) return;
    pose(a);
    if (!a.looping) {
      if (a.reduced) drift(a, 0);
      a.renderer.render(a.scene, a.camera);
      if (!a.reduced && a.scatter < 0.999) startLoopRef.current();
    }
  }, []);

  useLenis((lenis) => draw(lenis.scroll));

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!wrap || !canvas || !root) return;

    let cancelled = false;
    let renderer: WebGLRenderer | undefined;
    let geoA: BufferGeometry | undefined;
    let geoB: BufferGeometry | undefined;
    let pointGeo: BufferGeometry | undefined;
    const fruitGeos: BufferGeometry[] = [];
    let lineMatA: LineBasicMaterial | undefined;
    let lineMatB: LineBasicMaterial | undefined;
    let dotMat: PointsMaterial | undefined;
    const fruitMats: PointsMaterial[] = [];
    let fruitTexture: CanvasTexture | undefined;
    let ro: ResizeObserver | undefined;
    let io: IntersectionObserver | undefined;
    let raf = 0;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let hideTimer = 0;
    let lastW = 0;
    let lastH = 0;

    const stopLoop = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = 0;
      }
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (api.current) api.current.looping = false;
    };

    const startLoop = () => {
      const a = api.current;
      if (!a || a.reduced || raf) return;
      a.looping = true;
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        const cur = api.current;
        if (!cur?.visible) return;
        pose(cur);
        drift(cur, now * 0.001);
        cur.renderer.render(cur.scene, cur.camera);
        // The field no longer changes once fully scattered. Leave the last
        // frame on the canvas and restart only if upward scroll reverses it.
        if (cur.scatter >= 0.999) stopLoop();
      };
      raf = requestAnimationFrame(tick);
    };
    startLoopRef.current = startLoop;

    void (async () => {
      const res = await fetch("/hero-cloud.bin");
      if (!res.ok) return;
      const ab = await res.arrayBuffer();
      if (cancelled) return;

      const view = new DataView(ab);
      if (view.getUint8(3) !== 0x32 /* CLD2 */) return;
      const pointCount = view.getUint32(4, true);
      const lineCountA = view.getUint32(8, true);
      const lineCountB = view.getUint32(12, true);
      const posAOff = 16;
      const posBOff = posAOff + pointCount * 12;
      const idxAOff = posBOff + pointCount * 12;
      const idxBOff = idxAOff + lineCountA * 8;
      const restA = Float32Array.from(
        new Float32Array(ab, posAOff, pointCount * 3),
      );
      const restB = Float32Array.from(
        new Float32Array(ab, posBOff, pointCount * 3),
      );
      const idxA = new Uint32Array(ab, idxAOff, lineCountA * 2);
      const idxB = new Uint32Array(ab, idxBOff, lineCountB * 2);
      const live = new Float32Array(restA);
      const fruitIndices = new Uint32Array(pickFruitIndices(restB));
      const clocks = new Float32Array(pointCount * 7);
      const scatterDirs = new Float32Array(pointCount * 3);
      const pseudoRandom = (seed: number) => {
        const value = Math.sin(seed) * 43758.5453;
        return value - Math.floor(value);
      };
      for (let i = 0; i < pointCount; i++) {
        const c = i * 7;
        const p = i * 3;
        // Incommensurate ranges so the path does not obviously loop.
        clocks[c] = 0.14 + Math.random() * 0.32;
        clocks[c + 1] = 0.12 + Math.random() * 0.32;
        clocks[c + 2] = 0.16 + Math.random() * 0.32;
        clocks[c + 3] = Math.random() * Math.PI * 2;
        clocks[c + 4] = Math.random() * Math.PI * 2;
        clocks[c + 5] = Math.random() * Math.PI * 2;
        clocks[c + 6] = AMP * (0.5 + Math.random() * 0.5);

        // Deterministic full-frame targets: every reload gets the same field,
        // and storing target-minus-rest makes upward scroll exactly reversible.
        const seed = i + 1;
        const targetX = (pseudoRandom(seed * 12.9898) * 2 - 1) * 1.08;
        const targetY = (pseudoRandom(seed * 78.233) * 2 - 1) * 0.62;
        const targetZ = (pseudoRandom(seed * 39.425) * 2 - 1) * 0.32;
        scatterDirs[p] = targetX - restB[p];
        scatterDirs[p + 1] = targetY - restB[p + 1];
        scatterDirs[p + 2] = targetZ - restB[p + 2];
      }

      const coarse = window.matchMedia("(pointer: coarse)").matches;
      renderer = new WebGLRenderer({
        canvas,
        // MSAA plus a buffer rebuild is what reads as a blink on iOS scroll.
        antialias: !coarse,
        alpha: false,
        powerPreference: coarse ? "default" : "low-power",
        stencil: false,
      });
      renderer.setClearColor(0x0a0a0a, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new Scene();
      scene.fog = new Fog(0x0a0a0a, 2.1, 3.5);

      const camera = new PerspectiveCamera(32, 1, 0.1, 8);
      camera.position.z = 2.35;

      const posAttr = new BufferAttribute(live, 3);
      geoA = new BufferGeometry();
      geoA.setAttribute("position", posAttr);
      geoA.setIndex(new BufferAttribute(idxA, 1));
      geoB = new BufferGeometry();
      geoB.setAttribute("position", posAttr);
      geoB.setIndex(new BufferAttribute(idxB, 1));

      // Points would honour the line index and draw every endpoint twice.
      pointGeo = new BufferGeometry();
      pointGeo.setAttribute("position", posAttr);

      lineMatA = new LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: LINE_OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      lineMatB = new LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      dotMat = new PointsMaterial({
        color: 0xffffff,
        size: 0.012,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        sizeAttenuation: true,
      });
      fruitTexture = createFruitTexture();

      const linesA = new LineSegments(geoA, lineMatA);
      const linesB = new LineSegments(geoB, lineMatB);
      linesB.visible = false;
      const dots = new Points(pointGeo, dotMat);
      const fruits = Array.from(fruitIndices, (index, i) => {
        const p = index * 3;
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new BufferAttribute(restB.slice(p, p + 3), 3),
        );
        fruitGeos.push(geometry);
        const material = new PointsMaterial({
          color: FRUIT_COLOR,
          size: i === 0 ? FRUIT_SELECTED_SIZE : FRUIT_SIZE,
          map: fruitTexture,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });
        fruitMats.push(material);
        const fruit = new Points(geometry, material);
        fruit.visible = false;
        fruit.renderOrder = i === 0 ? 2 : 1;
        return fruit;
      });

      const group = new Group();
      group.add(linesA, linesB, dots, ...fruits);
      scene.add(group);

      const scatterGeometry = () => {
        const projects = document.getElementById("projects");
        if (!projects) {
          return {
            start: Number.POSITIVE_INFINITY,
            travel: window.innerHeight * SCATTER_TRAVEL_VH,
          };
        }
        const top = projects.getBoundingClientRect().top + window.scrollY;
        const start =
          top +
          Math.max(
            0,
            projects.offsetHeight - window.innerHeight * SCATTER_START_INSET_VH,
          );
        const available =
          document.documentElement.scrollHeight - window.innerHeight - start;
        return {
          // Begin after most of the project stage has left, then settle by the
          // document's reachable end even on short pages.
          start,
          travel: Math.max(
            1,
            Math.min(window.innerHeight * SCATTER_TRAVEL_VH, available),
          ),
        };
      };

      const measureScrollRange = () => {
        if (!api.current) return;
        const scatterGeometryNext = scatterGeometry();
        api.current.vh = window.innerHeight;
        api.current.heroH = root.offsetHeight;
        api.current.wide = window.matchMedia("(min-width: 1024px)").matches;
        api.current.scatterStart = scatterGeometryNext.start;
        api.current.scatterTravel = scatterGeometryNext.travel;
      };

      const sizeCanvas = () => {
        const { width, height } = wrap.getBoundingClientRect();
        const w = Math.round(width);
        const h = Math.round(height);
        if (w < 1 || h < 1) return;
        // setSize reallocates the drawing buffer. Skip no-ops so accordion
        // height changes and iOS chrome jitter cannot flash the tree black.
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        renderer?.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };

      const fit = () => {
        sizeCanvas();
        measureScrollRange();
      };
      fit();

      const scatterGeometryInitial = scatterGeometry();
      api.current = {
        renderer,
        scene,
        camera,
        group,
        posAttr,
        restA,
        restB,
        live,
        clocks,
        scatterDirs,
        lineMatA,
        lineMatB,
        dotMat,
        fruitMats,
        linesA,
        linesB,
        fruits,
        fruitIndex: 0,
        morph: 0,
        scatter: 0,
        scatterStart: scatterGeometryInitial.start,
        scatterTravel: scatterGeometryInitial.travel,
        ndc: new Vector2(),
        ray: new Raycaster(),
        plane: new Plane(),
        planeN: new Vector3(),
        hit: new Vector3(),
        hitSmooth: new Vector3(),
        origin: new Vector3(),
        hasPointer: false,
        hitReady: false,
        repelMix: 0,
        visible: true,
        reduced,
        looping: false,
        vh: window.innerHeight,
        heroH: root.offsetHeight,
        wide: window.matchMedia("(min-width: 1024px)").matches,
        scroll: window.scrollY,
        lastP: Number.NaN,
        veil: veilRef.current,
      };

      draw(window.scrollY, true);
      canvas.classList.add("opacity-100");
      startLoop();

      ro = new ResizeObserver((entries) => {
        const wrapChanged = entries.some((entry) => entry.target === wrap);
        if (wrapChanged) sizeCanvas();
        measureScrollRange();
        if (api.current) api.current.lastP = Number.NaN;
        draw(window.scrollY, true);
      });
      ro.observe(wrap);
      const projectsForResize = document.getElementById("projects");
      if (projectsForResize) ro.observe(projectsForResize);

      const seen = new Set<Element>();
      io = new IntersectionObserver(
        (entries) => {
          if (!api.current) return;
          for (const entry of entries) {
            if (entry.isIntersecting) seen.add(entry.target);
            else seen.delete(entry.target);
          }
          if (seen.size > 0) {
            // iOS reports false leaves for a frame while the URL bar moves.
            // Dropping the loop then would clear the canvas (preserveDrawingBuffer
            // is off) and the tree would blink back in.
            if (hideTimer) {
              clearTimeout(hideTimer);
              hideTimer = 0;
            }
            api.current.visible = true;
            api.current.lastP = Number.NaN;
            draw(window.scrollY, true);
            startLoop();
            return;
          }
          if (hideTimer) return;
          hideTimer = window.setTimeout(() => {
            hideTimer = 0;
            if (!api.current || seen.size > 0) return;
            api.current.visible = false;
            stopLoop();
          }, 280);
        },
        { rootMargin: "30% 0px 30% 0px", threshold: 0 },
      );
      io.observe(root);
      const projects = document.getElementById("projects");
      if (projects) io.observe(projects);
      const education = document.getElementById("education");
      if (education) io.observe(education);
    })();

    const onVis = () => {
      if (document.hidden) stopLoop();
      else if (api.current?.visible) startLoop();
    };
    document.addEventListener("visibilitychange", onVis);

    // Window, not the canvas: the cloud is behind the headline and would
    // never see hover. Touch is ignored so a finger does not fight Lenis.
    const onPointerMove = (e: PointerEvent) => {
      const a = api.current;
      if (!a || a.reduced) return;
      if (e.pointerType === "touch") {
        a.hasPointer = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      a.hasPointer = true;
      a.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      a.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const onPointerGone = () => {
      if (api.current) api.current.hasPointer = false;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onPointerGone);
    window.addEventListener("blur", onPointerGone);
    const onProjectChange = (event: Event) => {
      const a = api.current;
      if (!a) return;
      const next = (event as CustomEvent<number>).detail;
      const previous = a.fruitIndex;
      a.fruitIndex = Math.min(
        a.fruits.length - 1,
        Math.max(0, Math.round(next)),
      );
      a.fruitMats[previous].size = FRUIT_SIZE;
      a.fruits[previous].renderOrder = 1;
      a.fruitMats[a.fruitIndex].size = FRUIT_SELECTED_SIZE;
      a.fruits[a.fruitIndex].renderOrder = 2;
      a.lastP = Number.NaN;
      draw(window.scrollY, true);
      startLoop();
    };
    window.addEventListener("portfolio:project-change", onProjectChange);

    return () => {
      cancelled = true;
      stopLoop();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("mouseleave", onPointerGone);
      window.removeEventListener("blur", onPointerGone);
      window.removeEventListener("portfolio:project-change", onProjectChange);
      ro?.disconnect();
      io?.disconnect();
      startLoopRef.current = () => {};
      api.current = null;
      geoA?.dispose();
      geoB?.dispose();
      pointGeo?.dispose();
      for (const geometry of fruitGeos) geometry.dispose();
      lineMatA?.dispose();
      lineMatB?.dispose();
      dotMat?.dispose();
      for (const material of fruitMats) material.dispose();
      fruitTexture?.dispose();
      renderer?.dispose();
    };
  }, [draw, rootRef]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="h-full w-full transform-gpu opacity-0 backface-hidden transition-opacity duration-500"
      />
      {/* Fades out as the head docks, so the parked bust is not sitting under
          the hero's readability veil. */}
      <div
        ref={veilRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/45"
      />
    </div>
  );
}
