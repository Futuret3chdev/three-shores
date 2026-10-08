import * as THREE from "three";

export type CityId = "melbourne" | "sydney" | "brisbane";

export type Collider = {
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
};

export type CityBuild = {
  group: THREE.Group;
  colliders: Collider[];
  motes: THREE.Object3D[];
  beacon: THREE.Vector3;
  spawn: THREE.Vector3;
  spawnYaw: number;
  tick: (t: number) => void;
  dispose: () => void;
};

const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);

function stone(color: string, rough = 0.86) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.04 });
}

export function buildCity(id: CityId): CityBuild {
  const group = new THREE.Group();
  const colliders: Collider[] = [];
  const motes: THREE.Object3D[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const tickers: Array<(t: number) => void> = [];

  const track = <T extends THREE.BufferGeometry>(g: T) => {
    geos.push(g);
    return g;
  };
  const trackM = <T extends THREE.Material>(m: T) => {
    mats.push(m);
    return m;
  };

  function addBox(
    material: THREE.Material,
    cx: number,
    cy: number,
    cz: number,
    hx: number,
    hy: number,
    hz: number,
    cast = false,
  ) {
    const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2)), material);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ cx, cy, cz, hx, hy, hz });
    return mesh;
  }

  function visual(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rotY = 0,
  ) {
    const mesh = new THREE.Mesh(track(geo), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function slab(
    material: THREE.Material,
    cx: number,
    top: number,
    cz: number,
    hx: number,
    hz: number,
  ) {
    return addBox(material, cx, top - 0.14, cz, hx, 0.14, hz, true);
  }

  function stairsZ(
    material: THREE.Material,
    x: number,
    z0: number,
    z1: number,
    y0: number,
    y1: number,
    width: number,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const top = y0 + ((y1 - y0) * (i + 1)) / count;
      const cz = z0 + ((z1 - z0) * (i + 0.5)) / count;
      const hz = Math.abs(z1 - z0) / count / 2 + 0.05;
      slab(material, x, top, cz, width / 2, hz);
    }
  }

  function stairsX(
    material: THREE.Material,
    z: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    depth: number,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const top = y0 + ((y1 - y0) * (i + 1)) / count;
      const cx = x0 + ((x1 - x0) * (i + 0.5)) / count;
      const hx = Math.abs(x1 - x0) / count / 2 + 0.05;
      slab(material, cx, top, z, hx, depth / 2);
    }
  }

  function mote(x: number, y: number, z: number) {
    const gold = trackM(
      new THREE.MeshStandardMaterial({
        color: "#f0d48a",
        emissive: "#c48a22",
        emissiveIntensity: 0.6,
        metalness: 0.85,
        roughness: 0.25,
      }),
    );
    const mesh = new THREE.Mesh(track(new THREE.TorusGeometry(0.28, 0.07, 8, 16)), gold);
    mesh.position.set(x, y, z);
    group.add(mesh);
    motes.push(mesh);
  }

  function windows(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number) {
    const glass = trackM(
      new THREE.MeshStandardMaterial({
        color: "#f2c078",
        emissive: "#e07a2f",
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.4,
      }),
    );
    const spots: Array<[number, number, number, number]> = [];
    const pushFace = (
      ox: number,
      oy: number,
      oz: number,
      yaw: number,
      spanA: number,
      spanB: number,
    ) => {
      const cols = Math.max(2, Math.floor(spanA / 1.5));
      const rows = Math.max(2, Math.floor(spanB / 1.7));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const u = (c + 0.5) / cols - 0.5;
          const v = (r + 0.5) / rows - 0.5;
          const ax = Math.cos(yaw);
          const az = Math.sin(yaw);
          spots.push([
            ox + ax * u * spanA,
            oy + v * spanB,
            oz + az * u * spanA,
            yaw,
          ]);
        }
      }
    };
    pushFace(cx, cy, cz + hz + 0.05, 0, hx * 2 * 0.8, hy * 2 * 0.7);
    pushFace(cx, cy, cz - hz - 0.05, 0, hx * 2 * 0.8, hy * 2 * 0.7);
    pushFace(cx + hx + 0.05, cy, cz, Math.PI / 2, hz * 2 * 0.75, hy * 2 * 0.7);
    pushFace(cx - hx - 0.05, cy, cz, Math.PI / 2, hz * 2 * 0.75, hy * 2 * 0.7);
    const geo = track(new THREE.PlaneGeometry(0.55, 0.8));
    const mesh = new THREE.InstancedMesh(geo, glass, spots.length);
    spots.forEach(([x, y, z, yaw], i) => {
      _dummy.position.set(x, y, z);
      _dummy.rotation.set(0, yaw, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  function members(color: string, segs: Array<[number, number, number, number, number, number]>, thick: number) {
    const material = trackM(stone(color, 0.45));
    material.metalness = 0.72;
    const geo = track(new THREE.BoxGeometry(1, 1, 1));
    const mesh = new THREE.InstancedMesh(geo, material, segs.length);
    segs.forEach(([ax, ay, az, bx, by, bz], i) => {
      const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
      const len = dir.length() || 0.01;
      dir.multiplyScalar(1 / len);
      _dummy.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      _dummy.quaternion.setFromUnitVectors(_up, dir);
      _dummy.scale.set(thick, len, thick);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    group.add(mesh);
  }

  const sand = trackM(stone("#c4a15a"));
  const sandDark = trackM(stone("#8d6a3a"));
  const copper = trackM(stone("#3c6b52", 0.42));
  copper.metalness = 0.55;
  const concrete = trackM(stone("#6e655c"));
  const steel = trackM(stone("#8ea0ac", 0.35));
  steel.metalness = 0.8;
  const glassMat = trackM(
    new THREE.MeshStandardMaterial({
      color: "#b7dbe6",
      roughness: 0.08,
      metalness: 0.65,
      transparent: true,
      opacity: 0.72,
    }),
  );
  const shellMat = trackM(
    new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.38, metalness: 0.12 }),
  );
  const yellow = trackM(stone("#e2b133", 0.6));
  const waterMat = trackM(
    new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float w = sin(vUv.x * 48.0 + uTime) * sin(vUv.y * 36.0 - uTime * 0.8);
          vec3 col = mix(vec3(0.04, 0.12, 0.16), vec3(0.18, 0.38, 0.42), w * 0.5 + 0.5);
          gl_FragColor = vec4(col, 0.92);
        }
      `,
    }),
  );
  tickers.push((t) => {
    (waterMat.uniforms.uTime as { value: number }).value = t;
  });

  let beacon = new THREE.Vector3();
  let spawn = new THREE.Vector3();
  let spawnYaw = 0;

  if (id === "melbourne") {
    spawn.set(0, 0.2, 30);
    spawnYaw = 0;
    addBox(concrete, 0, -0.3, 24, 20, 0.3, 12);
    addBox(concrete, 0, -0.3, -20, 22, 0.3, 12);
    const river = new THREE.Mesh(track(new THREE.PlaneGeometry(70, 22)), waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, -0.15, 2);
    group.add(river);

    slab(sand, 0, 5.1, 2, 3.4, 15);
    addBox(sandDark, -3.6, 3.2, 2, 0.18, 1.3, 15);
    addBox(sandDark, 3.6, 3.2, 2, 0.18, 1.3, 15);
    stairsZ(sand, 0, 16, 8, 0, 5.1, 4.2, 10);
    stairsZ(sand, 0, -8, -16, 5.1, 0, 4.2, 10);

    addBox(sand, 0, 6.2, -24, 15, 6.2, 5.2, true);
    windows(0, 6.2, -24, 15, 6.2, 5.2);
    const dome = visual(new THREE.SphereGeometry(5.2, 28, 18), copper, 0, 13.4, -24);
    dome.scale.set(1, 0.72, 1);
    visual(new THREE.CylinderGeometry(0.35, 0.45, 3.2, 10), sandDark, 0, 17.2, -24);
    const clock = visual(new THREE.CircleGeometry(1.15, 24), trackM(stone("#f3ead7", 0.4)), 0, 8.4, -18.7);
    clock.position.z = -18.75;
    for (let i = 0; i < 9; i++) {
      const z = -16.2 + (i - 4) * 2.5;
      visual(new THREE.TorusGeometry(1.15, 0.12, 6, 10, Math.PI), sandDark, z, 2.3, -18.75, Math.PI / 2);
    }

    for (let i = 0; i < 8; i++) {
      const top = 1.35 + i * 1.2;
      slab(sand, 18.2, top, -24, 1.2, 2.1);
      if (i % 2 === 0) mote(18.2, top + 0.65, -24);
    }
    slab(sand, 16.5, 1.15, -24, 0.8, 1.2);
    beacon.set(0, 12.6, -24);
    mote(0, 1.2, 28);
    mote(0, 6.0, 6);
    mote(0, 6.0, -4);
    mote(0, 1.2, -16);

    slab(yellow, 8, 1.35, 26, 4.2, 1.15);
    addBox(sandDark, 8, 0.45, 26, 4, 0.45, 1);
    slab(sand, 12, 2.55, 20, 3.2, 2.4);
    addBox(sandDark, 12, 1.15, 20, 3, 1.15, 2.2, true);
    mote(12, 3.2, 20);

    for (let i = 0; i < 5; i++) {
      const h = 2 + i * 1.3;
      const shard = visual(
        new THREE.BoxGeometry(3.2, h, 0.35),
        glassMat,
        -14 + i * 0.4,
        h / 2,
        28 - i * 1.1,
      );
      shard.rotation.y = -0.5 + i * 0.18;
      shard.rotation.z = -0.15;
    }
    visual(new THREE.BoxGeometry(4, 48, 4), trackM(stone("#d7d2c8", 0.4)), 34, 24, -8);
    visual(new THREE.BoxGeometry(2.2, 18, 2.2), glassMat, 34, 46, -8);
  }

  if (id === "sydney") {
    spawn.set(-24, 0.2, 8);
    spawnYaw = -Math.PI / 2;
    addBox(concrete, -18, -0.3, 8, 12, 0.3, 10);
    const river = new THREE.Mesh(track(new THREE.PlaneGeometry(120, 80)), waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(20, -0.45, 0);
    group.add(river);

    addBox(sand, -22, 2.2, 8, 4.5, 2.2, 3.4, true);
    windows(-22, 2.2, 8, 4.5, 2.2, 3.4);
    stairsX(sand, 8, -16, -12, 0, 4.5, 3, 8);
    slab(sand, -14, 4.6, 8, 2.4, 2.6);
    addBox(sandDark, -14, 2.1, 8, 2.2, 2.1, 2.4, true);
    slab(sand, -6, 6.3, 5, 2.5, 2.4);
    addBox(sandDark, -6, 2.9, 5, 2.3, 2.9, 2.2, true);
    slab(sand, 1, 7.6, 2, 2.2, 2.2);

    slab(steel, 26, 8.7, 0, 24, 3.3);
    addBox(steel, 26, 8.2, 3.5, 24, 0.35, 0.18);
    addBox(steel, 26, 8.2, -3.5, 24, 0.35, 0.18);
    addBox(sand, 2, 6, 0, 2.2, 6, 2.2, true);
    addBox(sand, 50, 6, 0, 2.2, 6, 2.2, true);

    const arch: Array<[number, number, number, number, number, number]> = [];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI * (0.08 + (0.84 * i) / n);
      const a1 = Math.PI * (0.08 + (0.84 * (i + 1)) / n);
      const x0 = 26 + Math.cos(a0) * 24;
      const y0 = 8.5 + Math.sin(a0) * 16;
      const x1 = 26 + Math.cos(a1) * 24;
      const y1 = 8.5 + Math.sin(a1) * 16;
      arch.push([x0, y0, 2.2, x1, y1, 2.2]);
      arch.push([x0, y0, -2.2, x1, y1, -2.2]);
      if (i % 2 === 0) {
        arch.push([x0, y0, 2.2, x0, 8.7, 2.2]);
        arch.push([x0, y0, -2.2, x0, 8.7, -2.2]);
      }
    }
    members("#c5d0d8", arch, 0.45);

    stairsX(concrete, 0, 48, 56, 8.7, 2.2, 4, 12);
    addBox(shellMat, 62, 1.1, 0, 10, 1.1, 8, true);
    const shellGeo = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const s1 = visual(shellGeo, shellMat, 58, 2.2, -2);
    s1.scale.set(6.5, 9.5, 4.2);
    s1.rotation.y = 0.4;
    const s2 = visual(shellGeo.clone(), shellMat, 64, 2.2, 1.5);
    s2.scale.set(5.5, 11, 4);
    s2.rotation.y = -0.2;
    const s3 = visual(shellGeo.clone(), shellMat, 68, 2.2, -3);
    s3.scale.set(4.2, 7.5, 3.4);
    s3.rotation.y = 0.8;

    beacon.set(63, 2.4, 2);
    mote(-20, 5.2, 8);
    mote(-6, 7.1, 5);
    mote(16, 9.4, 0);
    mote(36, 9.4, 0);
    mote(62, 3.1, 0);

    for (let i = 0; i < 6; i++) {
      visual(new THREE.BoxGeometry(3.5, 18 + i * 6, 3.5), trackM(stone("#d9dde2", 0.35)), 20 + i * 5, 16, -18);
    }
  }

  if (id === "brisbane") {
    spawn.set(0, 0.2, 22);
    spawnYaw = 0;
    addBox(concrete, 0, -0.3, 16, 16, 0.3, 10);
    addBox(concrete, -16, -0.3, 2, 10, 0.3, 8);
    const river = new THREE.Mesh(track(new THREE.PlaneGeometry(90, 28)), waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(28, -0.4, -2);
    group.add(river);

    slab(sand, 0, 1.3, 12, 6, 2.2);
    slab(sand, 0, 2.5, 8, 5, 1.8);
    stairsZ(sand, 0, 14, 10, 0, 1.3, 5, 4);

    addBox(sand, -16, 5, 2, 7, 5, 5.5, true);
    windows(-16, 5, 2, 7, 5.5, 5.5);
    addBox(sand, -16, 13, 2, 2.1, 3.2, 2.1, true);
    visual(new THREE.SphereGeometry(2.3, 18, 12), copper, -16, 17.4, 2).scale.set(1, 0.7, 1);
    visual(new THREE.CircleGeometry(0.7, 20), trackM(stone("#f4efe4", 0.4)), -16, 12.2, 4.16);
    stairsZ(sand, -7.2, 12, 8.8, 0, 1.5, 3.2, 4);

    slab(steel, 30, 7.2, -2, 18, 3.1);
    addBox(steel, 30, 6.6, 1.3, 18, 0.45, 0.2);
    addBox(steel, 30, 6.6, -5.3, 18, 0.45, 0.2);
    stairsX(concrete, -2, 8, 14, 0, 7.2, 4.5, 14);

    const truss: Array<[number, number, number, number, number, number]> = [];
    for (let i = 0; i < 14; i++) {
      const x = 14 + i * 2.4;
      truss.push([x, 7.2, 1.2, x, 11.2, 1.2]);
      truss.push([x, 7.2, -5.2, x, 11.2, -5.2]);
      truss.push([x, 11.2, 1.2, x + 2.4, 11.2, 1.2]);
      truss.push([x, 11.2, -5.2, x + 2.4, 11.2, -5.2]);
      truss.push([x, 7.2, 1.2, x + 2.4, 11.2, 1.2]);
      truss.push([x, 11.2, -5.2, x + 2.4, 7.2, -5.2]);
      truss.push([x, 11.2, 1.2, x, 11.2, -5.2]);
    }
    members("#9aa8b2", truss, 0.28);

    const wheel = visual(new THREE.TorusGeometry(4.2, 0.18, 8, 28), steel, 10, 4.6, 20);
    wheel.rotation.y = 0.2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      visual(
        new THREE.BoxGeometry(0.08, 4, 0.08),
        steel,
        10 + Math.cos(a) * 0.2,
        4.6,
        20,
      ).rotation.z = a;
    }

    beacon.set(46, 7.5, -2);
    mote(0, 2.1, 12);
    mote(0, 3.2, 8);
    mote(-16, 11, 2);
    mote(22, 8, -2);
    mote(36, 8, -2);
    mote(44, 8, -2);
  }

  const crystalMat = trackM(
    new THREE.MeshStandardMaterial({
      color: "#8ff6e4",
      emissive: "#1ec8b0",
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.3,
    }),
  );
  const crystal = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.7, 0)), crystalMat);
  crystal.position.copy(beacon);
  group.add(crystal);
  const light = new THREE.PointLight("#7ef0dc", 4, 14);
  light.position.copy(beacon);
  group.add(light);
  tickers.push((t) => {
    crystal.position.y = beacon.y + Math.sin(t * 2) * 0.25;
    crystal.rotation.y = t * 0.8;
    light.position.y = crystal.position.y;
  });
  motes.forEach((m, i) => {
    const base = m.position.y;
    tickers.push((t) => {
      m.rotation.y = t * 1.4 + i;
      m.rotation.x = Math.sin(t + i) * 0.4;
      m.position.y = base + Math.sin(t * 2 + i) * 0.12;
    });
  });

  return {
    group,
    colliders,
    motes,
    beacon,
    spawn,
    spawnYaw,
    tick: (t) => tickers.forEach((fn) => fn(t)),
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
