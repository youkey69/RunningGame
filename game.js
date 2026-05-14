const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const staminaBar = document.querySelector("#staminaBar");
const distanceText = document.querySelector("#distance");
const paceText = document.querySelector("#pace");
const message = document.querySelector("#message");
const startButton = document.querySelector("#start");

const COURSE_METERS = 5000;
const DISTANCE_MULTIPLIER = 5;
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
  state.distance += pace.speed * DISTANCE_MULTIPLIER * dt;
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

function drawPixelRunner(x, y, laneScale, colors) {
  const s = 4 * laneScale;
  const stride = Math.sin(state.time * 14) > 0 ? 1 : -1;

  ctx.fillStyle = colors.skin;
  ctx.fillRect(x + 12 * s, y - 17 * s, 5 * s, 5 * s);
  ctx.fillRect(x + 16 * s, y - 15 * s, 2 * s, 2 * s);

  ctx.fillStyle = colors.hair;
  ctx.fillRect(x + 10 * s, y - 18 * s, 6 * s, 2 * s);
  ctx.fillRect(x + 10 * s, y - 16 * s, 2 * s, 4 * s);

  ctx.fillStyle = colors.shirt;
  ctx.fillRect(x + 6 * s, y - 12 * s, 8 * s, 7 * s);
  ctx.fillRect(x + 12 * s, y - 10 * s, 4 * s, 3 * s);

  ctx.fillStyle = colors.skin;
  ctx.fillRect(x + (4 - stride) * s, y - 10 * s, 4 * s, 2 * s);
  ctx.fillRect(x + (13 + stride) * s, y - 8 * s, 4 * s, 2 * s);

  ctx.fillStyle = colors.short;
  ctx.fillRect(x + 6 * s, y - 5 * s, 7 * s, 4 * s);

  ctx.fillStyle = colors.skin;
  ctx.fillRect(x + (3 + stride) * s, y - 1 * s, 6 * s, 2 * s);
  ctx.fillRect(x + (10 - stride) * s, y - 1 * s, 5 * s, 2 * s);

  ctx.fillStyle = colors.hair;
  ctx.fillRect(x + 16 * s, y - 14 * s, s, s);
}

function drawWater(x, y, scale) {
  const s = 4 * scale;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y - 8 * s, 7 * s, 8 * s);
  ctx.fillStyle = "#5edbff";
  ctx.fillRect(x + s, y - 5 * s, 5 * s, 3 * s);
  ctx.fillStyle = "#2a183b";
  ctx.fillRect(x, y - 8 * s, 7 * s, s);
}

function wrap(value, length) {
  return ((value % length) + length) % length;
}

function drawCloud(x, y, scale) {
  const s = 8 * scale;
  ctx.fillStyle = "#fff7d6";
  ctx.fillRect(x, y + s, 9 * s, 3 * s);
  ctx.fillRect(x + 2 * s, y, 4 * s, 4 * s);
  ctx.fillRect(x + 5 * s, y + s, 5 * s, 3 * s);
  ctx.fillStyle = "#c8efff";
  ctx.fillRect(x + s, y + 4 * s, 8 * s, s);
}

function drawTree(x, y, scale) {
  const s = 6 * scale;
  ctx.fillStyle = "#7b4a2b";
  ctx.fillRect(x + 6 * s, y + 8 * s, 3 * s, 7 * s);
  ctx.fillStyle = "#41a45a";
  ctx.fillRect(x + 2 * s, y + 6 * s, 11 * s, 7 * s);
  ctx.fillStyle = "#2f7f4e";
  ctx.fillRect(x + 4 * s, y, 7 * s, 8 * s);
  ctx.fillRect(x, y + 4 * s, 14 * s, 5 * s);
}

function drawStones() {
  for (let i = 0; i < 28; i++) {
    const x = wrap(i * 73 - state.worldOffset * 0.9, canvas.width + 90) - 45;
    const lane = i % LANES.length;
    const y = LANES[lane] + 8 + ((i * 17) % 36);
    const size = 2 + (i % 3);
    ctx.fillStyle = i % 2 === 0 ? "#7b7770" : "#9d9588";
    ctx.fillRect(x, y, size * 3, size * 2);
  }
}

function drawDust() {
  for (const dust of state.dusts) {
    const alpha = Math.max(0, dust.life / dust.maxLife);
    ctx.fillStyle = `rgba(218, 184, 126, ${alpha})`;
    ctx.fillRect(dust.x, dust.y, dust.size, dust.size);
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#78d9ff";
  ctx.fillRect(0, 0, canvas.width, 220);
  ctx.fillStyle = "#fff0b8";
  ctx.fillRect(730, 34, 54, 54);

  for (let i = 0; i < 7; i++) {
    const x = wrap(i * 230 - state.worldOffset * 0.08, canvas.width + 180) - 120;
    const y = 36 + ((i * 29) % 58);
    drawCloud(x, y, 0.75 + (i % 3) * 0.18);
  }

  for (let i = 0; i < 10; i++) {
    const x = wrap(i * 145 - state.worldOffset * 0.25, canvas.width + 170) - 90;
    const y = 96 + ((i * 13) % 34);
    drawTree(x, y, 0.78 + (i % 3) * 0.08);
  }

  ctx.fillStyle = "#49b85f";
  ctx.fillRect(0, 215, canvas.width, 325);
  ctx.fillStyle = "#c98d5a";
  ctx.beginPath();
  ctx.moveTo(0, 160);
  ctx.lineTo(canvas.width, 160);

  ctx.lineTo(canvas.width, 500);
  ctx.lineTo(0, 470);
  ctx.closePath();
  ctx.fill();
  drawStones();
}

function draw() {
  drawBackground();

  const sorted = [...state.objects].sort((a, b) => a.lane - b.lane);
  for (const object of sorted) {
    const laneY = LANES[object.lane];
    const scale = 0.75 + object.lane * 0.18;
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

  ctx.fillStyle = "#2a183b";
  ctx.font = "bold 26px monospace";
  ctx.fillText(`${Math.floor(Math.min(state.distance, COURSE_METERS)).toLocaleString()} / 5,000m`, 690, 42);

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

const TAP_MOVE_LIMIT = 18;
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
  const moved = Math.hypot(dx, dy);

  if (Math.abs(dx) > SWIPE_MOVE_LIMIT && Math.abs(dx) > Math.abs(dy)) {
    setPace(dx > 0 ? "fast" : "slow");
  } else if (moved < TAP_MOVE_LIMIT) {
    const direction = event.clientY < window.innerHeight / 2 ? -1 : 1;
    moveLane(direction);
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

document.querySelector("#laneBack").addEventListener("click", () => moveLane(-1));
document.querySelector("#laneFront").addEventListener("click", () => moveLane(1));
document.querySelector("#slow").addEventListener("click", () => setPace("slow"));
document.querySelector("#fast").addEventListener("click", () => setPace("fast"));
startButton.addEventListener("click", resetGame);

requestAnimationFrame(loop);
