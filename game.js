// ─────────────────────────────────────────────
//  ENDLESS NINJA RUN — game.js (Enhanced)
// ─────────────────────────────────────────────

// ── Canvas Setup ──────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 360;

// ── Constants ─────────────────────────────────
const GROUND_Y = canvas.height - 60;
const PLAYER_X = 110;
const PLAYER_W = 28;
const PLAYER_H = 36;
const GRAVITY = 0.55;
const JUMP_FORCE = -13.5;
const BASE_SPEED = 5;
const SPEED_CAP = 11;
const SPEED_RAMP = 0.0008;

const GROUND_H = canvas.height - GROUND_Y;
const SAFE_SPAWN_X = canvas.width + 80;
const MIN_OBSTACLE_GAP = 220;
const COIN_RADIUS = 8;
const COIN_FLOAT_AMP = 22;
const COIN_FLOAT_MAX = GROUND_Y - PLAYER_H - 10;

const THEME_DURATION = 20 * 60; // frames (~20s at 60fps)

// ── Themes ────────────────────────────────────
const THEMES = [
  {
    name: "NIGHT CITY",
    skyTop: "#04040e",
    skyBot: "#0d0d2a",
    fogColor: "rgba(30,20,60,0.18)",
    groundCol: "#12122a",
    groundEdge: "#50c8ff",
    moonColor: "#c8d8ff",
    treeFill: "#080818",
    treeEdge: "rgba(80,200,255,0.3)",
    gridColor: "rgba(80,200,255,0.04)",
    starAlpha: 0.7,
    mountainFill: "#0a0a20",
  },
  {
    name: "FOREST",
    skyTop: "#0a1a0a",
    skyBot: "#1a3020",
    fogColor: "rgba(20,60,30,0.2)",
    groundCol: "#0f2010",
    groundEdge: "#4aff7a",
    moonColor: "#ffffc0",
    treeFill: "#061508",
    treeEdge: "rgba(74,255,122,0.4)",
    gridColor: "rgba(74,255,122,0.03)",
    starAlpha: 0.4,
    mountainFill: "#0a1a0a",
  },
  {
    name: "DESERT",
    skyTop: "#1a0a00",
    skyBot: "#2e1a08",
    fogColor: "rgba(80,40,10,0.18)",
    groundCol: "#2a1505",
    groundEdge: "#ff9933",
    moonColor: "#ffd080",
    treeFill: "#1a0800",
    treeEdge: "rgba(255,153,51,0.4)",
    gridColor: "rgba(255,153,51,0.04)",
    starAlpha: 0.5,
    mountainFill: "#200e03",
  },
];

let currentThemeIdx = 0;
let nextThemeIdx = 1;
let themeProgress = 0; // 0..1 blend
let themeTimer = 0;

function getTheme() {
  // Blend between currentTheme and nextTheme during transition
  return THEMES[currentThemeIdx];
}

// ── Palette (dynamic — updated by theme) ──────
const PAL = {
  sky: "#0d0d1a",
  skyLine1: "#1a1a2e",
  skyLine2: "#16213e",
  ground: "#1e1e2e",
  groundEdge: "#50c8ff",
  player: "#50c8ff",
  playerShade: "#1a8ab5",
  spike: "#ff4f6d",
  spikeShade: "#b8002a",
  coin: "#ffd166",
  coinShine: "#fff0a0",
  hud: "#e0e0ff",
  hudDim: "#6060a0",
  over: "#ff4f6d",
  overSub: "#c0c0e0",
  star: "rgba(200,210,255,0.55)",
};

// ── Stars ─────────────────────────────────────
const STARS = Array.from({ length: 90 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * (GROUND_Y - 40),
  r: Math.random() * 1.3 + 0.3,
  flicker: Math.random(),
  layer: Math.random() < 0.5 ? 0 : 1, // 0=far, 1=near (for parallax)
}));

// ── Parallax Layers ───────────────────────────
// Mountains: very slow (0.1x), Trees: slower (0.3x), Clouds: medium (0.15x)
let mountScroll = 0;
let treeScroll = 0;
let cloudScroll = 0;

// Pre-generate mountain & tree geometry (static world positions)
const MOUNTAINS = Array.from({ length: 14 }, (_, i) => ({
  x: i * 130 + Math.random() * 60,
  w: 160 + Math.random() * 120,
  h: 50 + Math.random() * 60,
}));

const TREES = Array.from({ length: 28 }, (_, i) => ({
  x: i * 70 + Math.random() * 40,
  h: 50 + Math.random() * 40,
  w: 18 + Math.random() * 14,
  type: Math.random() < 0.6 ? "pine" : "cactus",
}));

const CLOUDS = Array.from({ length: 8 }, (_, i) => ({
  x: i * 120 + Math.random() * 60,
  y: 20 + Math.random() * 50,
  w: 80 + Math.random() * 60,
  h: 20 + Math.random() * 14,
}));

// ── Game State ────────────────────────────────
let state; // 'start' | 'running' | 'over'
let player;
let obstacles;
let coins;
let score;
let coinCount;
let frameCount;
let speed;
let groundSegments;
let lastSpawnFrame;
let worldX;

// ── Input ─────────────────────────────────────
const keys = { space: false };
let jumpPressed = false;

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!keys.space) jumpPressed = true;
    keys.space = true;
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") keys.space = false;
});

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    jumpPressed = true;
  },
  { passive: false },
);

// ── Screen Management ─────────────────────────
function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function showLeaderboard() {
  renderLeaderboard();
  document.getElementById("leaderboard-modal").classList.add("active");
}

function hideLeaderboard() {
  document.getElementById("leaderboard-modal").classList.remove("active");
}

// ── Leaderboard (localStorage) ────────────────
function getLeaderboard() {
  return fetch("get_leaderboard.php")
    .then((res) => res.json())
    .catch(() => []);
}

function saveToLeaderboard(name, sc, coins) {
  fetch("save_score.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `player_name=${name}&high_score=${sc}&coins_collected=${coins}`,
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("Saved:", data);
    })
    .catch((err) => {
      console.error("Save failed:", err);
    });
}

function renderLeaderboard() {
  getLeaderboard().then((lb) => {
    const tbody = document.getElementById("lb-body");

    if (!lb.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="lb-empty">NO SCORES YET</td></tr>`;
      return;
    }

    const medals = ["rank-1", "rank-2", "rank-3", "", ""];

    tbody.innerHTML = lb
      .slice(0, 5)
      .map(
        (entry, i) =>
          `<tr class="${medals[i] || ""}">
          <td>${["◈", "○", "△", "4", "5"][i]}</td>
          <td>${entry.player_name}</td>
          <td>${String(entry.high_score).padStart(6, "0")}</td>
          <td>${entry.coins_collected}</td>
        </tr>`,
      )
      .join("");
  });
}

function calculateRank(name, score) {
  const lb = getLeaderboard();

  // include current run
  const temp = [...lb, { name, score }];

  temp.sort((a, b) => b.score - a.score);

  for (let i = 0; i < temp.length; i++) {
    if (temp[i].name === name && temp[i].score === score) {
      return i + 1;
    }
  }

  return temp.length;
}

// ── UI Event Bindings ─────────────────────────
document.getElementById("btn-play").addEventListener("click", () => {
  showScreen("game-screen");
  initGame();
  startLoop();
});

document
  .getElementById("btn-leaderboard-start")
  .addEventListener("click", showLeaderboard);
document
  .getElementById("btn-close-lb")
  .addEventListener("click", hideLeaderboard);

document.getElementById("btn-submit").addEventListener("click", () => {
  const name = document.getElementById("player-name").value.trim() || "NINJA";
  const cleanName = name.toUpperCase().slice(0, 12);

  saveToLeaderboard(cleanName, score, coinCount);

  fetch(`get_rank.php?player_name=${cleanName}`)
    .then((res) => res.json())
    .then((data) => {
      const rank = data.rank ?? "-";
      document.getElementById("go-rank").textContent = "#" + rank;
    });

  document.getElementById("btn-submit").textContent = "✓ SAVED";
  document.getElementById("btn-submit").disabled = true;
});

document.getElementById("btn-play-again").addEventListener("click", () => {
  showScreen("game-screen");
  initGame();
});

document
  .getElementById("btn-leaderboard-go")
  .addEventListener("click", showLeaderboard);

// ── Init / Reset ──────────────────────────────
function initGame() {
  state = "running";

  player = {
    x: PLAYER_X,
    y: GROUND_Y - PLAYER_H,
    vy: 0,
    onGround: true,
    legFrame: 0,
    frame: 0, // animation frame
  };

  obstacles = [];
  coins = [];
  score = 0;
  coinCount = 0;
  frameCount = 0;
  speed = BASE_SPEED;
  worldX = 0;
  lastSpawnFrame = -130; // triggers an immediate spawn on first update
  groundSegments = [];

  // Reset spawn manager
  spawnTimer = spawnInterval; // fire immediately on first frame
  spawnInterval = 5000;
  diffTimer = 0;
  lastPatternId = null;
  difficultyLevel = 0;

  currentThemeIdx = 0;
  nextThemeIdx = 1;
  themeProgress = 0;
  themeTimer = 0;

  // Reset submit button on game over screen
  const btnSub = document.getElementById("btn-submit");
  btnSub.textContent = "◈ SUBMIT SCORE";
  btnSub.disabled = false;
  document.getElementById("player-name").value = "";
}

// ── Physics ───────────────────────────────────
function updatePlayer() {
  if (jumpPressed && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }
  jumpPressed = false;

  player.vy += GRAVITY;
  player.y += player.vy;

  if (
    player.y + PLAYER_H >= GROUND_Y &&
    !isOverGap(player.x, player.x + PLAYER_W)
  ) {
    player.y = GROUND_Y - PLAYER_H;
    player.vy = 0;
    player.onGround = true;
  }

  if (player.y > canvas.height + 20) triggerGameOver();

  // Animation frame counter
  player.frame = player.frame + 1;
}

function isOverGap(x1, x2) {
  for (const g of groundSegments) {
    const gx1 = g.x - worldX;
    const gx2 = gx1 + g.w;
    if (x1 >= gx1 && x2 <= gx2) return true;
  }
  return false;
}

function overlapsGap(x1, x2) {
  for (const g of groundSegments) {
    const gx1 = g.x - worldX;
    const gx2 = gx1 + g.w;
    if (x1 < gx2 && x2 > gx1) return true;
  }
  return false;
}

// ══════════════════════════════════════════════
//  OBSTACLE SYSTEM v2 — Pattern-Based Spawning
// ══════════════════════════════════════════════

// ── Spawn Manager State ───────────────────────
let spawnTimer = 0; // ms elapsed since last spawn
let spawnInterval = 5000; // ms between pattern spawns (scales down over time)
let diffTimer = 0; // ms elapsed for difficulty scaling
let lastPatternId = null; // avoid repeating same pattern back-to-back
let difficultyLevel = 0; // 0=easy, 1=medium, 2=hard

// ── Obstacle Types ────────────────────────────
const obstacleTypes = {
  // 1. Ground spike(s) — jump to avoid
  groundSpike(spawnX, count = 1) {
    const w = count * 24;
    obstacles.push({ type: "spike", x: spawnX, w });
  },

  // 2. Flying obstacle (bird) — duck or time jump
  flyingObstacle(spawnX, yOffset = 0) {
    const w = 34;
    const h = 20;
    const y = GROUND_Y - 60 - yOffset;
    obstacles.push({ type: "bird", x: spawnX, w, h, y, baseY: y });
  },

  // 3. Falling obstacle — spawns high, drops after delay
  fallingObstacle(spawnX) {
    obstacles.push({
      type: "falling",
      x: spawnX,
      w: 26,
      h: 26,
      y: GROUND_Y - 200, // starts high
      vy: 0,
      falling: false,
      fallDelay: 80, // frames before it drops
      fallTimer: 0,
      landed: false,
    });
  },

  // 4. Gap in ground — jump across
  groundGap(spawnX, width = 120) {
    const worldGapX = spawnX + worldX;
    groundSegments.push({ x: worldGapX, w: width });
    obstacles.push({ type: "gap", x: spawnX, w: width });
  },

  // 5. Moving obstacle — oscillates vertically
  movingObstacle(spawnX) {
    const midY = GROUND_Y - 70;
    obstacles.push({
      type: "mover",
      x: spawnX,
      w: 28,
      h: 28,
      y: midY,
      midY,
      phase: 0,
      amplitude: 40,
      speed: 0.07,
    });
  },

  // Helper: spawn a coin at position
  spawnCoinAt(cx, cy) {
    // ensure no obstacle overlap
    for (const o of obstacles) {
      if (cx + COIN_RADIUS + 8 > o.x && cx - COIN_RADIUS - 8 < o.x + o.w)
        return;
    }
    coins.push({
      x: cx,
      y: cy,
      baseY: cy,
      collected: false,
      phase: Math.random() * Math.PI * 2,
      spin: 0,
    });
  },
};

// ── Pattern Definitions ───────────────────────
// Each pattern is an array of spawn actions with optional xOffset
const patterns = {
  // ── Easy ───────────────
  A: {
    name: "Single Spike",
    difficulty: 0,
    actions(sx) {
      obstacleTypes.groundSpike(sx, 1);
    },
  },

  B: {
    name: "Spike + Coin",
    difficulty: 0,
    actions(sx) {
      obstacleTypes.groundSpike(sx, 1);
      obstacleTypes.spawnCoinAt(sx + 12, GROUND_Y - PLAYER_H - 30);
    },
  },

  C: {
    name: "Flying Obstacle",
    difficulty: 0,
    actions(sx) {
      obstacleTypes.flyingObstacle(sx, 0);
    },
  },

  // ── Medium ─────────────
  D: {
    name: "Falling Trap",
    difficulty: 1,
    actions(sx) {
      obstacleTypes.fallingObstacle(sx);
      // coin to lure player near
      obstacleTypes.spawnCoinAt(sx + 13, GROUND_Y - PLAYER_H - 20);
    },
  },

  E: {
    name: "Gap + Spike",
    difficulty: 1,
    actions(sx) {
      obstacleTypes.groundGap(sx, 110);
      obstacleTypes.groundSpike(sx + 140, 1);
    },
  },

  F: {
    name: "Moving Obstacle + Coins",
    difficulty: 1,
    actions(sx) {
      obstacleTypes.movingObstacle(sx);
      obstacleTypes.spawnCoinAt(sx + 60, GROUND_Y - PLAYER_H - 25);
      obstacleTypes.spawnCoinAt(sx + 90, GROUND_Y - PLAYER_H - 25);
    },
  },

  // ── Hard ───────────────
  G: {
    name: "Double Spike",
    difficulty: 2,
    actions(sx) {
      obstacleTypes.groundSpike(sx, 2);
    },
  },

  H: {
    name: "Bird + Ground Spike",
    difficulty: 2,
    actions(sx) {
      obstacleTypes.groundSpike(sx, 1);
      obstacleTypes.flyingObstacle(sx + 130, 10);
    },
  },

  I: {
    name: "Gap + Falling",
    difficulty: 2,
    actions(sx) {
      obstacleTypes.groundGap(sx, 130);
      obstacleTypes.fallingObstacle(sx + 160);
    },
  },

  J: {
    name: "Mover + Spike Gauntlet",
    difficulty: 2,
    actions(sx) {
      obstacleTypes.movingObstacle(sx);
      obstacleTypes.groundSpike(sx + 120, 1);
      obstacleTypes.spawnCoinAt(sx + 60, GROUND_Y - PLAYER_H - 50);
    },
  },
};

// ── Spawn Manager ─────────────────────────────
const spawnManager = {
  // Pick an appropriate pattern for current difficulty, avoiding repeats
  selectPattern() {
    const available = Object.entries(patterns).filter(([id, p]) => {
      if (id === lastPatternId) return false;
      if (p.difficulty > difficultyLevel) return false;
      return true;
    });
    if (available.length === 0) return null;
    const [id, p] = available[Math.floor(Math.random() * available.length)];
    lastPatternId = id;
    return p;
  },

  // Called every frame with delta-ms
  update(dtMs) {
    // Difficulty scaling every 12 seconds
    diffTimer += dtMs;
    if (diffTimer >= 12000) {
      diffTimer = 0;
      if (difficultyLevel < 2) {
        difficultyLevel++;
      }
      // Reduce spawn interval: 5s → 4s → 3s
      spawnInterval = Math.max(3000, spawnInterval - 1000);
    }

    // Time-based spawn tick
    spawnTimer += dtMs;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      const pattern = this.selectPattern();
      if (pattern) {
        pattern.actions(SAFE_SPAWN_X);
      }
    }
  },
};

// ── Obstacle Update ───────────────────────────
function updateObstacles() {
  const dt = 1000 / 60; // ~16.67ms per frame

  for (const o of obstacles) {
    o.x -= speed;

    if (o.type === "bird") {
      // Gentle sine wave bob
      o.y = o.baseY + Math.sin(frameCount * 0.07) * 8;
    }

    if (o.type === "mover") {
      // Vertical oscillation
      o.phase += o.speed;
      o.y = o.midY + Math.sin(o.phase) * o.amplitude;
    }

    if (o.type === "falling") {
      if (!o.falling && !o.landed) {
        // Count down until drop — only start counting when visible
        if (o.x < canvas.width + 20) {
          o.fallTimer++;
          if (o.fallTimer >= o.fallDelay) o.falling = true;
        }
      }
      if (o.falling && !o.landed) {
        o.vy += GRAVITY * 1.1;
        o.y += o.vy;
        if (o.y + o.h >= GROUND_Y) {
          o.y = GROUND_Y - o.h;
          o.vy = 0;
          o.falling = false;
          o.landed = true;
        }
      }
    }
  }

  obstacles = obstacles.filter((o) => o.x + o.w > -100);
  groundSegments = groundSegments.filter((g) => g.x - worldX + g.w > -100);
}

// ── Legacy spawnObstacle shim (no longer called, kept for safety) ──
function spawnObstacle() {}

// ── Coin Spawning ─────────────────────────────
function spawnCoin() {
  const cx = SAFE_SPAWN_X + randInt(20, 60);
  const clearLeft = cx - COIN_RADIUS - 24;
  const clearRight = cx + COIN_RADIUS + 24;

  for (const o of obstacles) {
    if (clearRight > o.x && clearLeft < o.x + o.w) return;
  }
  if (overlapsGap(clearLeft, clearRight)) return;

  const baseY = randInt(
    GROUND_Y - PLAYER_H - COIN_FLOAT_AMP - 10,
    GROUND_Y - PLAYER_H - 4,
  );
  coins.push({
    x: cx,
    y: baseY,
    baseY,
    collected: false,
    phase: Math.random() * Math.PI * 2,
    spin: 0,
  });
}

function updateCoins() {
  for (const c of coins) {
    c.x -= speed;
    c.y = c.baseY + Math.sin(frameCount * 0.05 + c.phase) * 5;
    c.spin = (c.spin + 0.04) % (Math.PI * 2);
  }
  coins = coins.filter((c) => !c.collected && c.x + COIN_RADIUS > -20);
}

// ── Collision ─────────────────────────────────
function checkCollisions() {
  const px1 = player.x + 4;
  const px2 = player.x + PLAYER_W - 4;
  const py1 = player.y + 4;
  const py2 = player.y + PLAYER_H - 2;

  for (const o of obstacles) {
    if (o.type === "spike") {
      if (px2 > o.x + 4 && px1 < o.x + o.w - 4 && py2 > GROUND_Y - 20) {
        triggerGameOver();
        return;
      }
    }
    if (o.type === "bird") {
      const bx1 = o.x;
      const bx2 = o.x + o.w;
      const by1 = o.y - o.h / 2;
      const by2 = o.y + o.h / 2;

      if (px2 > bx1 && px1 < bx2 && py2 > by1 && py1 < by2) {
        triggerGameOver();
        return;
      }
    }
    if (o.type === "falling") {
      // only collide once it's visibly in range (not just a warning beam)
      if (o.y > GROUND_Y - 220) {
        if (
          px2 > o.x + 2 &&
          px1 < o.x + o.w - 2 &&
          py2 > o.y &&
          py1 < o.y + o.h
        ) {
          triggerGameOver();
          return;
        }
      }
    }
    if (o.type === "mover") {
      if (
        px2 > o.x + 2 &&
        px1 < o.x + o.w - 2 &&
        py2 > o.y &&
        py1 < o.y + o.h
      ) {
        triggerGameOver();
        return;
      }
    }
  }

  for (const c of coins) {
    const dx = player.x + PLAYER_W / 2 - c.x;
    const dy = player.y + PLAYER_H / 2 - c.y;
    if (Math.sqrt(dx * dx + dy * dy) < PLAYER_W / 2 + COIN_RADIUS) {
      c.collected = true;
      coinCount++;
    }
  }
}

// ── Game Over ─────────────────────────────────
function triggerGameOver() {
  state = "over";

  // Populate game-over screen
  document.getElementById("go-score").textContent = String(score).padStart(
    6,
    "0",
  );
  document.getElementById("go-coins").textContent = coinCount;

  document.getElementById("go-rank").textContent = "# -";

  // Delay screen transition slightly for death feel
  setTimeout(() => {
    showScreen("gameover-screen");
  }, 600);
}

// ── Score ─────────────────────────────────────
function updateScore() {
  score = Math.floor(frameCount / 6) + coinCount * 10;
}

// ── Theme Update ──────────────────────────────
function updateTheme() {
  themeTimer++;
  if (themeTimer >= THEME_DURATION) {
    themeTimer = 0;
    currentThemeIdx = nextThemeIdx;
    nextThemeIdx = (nextThemeIdx + 1) % THEMES.length;
  }
}

// ── Update ────────────────────────────────────
function update() {
  if (state !== "running") return;

  frameCount++;
  speed = Math.min(BASE_SPEED + frameCount * SPEED_RAMP, SPEED_CAP);
  worldX += speed;

  updatePlayer();
  updateObstacles();
  updateCoins();
  checkCollisions();
  updateTheme();
  updateScore();

  // Time-based pattern spawning (spawnManager handles interval + difficulty)
  const dtMs = 1000 / 60;
  spawnManager.update(dtMs);

  // Occasional lone coin (not tied to patterns)
  if (frameCount % 70 === 0) spawnCoin();

  // Parallax scroll offsets
  mountScroll = (mountScroll + speed * 0.08) % (MOUNTAINS.length * 130);
  treeScroll = (treeScroll + speed * 0.3) % (TREES.length * 70);
  cloudScroll = (cloudScroll + speed * 0.12) % (CLOUDS.length * 120);
}

// ── Render Helpers ────────────────────────────
function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawText(text, x, y, opts = {}) {
  ctx.font = opts.font || '16px "Share Tech Mono", monospace';
  ctx.fillStyle = opts.color || PAL.hud;
  ctx.textAlign = opts.align || "left";
  ctx.textBaseline = opts.baseline || "top";
  ctx.fillText(text, x, y);
}

// ── Render Background ─────────────────────────
function renderBackground() {
  const theme = THEMES[currentThemeIdx];

  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, theme.skyTop);
  grad.addColorStop(1, theme.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, GROUND_Y);

  // Stars
  for (const s of STARS) {
    const parallaxX =
      s.x - worldX * (s.layer === 0 ? 0.02 : 0.04) * (s.layer + 1);
    const sx = ((parallaxX % canvas.width) + canvas.width) % canvas.width;
    const alpha =
      theme.starAlpha *
      (0.3 + 0.7 * Math.sin(frameCount * 0.02 + s.flicker * 10));
    ctx.fillStyle = `rgba(200,210,255,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon / Sun
  renderMoon(theme);

  // Mountains (parallax 0.08x)
  renderMountains(theme);

  // Fog strip between mountains and trees
  const fog = ctx.createLinearGradient(0, GROUND_Y - 60, 0, GROUND_Y);
  fog.addColorStop(0, "rgba(0,0,0,0)");
  fog.addColorStop(1, theme.fogColor);
  ctx.fillStyle = fog;
  ctx.fillRect(0, GROUND_Y - 60, canvas.width, 60);

  // Trees (parallax 0.3x)
  renderTrees(theme);

  // Grid lines (keep original feel)
  ctx.strokeStyle = theme.gridColor;
  ctx.lineWidth = 1;
  const gridScroll = (worldX * 0.2) % 80;
  for (let gx = -gridScroll; gx < canvas.width; gx += 80) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, GROUND_Y);
    ctx.stroke();
  }

  // Theme name watermark (top-center, subtle)
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = '10px "Share Tech Mono", monospace';
  ctx.fillStyle = "rgba(200,220,255,0.15)";
  ctx.fillText(theme.name, canvas.width / 2, 6);
}

function renderMoon(theme) {
  // Moon position drifts slowly
  const mx = canvas.width - 100 - ((worldX * 0.03) % (canvas.width * 0.6));
  const my = 36;
  // Glow
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 30);
  glow.addColorStop(0, theme.moonColor + "aa");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, 30, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = theme.moonColor;
  ctx.beginPath();
  ctx.arc(mx, my, 13, 0, Math.PI * 2);
  ctx.fill();
  // Crater shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.arc(mx + 3, my + 2, 10, 0, Math.PI * 2);
  ctx.fill();
}

function renderMountains(theme) {
  ctx.fillStyle = theme.mountainFill;
  ctx.beginPath();
  let started = false;

  const totalW = MOUNTAINS.length * 130;
  const offset = mountScroll % totalW;

  for (let rep = -1; rep <= 1; rep++) {
    for (const m of MOUNTAINS) {
      const mx = m.x - offset + rep * totalW;
      if (mx + m.w < -20 || mx > canvas.width + 20) continue;
      if (!started) {
        ctx.moveTo(mx, GROUND_Y);
        started = true;
      }
      ctx.lineTo(mx, GROUND_Y);
      ctx.lineTo(mx + m.w * 0.5, GROUND_Y - m.h);
      ctx.lineTo(mx + m.w, GROUND_Y);
    }
  }
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.lineTo(0, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // Subtle edge highlight
  ctx.strokeStyle = theme.treeEdge.replace("0.4", "0.12");
  ctx.lineWidth = 1;
  ctx.beginPath();
  const offset2 = mountScroll % totalW;
  for (let rep = -1; rep <= 1; rep++) {
    for (const m of MOUNTAINS) {
      const mx = m.x - offset2 + rep * totalW;
      if (mx + m.w < -20 || mx > canvas.width + 20) continue;
      ctx.moveTo(mx, GROUND_Y);
      ctx.lineTo(mx + m.w * 0.5, GROUND_Y - m.h);
      ctx.lineTo(mx + m.w, GROUND_Y);
    }
  }
  ctx.stroke();
}

function renderTrees(theme) {
  const totalW = TREES.length * 70;
  const offset = treeScroll % totalW;

  for (let rep = -1; rep <= 1; rep++) {
    for (const t of TREES) {
      const tx = t.x - offset + rep * totalW;
      if (tx + t.w + 10 < 0 || tx > canvas.width + 10) continue;

      const isDessert = theme.name === "DESERT";
      ctx.fillStyle = theme.treeFill;
      ctx.strokeStyle = theme.treeEdge;
      ctx.lineWidth = 1;

      if (isDessert) {
        // Cactus
        drawCactus(tx, GROUND_Y, t.h, t.w, theme);
      } else {
        // Pine tree
        drawPine(tx, GROUND_Y, t.h, t.w, theme);
      }
    }
  }
}

function drawPine(x, baseY, h, w, theme) {
  ctx.fillStyle = theme.treeFill;
  ctx.strokeStyle = theme.treeEdge;
  ctx.lineWidth = 1;
  // Triangle
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + w, baseY);
  ctx.lineTo(x + w * 0.5, baseY - h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Trunk
  ctx.fillStyle = theme.treeFill;
  ctx.fillRect(x + w * 0.38, baseY, w * 0.24, 8);
}

function drawCactus(x, baseY, h, w, theme) {
  ctx.fillStyle = theme.treeFill;
  ctx.strokeStyle = theme.treeEdge;
  ctx.lineWidth = 1;
  // Main body
  ctx.beginPath();
  ctx.roundRect(x + w * 0.3, baseY - h, w * 0.4, h, 4);
  ctx.fill();
  ctx.stroke();
  // Left arm
  ctx.beginPath();
  ctx.roundRect(x, baseY - h * 0.65, w * 0.35, h * 0.25, 3);
  ctx.fill();
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.roundRect(x + w * 0.65, baseY - h * 0.55, w * 0.35, h * 0.22, 3);
  ctx.fill();
  ctx.stroke();
}

// ── Render Ground ─────────────────────────────
function renderGround() {
  const theme = THEMES[currentThemeIdx];
  const gapRects = groundSegments.map((g) => ({
    x1: g.x - worldX,
    x2: g.x - worldX + g.w,
  }));

  const spans = subtractGaps(0, canvas.width, gapRects);

  for (const [sx, ex] of spans) {
    if (ex <= sx) continue;
    // Main ground
    drawRect(sx, GROUND_Y, ex - sx, GROUND_H, theme.groundCol);
    // Top edge glow
    ctx.fillStyle = theme.groundEdge;
    ctx.fillRect(sx, GROUND_Y, ex - sx, 2);
    // Subtle scan line
    ctx.fillStyle = "rgba(80,200,255,0.04)";
    ctx.fillRect(sx, GROUND_Y + 2, ex - sx, 1);
    // Ground texture lines
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const texOff = (worldX * 0.5) % 40;
    for (let gx = sx - texOff; gx < ex; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(Math.max(gx, sx), GROUND_Y + 6);
      ctx.lineTo(Math.min(gx + 30, ex), GROUND_Y + 6);
      ctx.stroke();
    }
  }
}

function subtractGaps(start, end, gaps) {
  let spans = [[start, end]];
  for (const g of gaps) {
    const next = [];
    for (const [s, e] of spans) {
      if (g.x2 <= s || g.x1 >= e) {
        next.push([s, e]);
      } else {
        if (s < g.x1) next.push([s, g.x1]);
        if (e > g.x2) next.push([g.x2, e]);
      }
    }
    spans = next;
  }
  return spans;
}

// ── Render Player (Ninja) ─────────────────────
function renderPlayer() {
  const x = player.x;
  const y = player.y;
  const w = PLAYER_W;
  const h = PLAYER_H;

  // Running animation: leg offset cycles
  const running = player.onGround;
  const legCycle = Math.sin(player.frame * 0.35);
  const bodyBob = running ? Math.sin(player.frame * 0.35) * 1.2 : 0;
  const by = y + bodyBob;

  // Shadow on ground
  if (player.onGround) {
    ctx.fillStyle = "rgba(80,200,255,0.10)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, GROUND_Y + 2, w * 0.6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cape / scarf trailing
  ctx.fillStyle = PAL.playerShade;
  ctx.beginPath();
  const capeLen = running ? 10 + Math.abs(legCycle) * 6 : 8;
  ctx.moveTo(x + 2, by + 6);
  ctx.lineTo(x - capeLen, by + 14);
  ctx.lineTo(x - capeLen + 4, by + 20);
  ctx.lineTo(x + 4, by + 16);
  ctx.closePath();
  ctx.fill();

  // Body (torso)
  ctx.fillStyle = "#1a2a3a";
  ctx.fillRect(x + 2, by + 10, w - 4, h - 14);

  // Chest band
  ctx.fillStyle = PAL.playerShade;
  ctx.fillRect(x + 4, by + 13, w - 8, 3);

  // Head
  ctx.fillStyle = "#0f1f2f";
  ctx.fillRect(x + 2, by, w - 4, 14);

  // Headband
  ctx.fillStyle = PAL.player;
  ctx.fillRect(x + 2, by + 8, w - 4, 3);

  // Eyes (visor/slit)
  ctx.fillStyle = "#000";
  ctx.fillRect(x + 4, by + 2, w - 8, 6);
  // Eye glow
  ctx.fillStyle = "rgba(80,200,255,0.7)";
  ctx.fillRect(x + 5, by + 3, 5, 3);
  ctx.fillRect(x + w - 10, by + 3, 5, 3);

  // Legs
  const legH = 8;
  const legW = 7;
  const legY = by + h - legH;

  // Left leg
  ctx.fillStyle = "#0f1f2f";
  ctx.fillRect(x + 3, legY + (running ? legCycle * 4 : 0), legW, legH);
  // Left foot
  ctx.fillStyle = PAL.playerShade;
  ctx.fillRect(
    x + 1,
    legY + legH + (running ? legCycle * 4 : 0) - 2,
    legW + 3,
    4,
  );

  // Right leg
  ctx.fillStyle = "#0f1f2f";
  ctx.fillRect(
    x + w - legW - 3,
    legY + (running ? -legCycle * 4 : 0),
    legW,
    legH,
  );
  // Right foot
  ctx.fillStyle = PAL.playerShade;
  ctx.fillRect(
    x + w - legW - 5,
    legY + legH + (running ? -legCycle * 4 : 0) - 2,
    legW + 3,
    4,
  );

  // Arm / sword when jumping
  if (!player.onGround) {
    ctx.fillStyle = PAL.player;
    ctx.fillRect(x + w - 2, by + 6, 3, 16);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + w - 2, by + 6, 3, 4);
  } else {
    // Arm pumping
    ctx.fillStyle = "#1a2a3a";
    ctx.fillRect(x + w - 3, by + 10 - legCycle * 4, 5, 10);
  }
}

// ── Render Obstacles ──────────────────────────
function renderObstacles() {
  for (const o of obstacles) {
    if (o.type === "spike") {
      drawSpikes(o.x, o.w);
    }
    if (o.type === "gap") {
      // Void abyss
      const grd = ctx.createLinearGradient(o.x, GROUND_Y, o.x, canvas.height);
      grd.addColorStop(0, "rgba(255,30,60,0.22)");
      grd.addColorStop(0.5, "rgba(100,0,30,0.1)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(o.x, GROUND_Y, o.w, canvas.height - GROUND_Y);

      // Gap edge markers
      ctx.strokeStyle = "rgba(255,60,80,0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(o.x, GROUND_Y - 8);
      ctx.lineTo(o.x, GROUND_Y);
      ctx.moveTo(o.x + o.w, GROUND_Y - 8);
      ctx.lineTo(o.x + o.w, GROUND_Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (o.type === "bird") {
      const wing = Math.sin(frameCount * 0.3) * 6;

      // body
      ctx.fillStyle = "#e0e0ff";
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, o.y, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // wings
      ctx.strokeStyle = "#c0c0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.x + 6, o.y);
      ctx.lineTo(o.x + o.w / 2, o.y - wing);
      ctx.lineTo(o.x + o.w - 6, o.y);
      ctx.stroke();
    }

    // ── Falling obstacle ──────────────────────
    if (o.type === "falling") {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;

      // Warning beam from sky (only before it falls)
      if (!o.falling && !o.landed) {
        const warnAlpha = 0.12 + 0.1 * Math.sin(frameCount * 0.25);
        ctx.fillStyle = `rgba(255,80,40,${warnAlpha.toFixed(2)})`;
        ctx.fillRect(o.x + 2, 0, o.w - 4, o.y);
        // Warning label
        ctx.fillStyle = "rgba(255,100,50,0.7)";
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("▼", cx, Math.max(o.y - 14, 14));
      }

      // Boulder body
      ctx.fillStyle = o.landed ? "#8a3000" : "#ff5520";
      ctx.beginPath();
      ctx.roundRect(o.x, o.y, o.w, o.h, 5);
      ctx.fill();

      // Glow
      const glowColor = o.landed
        ? "rgba(180,80,0,0.3)"
        : "rgba(255,100,30,0.4)";
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4, 7);
      ctx.stroke();

      // Crack lines
      ctx.strokeStyle = "rgba(255,200,150,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 4);
      ctx.lineTo(cx + 4, cy + 6);
      ctx.moveTo(cx + 5, cy - 6);
      ctx.lineTo(cx - 3, cy + 2);
      ctx.stroke();
    }

    // ── Moving obstacle ───────────────────────
    if (o.type === "mover") {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;

      // Trail ghost
      ctx.fillStyle = "rgba(180,60,255,0.12)";
      ctx.beginPath();
      ctx.roundRect(o.x, o.y - 12, o.w, o.h + 24, 6);
      ctx.fill();

      // Body
      ctx.fillStyle = "#b03cff";
      ctx.beginPath();
      ctx.roundRect(o.x, o.y, o.w, o.h, 6);
      ctx.fill();

      // Glow ring
      ctx.strokeStyle = "rgba(200,100,255,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4, 8);
      ctx.stroke();

      // Direction arrows
      ctx.fillStyle = "rgba(255,200,255,0.7)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⬆⬇", cx, cy);
    }
  }
}

function drawSpikes(ox, ow) {
  const count = Math.round(ow / 24);
  const sw = ow / count;
  const spikeH = 22;
  const base = GROUND_Y;

  for (let i = 0; i < count; i++) {
    const sx = ox + i * sw;
    // Red glow shadow
    ctx.fillStyle = "rgba(255,40,90,0.2)";
    ctx.beginPath();
    ctx.ellipse(sx + sw / 2, base + 2, sw / 2 - 1, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spike base (platform piece)
    ctx.fillStyle = "#3a0010";
    ctx.fillRect(sx + 2, base - 4, sw - 4, 6);

    // Dark spike body
    ctx.fillStyle = PAL.spikeShade;
    ctx.beginPath();
    ctx.moveTo(sx + 3, base);
    ctx.lineTo(sx + sw - 3, base);
    ctx.lineTo(sx + sw / 2, base - spikeH + 2);
    ctx.closePath();
    ctx.fill();

    // Bright spike face
    ctx.fillStyle = PAL.spike;
    ctx.beginPath();
    ctx.moveTo(sx + 5, base);
    ctx.lineTo(sx + sw - 5, base);
    ctx.lineTo(sx + sw / 2, base - spikeH);
    ctx.closePath();
    ctx.fill();

    // Highlight edge
    ctx.strokeStyle = "rgba(255,150,170,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, base - spikeH);
    ctx.lineTo(sx + 5, base);
    ctx.stroke();

    // Small warning triangle
    ctx.fillStyle = "rgba(255,79,109,0.4)";
    ctx.font = "8px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("▲", sx + sw / 2, base - spikeH - 8);
  }
}

// ── Render Coins ──────────────────────────────
function renderCoins() {
  for (const c of coins) {
    if (c.collected) continue;

    const spinScale = Math.cos(c.spin); // -1..1 simulates rotation (width varies)
    const visR = COIN_RADIUS * Math.abs(spinScale);

    // Outer glow
    const grd = ctx.createRadialGradient(
      c.x,
      c.y,
      0,
      c.x,
      c.y,
      COIN_RADIUS + 10,
    );
    grd.addColorStop(0, "rgba(255,209,102,0.4)");
    grd.addColorStop(1, "rgba(255,209,102,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(c.x, c.y, COIN_RADIUS + 10, 0, Math.PI * 2);
    ctx.fill();

    // Coin body (ellipse to simulate spin)
    ctx.fillStyle = PAL.coin;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, Math.max(visR, 1), COIN_RADIUS, 0, 0, Math.PI * 2);
    ctx.fill();

    // Center stripe (when facing)
    if (Math.abs(spinScale) > 0.3) {
      ctx.fillStyle = "#e6a020";
      ctx.beginPath();
      ctx.ellipse(
        c.x,
        c.y,
        Math.max(visR * 0.5, 0.5),
        COIN_RADIUS * 0.65,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Shine highlight
      ctx.fillStyle = PAL.coinShine;
      ctx.beginPath();
      ctx.ellipse(
        c.x - visR * 0.3,
        c.y - COIN_RADIUS * 0.3,
        Math.max(visR * 0.25, 0.5),
        COIN_RADIUS * 0.3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // ¥ / ◈ symbol
      ctx.fillStyle = "rgba(255,220,100,0.6)";
      ctx.font = `bold ${Math.round(COIN_RADIUS * 0.9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (Math.abs(spinScale) > 0.6) ctx.fillText("◈", c.x, c.y + 1);
    }
  }
}

// ── Render HUD ────────────────────────────────
function renderHUD() {
  const theme = THEMES[currentThemeIdx];

  // Score panel (top-left)
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(10, 8, 130, 38);
  ctx.strokeStyle = "rgba(80,200,255,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 8, 130, 38);

  drawText("SCORE", 16, 10, {
    color: "rgba(80,200,255,0.5)",
    font: '10px "Share Tech Mono", monospace',
  });
  drawText(String(score).padStart(6, "0"), 16, 22, {
    color: "#e0e0ff",
    font: 'bold 20px "Share Tech Mono", monospace',
  });

  // Coin panel (top-right)
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(canvas.width - 140, 8, 130, 38);
  ctx.strokeStyle = "rgba(255,209,102,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(canvas.width - 140, 8, 130, 38);

  drawText("COINS", canvas.width - 134, 10, {
    color: "rgba(255,209,102,0.5)",
    font: '10px "Share Tech Mono", monospace',
  });
  drawText("◈ " + coinCount, canvas.width - 134, 22, {
    color: PAL.coin,
    font: 'bold 20px "Share Tech Mono", monospace',
  });

  // Theme name (top-center)
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = '10px "Share Tech Mono", monospace';
  ctx.fillStyle = "rgba(200,220,255,0.28)";
  ctx.fillText(theme.name, canvas.width / 2, 12);

  // Speed bar (tiny, bottom-right corner)
  const speedPct = (speed - BASE_SPEED) / (SPEED_CAP - BASE_SPEED);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(canvas.width - 50, canvas.height - 12, 40, 4);
  ctx.fillStyle = theme.groundEdge;
  ctx.fillRect(canvas.width - 50, canvas.height - 12, 40 * speedPct, 4);

  // Difficulty label
  const diffLabels = ["EASY", "MED", "HARD"];
  const diffColors = [
    "rgba(80,255,120,0.5)",
    "rgba(255,200,50,0.5)",
    "rgba(255,80,80,0.6)",
  ];
  ctx.font = '9px "Share Tech Mono", monospace';
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = diffColors[difficultyLevel] || diffColors[0];
  ctx.fillText(
    diffLabels[difficultyLevel] || "EASY",
    canvas.width - 54,
    canvas.height - 4,
  );
}

// ── Render Death Flash ────────────────────────
let deathFlash = 0;

// ── Render ────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  renderBackground();
  renderGround();
  renderObstacles();
  renderCoins();
  renderPlayer();
  renderHUD();

  // Death flash
  if (state === "over" && deathFlash > 0) {
    ctx.fillStyle = `rgba(255,50,80,${deathFlash.toFixed(2)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    deathFlash -= 0.06;
  }
}

// ── Game Loop ─────────────────────────────────
let loopStarted = false;

function loop() {
  update();
  render();

  // Trigger death flash on transition
  if (state === "over" && deathFlash === 0) {
    deathFlash = 0.6;
  }

  requestAnimationFrame(loop);
}

function startLoop() {
  if (!loopStarted) {
    loopStarted = true;
    loop();
  }
}

// ── Utilities ─────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Boot ──────────────────────────────────────
// Show start screen first; game loop starts on Play
state = "idle";
showScreen("start-screen");

// Run a decorative idle render (just background) while on start screen
(function idleRender() {
  if (state !== "running" && state !== "over") {
    // Minimal: draw bg onto canvas for start screen canvas element (hidden)
    requestAnimationFrame(idleRender);
  }
})();
