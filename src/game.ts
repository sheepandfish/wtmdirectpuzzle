import * as THREE from "three";
import {
  DEFAULT_FOV,
  MOUSE_SENSITIVITY,
  NADES,
  PLAYER_HEIGHT,
  PRICES,
  REWARDS,
  ROUND,
  SCOPE_FOV,
  STARTING_MONEY,
  TEAM_SIZE,
  WEAPONS,
  weaponDef,
  type WeaponId,
} from "./config";
import { commandFromInput } from "./core/command";
import { applyPurchase, helmetPrice, killReward, roundPayout } from "./core/economy";
import { Input } from "./core/input";
import { FixedLoop } from "./core/loop";
import { clamp, degToRad, lerp, lerpVec, yawPitchToDir, yawToOffset, type Vec3 } from "./core/math";
import { horizontalSpeed, simulateMove, type Solid } from "./core/physics";
import { traceShot } from "./core/raycast";
import { advancePhase, isMatchOver } from "./core/round";
import { createRng, type Rng } from "./core/rng";
import { SoundBus } from "./audio/sounds";
import { createBrain, stepBot, type BotBrain } from "./ai/bot";
import {
  chooseBombCarrier,
  createBomb,
  dropBomb,
  settleDroppedBomb,
  tryPickupBomb,
  useActionPrompt,
  type Bomb,
  bombWorldPos,
} from "./entities/bomb";
import {
  applyFlashPop,
  clearNades,
  createNadeWorld,
  stepFlashDecay,
  stepNades,
  throwNade,
  type NadeWorld,
} from "./entities/nades";
import {
  activeWeapon,
  activeWeaponDef,
  addMoney,
  createPlayer,
  damagePlayer,
  eyePosition,
  giveWeapon,
  resetForRound,
  switchSlot,
  tryReload,
  type Player,
} from "./entities/player";
import { matchRosterNames, otherTeam, spawnYaw, teamColor, type Team } from "./entities/team";
import { buildSandMap } from "./map/sand";
import { signColor, signParts, siteSignPlacements } from "./map/signs";
import type { GameMap } from "./map/types";
import { currentSpreadDeg, sampleShotDirection } from "./weapons/shooting";
import { canFire, consumeShot, stepWeapon, toggleScope } from "./weapons/weapon";
import { Hud, type DamageLine, type HurtPip, type KillLine } from "./ui/hud";

interface Decal {
  mesh: THREE.Mesh;
  life: number;
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly viewmodel = new THREE.Group();
  private readonly input = new Input();
  private readonly audio = new SoundBus();
  private readonly hud: Hud;
  private readonly map: GameMap;
  private readonly solids: Solid[];
  private readonly loop: FixedLoop;
  private readonly playerMeshes = new Map<number, THREE.Group>();
  private readonly bombMesh: THREE.Mesh;
  private readonly clock = new THREE.Clock();
  private readonly rng: Rng = createRng((Math.random() * 0xffffffff) >>> 0);
  private readonly nades: NadeWorld = createNadeWorld();
  private readonly nadeMeshes = new Map<number, THREE.Object3D>();
  private readonly smokeMeshes = new Map<number, THREE.Object3D>();

  private players: Player[] = [];
  private brains: BotBrain[] = [];
  private localId = 0;
  private cameraTargetId = 0;
  private bomb: Bomb | null = null;
  private phase: "menu" | "freeze" | "live" | "end" | "matchover" = "menu";
  private timer = 0;
  private simTime = 0;
  private pendingMatchOver = false;
  private scoreT = 0;
  private scoreCT = 0;
  private lossStreakT = 0;
  private lossStreakCT = 0;
  private roundsPlayed = 0;
  private buyOpen = false;
  private banner = "";
  private bannerLeft = 0;
  private kills: KillLine[] = [];
  private hurts: HurtPip[] = [];
  private damageLog: DamageLine[] = [];
  private decals: Decal[] = [];
  private plantHeld = 0;
  private defuseHeld = 0;
  private lastBombBeep = 0;
  private fov = DEFAULT_FOV;
  private started = false;
  private viewWeaponId: WeaponId | null = null;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.applyResolution();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, innerWidth / innerHeight, 1, 9000);
    this.scene.background = new THREE.Color(0xb8c8d4);
    // Light haze only at long range so mid-field stays sharp.
    this.scene.fog = new THREE.Fog(0xb8c8d4, 2800, 7600);

    const hemi = new THREE.HemisphereLight(0xeef4ff, 0x7a6a4a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3de, 1.55);
    sun.position.set(600, 1400, 800);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 200;
    sun.shadow.camera.far = 4200;
    sun.shadow.camera.left = -2000;
    sun.shadow.camera.right = 2000;
    sun.shadow.camera.top = 2000;
    sun.shadow.camera.bottom = -2000;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 1.2;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.22));

    this.map = buildSandMap();
    this.solids = this.map.brushes.filter((b) => b.solid).map((b) => ({ aabb: b.aabb }));
    this.buildMapMeshes();

    this.bombMesh = new THREE.Mesh(
      new THREE.BoxGeometry(16, 10, 22),
      this.solidMat(0x222222, 0.55),
    );
    this.bombMesh.castShadow = true;
    this.bombMesh.receiveShadow = true;
    this.scene.add(this.bombMesh);

    this.camera.add(this.viewmodel);
    this.scene.add(this.camera);
    this.buildViewmodel("ak");

    this.hud = new Hud(hudRoot);
    this.hud.onStart((team) => this.startMatch(team));
    this.hud.onBuy((id) => this.buy(id));
    this.input.attach(canvas);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onBuyKey, true);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.loop = new FixedLoop(this.tick, this.draw, () => this.applyMouseLook());
    this.loop.start();
  }

  private applyResolution(): void {
    // Supersample on 1x displays so edges stay sharp.
    this.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1.5), 2));
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private onResize = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.applyResolution();
  };

  private solidMat(color: number, roughness = 0.84): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
  }

  private onBuyKey = (e: KeyboardEvent) => {
    if (!this.buyOpen || this.phase !== "freeze") return;
    const id = this.hud.tryBuyHotkey(e.code);
    if (id) {
      e.preventDefault();
      e.stopPropagation();
      this.buy(id);
    }
  };

  private buildMapMeshes(): void {
    const mats = new Map<number, THREE.MeshStandardMaterial>();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (const b of this.map.brushes) {
      if (!b.visible) continue;
      let mat = mats.get(b.color);
      if (!mat) {
        mat = this.solidMat(b.color, b.surface === "ground" ? 0.92 : 0.8);
        if (b.surface === "ground") {
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = 1;
          mat.polygonOffsetUnits = 1;
        }
        mats.set(b.color, mat);
      }
      const mesh = new THREE.Mesh(geo, mat);
      const a = b.aabb;
      mesh.position.set((a.min.x + a.max.x) / 2, (a.min.y + a.max.y) / 2, (a.min.z + a.max.z) / 2);
      mesh.scale.set(Math.max(0.01, a.max.x - a.min.x), Math.max(0.01, a.max.y - a.min.y), Math.max(0.01, a.max.z - a.min.z));
      mesh.receiveShadow = true;
      mesh.castShadow = b.surface !== "ground";
      this.scene.add(mesh);
    }
    // site markers (floor paint is already in the map brushes; this is a dark ground decal only)
    for (const site of this.map.sites) {
      const g = new THREE.PlaneGeometry(120, 120);
      const m = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({
          color: 0x222222,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set((site.aabb.min.x + site.aabb.max.x) / 2, 0.8, (site.aabb.min.z + site.aabb.max.z) / 2);
      m.renderOrder = 1;
      this.scene.add(m);
    }
    for (const place of siteSignPlacements(this.map.sites)) {
      this.addSiteLetter(place.letter, place.x, place.z);
    }
  }

  private addSiteLetter(letter: "A" | "B", x: number, z: number): void {
    // Kept as a single-sign builder; placements are created in buildMapMeshes.
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    for (const part of signParts(letter)) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(part.w, part.h, part.d),
        this.unlitMat(signColor(part.kind, letter)),
      );
      mesh.position.set(part.x, part.y, part.z);
      mesh.rotation.y = part.rotY;
      mesh.rotation.z = part.rotZ;
      group.add(mesh);
    }
    this.scene.add(group);
  }

  private unlitMat(color: number): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({ color });
    mat.toneMapped = false;
    return mat;
  }

  /** Keep the existing local +X offset (body x = 8); only the silhouette changes with the gun. */
  private buildViewmodel(id: WeaponId): void {
    this.viewmodel.clear();
    this.viewWeaponId = id;
    const mat = this.solidMat(0x2a2d2a, 0.45);
    const wood = this.solidMat(0x5a4030, 0.7);
    const def = weaponDef(id);
    if (def.className === "blade") {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 22), this.solidMat(0xc0c4c8, 0.35));
      blade.position.set(8, -6, -20);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 8), wood);
      handle.position.set(8, -8, -8);
      this.viewmodel.add(blade, handle);
      return;
    }
    if (def.className === "pistol") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 14), mat);
      body.position.set(8, -8, -18);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 10), mat);
      barrel.position.set(8, -6, -28);
      this.viewmodel.add(body, barrel);
      return;
    }
    if (def.className === "sniper") {
      const body = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 32), mat);
      body.position.set(8, -8, -24);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 28), mat);
      barrel.position.set(8, -6, -48);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 12), wood);
      stock.position.set(8, -9, -8);
      const scope = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 10), mat);
      scope.position.set(8, -3, -22);
      this.viewmodel.add(body, barrel, stock, scope);
      return;
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 28), mat);
    body.position.set(8, -8, -22);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 22), mat);
    barrel.position.set(8, -6, -42);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 10), wood);
    stock.position.set(8, -9, -8);
    this.viewmodel.add(body, barrel, stock);
  }

  private startMatch(localTeam: Team): void {
    this.audio.resume();
    this.scoreT = 0;
    this.scoreCT = 0;
    this.lossStreakT = 0;
    this.lossStreakCT = 0;
    this.roundsPlayed = 0;
    this.kills = [];
    this.damageLog = [];
    this.hurts = [];
    this.players = [];
    this.brains = [];
    this.started = true;
    this.pendingMatchOver = false;
    this.simTime = 0;
    this.hud.hideOverlay();
    clearNades(this.nades);

    const roster = matchRosterNames(localTeam, TEAM_SIZE);
    let nextId = 0;
    const make = (team: Team, kind: "human" | "bot", name: string, spawnIndex: number) => {
      const spawn = (team === "t" ? this.map.tSpawns : this.map.ctSpawns)[spawnIndex];
      const p = createPlayer(nextId++, name, kind, team, spawn);
      p.yaw = spawnYaw(team);
      this.players.push(p);
      this.ensureMesh(p);
      if (kind === "bot") {
        const pref: "A" | "B" = spawnIndex % 2 === 0 ? "A" : "B";
        this.brains.push(createBrain(p.id, pref));
      }
      return p;
    };

    const localIndex = 0;
    make(localTeam, "human", "You", localIndex);
    this.localId = 0;
    this.cameraTargetId = this.localId;
    const localNames = localTeam === "t" ? roster.t : roster.ct;
    for (let i = 1; i < TEAM_SIZE; i++) make(localTeam, "bot", localNames[i], i);
    const other = otherTeam(localTeam);
    const otherNames = other === "t" ? roster.t : roster.ct;
    for (let i = 0; i < TEAM_SIZE; i++) make(other, "bot", otherNames[i], i);

    this.beginRound(true);

    document.querySelector("canvas")?.requestPointerLock();
  }

  private ensureMesh(p: Player): void {
    if (this.playerMeshes.has(p.id)) return;
    const g = new THREE.Group();
    const color = teamColor(p.team);
    const body = new THREE.Mesh(new THREE.BoxGeometry(24, 40, 16), this.solidMat(color, 0.72));
    body.position.y = 36;
    body.name = "body";
    const head = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), this.solidMat(0xe0c8a0, 0.62));
    head.position.y = 66;
    head.name = "head";
    const legs = new THREE.Mesh(new THREE.BoxGeometry(22, 32, 14), this.solidMat(0x222222, 0.8));
    legs.position.y = 16;
    g.add(body, head, legs);
    g.traverse((obj) => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    this.scene.add(g);
    this.playerMeshes.set(p.id, g);
  }

  private beginRound(first: boolean): void {
    this.phase = "freeze";
    this.timer = ROUND.freezeTime;
    this.buyOpen = true;
    this.plantHeld = 0;
    this.defuseHeld = 0;
    this.pendingMatchOver = false;
    this.kills = [];
    this.cameraTargetId = this.localId;
    this.banner = first ? "准备阶段 — 购买菜单已打开" : "新回合 — 购买菜单已打开";
    this.bannerLeft = 3;
    clearNades(this.nades);

    if (this.roundsPlayed === ROUND.halftimeAfter) {
      this.halftime();
    }

    this.players.forEach((p) => {
      const teamIndex = this.players.filter((x) => x.team === p.team).indexOf(p);
      const spawn = (p.team === "t" ? this.map.tSpawns : this.map.ctSpawns)[teamIndex] ?? this.map.tSpawns[0];
      resetForRound(p, spawn, spawnYaw(p.team));
      if (first) p.money = STARTING_MONEY;
    });

    const terrorists = this.players.filter((p) => p.team === "t");
    const carrier = chooseBombCarrier(terrorists);
    this.bomb = carrier ? createBomb(carrier.id, carrier.body.position) : null;

    for (const b of this.brains) {
      b.mode = "patrol";
      b.path = [];
      b.pathIndex = 0;
      b.seenId = null;
    }
    void first;
  }

  private halftime(): void {
    for (const p of this.players) {
      p.team = otherTeam(p.team);
      p.money = STARTING_MONEY;
      p.inventory.primary = null;
      p.inventory.active = "secondary";
      p.armor = 0;
      p.helmet = false;
      p.kit = false;
      p.nades = { flash: 0, smoke: 0 };
    }
    for (const b of this.brains) {
      const p = this.players.find((x) => x.id === b.playerId);
      if (!p) continue;
      const teamIndex = this.players.filter((x) => x.team === p.team).indexOf(p);
      b.sitePref = teamIndex % 2 === 0 ? "A" : "B";
    }
    const tmp = this.scoreT;
    this.scoreT = this.scoreCT;
    this.scoreCT = tmp;
    this.lossStreakT = 0;
    this.lossStreakCT = 0;
    this.banner = "半场交换阵营";
    this.bannerLeft = 4;
  }

  private tick = (dt: number) => {
    this.simTime += dt;
    if (this.phase === "menu" || this.phase === "matchover") {
      this.input.endTick();
      this.hud.update(this.hudModel());
      return;
    }
    const local = this.local();
    this.bannerLeft = Math.max(0, this.bannerLeft - dt);
    if (this.bannerLeft <= 0 && this.phase !== "end") this.banner = "";

    if (this.input.buyPressed && this.phase === "freeze") {
      this.buyOpen = !this.buyOpen;
    }
    if (this.phase !== "freeze") this.buyOpen = false;

    this.timer -= dt;
    const phaseAction = this.stepPhase();
    if (phaseAction === "matchover") {
      this.input.endTick();
      this.hud.update(this.hudModel());
      return;
    }

    const frozen = this.phase === "freeze" || this.phase === "end";

    for (const p of this.players) {
      p.prevPosition = { ...p.body.position };
      if (p.alive) {
        const w = activeWeapon(p);
        stepWeapon(w, dt);
      }
    }
    stepFlashDecay(this.players, dt);

    if (local.alive) {
      const def = activeWeaponDef(local);
      const w = activeWeapon(local);
      const cmd = commandFromInput(this.input.snapshot(), {
        yaw: local.yaw,
        maxSpeed: def.canScope && w.scoped && def.scopedSpeed ? def.scopedSpeed : def.moveSpeed,
        frozen,
        buyOpen: this.buyOpen,
        automatic: def.automatic,
      });
      if (cmd.slot && (this.phase !== "freeze" || !this.buyOpen)) switchSlot(local, cmd.slot);
      if (cmd.reload) {
        if (tryReload(local)) this.audio.reload();
      }
      if (cmd.aimToggle) toggleScope(w);
      simulateMove(local.body, cmd.move, dt, this.solids);
      if (cmd.fire) this.tryShoot(local, this.rng);
      if (cmd.drop && this.bomb && this.bomb.carrierId === local.id) {
        dropBomb(this.bomb, local.body.position);
        this.plantHeld = 0;
      }
      if (!frozen && !this.buyOpen) {
        if (cmd.throwFlash && local.nades.flash > 0) {
          local.nades.flash -= 1;
          throwNade(this.nades, "flash", eyePosition(local), local.yaw, local.pitch, local.id);
        }
        if (cmd.throwSmoke && local.nades.smoke > 0) {
          local.nades.smoke -= 1;
          throwNade(this.nades, "smoke", eyePosition(local), local.yaw, local.pitch, local.id);
        }
      }
      this.audio.footsteps(horizontalSpeed(local.body), this.input.walking, dt, !local.body.onGround);
    } else {
      this.updateSpectateTarget();
    }

    if (!frozen) {
      for (const brain of this.brains) {
        const bot = this.players.find((p) => p.id === brain.playerId);
        if (!bot || !bot.alive) continue;
        const cmd = stepBot(brain, bot, this.worldView(bot), dt, this.rng);
        simulateMove(bot.body, cmd.move, dt, this.solids);
        if (cmd.reload) tryReload(bot);
        if (cmd.aimToggle) toggleScope(activeWeapon(bot));
        if (cmd.fire) this.tryShoot(bot, this.rng);
        bot.useIntent = cmd.use;
      }
    } else {
      this.botBuy();
    }

    if (!frozen) {
      const events = stepNades(this.nades, dt, this.solids);
      for (const ev of events) {
        if (ev.kind === "flash") applyFlashPop(ev.position, this.players, this.map);
      }
    }

    this.stepBomb(dt, frozen);
    this.stepDecals(dt);
    this.checkRoundOver();

    this.fov = lerp(this.fov, activeWeapon(local).scoped ? SCOPE_FOV : DEFAULT_FOV, 1 - Math.exp(-12 * dt));
    this.input.endTick();
    this.hud.update(this.hudModel());
  };

  private updateSpectateTarget(): void {
    const local = this.local();
    if (local.alive) {
      this.cameraTargetId = this.localId;
      return;
    }
    const current = this.players.find((p) => p.id === this.cameraTargetId);
    if (current && current.alive && current.id !== local.id) return;
    const mate = this.players.find((p) => p.team === local.team && p.alive && p.id !== local.id);
    this.cameraTargetId = mate ? mate.id : local.id;
  }

  private worldView(bot: Player) {
    const pos = this.bomb ? bombWorldPos(this.bomb, this.players) : { x: 0, y: 0, z: 0 };
    const planted = this.bomb?.state === "planted" || this.bomb?.state === "defusing";
    return {
      map: this.map,
      players: this.players,
      bombPos: pos,
      bombState: this.bomb?.state ?? "idle",
      bombCarrierId: this.bomb?.carrierId ?? null,
      canPlant: this.canPlant(bot),
      canDefuse: this.canDefuse(bot),
      frozen: this.phase !== "live",
      bombLoose: this.bomb?.state === "idle" || this.bomb?.state === "dropping",
      bombFuseLeft: planted && this.bomb ? this.bomb.fuseLeft : null,
      smokes: this.nades.smokes,
    };
  }

  private tryShoot(p: Player, rng: Rng): void {
    const w = activeWeapon(p);
    const def = weaponDef(w.id);
    if (!canFire(w)) return;
    consumeShot(w);
    if (def.className === "blade") this.audio.melee();
    else this.audio.gunshot(def.className === "sniper" ? "sniper" : def.className === "pistol" ? "pistol" : "rifle");

    if (w.id === "blade") {
      const origin = eyePosition(p);
      const dir = yawPitchToDir(p.yaw, p.pitch);
      const hit = traceShot(this.map, origin, dir, def.meleeRange ?? 64, this.players, p.id, def.rangeModifier);
      if (hit?.kind === "player") this.applyHit(p, hit.player, hit.group, def.damage * hit.damageScale, def.armorPen, def.id);
      return;
    }

    const spread = currentSpreadDeg(p);
    const sample = sampleShotDirection(p, spread, rng);
    const hit = traceShot(this.map, sample.origin, sample.dir, 4000, this.players, p.id, def.rangeModifier);
    if (!hit) return;
    if (hit.kind === "world") this.spawnDecal(hit.point, hit.normal);
    else this.applyHit(p, hit.player, hit.group, def.damage * hit.damageScale, def.armorPen, def.id);
  }

  private applyHit(attacker: Player, victim: Player, group: "head" | "chest" | "stomach" | "leg", dmg: number, pen: number, weaponId: WeaponId): void {
    if (attacker.team === victim.team) return;
    const res = damagePlayer(victim, dmg, group, pen, this.simTime);
    this.audio.hit(group === "head");
    if (attacker.id === this.localId && res.healthDamage > 0) {
      this.damageLog.push({
        amount: res.healthDamage,
        victim: victim.name,
        victimTeam: victim.team,
        group,
        remaining: res.remaining,
        killed: res.killed,
        at: this.simTime,
      });
      this.damageLog = this.damageLog.slice(-12);
    }
    if (victim.id === this.localId) {
      this.audio.hurt();
      const eye = eyePosition(victim);
      const dx = attacker.body.position.x - eye.x;
      const dz = attacker.body.position.z - eye.z;
      const absYaw = yawToOffset(dx, dz);
      this.hurts.push({ yaw: absYaw - victim.yaw, at: this.simTime });
    }
    if (res.killed) {
      attacker.kills += 1;
      addMoney(attacker, killReward(weaponDef(weaponId).className));
      if (this.bomb && this.bomb.carrierId === victim.id && this.bomb.state === "carried") {
        this.bomb.state = "idle";
        this.bomb.carrierId = null;
        this.bomb.position = { ...victim.body.position };
      }
      this.kills.push({
        attacker: attacker.name,
        attackerTeam: attacker.team,
        victim: victim.name,
        victimTeam: victim.team,
        weapon: WEAPONS[weaponId].name,
        headshot: group === "head",
        at: this.simTime,
      });
      this.kills = this.kills.slice(-8);
      if (victim.id === this.localId) this.updateSpectateTarget();
    }
  }

  private canPlant(p: Player): boolean {
    if (this.phase !== "live" || !this.bomb || p.team !== "t" || !p.alive) return false;
    if (this.bomb.carrierId !== p.id || (this.bomb.state !== "carried" && this.bomb.state !== "planting")) return false;
    return this.map.sites.some((s) => inSite(p.body.position, s.aabb));
  }

  private canDefuse(p: Player): boolean {
    if (this.phase !== "live" || !this.bomb || p.team !== "ct" || !p.alive) return false;
    if (this.bomb.state !== "planted" && this.bomb.state !== "defusing") return false;
    const pos = bombWorldPos(this.bomb, this.players);
    return Math.hypot(p.body.position.x - pos.x, p.body.position.z - pos.z) < 56;
  }

  private stepBomb(dt: number, frozen: boolean): void {
    if (!this.bomb) return;
    const bomb = this.bomb;

    if (bomb.state === "idle") {
      for (const p of this.players) {
        if (tryPickupBomb(bomb, p)) break;
      }
    }
    if (frozen) {
      settleDroppedBomb(bomb);
      return;
    }

    const local = this.local();
    const planter = this.players.find((p) => p.id === bomb.carrierId);
    const plantInput = (p: Player) =>
      p.id === local.id ? this.input.useDown : p.useIntent;

    if (this.canPlant(local) || (planter && this.canPlant(planter) && plantInput(planter!))) {
      const actor = this.canPlant(local) && this.input.useDown ? local : planter!;
      if (plantInput(actor) && horizontalSpeed(actor.body) < 40) {
        this.plantHeld += dt;
        bomb.state = "planting";
        if (Math.floor(this.plantHeld * 4) !== Math.floor((this.plantHeld - dt) * 4)) this.audio.plantBeep(false);
        if (this.plantHeld >= ROUND.plantTime) {
          const site = this.map.sites.find((s) => inSite(actor.body.position, s.aabb));
          bomb.state = "planted";
          bomb.site = site?.id ?? "A";
          bomb.position = { ...actor.body.position, y: 2 };
          bomb.carrierId = null;
          bomb.fuseLeft = ROUND.bombTime;
          this.plantHeld = 0;
          addMoney(actor, REWARDS.plant);
          this.banner = `炸弹已安放于 ${bomb.site} 点`;
          this.bannerLeft = 2.5;
        }
      } else {
        this.plantHeld = 0;
        if (bomb.state === "planting") bomb.state = "carried";
      }
    } else if (bomb.state === "planting") {
      this.plantHeld = 0;
      bomb.state = "carried";
    }

    if (bomb.state === "planted" || bomb.state === "defusing") {
      bomb.fuseLeft -= dt;
      const urgent = bomb.fuseLeft < 10;
      if (this.timer || true) {
        const interval = urgent ? 0.4 : 1;
        this.lastBombBeep += dt;
        if (this.lastBombBeep >= interval) {
          this.lastBombBeep = 0;
          this.audio.bombTick(urgent);
        }
      }
      const defuser = this.players.find((p) => this.canDefuse(p) && plantInput(p));
      if (defuser && horizontalSpeed(defuser.body) < 40) {
        bomb.state = "defusing";
        const need = defuser.kit ? ROUND.defuseTimeWithKit : ROUND.defuseTime;
        this.defuseHeld += dt;
        if (this.defuseHeld >= need) {
          bomb.state = "defused";
          addMoney(defuser, REWARDS.defuse);
          this.endRound("ct", "拆包成功");
        }
      } else {
        this.defuseHeld = 0;
        if (bomb.state === "defusing") bomb.state = "planted";
      }
      if (bomb.fuseLeft <= 0 && bomb.state !== "defused") {
        bomb.state = "exploded";
        this.audio.explode();
        for (const p of this.players) {
          if (!p.alive) continue;
          const d = Math.hypot(p.body.position.x - bomb.position.x, p.body.position.z - bomb.position.z);
          if (d < 700) {
            const falloff = 1 - d / 700;
            damagePlayer(p, 200 * falloff, "chest", 0.5, this.simTime);
          }
        }
        this.endRound("t", "炸弹爆炸");
      }
    }

    settleDroppedBomb(bomb);
  }

  private stepPhase(): "beginRound" | "matchover" | undefined {
    const next = advancePhase({
      phase: this.phase,
      timer: this.timer,
      buyOpen: this.buyOpen,
      pendingMatchOver: this.pendingMatchOver,
      roundTime: ROUND.roundTime,
      buyCloseWarn: ROUND.buyCloseWarn,
    });
    this.phase = next.phase;
    this.timer = next.timer;
    this.buyOpen = next.buyOpen;
    if (next.banner !== undefined) {
      this.banner = next.banner;
      this.bannerLeft = next.bannerLeft ?? this.bannerLeft;
    }
    if (next.action === "beginRound") this.beginRound(false);
    if (next.action === "matchover") {
      const w: Team = this.scoreT > this.scoreCT ? "t" : "ct";
      this.hud.showMatchOver(w, this.scoreT, this.scoreCT);
      document.exitPointerLock();
    }
    return next.action;
  }

  private checkRoundOver(): void {
    if (this.phase !== "live") return;
    const tAlive = this.players.some((p) => p.team === "t" && p.alive);
    const ctAlive = this.players.some((p) => p.team === "ct" && p.alive);
    const planted = this.bomb?.state === "planted" || this.bomb?.state === "defusing";
    if (!tAlive && !planted) {
      this.endRound("ct", "消灭全部 ATK");
      return;
    }
    if (!ctAlive) {
      this.endRound("t", "消灭全部 DEF");
      return;
    }
    if (this.timer <= 0 && !planted) {
      this.endRound("ct", "时间耗尽");
    }
  }

  private endRound(winner: Team, reason: string): void {
    if (this.phase !== "live") return;
    this.phase = "end";
    this.timer = ROUND.endDisplay;
    const winPay = roundPayout(1, 0);
    const lossPay = roundPayout(0, winner === "t" ? this.lossStreakCT : this.lossStreakT);
    this.banner = `${winner === "t" ? "ATK" : "DEF"} 获胜 — ${reason}  胜 +$${winPay} / 负 +$${lossPay}`;
    this.bannerLeft = ROUND.endDisplay;
    if (winner === "t") this.scoreT += 1;
    else this.scoreCT += 1;

    const tLoss = this.lossStreakT;
    const ctLoss = this.lossStreakCT;
    for (const p of this.players) {
      const won = p.team === winner;
      const streak = p.team === "t" ? tLoss : ctLoss;
      addMoney(p, roundPayout(won ? 1 : 0, streak));
    }
    if (winner === "t") {
      this.lossStreakT = 0;
      this.lossStreakCT += 1;
    } else {
      this.lossStreakCT = 0;
      this.lossStreakT += 1;
    }
    this.roundsPlayed += 1;
    this.pendingMatchOver = isMatchOver(this.scoreT, this.scoreCT, this.roundsPlayed, ROUND.winScore, ROUND.maxRounds);
  }

  private buy(id: string): void {
    if (this.phase !== "freeze") return;
    const p = this.local();
    const catalog: Record<string, { price: number; apply: () => void; allowed?: boolean }> = {
      ak: { price: PRICES.ak, apply: () => giveWeapon(p, "ak") },
      crx: { price: PRICES.crx, apply: () => giveWeapon(p, "crx") },
      px9: { price: PRICES.px9, apply: () => giveWeapon(p, "px9") },
      falcon: { price: PRICES.falcon, apply: () => giveWeapon(p, "falcon") },
      kevlar: { price: PRICES.kevlar, apply: () => { p.armor = 100; } },
      helmet: {
        price: helmetPrice(p.armor, p.helmet) ?? PRICES.helmet,
        apply: () => { p.armor = 100; p.helmet = true; },
        allowed: helmetPrice(p.armor, p.helmet) !== null,
      },
      kit: { price: PRICES.kit, apply: () => { p.kit = true; }, allowed: p.team === "ct" && !p.kit },
      flash: {
        price: PRICES.flash,
        apply: () => { p.nades.flash += 1; },
        allowed: p.nades.flash < NADES.maxFlash,
      },
      smoke: {
        price: PRICES.smoke,
        apply: () => { p.nades.smoke += 1; },
        allowed: p.nades.smoke < NADES.maxSmoke,
      },
    };
    const item = catalog[id];
    if (!item) return;
    if (item.allowed === false) return;
    const next = applyPurchase(p.money, item.price);
    if (next === null) return;
    p.money = next;
    item.apply();
    this.audio.buy();
  }

  private botBuy(): void {
    if (this.phase !== "freeze") return;
    for (const p of this.players) {
      if (p.kind !== "bot") continue;
      if (p.team === "ct" && !p.kit && applyPurchase(p.money, PRICES.kit) !== null && p.money >= PRICES.kit + 1000) {
        p.money = applyPurchase(p.money, PRICES.kit)!;
        p.kit = true;
      }
      const helm = helmetPrice(p.armor, p.helmet);
      if (helm !== null && p.money >= helm) {
        p.money = applyPurchase(p.money, helm)!;
        p.armor = 100;
        p.helmet = true;
      }
      if (!p.inventory.primary && p.money >= PRICES.ak) {
        p.money = applyPurchase(p.money, PRICES.ak)!;
        giveWeapon(p, "ak");
      } else if (!p.inventory.primary && p.money >= PRICES.crx) {
        p.money = applyPurchase(p.money, PRICES.crx)!;
        giveWeapon(p, "crx");
      }
    }
  }

  private spawnDecal(point: Vec3, normal: Vec3): void {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide }),
    );
    m.position.set(point.x + normal.x * 0.6, point.y + normal.y * 0.6, point.z + normal.z * 0.6);
    m.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    this.scene.add(m);
    this.decals.push({ mesh: m, life: 8 });
    if (this.decals.length > 80) {
      const old = this.decals.shift()!;
      this.scene.remove(old.mesh);
    }
  }

  private stepDecals(dt: number): void {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      this.decals[i].life -= dt;
      if (this.decals[i].life <= 0) {
        this.scene.remove(this.decals[i].mesh);
        this.decals.splice(i, 1);
      }
    }
  }

  private local(): Player {
    return this.players.find((p) => p.id === this.localId) ?? this.players[0] ?? placeholderPlayer();
  }

  private hudModel() {
    const local = this.local();
    return {
      local,
      spreadDeg: currentSpreadDeg(local),
      scoreT: this.scoreT,
      scoreCT: this.scoreCT,
      phase: this.phase,
      timer: this.timer,
      bombTimer: this.bomb && (this.bomb.state === "planted" || this.bomb.state === "defusing") ? this.bomb.fuseLeft : null,
      banner: this.banner,
      buyOpen: this.buyOpen,
      money: local.money,
      canBuy: this.phase === "freeze",
      kills: this.kills,
      hurts: this.hurts,
      damages: this.damageLog,
      action: this.actionPrompt(),
      scoped: activeWeapon(local).scoped,
      pointerLocked: this.input.pointerLocked,
      now: this.simTime,
      carryingBomb: !!(this.bomb && this.bomb.carrierId === local.id && (this.bomb.state === "carried" || this.bomb.state === "planting")),
      scoreboardOpen: this.input.scoreboard,
      started: this.started,
      roster: this.players.map((p) => ({
        name: p.name,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        money: p.money,
        alive: p.alive,
        local: p.id === this.localId,
      })),
    };
  }

  private actionPrompt(): { label: string; progress: number } | null {
    if (!this.started || !this.bomb) return null;
    const p = this.local();
    return useActionPrompt({
      canPlant: this.canPlant(p),
      canDefuse: this.canDefuse(p),
      plantHeld: this.plantHeld,
      defuseHeld: this.defuseHeld,
      plantTime: ROUND.plantTime,
      defuseTime: ROUND.defuseTime,
      defuseTimeWithKit: ROUND.defuseTimeWithKit,
      hasKit: p.kit,
    });
  }

  /** Apply pending mouse deltas every display frame, not only on 60 Hz ticks. */
  private applyMouseLook(): void {
    const { dx, dy } = this.input.consumeMouse();
    if (this.phase === "menu" || this.phase === "matchover") return;
    const local = this.local();
    if (!this.started || local.id < 0 || !this.input.pointerLocked || this.buyOpen) return;
    if (dx === 0 && dy === 0) return;
    // Mouse right should look right. Positive yaw looks left in this convention.
    const scale = MOUSE_SENSITIVITY * 0.022 * (Math.PI / 4);
    local.yaw -= dx * scale;
    local.pitch = clamp(local.pitch - dy * scale, -1.35, 1.35);
  }

  private syncNadeMeshes(): void {
    const liveThrown = new Set(this.nades.thrown.map((n) => n.id));
    for (const n of this.nades.thrown) {
      let mesh = this.nadeMeshes.get(n.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(3, 3, 10, 8),
          this.solidMat(n.kind === "flash" ? 0xd8d0a8 : 0x5a6a48, 0.55),
        );
        mesh.rotation.x = Math.PI / 2;
        this.scene.add(mesh);
        this.nadeMeshes.set(n.id, mesh);
      }
      mesh.position.set(n.position.x, n.position.y, n.position.z);
    }
    for (const [id, mesh] of this.nadeMeshes) {
      if (!liveThrown.has(id)) {
        this.scene.remove(mesh);
        this.nadeMeshes.delete(id);
      }
    }
    const liveSmoke = new Set(this.nades.smokes.map((s) => s.id));
    for (const s of this.nades.smokes) {
      let mesh = this.smokeMeshes.get(s.id);
      if (!mesh) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xc8c8c0,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          roughness: 1,
        });
        mesh = new THREE.Mesh(new THREE.SphereGeometry(s.radius, 16, 12), mat);
        this.scene.add(mesh);
        this.smokeMeshes.set(s.id, mesh);
      }
      const fade = Math.min(1, s.left / 2);
      mesh.position.set(s.position.x, s.position.y, s.position.z);
      (mesh as THREE.Mesh).scale.setScalar(0.85 + 0.15 * fade);
      const mat = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = 0.55 + 0.2 * fade;
    }
    for (const [id, mesh] of this.smokeMeshes) {
      if (!liveSmoke.has(id)) {
        this.scene.remove(mesh);
        this.smokeMeshes.delete(id);
      }
    }
  }

  private draw = (alpha: number) => {
    const local = this.local();
    const subject = this.players.find((p) => p.id === this.cameraTargetId) ?? local;
    if (this.started && local.id >= 0) {
      const followAlive = subject.alive && (!local.alive || subject.id === local.id);
      const camPlayer = followAlive ? subject : local;
      const pos = lerpVec(camPlayer.prevPosition, camPlayer.body.position, alpha);
      const eye = pos.y + (camPlayer.body.crouched ? 46 : 64);
      if (local.alive || (subject.alive && subject.id !== local.id)) {
        this.camera.position.set(pos.x, eye, pos.z);
        this.camera.rotation.order = "YXZ";
        const w = activeWeapon(camPlayer);
        this.camera.rotation.y = camPlayer.yaw + w.recoil.yaw * degToRad(1);
        this.camera.rotation.x = camPlayer.pitch + w.recoil.pitch * degToRad(1);
      } else {
        // Short death cam: pulled back from the corpse, mouse still looks around.
        const dir = yawPitchToDir(local.yaw, local.pitch);
        this.camera.position.set(pos.x - dir.x * 48, eye + 18, pos.z - dir.z * 48);
        this.camera.rotation.order = "YXZ";
        this.camera.rotation.y = local.yaw;
        this.camera.rotation.x = clamp(local.pitch - 0.15, -1.35, 1.35);
      }
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      const bob = local.alive && local.body.onGround ? Math.sin(this.clock.getElapsedTime() * (horizontalSpeed(local.body) > 80 ? 12 : 0)) * 0.4 : 0;
      this.viewmodel.position.set(0, bob * 0.15, 0);
      const vw = activeWeapon(local);
      if (this.viewWeaponId !== vw.id) this.buildViewmodel(vw.id);
      this.viewmodel.rotation.x = vw.recoil.pitch * 0.02;
      this.viewmodel.visible = local.alive && !vw.scoped;
    }

    for (const p of this.players) {
      const mesh = this.playerMeshes.get(p.id);
      if (!mesh) continue;
      const pos = lerpVec(p.prevPosition, p.body.position, alpha);
      const scaleY = p.body.height / PLAYER_HEIGHT;
      mesh.scale.y = scaleY;
      const body = mesh.getObjectByName("body") as THREE.Mesh | undefined;
      if (body) (body.material as THREE.MeshStandardMaterial).color.setHex(teamColor(p.team));

      const hideFirstPerson = p.alive && p.id === this.cameraTargetId;
      if (hideFirstPerson) {
        mesh.visible = false;
        continue;
      }
      if (p.alive) {
        mesh.visible = true;
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.rotation.set(0, p.yaw, 0);
        continue;
      }
      // Dead: fall over, then sink out of the field. Timeline is 0.35 / 1.15 / 2.6 on simTime.
      const age = p.diedAt > 0 ? this.simTime - p.diedAt : 99;
      if (age > 2.6) {
        mesh.visible = false;
        continue;
      }
      const fall = Math.min(1, age / 0.35);
      const sink = age > 1.15 ? Math.min(1, (age - 1.15) / 1.2) : 0;
      mesh.visible = true;
      mesh.position.set(pos.x, pos.y - sink * 80, pos.z);
      mesh.rotation.set(0, p.yaw, (Math.PI / 2) * fall);
    }

    if (this.bomb) {
      const hide = this.bomb.state === "carried" && this.bomb.carrierId === this.cameraTargetId;
      const wp = bombWorldPos(this.bomb, this.players);
      this.bombMesh.position.set(wp.x, wp.y, wp.z);
      this.bombMesh.visible = this.started && this.bomb.state !== "exploded" && this.bomb.state !== "defused" && !hide;
    } else {
      this.bombMesh.visible = false;
    }

    this.syncNadeMeshes();
    this.renderer.render(this.scene, this.camera);
  };
}

function inSite(pos: Vec3, aabb: { min: Vec3; max: Vec3 }): boolean {
  return pos.x >= aabb.min.x && pos.x <= aabb.max.x && pos.z >= aabb.min.z && pos.z <= aabb.max.z;
}

function placeholderPlayer(): Player {
  return createPlayer(-1, "", "human", "t", { x: 0, y: 0, z: 0 });
}
