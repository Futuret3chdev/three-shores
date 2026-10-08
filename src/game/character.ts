import * as THREE from "three";

export type Rig = {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  calfL: THREE.Group;
  calfR: THREE.Group;
};

function mat(color: string, rough = 0.72, metal = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function limb(radius: number, length: number, material: THREE.Material) {
  const pivot = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.05, length - radius * 2), 4, 10);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

export function createRunner(): Rig {
  const cloth = mat("#1a222c", 0.84, 0.08);
  const clothDark = mat("#12181f", 0.88, 0.05);
  const skin = mat("#c49a78", 0.62, 0.02);
  const hair = mat("#14110e", 0.8, 0.05);
  const boot = mat("#0c0d10", 0.55, 0.2);
  const teal = mat("#1f6f66", 0.5, 0.15);

  const root = new THREE.Group();
  const hip = new THREE.Group();
  hip.position.y = 0.96;
  root.add(hip);

  const torso = new THREE.Group();
  hip.add(torso);

  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 4, 12), cloth);
  chest.scale.set(1.15, 1.15, 0.82);
  chest.position.y = 0.28;
  chest.castShadow = true;
  torso.add(chest);

  const coat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.28), cloth);
  coat.position.y = 0.22;
  coat.castShadow = true;
  torso.add(coat);

  const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.04), clothDark);
  lapelL.position.set(-0.08, 0.34, 0.14);
  lapelL.rotation.z = 0.18;
  torso.add(lapelL);
  const lapelR = lapelL.clone();
  lapelR.position.x = 0.08;
  lapelR.rotation.z = -0.18;
  torso.add(lapelR);

  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.02), teal);
  shirt.position.set(0, 0.42, 0.15);
  torso.add(shirt);

  const hem = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.26), clothDark);
  hem.position.y = -0.12;
  torso.add(hem);

  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), cloth);
  shoulderL.position.set(-0.26, 0.46, 0);
  torso.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.26;
  torso.add(shoulderR);

  const head = new THREE.Group();
  head.position.y = 0.66;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 14), skin);
  skull.scale.set(0.96, 1.05, 0.98);
  skull.castShadow = true;
  head.add(skull);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.142, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.y = 0.02;
  head.add(hairCap);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), skin);
  jaw.position.set(0, -0.08, 0.05);
  head.add(jaw);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.04), skin);
  nose.position.set(0, -0.01, 0.13);
  head.add(nose);

  const armL = limb(0.055, 0.3, cloth);
  armL.position.set(-0.28, 0.44, 0);
  torso.add(armL);
  const foreL = limb(0.048, 0.28, skin);
  foreL.position.y = -0.3;
  armL.add(foreL);
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.05), skin);
  handL.position.y = -0.3;
  foreL.add(handL);

  const armR = limb(0.055, 0.3, cloth);
  armR.position.set(0.28, 0.44, 0);
  torso.add(armR);
  const foreR = limb(0.048, 0.28, skin);
  foreR.position.y = -0.3;
  armR.add(foreR);
  const handR = handL.clone();
  foreR.add(handR);

  const thighL = limb(0.085, 0.4, clothDark);
  thighL.position.set(-0.11, 0, 0);
  hip.add(thighL);
  const calfL = limb(0.062, 0.38, clothDark);
  calfL.position.y = -0.4;
  thighL.add(calfL);
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), boot);
  bootL.position.set(0, -0.4, 0.04);
  bootL.castShadow = true;
  calfL.add(bootL);

  const thighR = limb(0.085, 0.4, clothDark);
  thighR.position.set(0.11, 0, 0);
  hip.add(thighR);
  const calfR = limb(0.062, 0.38, clothDark);
  calfR.position.y = -0.4;
  thighR.add(calfR);
  const bootR = bootL.clone();
  calfR.add(bootR);

  return { root, torso, head, armL, armR, foreL, foreR, thighL, thighR, calfL, calfR };
}

export function animateRunner(rig: Rig, time: number, speed: number, grounded: boolean) {
  const moving = Math.min(1, Math.abs(speed) / 3.2);
  const cadence = time * (8 + moving * 6);
  const swing = Math.sin(cadence) * moving;
  rig.thighL.rotation.x = swing * 0.85;
  rig.thighR.rotation.x = -swing * 0.85;
  rig.calfL.rotation.x = Math.max(0, -swing) * 1.1;
  rig.calfR.rotation.x = Math.max(0, swing) * 1.1;
  rig.armL.rotation.x = -swing * 0.7;
  rig.armR.rotation.x = swing * 0.7;
  rig.foreL.rotation.x = -0.25 - Math.max(0, swing) * 0.4;
  rig.foreR.rotation.x = -0.25 - Math.max(0, -swing) * 0.4;
  rig.torso.rotation.x = 0.06 + moving * 0.08;
  rig.torso.rotation.z = -swing * 0.05;
  rig.head.rotation.x = -0.04;
  if (!grounded) {
    rig.thighL.rotation.x = 0.35;
    rig.thighR.rotation.x = -0.15;
    rig.armL.rotation.x = -0.8;
    rig.armR.rotation.x = -0.55;
    rig.foreL.rotation.x = -0.4;
    rig.foreR.rotation.x = -0.3;
  }
}
