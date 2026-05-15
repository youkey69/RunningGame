const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const staminaBar = document.querySelector("#staminaBar");
const distanceText = document.querySelector("#distance");
const paceText = document.querySelector("#pace");
const message = document.querySelector("#message");
const startButton = document.querySelector("#start");

const COURSE_METERS = 5000;
const DISTANCE_COUNTUP_MULTIPLIER = 40;
const LANES = [190, 280, 380];
const PLAYER_X = 150;
const PACE = {
  slow: { label: "Slow", speed: 7.4, drain: 3.3 },
  normal: { label: "Normal", speed: 10.2, drain: 5.2 },
  fast: { label: "Fast", speed: 13.6, drain: 8.8 },
};

const state = {
  running: false,
  finished: false,
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

function resetGame() {
  Object.assign(state, {
    running: true,
    finished: false,
    lane: 1,
    stamina: 100,
    distance: 0,
    pace: "normal",
    obstacleTimer: 1.1,
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

function moveLane(direction) {
  if (!state.running) return;
  state.lane = Math.max(0, Math.min(2, state.lane + direction));
}

function setPace(pace) {
  if (!state.running) return;
  if (pace === "fast") emitDust();
  state.pace = pace;
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

  const pace = PACE[state.pace];
  state.time += dt;
  state.distance += pace.speed * DISTANCE_COUNTUP_MULTIPLIER * dt;
  state.stamina -= pace.drain * dt;
  state.hitCooldown = Math.max(0, state.hitCooldown - dt);
  state.hitFlash = Math.max(0, state.hitFlash - dt);
  state.worldOffset += pace.speed * 18 * dt;

  for (const dust of state.dusts) {
    dust.x += dust.vx * dt;
    dust.y += dust.vy * dt;
    dust.vy += 80 * dt;
    dust.life -= dt;
  }
  state.dusts = state.dusts.filter((dust) => dust.life > 0);
  state.obstacleTimer -= dt;
  state.itemTimer -= dt;

  if (state.obstacleTimer <= 0) {
    spawn("runner");
    state.obstacleTimer = 0.85 + Math.random() * 1.25;
  }

  if (state.itemTimer <= 0) {
    spawn("water");
    state.itemTimer = 2.8 + Math.random() * 2.2;
  }

  for (const object of state.objects) {
    object.x -= (pace.speed * 22 + (object.type === "runner" ? 80 : 40)) * dt;
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
    const prize = Math.max(0, Math.round(15000 - state.time * 120));
    endGame(`ゴール！ ${formatTime(state.time)} / 賞金 ${prize.toLocaleString()}G`, true);
  }
}

function endGame(text, finished) {
  state.running = false;
  state.finished = finished;
  message.querySelector("h1").textContent = finished ? "FINISH!" : "GAME OVER";
  message.querySelector("p").textContent = text;
  startButton.textContent = "RESTART";
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
  pixelRect(baseX + 17 * s, baseY - 20 * s, s, s, "#101015");
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
    const x = wrap(i * 57 - state.worldOffset * 0.9, canvas.width + 90) - 45;
    const lane = i % LANES.length;
    const y = LANES[lane] + 8 + ((i * 17) % 54);
    const size = 2 + (i % 3);
    pixelRect(x, y + size, size * 5, size * 2, "#6d4433");
    pixelRect(x + size, y, size * 4, size * 2, i % 2 === 0 ? "#b7aa92" : "#8f8171");
    pixelRect(x + size * 2, y, size, size, "#f1d49b");
  }
}

function drawDirtTexture() {
  for (let i = 0; i < 170; i++) {
    const x = wrap(i * 41 - state.worldOffset * 0.9, canvas.width + 48) - 24;
    const y = 188 + ((i * 31) % 300);
    const color = i % 4 === 0 ? "#a95f2e" : i % 4 === 1 ? "#d48a3e" : i % 4 === 2 ? "#8e4f2b" : "#efad55";
    ditherDot(x, y, i, color, i % 5 === 0 ? 3 : 2);
  }
}

function drawFinishFlag() {
  const metersLeft = COURSE_METERS - state.distance;
  if (metersLeft > 900) return;

  const finishProgress = (900 - metersLeft) / 900;
  const x = canvas.width + 80 - finishProgress * (canvas.width + 80 - PLAYER_X);
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

  const sky = ctx.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0, "#14b8f5");
  sky.addColorStop(1, "#72dcff");
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

  ctx.fillStyle = "#c77735";
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.lineTo(canvas.width, 180);
  ctx.lineTo(canvas.width, 500);
  ctx.lineTo(0, 486);
  ctx.closePath();
  ctx.fill();

  pixelRect(0, 180, canvas.width, 5, "#8e4f2b");
  drawDirtTexture();
  drawStones();
  drawFinishFlag();
  drawGrassTufts(486, 54, 1.1);
}

function draw() {
  drawBackground();

  const sorted = [...state.objects].sort((a, b) => a.lane - b.lane);
  for (const object of sorted) {
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
        shirt: "#ff5964",
        short: "#353b9a",
      });
    }
  }

  drawDust();

  const playerY = LANES[state.lane];
  const playerVisible = state.hitFlash <= 0 || Math.floor(state.hitFlash * 12) % 2 === 0;
  if (playerVisible) {
    drawPixelRunner(PLAYER_X, playerY, 0.86 + state.lane * 0.18, {
      skin: "#f6b26b",
      hair: "#5a2c2a",
      shirt: "#36d1dc",
      short: "#2a183b",
    });
  }

  const raceText = `${Math.floor(Math.min(state.distance, COURSE_METERS)).toLocaleString()} / 5,000m`;
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "#20121f";
  ctx.fillText(raceText, 928, 43);
  ctx.fillText(raceText, 932, 43);
  ctx.fillText(raceText, 930, 41);
  ctx.fillText(raceText, 930, 45);
  ctx.fillStyle = "#f8fbff";
  ctx.fillText(raceText, 930, 43);
  ctx.textAlign = "left";

  staminaBar.style.width = `${Math.max(0, state.stamina)}%`;
  staminaBar.style.background = state.stamina < 25 ? "var(--danger)" : "linear-gradient(90deg, #48e07c, #f7e34f)";
  distanceText.textContent = Math.floor(Math.min(state.distance, COURSE_METERS)).toLocaleString();
  paceText.textContent = PACE[state.pace].label;
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
    setPace(dx > 0 ? "fast" : "slow");
  } else if (Math.abs(dy) > SWIPE_MOVE_LIMIT && Math.abs(dy) > Math.abs(dx)) {
    moveLane(dy < 0 ? -1 : 1);
  }
  touchStart = null;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") moveLane(-1);
  if (event.key === "ArrowDown") moveLane(1);
  if (event.key === "ArrowLeft") setPace("slow");
  if (event.key === "ArrowRight") setPace("fast");
  if (event.key === " " || event.key === "Enter") resetGame();
});

document.querySelector("#slow").addEventListener("click", () => setPace("slow"));
document.querySelector("#fast").addEventListener("click", () => setPace("fast"));
startButton.addEventListener("click", resetGame);

requestAnimationFrame(loop);
