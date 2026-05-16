const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const staminaBar = document.querySelector("#staminaBar");
const goldText = document.querySelector("#gold");
const paceText = document.querySelector("#pace");
const message = document.querySelector("#message");
const startButton = document.querySelector("#start");

const COURSE_METERS = 5000;
const DISTANCE_MULTIPLIER = 3;
const DISTANCE_COUNTUP_MULTIPLIER = 7;

const WORLD_SCROLL_MULTIPLIER = 18;
const GROUND_SCROLL_SCALE = 0.9;
const RUNNER_SCROLL_SCALE = 0.72;
const LANES = [190, 280, 380];
const PLAYER_X = 150;
const PACE_BASE = {
  slow: { label: "Slow", speedRatio: 7.4 / 16.2, drainMultiplier: 0.55 },
  normal: { label: "Normal", speedRatio: 1, drainMultiplier: 1 },
  fast: { label: "Fast", speedRatio: 22.4 / 16.2, drainMultiplier: 1.1 },
};
const BASE_NORMAL_SPEED = 16.2;
const BASE_STAMINA_DRAIN = 6.6;
const STAGE_SPEED_MULTIPLIER = 1.1;

const SKY_THEME_STOPS = [
  { stage: 1, sky: ["#14b8f5", "#72dcff"] },
  { stage: 5, sky: ["#f5a55e", "#ffd18e"] },
  { stage: 10, sky: ["#111936", "#050817"] },
];

const SURFACE_THEMES = [
  {
    road: "#c77735",
    roadEdge: "#8e4f2b",
    texture: ["#a95f2e", "#d48a3e", "#8e4f2b", "#efad55"],
    enemy: { shirt: "#ff5964", short: "#353b9a", shoe: "#ff2f45" },
  },
  {
    road: "#b87942",
    roadEdge: "#74492f",
    texture: ["#7b4a2e", "#c88343", "#9c653b", "#e0a761"],
    enemy: { shirt: "#2fd27f", short: "#293276", shoe: "#ff6545" },
  },
  {
    road: "#b87942",
    roadEdge: "#74492f",
    texture: ["#7b4a2e", "#c88343", "#9c653b", "#e0a761"],
    enemy: { shirt: "#2fd27f", short: "#293276", shoe: "#ff6545" },
  },
  {
    road: "#5f6269",
    roadEdge: "#30323a",
    texture: ["#32363f", "#737983", "#4a4f5b", "#a5aab3"],
    enemy: { shirt: "#f7d64a", short: "#7b2468", shoe: "#f04d75" },
  },
  {
    road: "#4c8b45",
    roadEdge: "#256328",
    texture: ["#246b2e", "#65b84a", "#3e8e36", "#a9d84c"],
    enemy: { shirt: "#37c8ff", short: "#22375f", shoe: "#ff4b38" },
  },
  {
    road: "#d6b06c",
    roadEdge: "#9c7b42",
    texture: ["#9d7a43", "#e8c77d", "#b99556", "#f4dd9d"],
    enemy: { shirt: "#ff8a2a", short: "#31406e", shoe: "#f02040" },
  },
  {
    road: "#2f3541",
    roadEdge: "#171b23",
    texture: ["#1f2530", "#545d6b", "#333b48", "#808a99"],
    enemy: { shirt: "#b95cff", short: "#253b75", shoe: "#ff3333" },
  },
  {
    road: "#2f3541",
    roadEdge: "#171b23",
    texture: ["#1f2530", "#545d6b", "#333b48", "#808a99"],
    enemy: { shirt: "#ff77b7", short: "#254875", shoe: "#ff3333" },
  },
  {
    road: "#2f3541",
    roadEdge: "#171b23",
    texture: ["#1f2530", "#545d6b", "#333b48", "#808a99"],
    enemy: { shirt: "#b95cff", short: "#253b75", shoe: "#ff3333" },
  },
];

const state = {
  running: false,
  finished: false,
  stage: 1,
  totalGold: 0,
  lane: 1,
  stamina: 100,
  distance: 0,
  pace: "normal",
  obstacleTimer: 0,
  itemTimer: 0,
  hitCooldown: 0,
  hitFlash: 0,
  objects: [],
  dusts: [],
  worldOffset: 0,
  time: 0,
  lastFrame: performance.now(),
};

function resetGame({ advanceStage = false } = {}) {
  if (advanceStage) state.stage += 1;
  Object.assign(state, {
    running: true,
    finished: false,
    lane: 1,
    stamina: 100,
    distance: 0,
    pace: "normal",
    obstacleTimer: getObstacleDelay(),
    itemTimer: 2.2,
    hitCooldown: 0,
    hitFlash: 0,
    objects: [],
    dusts: [],
    worldOffset: 0,
    time: 0,
    lastFrame: performance.now(),
  });
  message.classList.add("hidden");
}

function handleStartButton() {
  resetGame({ advanceStage: state.finished });
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(from, to, amount) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  return rgbToHex(start.map((value, index) => Math.round(value + (end[index] - value) * amount)));
}

function getSkyTheme() {
  const stage = state.stage;
  const nextStopIndex = SKY_THEME_STOPS.findIndex((stop) => stage <= stop.stage);
  if (nextStopIndex === -1) return SKY_THEME_STOPS[SKY_THEME_STOPS.length - 1].sky;
  if (nextStopIndex <= 0) return SKY_THEME_STOPS[0].sky;
  const from = SKY_THEME_STOPS[nextStopIndex - 1];
  const to = SKY_THEME_STOPS[nextStopIndex];
  const amount = Math.min(1, Math.max(0, (stage - from.stage) / (to.stage - from.stage)));
  return [
    mixHex(from.sky[0], to.sky[0], amount),
    mixHex(from.sky[1], to.sky[1], amount),
  ];
}

function getStageSpeedFactor() {
  return STAGE_SPEED_MULTIPLIER ** (state.stage - 1);
}

function getStaminaStageFactor() {
  const speedFactor = getStageSpeedFactor();
  const stageIncrease = speedFactor - 1;
  if (state.pace === "slow") return 1 + stageIncrease * 0.28;
  if (state.pace === "normal") return 1 + stageIncrease * 0.42;
  return 1 + stageIncrease * 0.72;
}

function getStageTheme() {
  const surface = SURFACE_THEMES[(state.stage - 1) % SURFACE_THEMES.length];
  return {
    ...surface,
    sky: getSkyTheme(),
  };
}

function getPaceConfig(paceName = state.pace) {
  const base = PACE_BASE[paceName];
  const stageSpeed = BASE_NORMAL_SPEED * getStageSpeedFactor();
  return {
    label: base.label,
    speed: stageSpeed * base.speedRatio,
    drainMultiplier: base.drainMultiplier,
  };
}

function getObstacleDelay() {
  const stagePressure = Math.min(0.78, (state.stage - 1) * 0.09);
  const minDelay = Math.max(0.22, 0.85 - stagePressure);
  const randomDelay = Math.max(0.34, 1.25 - stagePressure * 1.35);
  return minDelay + Math.random() * randomDelay;
}

function moveLane(direction) {
  if (!state.running) return;
  state.lane = Math.max(0, Math.min(2, state.lane + direction));
}

function setPace(pace) {
  if (!state.running) return;
  if (pace === "fast") emitDust();
  state.pace = pace;
}

function increasePace() {
  if (state.pace === "slow") {
    setPace("normal");
  } else {
    setPace("fast");
  }
}

function decreasePace() {
  if (state.pace === "fast") {
    setPace("normal");
  } else {
    setPace("slow");
  }
}

function spawn(type) {
  state.objects.push({
    type,
    lane: Math.floor(Math.random() * 3),
    x: canvas.width + 50,
    bob: Math.random() * Math.PI * 2,
  });
}

function emitDust() {
  const footY = LANES[state.lane] + 4;
  for (let i = 0; i < 9; i++) {
    state.dusts.push({
      x: PLAYER_X - 8 + Math.random() * 20,
      y: footY + Math.random() * 8,
      vx: -70 - Math.random() * 80,
      vy: -8 - Math.random() * 28,
      life: 0.32 + Math.random() * 0.22,
      maxLife: 0.54,
      size: 3 + Math.random() * 5,
    });
  }
}

function update(dt) {
  if (!state.running) return;

  const pace = getPaceConfig();
  const normalPace = getPaceConfig("normal");
  const groundScrollSpeed = pace.speed * WORLD_SCROLL_MULTIPLIER * GROUND_SCROLL_SCALE;
  state.time += dt;
  state.distance += pace.speed * DISTANCE_COUNTUP_MULTIPLIER * dt;
  state.stamina -= BASE_STAMINA_DRAIN * getStaminaStageFactor() * pace.drainMultiplier * dt;
  state.hitCooldown = Math.max(0, state.hitCooldown - dt);
  state.hitFlash = Math.max(0, state.hitFlash - dt);
  state.worldOffset += pace.speed * WORLD_SCROLL_MULTIPLIER * dt;

  for (const dust of state.dusts) {
    dust.x += dust.vx * dt;
    dust.y += dust.vy * dt;
    dust.vy += 80 * dt;
    dust.life -= dt;
  }
  state.dusts = state.dusts.filter((dust) => dust.life > 0);
  state.obstacleTimer -= dt * (pace.speed / normalPace.speed);
  state.itemTimer -= dt;

  if (state.obstacleTimer <= 0) {
    spawn("runner");
    state.obstacleTimer = getObstacleDelay();
  }

  if (state.itemTimer <= 0) {
    spawn("water");
    state.itemTimer = 2.8 + Math.random() * 2.2;
  }

  for (const object of state.objects) {
    const objectScrollSpeed = object.type === "runner"
      ? groundScrollSpeed * RUNNER_SCROLL_SCALE
      : groundScrollSpeed;
    object.x -= objectScrollSpeed * dt;
    object.bob += dt * 8;

    const sameLane = object.lane === state.lane;
    const close = object.x > 128 && object.x < 200;
    if (sameLane && close) {
      if (object.type === "water") {
        state.stamina = Math.min(100, state.stamina + 50);
        object.collected = true;
      } else if (state.hitCooldown <= 0) {
        state.stamina -= 16;
        state.pace = "slow";
        state.hitCooldown = 1;
        state.hitFlash = 1;
      }
    }
  }

  state.objects = state.objects.filter((object) => object.x > -80 && !object.collected);

  if (state.stamina <= 0) endGame("スタミナ切れ！紙コップを取りながらペース配分しよう。", false);
  if (state.distance >= COURSE_METERS) {
    const timePrize = Math.max(0, 15000 - state.time * 120);
    const staminaRatio = Math.max(0, state.stamina) / 100;
    const staminaBonus = 0.5 + staminaRatio * 0.5;
    const prize = Math.max(0, Math.round(timePrize * staminaBonus));
    state.totalGold += prize;
    endGame(`タイム ${formatRaceTime(state.time)} / 獲得 ${prize.toLocaleString()}G`, true);
  }
}

function endGame(text, finished) {
  state.running = false;
  state.finished = finished;
  message.querySelector("h1").textContent = finished ? "FINISH!" : "GAME OVER";
  message.querySelector("p").textContent = text;
  startButton.textContent = finished ? "NEXT STAGE" : "RESTART";
  message.classList.remove("hidden");
}

function pixelRect(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function ditherDot(x, y, index, color, size = 2) {
  const jitterX = (index * 37) % 19;
  const jitterY = (index * 53) % 17;
  pixelRect(x + jitterX, y + jitterY, size, size, color);
}

function drawPixelRunner(x, y, laneScale, colors) {
  const s = Math.max(3, Math.round(4 * laneScale));
  const stride = Math.sin(state.time * 14) > 0 ? 1 : -1;
  const bob = Math.sin(state.time * 28) > 0 ? 1 : 0;
  const baseX = Math.round(x);
  const baseY = Math.round(y - bob * s * 0.35);
  const outline = colors.outline ?? "#20121f";
  const skinShadow = colors.skinShadow ?? "#d98245";
  const shirtShadow = colors.shirtShadow ?? "#c92d4e";
  const shoe = colors.shoe ?? "#f5df3a";
  const glasses = colors.glasses;

  // Shadow and speed streaks keep the small sprite grounded and readable.
  pixelRect(baseX + 3 * s, y + 1.5 * s, 16 * s, 1.5 * s, "#5b3427aa");
  pixelRect(baseX - 5 * s, y - 4 * s, 8 * s, s, "#e8b06a88");
  pixelRect(baseX - 9 * s, y - 2 * s, 5 * s, s, "#f4c78166");

  // Back arm.
  pixelRect(baseX + (5 - stride) * s, baseY - 12 * s, 4 * s, 3 * s, outline);
  pixelRect(baseX + (5 - stride) * s, baseY - 11 * s, 3 * s, 2 * s, colors.skin);

  // Legs.
  pixelRect(baseX + (5 + stride) * s, baseY - 3 * s, 5 * s, 4 * s, outline);
  pixelRect(baseX + (6 + stride) * s, baseY - 3 * s, 3 * s, 3 * s, colors.skin);
  pixelRect(baseX + (2 + stride) * s, baseY + s, 7 * s, 2 * s, outline);
  pixelRect(baseX + (1 + stride) * s, baseY + s, 5 * s, s, shoe);

  pixelRect(baseX + (11 - stride) * s, baseY - 3 * s, 5 * s, 4 * s, outline);
  pixelRect(baseX + (12 - stride) * s, baseY - 3 * s, 3 * s, 3 * s, colors.skin);
  pixelRect(baseX + (14 - stride) * s, baseY + s, 7 * s, 2 * s, outline);
  pixelRect(baseX + (15 - stride) * s, baseY + s, 5 * s, s, shoe);

  // Shorts and torso.
  pixelRect(baseX + 6 * s, baseY - 8 * s, 9 * s, 6 * s, outline);
  pixelRect(baseX + 7 * s, baseY - 7 * s, 7 * s, 4 * s, colors.short);
  pixelRect(baseX + 6 * s, baseY - 15 * s, 10 * s, 9 * s, outline);
  pixelRect(baseX + 7 * s, baseY - 14 * s, 8 * s, 7 * s, colors.shirt);
  pixelRect(baseX + 7 * s, baseY - 8 * s, 3 * s, s, shirtShadow);
  pixelRect(baseX + 13 * s, baseY - 13 * s, 2 * s, 3 * s, "#ffffff55");

  // Front arm.
  pixelRect(baseX + (14 + stride) * s, baseY - 13 * s, 6 * s, 4 * s, outline);
  pixelRect(baseX + (15 + stride) * s, baseY - 12 * s, 4 * s, 2 * s, colors.skin);
  pixelRect(baseX + (18 + stride) * s, baseY - 11 * s, 3 * s, 3 * s, outline);
  pixelRect(baseX + (18 + stride) * s, baseY - 11 * s, 2 * s, 2 * s, colors.skin);

  // Head and hair.
  pixelRect(baseX + 11 * s, baseY - 23 * s, 9 * s, 9 * s, outline);
  pixelRect(baseX + 12 * s, baseY - 22 * s, 7 * s, 7 * s, colors.skin);
  pixelRect(baseX + 10 * s, baseY - 24 * s, 8 * s, 4 * s, outline);
  pixelRect(baseX + 11 * s, baseY - 23 * s, 6 * s, 3 * s, colors.hair);
  pixelRect(baseX + 10 * s, baseY - 20 * s, 3 * s, 5 * s, colors.hair);
  pixelRect(baseX + 18 * s, baseY - 19 * s, 3 * s, 2 * s, skinShadow);
  if (glasses) {
    pixelRect(baseX + 14 * s, baseY - 20 * s, 5 * s, 2 * s, glasses);
    pixelRect(baseX + 18 * s, baseY - 19 * s, 4 * s, s, glasses);
  } else {
    pixelRect(baseX + 17 * s, baseY - 20 * s, s, s, "#101015");
  }
  pixelRect(baseX + 20 * s, baseY - 17 * s, 2 * s, s, outline);
}

function drawWater(x, y, scale) {
  const s = Math.max(3, Math.round(4 * scale));
  const baseX = Math.round(x);
  const baseY = Math.round(y);
  pixelRect(baseX - 2 * s, baseY - 13 * s, 11 * s, 15 * s, "#ffe87755");
  pixelRect(baseX, baseY - 12 * s, 7 * s, 13 * s, "#20121f");
  pixelRect(baseX + s, baseY - 11 * s, 5 * s, 11 * s, "#f8fbff");
  pixelRect(baseX + s, baseY - 12 * s, 5 * s, s, "#b85f21");
  pixelRect(baseX + 2 * s, baseY - 7 * s, 3 * s, 4 * s, "#37c8ff");
  pixelRect(baseX + 3 * s, baseY - 9 * s, s, 2 * s, "#8cecff");
  pixelRect(baseX + 2 * s, baseY - 2 * s, 3 * s, s, "#c9f4ff");
}

function wrap(value, length) {
  return ((value % length) + length) % length;
}

function drawCloud(x, y, scale) {
  const s = Math.max(3, Math.round(6 * scale));
  pixelRect(x + 2 * s, y + 6 * s, 17 * s, 3 * s, "#fff7d6");
  pixelRect(x + 5 * s, y + 2 * s, 7 * s, 7 * s, "#fff7d6");
  pixelRect(x + 11 * s, y + 3 * s, 5 * s, 6 * s, "#fff7d6");
  pixelRect(x, y + 7 * s, 21 * s, 2 * s, "#fff7d6");
  pixelRect(x + 3 * s, y + 8 * s, 14 * s, 2 * s, "#dff6ff");
  pixelRect(x + 7 * s, y + 3 * s, 2 * s, 2 * s, "#ffffff");
  pixelRect(x - 2 * s, y + 8 * s, s, s, "#fff7d6");
  pixelRect(x + 22 * s, y + 8 * s, s, s, "#fff7d6");
}

function drawTree(x, y, scale) {
  const s = Math.max(3, Math.round(5 * scale));
  pixelRect(x + 8 * s, y + 12 * s, 4 * s, 9 * s, "#4b2a1f");
  pixelRect(x + 9 * s, y + 12 * s, 2 * s, 9 * s, "#8a533b");
  pixelRect(x + 3 * s, y + 7 * s, 15 * s, 9 * s, "#083d26");
  pixelRect(x + s, y + 10 * s, 19 * s, 7 * s, "#0f6b35");
  pixelRect(x + 5 * s, y + 2 * s, 12 * s, 11 * s, "#0d7d3b");
  pixelRect(x + 8 * s, y, 7 * s, 8 * s, "#139a45");
  pixelRect(x + 4 * s, y + 8 * s, 4 * s, 4 * s, "#20b84f");
  pixelRect(x + 13 * s, y + 5 * s, 3 * s, 3 * s, "#54d642");
  pixelRect(x + 9 * s, y + 3 * s, 2 * s, 2 * s, "#a6e83f");
  pixelRect(x + 2 * s, y + 15 * s, 17 * s, 2 * s, "#052d1d");
}

function drawGrassTufts(baseY, height, scrollScale) {
  ctx.fillStyle = "#0b722f";
  ctx.fillRect(0, baseY, canvas.width, height);
  for (let i = 0; i < 92; i++) {
    const x = wrap(i * 23 - state.worldOffset * scrollScale, canvas.width + 32) - 16;
    const y = baseY + ((i * 11) % Math.max(1, height - 6));
    const color = i % 3 === 0 ? "#a6e83f" : i % 3 === 1 ? "#18b64b" : "#064d2c";
    pixelRect(x, y, 3, 10 + (i % 5), color);
    pixelRect(x + 3, y + 2, 3, 6 + (i % 4), color);
  }
  pixelRect(0, baseY, canvas.width, 5, "#9bea37");
  pixelRect(0, baseY + 5, canvas.width, 4, "#047a34");
}

function drawStones() {
  for (let i = 0; i < 46; i++) {
    const x = wrap(i * 57 - state.worldOffset * GROUND_SCROLL_SCALE, canvas.width + 90) - 45;
    const lane = i % LANES.length;
    const y = LANES[lane] + 8 + ((i * 17) % 54);
    const size = 2 + (i % 3);
    pixelRect(x, y + size, size * 5, size * 2, "#6d4433");
    pixelRect(x + size, y, size * 4, size * 2, i % 2 === 0 ? "#b7aa92" : "#8f8171");
    pixelRect(x + size * 2, y, size, size, "#f1d49b");
  }
}

function drawDirtTexture() {
  const texture = getStageTheme().texture;
  for (let i = 0; i < 170; i++) {
    const x = wrap(i * 41 - state.worldOffset * GROUND_SCROLL_SCALE, canvas.width + 48) - 24;
    const y = 188 + ((i * 31) % 300);
    const color = texture[i % texture.length];
    ditherDot(x, y, i, color, i % 5 === 0 ? 3 : 2);
  }
}

function drawFinishFlag() {
  const finishWorldX =
    PLAYER_X + COURSE_METERS * (WORLD_SCROLL_MULTIPLIER / DISTANCE_COUNTUP_MULTIPLIER) * GROUND_SCROLL_SCALE;
  const x = finishWorldX - state.worldOffset * GROUND_SCROLL_SCALE;

  if (x < -80 || x > canvas.width + 80) return;

  pixelRect(x, 122, 4, 82, "#20121f");
  pixelRect(x + 4, 123, 3, 79, "#b85f21");
  pixelRect(x - 2, 118, 8, 8, "#f39b2f");
  const flagX = x + 7;
  const flagY = 128;
  pixelRect(flagX, flagY, 44, 29, "#20121f");
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const color = (row + col) % 2 === 0 ? "#ffffff" : "#20121f";
      pixelRect(flagX + col * 7, flagY + row * 7, 7, 7, color);
    }
  }
  pixelRect(flagX + 35, flagY + 21, 10, 8, "#20121f");
}

function drawDust() {
  for (const dust of state.dusts) {
    const alpha = Math.max(0, dust.life / dust.maxLife);
    ctx.fillStyle = `rgba(242, 181, 103, ${alpha})`;
    ctx.fillRect(Math.round(dust.x), Math.round(dust.y), Math.round(dust.size * 1.7), Math.max(2, Math.round(dust.size * 0.8)));
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const theme = getStageTheme();
  const sky = ctx.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, 220);

  for (let i = 0; i < 7; i++) {
    const x = wrap(i * 230 - state.worldOffset * 0.08, canvas.width + 220) - 150;
    const y = 28 + ((i * 29) % 56);
    drawCloud(x, y, 0.72 + (i % 3) * 0.18);
  }

  for (let i = 0; i < 10; i++) {
    const x = wrap(i * 142 - state.worldOffset * 0.25, canvas.width + 190) - 100;
    const y = 114 + ((i * 13) % 38);
    drawTree(x, y, 0.82 + (i % 3) * 0.16);
  }

  pixelRect(0, 190, canvas.width, 18, "#04351f");
  drawGrassTufts(176, 26, 0.45);

  ctx.fillStyle = theme.road;
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.lineTo(canvas.width, 180);
  ctx.lineTo(canvas.width, 500);
  ctx.lineTo(0, 486);
  ctx.closePath();
  ctx.fill();

  pixelRect(0, 180, canvas.width, 5, theme.roadEdge);
  drawDirtTexture();
  drawStones();
  drawFinishFlag();
  drawGrassTufts(486, 54, 1.1);
}

function draw() {
  drawBackground();

  drawDust();
  const theme = getStageTheme();

  const playerVisible = state.hitFlash <= 0 || Math.floor(state.hitFlash * 12) % 2 === 0;
  const renderables = state.objects.map((object) => ({ kind: "object", lane: object.lane, object }));
  if (playerVisible) renderables.push({ kind: "player", lane: state.lane });

  renderables.sort((a, b) => a.lane - b.lane);
  for (const renderable of renderables) {
    if (renderable.kind === "player") {
      const playerY = LANES[state.lane];
      drawPixelRunner(PLAYER_X, playerY, 0.86 + state.lane * 0.18, {
        skin: "#f6b26b",
        hair: "#5a2c2a",
        shirt: "#ffd447",
        short: "#2a183b",
      });
      continue;
    }

    const object = renderable.object;
    const laneY = LANES[object.lane];
    const scale = object.type === "runner"
      ? 0.86 + object.lane * 0.18
      : 0.75 + object.lane * 0.18;
    const y = laneY + Math.sin(object.bob) * 3;
    if (object.type === "water") {
      drawWater(object.x, y, scale);
    } else {
      drawPixelRunner(object.x, y, scale, {
        skin: "#f0a86a",
        hair: "#2a183b",
        shirt: theme.enemy.shirt,
        short: theme.enemy.short,
        shoe: theme.enemy.shoe,
        glasses: "#101015",
      });
    }
  }

  const distanceDisplayText = `${Math.floor(Math.min(state.distance, COURSE_METERS)).toLocaleString()} / 5,000m`;
  const timeDisplayText = formatRaceTime(state.time);
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "#20121f";
  ctx.fillText(timeDisplayText, 628, 39);
  ctx.fillText(timeDisplayText, 632, 39);
  ctx.fillText(timeDisplayText, 630, 37);
  ctx.fillText(timeDisplayText, 630, 41);
  ctx.fillText(distanceDisplayText, 928, 39);
  ctx.fillText(distanceDisplayText, 932, 39);
  ctx.fillText(distanceDisplayText, 930, 37);
  ctx.fillText(distanceDisplayText, 930, 41);
  ctx.fillStyle = "#f8fbff";
  ctx.fillText(timeDisplayText, 630, 39);
  ctx.fillText(distanceDisplayText, 930, 39);
  ctx.textAlign = "left";
  const stageText = `STAGE ${state.stage}`;
  ctx.fillStyle = "#20121f";
  ctx.fillText(stageText, 28, 43);
  ctx.fillText(stageText, 32, 43);
  ctx.fillText(stageText, 30, 41);
  ctx.fillText(stageText, 30, 45);
  ctx.fillStyle = "#f8fbff";
  ctx.fillText(stageText, 30, 43);
  ctx.textAlign = "left";

  staminaBar.style.width = `${Math.max(0, state.stamina)}%`;
  staminaBar.style.background = state.stamina < 25 ? "var(--danger)" : "linear-gradient(90deg, #48e07c, #f7e34f)";
  goldText.textContent = state.totalGold.toLocaleString();
  paceText.textContent = getPaceConfig().label;
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.lastFrame) / 1000);
  state.lastFrame = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatRaceTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const restSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  const centiseconds = Math.floor((seconds % 1) * 100).toString().padStart(2, "0");
  return `${minutes}'${restSeconds}"${centiseconds}`;
}

const SWIPE_MOVE_LIMIT = 48;

let touchStart = null;

document.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) {
    touchStart = null;
    return;
  }
  touchStart = { x: event.clientX, y: event.clientY };
});

document.addEventListener("pointerup", (event) => {
  if (event.target.closest("button")) {
    touchStart = null;
    return;
  }

  if (!touchStart) return;
  const dx = event.clientX - touchStart.x;
  const dy = event.clientY - touchStart.y;
  if (Math.abs(dx) > SWIPE_MOVE_LIMIT && Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      increasePace();
    } else {
      decreasePace();
    }
  } else if (Math.abs(dy) > SWIPE_MOVE_LIMIT && Math.abs(dy) > Math.abs(dx)) {
    moveLane(dy < 0 ? -1 : 1);
  }
  touchStart = null;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") moveLane(-1);
  if (event.key === "ArrowDown") moveLane(1);
  if (event.key === "ArrowLeft") decreasePace();
  if (event.key === "ArrowRight") increasePace();
  if (event.key === " " || event.key === "Enter") handleStartButton();
});

startButton.addEventListener("click", handleStartButton);

requestAnimationFrame(loop);
