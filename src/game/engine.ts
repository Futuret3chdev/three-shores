import * as THREE from "three";
import { animateRunner, createRunner } from "./character";
import { buildCity, type CityBuild, type CityId, type Collider } from "./cities";

export type TouchState = { steer: number; throttle: number; jump: boolean; sprint: boolean };

type Probe = {
  getYaw: () => number;
  getSpeed: () => number;
  setKeys: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: Probe;
  }
}

const R = 0.34;
const HEIGHT = 1.72;

export type ShoreHandle = {
  setCity: (id: CityId) => void;
  setTouch: (t: Partial<TouchState>) => void;
  requestJump: () => void;
  setActive: (on: boolean) => void;
  dispose: () => void;
  claimed: () => boolean;
};

export function mountShores(
  canvas: HTMLCanvasElement,
  opts: {
    city: CityId;
    onMotes: (n: number, total: number) => void;
    onClaim: () => void;
    onCity: (id: CityId) => void;
    arrow: HTMLElement | null;
  },
): ShoreHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9aa7a4");
  scene.fog = new THREE.Fog("#9aa7a4", 28, 90);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 160);
  const hemi = new THREE.HemisphereLight("#fff1dc", "#3a2a22", 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffe0b0", 1.6);
  sun.position.set(18, 28, 12);
  scene.add(sun);

  const rig = createRunner();
  scene.add(rig.root);

  function dressCity(group: THREE.Group) {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.visible = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
    });
  }

  const keys = new Set<string>();
  let qa: Set<string> | null = null;
  const touch: TouchState = { steer: 0, throttle: 0, jump: false, sprint: false };
  let jumpQueued = false;

  let city: CityBuild = buildCity(opts.city);
  dressCity(city.group);
  scene.add(city.group);
  let cityId = opts.city;

  const pos = city.spawn.clone();
  let yaw = city.spawnYaw;
  let speed = 0;
  let vy = 0;
  let grounded = false;
  let coyote = 0;
  let live = false;
  let claimed = false;
  const taken = new Set<number>();
  const camDesired = new THREE.Vector3();

  const held = (code: string) => (qa ?? keys).has(code);

  window.__controlsTest = {
    getYaw: () => yaw,
    getSpeed: () => speed,
    setKeys: (codes) => {
      qa = new Set(codes);
    },
  };

  const onDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    if (e.code === "Space") jumpQueued = true;
  };
  const onUp = (e: KeyboardEvent) => keys.delete(e.code);
  const clear = () => keys.clear();
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", clear);

  let sizedW = 0;
  let sizedH = 0;
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (Math.abs(w - sizedW) < 3 && Math.abs(h - sizedH) < 3) return;
    sizedW = w;
    sizedH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function bodyHits(feet: number, b: Collider) {
    const top = b.cy + b.hy;
    const bot = b.cy - b.hy;
    return feet + HEIGHT > bot + 0.02 && feet < top - 0.08;
  }

  function resetSpawn() {
    pos.copy(city.spawn);
    yaw = city.spawnYaw;
    speed = 0;
    vy = 0;
    grounded = true;
  }

  function followCamera(dt: number) {
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    camDesired.set(pos.x - fx * 7.4, pos.y + 2.7, pos.z - fz * 7.4);
    const k = 1 - Math.exp(-7 * dt);
    camera.position.lerp(camDesired, k);
    camera.lookAt(pos.x, pos.y + 1.25, pos.z);
  }

  let last = performance.now();
  let t = 0;
  let raf = 0;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    let steer = 0;
    if (held("KeyA") || held("ArrowLeft")) steer += 1;
    if (held("KeyD") || held("ArrowRight")) steer -= 1;
    let throttle = 0;
    if (held("KeyW") || held("ArrowUp")) throttle += 1;
    if (held("KeyS") || held("ArrowDown")) throttle -= 1;
    const sprint = held("ShiftLeft") || held("ShiftRight") || (qa == null && touch.sprint);
    if (qa == null) {
      const steerTouch = Math.abs(touch.steer) < 0.2 ? 0 : touch.steer;
      const throttleTouch = Math.abs(touch.throttle) < 0.2 ? 0 : touch.throttle;
      if (steer === 0) steer = steerTouch;
      if (throttle === 0) throttle = throttleTouch;
      if (touch.jump) {
        jumpQueued = true;
        touch.jump = false;
      }
    }

    if (live && !claimed) {
      yaw += steer * 2.6 * dt;
      const max = sprint && throttle > 0 ? 8.4 : 5.4;
      const target = throttle * max;
      speed += (target - speed) * Math.min(1, dt * 7);
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      if (!grounded) vy -= 20 * dt;
      if (coyote > 0) coyote -= dt;
      if (jumpQueued && (grounded || coyote > 0)) {
        vy = 8.1;
        grounded = false;
        coyote = 0;
      }
      jumpQueued = false;

      const prevY = pos.y;
      pos.y += vy * dt;
      let nx = pos.x + fx * speed * dt;
      let nz = pos.z + fz * speed * dt;

      for (const b of city.colliders) {
        if (!bodyHits(pos.y, b)) continue;
        const left = b.cx - b.hx - R;
        const right = b.cx + b.hx + R;
        const near = b.cz - b.hz - R;
        const far = b.cz + b.hz + R;
        if (nx > left && nx < right && nz > near && nz < far) {
          const top = b.cy + b.hy;
          const rise = top - prevY;
          if (rise > 0.04 && rise < 0.62 && vy <= 1) {
            pos.y = top;
            vy = 0;
            grounded = true;
            continue;
          }
          if (rise >= 0.62 && rise < 1.65 && speed > 3.2 && throttle > 0) {
            pos.y = top;
            vy = 2.4;
            grounded = false;
            continue;
          }
          const penX = Math.min(Math.abs(nx - left), Math.abs(nx - right));
          const penZ = Math.min(Math.abs(nz - near), Math.abs(nz - far));
          if (penX < penZ) nx = nx < b.cx ? left : right;
          else nz = nz < b.cz ? near : far;
        }
      }
      pos.x = nx;
      pos.z = nz;

      grounded = false;
      let support = -Infinity;
      for (const b of city.colliders) {
        const top = b.cy + b.hy;
        const over =
          Math.abs(pos.x - b.cx) < b.hx + R * 0.45 && Math.abs(pos.z - b.cz) < b.hz + R * 0.45;
        if (!over) continue;
        if (vy <= 0.2 && prevY >= top - 0.2 && pos.y <= top + 0.08 && top >= support) {
          support = top;
        }
        const bot = b.cy - b.hy;
        if (vy > 0 && prevY + HEIGHT <= bot + 0.05 && pos.y + HEIGHT >= bot) {
          pos.y = bot - HEIGHT;
          vy = 0;
        }
      }
      if (support > -Infinity && pos.y <= support + 0.08) {
        pos.y = support;
        vy = 0;
        grounded = true;
        coyote = 0.14;
      }

      if (pos.y < -6) resetSpawn();

      city.motes.forEach((m, i) => {
        if (taken.has(i) || !m.visible) return;
        const dx = m.position.x - pos.x;
        const dy = m.position.y - (pos.y + 1);
        const dz = m.position.z - pos.z;
        if (dx * dx + dy * dy + dz * dz < 1.6) {
          m.visible = false;
          taken.add(i);
          opts.onMotes(taken.size, city.motes.length);
          blip();
        }
      });

      const bx = city.beacon.x - pos.x;
      const bz = city.beacon.z - pos.z;
      if (bx * bx + bz * bz < 3.2 && Math.abs(city.beacon.y - pos.y) < 2.4) {
        claimed = true;
        opts.onClaim();
      }
      if (opts.arrow) {
        const facingX = -Math.sin(yaw);
        const facingZ = -Math.cos(yaw);
        const ang = Math.atan2(bx * facingZ - bz * facingX, bx * facingX + bz * facingZ);
        opts.arrow.style.transform = `rotate(${ang}rad)`;
      }
    }

    rig.root.position.copy(pos);
    rig.root.rotation.y = yaw + Math.PI;
    animateRunner(rig, t, speed, grounded);
    city.tick(t);
    followCamera(dt);
    renderer.render(scene, camera);
  }

  followCamera(1);
  raf = requestAnimationFrame(frame);
  opts.onMotes(0, city.motes.length);

  let audio: AudioContext | null = null;
  function blip() {
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 740;
      g.gain.setValueAtTime(0.04, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
      o.connect(g);
      g.connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.12);
    } catch {
      /* ignore */
    }
  }

  return {
    setCity(id: CityId) {
      if (id === cityId) return;
      scene.remove(city.group);
      city.dispose();
      city = buildCity(id);
      dressCity(city.group);
      scene.add(city.group);
      cityId = id;
      taken.clear();
      claimed = false;
      resetSpawn();
      const skies: Record<CityId, string> = {
        melbourne: "#9aa7a4",
        sydney: "#8eb4c9",
        brisbane: "#7ec0d8",
      };
      scene.background = new THREE.Color(skies[id]);
      scene.fog = new THREE.Fog(skies[id], 28, 90);
      opts.onCity(id);
      opts.onMotes(0, city.motes.length);
    },
    setTouch(t) {
      if (t.steer != null) touch.steer = t.steer;
      if (t.throttle != null) touch.throttle = t.throttle;
      if (t.jump) touch.jump = true;
      if (t.sprint != null) touch.sprint = t.sprint;
    },
    requestJump() {
      jumpQueued = true;
    },
    setActive(on: boolean) {
      live = on;
      if (!on) {
        speed = 0;
        vy = 0;
      }
    },
    claimed: () => claimed,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      if (window.__controlsTest) delete window.__controlsTest;
      scene.remove(city.group);
      city.dispose();
      renderer.dispose();
    },
  };
}
