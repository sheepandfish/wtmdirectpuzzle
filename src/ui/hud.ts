import { NADES, PRICES, ROUND, WEAPONS, type WeaponId } from "../config";
import { helmetPrice } from "../core/economy";
import type { Player } from "../entities/player";
import { activeWeapon } from "../entities/player";
import { teamName, type Team } from "../entities/team";
import { flashOverlay } from "../entities/nades";

export interface KillLine {
  attacker: string;
  attackerTeam: Team;
  victim: string;
  victimTeam: Team;
  weapon: string;
  headshot: boolean;
  at: number;
}

export interface HurtPip {
  yaw: number;
  at: number;
}

export interface DamageLine {
  amount: number;
  victim: string;
  victimTeam: Team;
  group: "head" | "chest" | "stomach" | "leg";
  remaining: number;
  killed: boolean;
  at: number;
}

export interface ScoreRow {
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  money: number;
  alive: boolean;
  local: boolean;
}

export interface HudModel {
  local: Player;
  spreadDeg: number;
  scoreT: number;
  scoreCT: number;
  phase: "menu" | "freeze" | "live" | "end" | "matchover";
  timer: number;
  bombTimer: number | null;
  banner: string;
  buyOpen: boolean;
  money: number;
  canBuy: boolean;
  kills: KillLine[];
  hurts: HurtPip[];
  damages: DamageLine[];
  action: { label: string; progress: number } | null;
  scoped: boolean;
  pointerLocked: boolean;
  now: number;
  carryingBomb: boolean;
  scoreboardOpen: boolean;
  roster: ScoreRow[];
  started: boolean;
}

const BUY_ITEMS: Array<{ key: string; name: string; id: string; priceOf: (ctx: BuyCtx) => number | null }> = [
  { key: "1", name: "AK 步枪", id: "ak", priceOf: () => PRICES.ak },
  { key: "2", name: "CRX 卡宾", id: "crx", priceOf: () => PRICES.crx },
  { key: "3", name: "PX9 手枪", id: "px9", priceOf: () => PRICES.px9 },
  { key: "4", name: "FALCON 狙击", id: "falcon", priceOf: () => PRICES.falcon },
  { key: "5", name: "护甲", id: "kevlar", priceOf: () => PRICES.kevlar },
  { key: "6", name: "护甲+头盔", id: "helmet", priceOf: (ctx) => helmetPrice(ctx.armor, ctx.helmet) },
  { key: "7", name: "拆弹钳（仅 DEF）", id: "kit", priceOf: () => PRICES.kit },
  { key: "8", name: "闪光弹", id: "flash", priceOf: () => PRICES.flash },
  { key: "9", name: "烟雾弹", id: "smoke", priceOf: () => PRICES.smoke },
];

interface BuyCtx {
  money: number;
  team: Team;
  armor: number;
  helmet: boolean;
  kit: boolean;
  flash: number;
  smoke: number;
}

export class Hud {
  readonly root: HTMLElement;
  private buyHandler: ((id: string) => void) | null = null;
  private startHandler: ((team: Team) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = `
      <div class="scope" id="scope"><div class="dim"></div><div class="ring"></div></div>
      <div class="flash-overlay" id="flash-overlay"></div>
      <div class="crosshair" id="crosshair">
        <div class="hit-marker" id="hit-marker"></div>
        <div class="ch-dot"></div>
        <div class="ch-arm ch-h" id="ch-l"></div>
        <div class="ch-arm ch-h" id="ch-r"></div>
        <div class="ch-arm ch-v" id="ch-t"></div>
        <div class="ch-arm ch-v" id="ch-b"></div>
      </div>
      <div class="top-bar">
        <div class="score t" id="score-t">0</div>
        <div class="clock">
          <div class="time" id="clock">1:55</div>
          <div class="phase" id="phase">SAND</div>
        </div>
        <div class="score ct" id="score-ct">0</div>
      </div>
      <div class="banner" id="banner"></div>
      <div class="killfeed" id="killfeed"></div>
      <div class="damage-log" id="damage-log"></div>
      <div id="hurts"></div>
      <div class="lock-hint" id="lock-hint">点击继续</div>
      <div class="carry-hint" id="carry-hint">持有炸弹 · 按 G 丢弃</div>
      <div class="progress" id="action" style="display:none">
        <div id="action-label"></div>
        <div class="bar"><div class="fill" id="action-fill"></div></div>
      </div>
      <div class="hud-bottom">
        <div>
          <div class="stat hp"><div class="label">HP</div><div class="value" id="hp">100</div></div>
          <div class="stat armor" style="margin-top:8px"><div class="label">Armor</div><div class="value" id="armor">0</div></div>
        </div>
        <div class="stat ammo" style="margin:0 auto 8px"><div class="label" id="gun-name">PX9</div>
          <div class="value"><span id="mag">12</span><span class="ammo-clip" id="reserve">/ 24</span></div>
          <div class="nade-counts" id="nade-counts"></div>
        </div>
        <div class="stat money"><div class="label">Money</div><div class="value" id="money">$800</div></div>
      </div>
      <div class="scoreboard" id="scoreboard" style="display:none"></div>
      <div class="buy-menu" id="buy" style="display:none"></div>
      <div class="overlay" id="overlay"></div>
    `;
    this.renderBuy();
  }

  onBuy(fn: (id: string) => void): void {
    this.buyHandler = fn;
  }

  onStart(fn: (team: Team) => void): void {
    this.startHandler = fn;
    this.showMenu();
  }

  showMenu(): void {
    const el = this.el("overlay");
    el.style.display = "flex";
    el.innerHTML = `
      <h1>SAND</h1>
      <p>仿 CS 手感的第一人称战术射击原型。急停更准，移动散布更大，爆头四倍伤害。先到 ${ROUND.winScore} 分获胜，12 回合后交换阵营。</p>
      <div class="row">
        <button class="t" data-team="t">加入 ATK</button>
        <button class="ct" data-team="ct">加入 DEF</button>
      </div>
      <p>WASD 移动 · 鼠标视角 · Ctrl 蹲 · Shift 静步 · 空格跳 · 左键开火 · 右键开镜<br/>R 换弹 · E 下包/拆包 · G 丢包 · F 闪光 · C 烟雾 · B 购买 · 1/2/3 切枪 · Tab 计分板</p>
    `;
    el.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const team = (btn as HTMLButtonElement).dataset.team as Team;
        this.startHandler?.(team);
      });
    });
  }

  hideOverlay(): void {
    this.el("overlay").style.display = "none";
  }

  showMatchOver(winner: Team, scoreT: number, scoreCT: number): void {
    const el = this.el("overlay");
    el.style.display = "flex";
    el.innerHTML = `
      <h1>${teamName(winner)} 获胜</h1>
      <p>ATK ${scoreT} : ${scoreCT} DEF</p>
      <div class="row">
        <button class="t" data-team="t">再打一局 — ATK</button>
        <button class="ct" data-team="ct">再打一局 — DEF</button>
      </div>
    `;
    el.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const team = (btn as HTMLButtonElement).dataset.team as Team;
        this.startHandler?.(team);
      });
    });
  }

  update(m: HudModel): void {
    this.el("hp").textContent = `${Math.ceil(m.local.health)}`;
    this.el("armor").textContent = `${Math.ceil(m.local.armor)}`;
    const w = activeWeapon(m.local);
    const def = WEAPONS[w.id as WeaponId];
    this.el("gun-name").textContent = def.name;
    if (w.id === "blade") {
      this.el("mag").textContent = "—";
      this.el("reserve").textContent = "";
    } else {
      this.el("mag").textContent = `${w.mag}`;
      this.el("reserve").textContent = `/ ${w.reserve}`;
    }
    this.el("nade-counts").textContent = `闪光 ${m.local.nades.flash}  烟雾 ${m.local.nades.smoke}`;
    this.el("money").textContent = `$${m.money}`;
    this.el("score-t").textContent = `${m.scoreT}`;
    this.el("score-ct").textContent = `${m.scoreCT}`;

    const bomb = m.bombTimer !== null;
    const clock = bomb && m.bombTimer !== null ? m.bombTimer : m.timer;
    this.el("clock").textContent = formatTime(Math.max(0, clock));
    const phaseLabel =
      m.phase === "freeze" ? "准备 / 购买" : m.phase === "live" ? (bomb ? "炸弹已安放" : "交战") : m.phase === "end" ? "结算" : "SAND";
    this.el("phase").textContent = phaseLabel;
    this.el("banner").textContent = m.banner;
    this.el("scope").classList.toggle("on", m.scoped);
    this.el("crosshair").style.display = m.scoped || m.phase === "menu" || !m.local.alive ? "none" : "block";

    const gap = 6 + m.spreadDeg * 3.2;
    const len = 8;
    const l = this.el("ch-l");
    const r = this.el("ch-r");
    const tArm = this.el("ch-t");
    const b = this.el("ch-b");
    l.style.width = `${len}px`;
    r.style.width = `${len}px`;
    tArm.style.height = `${len}px`;
    b.style.height = `${len}px`;
    l.style.left = `${-gap - len}px`;
    l.style.top = `-1px`;
    r.style.left = `${gap}px`;
    r.style.top = `-1px`;
    tArm.style.left = `-1px`;
    tArm.style.top = `${-gap - len}px`;
    b.style.left = `-1px`;
    b.style.top = `${gap}px`;

    const dlog = this.el("damage-log");
    const nowDmg = m.now;
    const groupName = { head: "爆头", chest: "胸部", stomach: "腹部", leg: "腿部" };
    dlog.innerHTML = m.damages
      .filter((d) => nowDmg - d.at < 6)
      .slice(-10)
      .reverse()
      .map((d) => {
        const age = nowDmg - d.at;
        const o = age > 4.5 ? Math.max(0, 1 - (age - 4.5) / 1.5) : 1;
        const cls = `dmg-line${d.group === "head" ? " hs" : ""}${d.killed ? " kill" : ""}`;
        const tail = d.killed ? "击杀" : `剩余 ${Math.ceil(d.remaining)}`;
        return `<div class="${cls}" style="opacity:${o}"><span class="amt">${Math.round(d.amount)}</span> <span class="${d.victimTeam}">${esc(d.victim)}</span> ${groupName[d.group]} ${tail}</div>`;
      })
      .join("");
    this.el("hit-marker").classList.toggle("on", m.damages.some((d) => nowDmg - d.at < 0.2));

    const feed = this.el("killfeed");
    feed.innerHTML = m.kills
      .slice(-6)
      .reverse()
      .map(
        (k) =>
          `<div class="kill-line"><span class="${k.attackerTeam}">${esc(k.attacker)}</span> [${esc(k.weapon)}] <span class="${k.victimTeam}">${esc(k.victim)}</span>${k.headshot ? '<span class="hs">HS</span>' : ""}</div>`,
      )
      .join("");

    const hurts = this.el("hurts");
    const now = m.now;
    hurts.innerHTML = m.hurts
      .filter((h) => now - h.at < 1.2)
      .map((h) => {
        const age = now - h.at;
        const o = 1 - age / 1.2;
        const rot = h.yaw;
        return `<div class="hurt" style="transform: rotate(${rot}rad) translateY(-86px); opacity:${o}"></div>`;
      })
      .join("");

    const action = this.el("action");
    if (m.action) {
      action.style.display = "block";
      this.el("action-label").textContent = m.action.label;
      this.el("action-fill").style.width = `${Math.max(0, Math.min(1, m.action.progress)) * 100}%`;
    } else {
      action.style.display = "none";
    }

    const buy = this.el("buy");
    buy.style.display = m.buyOpen && m.canBuy ? "block" : "none";
    if (m.buyOpen) {
      this.refreshBuyState({
        money: m.money,
        team: m.local.team,
        armor: m.local.armor,
        helmet: m.local.helmet,
        kit: m.local.kit,
        flash: m.local.nades.flash,
        smoke: m.local.nades.smoke,
      });
    }

    this.el("lock-hint").style.display =
      m.started && !m.pointerLocked && m.phase !== "menu" && m.phase !== "matchover" ? "block" : "none";
    this.el("carry-hint").style.display = m.carryingBomb && m.local.alive ? "block" : "none";

    const fo = this.el("flash-overlay");
    const intensity = flashOverlay(m.local.flash);
    fo.style.opacity = String(intensity);

    const board = this.el("scoreboard");
    board.style.display = m.scoreboardOpen && m.phase !== "menu" ? "block" : "none";
    if (m.scoreboardOpen) {
      const rows = [...m.roster].sort((a, b) => (a.team === b.team ? b.kills - a.kills : a.team === "t" ? -1 : 1));
      board.innerHTML = `<h2>计分板</h2>
        <table><thead><tr><th></th><th>玩家</th><th>K</th><th>D</th><th>金钱</th></tr></thead><tbody>${rows
          .map((r) => {
            const mark = r.alive ? "" : " dead";
            const you = r.local ? " you" : "";
            return `<tr class="${r.team}${mark}${you}"><td class="team">${r.team === "t" ? "ATK" : "DEF"}</td><td>${esc(r.name)}</td><td>${r.kills}</td><td>${r.deaths}</td><td>$${r.money}</td></tr>`;
          })
          .join("")}</tbody></table>`;
    }
  }

  private renderBuy(): void {
    const buy = this.el("buy");
    buy.innerHTML = `<h2>购买菜单（冻结阶段）</h2><div class="buy-grid" id="buy-grid"></div><div class="hint">数字键 1-9 或点击购买 · 再按 B 关闭</div>`;
    const grid = this.el("buy-grid");
    for (const item of BUY_ITEMS) {
      const btn = document.createElement("button");
      btn.className = "buy-item";
      btn.dataset.id = item.id;
      const price = item.priceOf({
        money: 0,
        team: "t",
        armor: 0,
        helmet: false,
        kit: false,
        flash: 0,
        smoke: 0,
      });
      btn.dataset.price = String(price ?? 0);
      btn.innerHTML = `<span>${item.key}  ${item.name}</span><span class="buy-price">$${price ?? "—"}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (btn.classList.contains("off")) return;
        this.buyHandler?.(item.id);
      });
      grid.appendChild(btn);
    }
  }

  private refreshBuyState(ctx: BuyCtx): void {
    this.root.querySelectorAll<HTMLButtonElement>(".buy-item").forEach((btn) => {
      const id = btn.dataset.id ?? "";
      const item = BUY_ITEMS.find((x) => x.id === id);
      const price = item?.priceOf(ctx) ?? null;
      const priceEl = btn.querySelector(".buy-price");
      if (priceEl) priceEl.textContent = price === null ? "已拥有" : `$${price}`;
      btn.dataset.price = String(price ?? 0);
      let blocked = price === null || ctx.money < price;
      if (id === "kit" && (ctx.team !== "ct" || ctx.kit)) blocked = true;
      if (id === "flash" && ctx.flash >= NADES.maxFlash) blocked = true;
      if (id === "smoke" && ctx.smoke >= NADES.maxSmoke) blocked = true;
      btn.classList.toggle("off", blocked);
    });
  }

  tryBuyHotkey(code: string): string | null {
    const map: Record<string, string> = {
      Digit1: "ak",
      Digit2: "crx",
      Digit3: "px9",
      Digit4: "falcon",
      Digit5: "kevlar",
      Digit6: "helmet",
      Digit7: "kit",
      Digit8: "flash",
      Digit9: "smoke",
    };
    return map[code] ?? null;
  }

  private el(id: string): HTMLElement {
    return this.root.querySelector(`#${id}`) as HTMLElement;
  }
}

function formatTime(sec: number): string {
  const s = Math.ceil(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
