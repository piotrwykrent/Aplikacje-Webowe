const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const BASE_HEIGHT = 112;
const PLAYABLE_HEIGHT = canvas.height - BASE_HEIGHT;
const STEP_MS = 1000 / 60;

const state = {
  current: 0,
  getReady: 0,
  game: 1,
  falling: 2,
  celebrating: 3,
  over: 4,
};

let tickCount = 0;
let isNewRecord = false;
let celebrationTimerMs = 0;

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const bg = loadImage("assets/Flappy Bird/background-day.png");
const base = loadImage("assets/Flappy Bird/base.png");
const pipeImg = loadImage("assets/Flappy Bird/pipe-green.png");
const getReadyImg = loadImage("assets/UI/message.png");
const gameOverImg = loadImage("assets/UI/gameover.png");

const birdImgs = [
  loadImage("assets/Flappy Bird/yellowbird-upflap.png"),
  loadImage("assets/Flappy Bird/yellowbird-midflap.png"),
  loadImage("assets/Flappy Bird/yellowbird-downflap.png"),
];

const numberImgs = Array.from({ length: 10 }, (_, i) =>
  loadImage(`assets/UI/Numbers/${i}.png`),
);

const SCORE_SND = new Audio("assets/Sound Efects/point.wav");
const FLAP_SND = new Audio("assets/Sound Efects/wing.wav");
const HIT_SND = new Audio("assets/Sound Efects/hit.wav");
const DIE_SND = new Audio("assets/Sound Efects/die.wav");
const SWOOSH_SND = new Audio("assets/Sound Efects/swoosh.wav");

function playSound(audio) {
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

const bgmPlayer = {
  ctx: null,
  intervalId: null,
  noteIndex: 0,
  melody: [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.0, 698.46],
  start() {
    if (this.intervalId) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) this.ctx = new AudioCtx();
    if (this.ctx.state === "suspended") this.ctx.resume();

    this.noteIndex = 0;
    this.intervalId = setInterval(() => {
      if (state.current !== state.game) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(
        this.melody[this.noteIndex % this.melody.length],
        now,
      );
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
      this.noteIndex++;
    }, 260);
  },
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },
};

const score = {
  bestScores: JSON.parse(localStorage.getItem("flappyScores")) || [],
  previousGame: Number(localStorage.getItem("flappyLastScore")) || 0,
  current: 0,
  lastRun: 0,

  saveRun(newScore) {
    this.lastRun = newScore;
    this.bestScores.push(newScore);
    this.bestScores.sort((a, b) => b - a);
    this.bestScores = this.bestScores.slice(0, 5);
    localStorage.setItem("flappyScores", JSON.stringify(this.bestScores));
    localStorage.setItem("flappyLastScore", String(newScore));
  },

  getBest() {
    return this.bestScores.length > 0 ? this.bestScores[0] : 0;
  },
};

const boosts = {
  items: [],
  ghostTimerMs: 0,
  fastForward: {
    active: false,
    pointsLeft: 0,
    tickMs: 0,
  },

  reset() {
    this.items = [];
    this.ghostTimerMs = 0;
    this.fastForward.active = false;
    this.fastForward.pointsLeft = 0;
    this.fastForward.tickMs = 0;
  },

  spawn(x, y) {
    const type = Math.random() < 0.55 ? "ghost" : "fastForward";
    this.items.push({ x, y, type, r: 14 });
  },

  isInvulnerable() {
    return this.ghostTimerMs > 0 || this.fastForward.active;
  },

  getSpeedMultiplier() {
    return this.fastForward.active ? 4.5 : 1;
  },

  update() {
    if (state.current !== state.game) return;

    if (this.ghostTimerMs > 0) {
      this.ghostTimerMs = Math.max(0, this.ghostTimerMs - STEP_MS);
    }

    if (this.fastForward.active) {
      this.fastForward.tickMs += STEP_MS;
      if (this.fastForward.tickMs >= 220) {
        this.fastForward.tickMs = 0;
        score.current += 1;
        this.fastForward.pointsLeft -= 1;
        playSound(SCORE_SND);

        if (this.fastForward.pointsLeft <= 0) {
          this.fastForward.active = false;
          this.ghostTimerMs = Math.max(this.ghostTimerMs, 1500);
        }
      }
    }

    const speed = pipes.dx * this.getSpeedMultiplier();
    const { cx, cy } = bird.getCenter();

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      item.x -= speed;

      const dist = Math.hypot(cx - item.x, cy - item.y);
      if (dist < bird.radius + item.r) {
        if (item.type === "ghost") {
          this.ghostTimerMs = 5000;
          playSound(SWOOSH_SND);
        } else if (item.type === "fastForward") {
          this.fastForward.active = true;
          this.fastForward.pointsLeft = 5;
          this.fastForward.tickMs = 0;
          playSound(SWOOSH_SND);
        }
        this.items.splice(i, 1);
        i--;
        continue;
      }

      if (item.x + item.r < 0) {
        this.items.splice(i, 1);
        i--;
      }
    }
  },

  draw() {
    for (const item of this.items) {
      const pulse = Math.sin(tickCount * 0.12) * 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r + pulse * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = item.type === "ghost" ? "#00b4d8" : "#f77f00";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.type === "ghost" ? "G" : ">>", item.x, item.y + 1);
      ctx.restore();
    }

    if (this.fastForward.active && state.current === state.game) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const y = (i * 53 + tickCount * 7) % PLAYABLE_HEIGHT;
        const x =
          canvas.width - ((tickCount * 18 + i * 95) % (canvas.width + 80));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 45, y);
        ctx.stroke();
      }
      ctx.restore();
    }
  },
};

const flyingObstacles = {
  items: [],

  reset() {
    this.items = [];
  },

  update() {
    if (state.current !== state.game) return;

    if (
      score.current >= 2 &&
      tickCount % 230 === 0 &&
      !boosts.fastForward.active
    ) {
      this.items.push({
        x: canvas.width + 25,
        baseY: 75 + Math.random() * (PLAYABLE_HEIGHT - 160),
        y: 150,
        r: 12,
        phase: Math.random() * Math.PI * 2,
        dx: 3.1,
      });
    }

    const { cx, cy } = bird.getCenter();
    const mult = boosts.getSpeedMultiplier();

    for (let i = 0; i < this.items.length; i++) {
      const obs = this.items[i];
      obs.x -= obs.dx * mult;
      obs.phase += 0.08;
      obs.y = obs.baseY + Math.sin(obs.phase) * 26;

      if (!boosts.isInvulnerable()) {
        const dist = Math.hypot(cx - obs.x, cy - obs.y);
        if (dist < bird.radius + obs.r - 2) {
          triggerCrash();
          return;
        }
      }

      if (obs.x + obs.r < -10) {
        this.items.splice(i, 1);
        i--;
      }
    }
  },

  draw() {
    for (const obs of this.items) {
      ctx.save();
      if (boosts.isInvulnerable()) ctx.globalAlpha = 0.35;
      ctx.translate(obs.x, obs.y);
      ctx.rotate(tickCount * 0.15);

      ctx.fillStyle = "#d62828";
      ctx.strokeStyle = "#3a0000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const spikes = 8;
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? obs.r + 3 : obs.r - 3;
        const angle = (i * Math.PI) / spikes;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd166";
      ctx.fill();
      ctx.restore();
    }
  },
};

const confetti = {
  particles: [],
  colors: ["#ffbe0b", "#fb5607", "#ff006e", "#8338ec", "#3a86ff", "#06d6a0"],

  spawn() {
    this.particles = Array.from({ length: 65 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -200,
      w: 6 + Math.random() * 5,
      h: 4 + Math.random() * 4,
      vy: 1.5 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 1.8,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
    }));
  },

  update() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vRot;
      if (p.y > canvas.height) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
    }
  },

  draw() {
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  },
};

const bird = {
  x: 60,
  y: 150,
  w: 34,
  h: 24,
  radius: 10,
  velocity: 0,
  gravity: 0.25,
  jump: -4.6,
  rotation: 0,
  animation: [0, 1, 2, 1],
  frame: 0,

  getCenter() {
    return { cx: this.x + this.w / 2, cy: this.y + this.h / 2 };
  },

  reset() {
    this.x = 60;
    this.y = 150;
    this.velocity = 0;
    this.rotation = 0;
    this.frame = 0;
  },

  draw() {
    const img = birdImgs[this.animation[this.frame]];
    if (!img.complete || !img.naturalWidth) return;

    ctx.save();
    if (boosts.ghostTimerMs > 0 && state.current === state.game) {
      ctx.globalAlpha = 0.7;
    }
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.rotate(this.rotation);
    ctx.drawImage(img, -this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  },

  update() {
    const period =
      state.current === state.getReady ? 10 : boosts.fastForward.active ? 2 : 5;

    if (state.current !== state.falling && state.current !== state.over) {
      if (tickCount % period === 0) {
        this.frame = (this.frame + 1) % this.animation.length;
      }
    }

    if (state.current === state.getReady) {
      this.y = 150 + Math.cos(tickCount / 10) * 5;
      this.rotation = 0;
      return;
    }

    if (state.current === state.celebrating) {
      const targetX = canvas.width / 2 - this.w / 2;
      const targetY = 190;
      this.x += (targetX - this.x) * 0.08;
      this.y += (targetY - this.y) * 0.08;
      this.rotation += 0.28;
      celebrationTimerMs -= STEP_MS;
      confetti.update();

      if (celebrationTimerMs <= 0) {
        this.rotation = 0;
        state.current = state.over;
      }
      return;
    }

    if (state.current === state.over) return;

    if (state.current === state.game && boosts.fastForward.active) {
      this.y += (170 - this.y) * 0.15;
      this.velocity = 0;
      this.rotation = 0;
      return;
    }

    this.velocity += this.gravity;
    this.y += this.velocity;

    if (this.y < 0) {
      this.y = 0;
      this.velocity = 0;
    }

    if (this.velocity < 0) {
      this.rotation = (-25 * Math.PI) / 180;
    } else {
      this.rotation = Math.min(
        this.rotation + (4 * Math.PI) / 180,
        (90 * Math.PI) / 180,
      );
    }

    if (this.y + this.h >= PLAYABLE_HEIGHT) {
      this.y = PLAYABLE_HEIGHT - this.h;
      this.frame = 1;
      if (state.current === state.game) {
        playSound(HIT_SND);
        finishRun();
      } else if (state.current === state.falling) {
        playSound(DIE_SND);
        finishRun();
      }
    }
  },

  flap() {
    if (boosts.fastForward.active) return;
    this.velocity = this.jump;
    playSound(FLAP_SND);
  },
};

const pipes = {
  position: [],
  w: 52,
  h: 320,
  dx: 2,
  spawnedCount: 0,

  reset() {
    this.position = [];
    this.spawnedCount = 0;
  },

  draw() {
    if (!pipeImg.complete || !pipeImg.naturalWidth) return;

    ctx.save();
    if (boosts.isInvulnerable() && state.current === state.game) {
      ctx.globalAlpha = 0.35;
    }

    for (const p of this.position) {
      const topY = p.topBottomY - this.h;
      const bottomY = p.topBottomY + p.gap;

      ctx.save();
      ctx.translate(p.x + this.w / 2, topY + this.h / 2);
      ctx.scale(1, -1);
      ctx.drawImage(pipeImg, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.restore();

      ctx.drawImage(pipeImg, p.x, bottomY, this.w, this.h);
    }
    ctx.restore();
  },

  update() {
    if (state.current !== state.game) return;

    const mult = boosts.getSpeedMultiplier();
    const spawnInterval = boosts.fastForward.active ? 28 : 95;

    if (tickCount % spawnInterval === 0) {
      const gap = 105 + Math.random() * 25;
      const minEdge = 45;
      const maxTopBottomY = PLAYABLE_HEIGHT - gap - minEdge;
      const topBottomY = minEdge + Math.random() * (maxTopBottomY - minEdge);

      this.position.push({
        x: canvas.width,
        topBottomY,
        gap,
        passed: false,
      });

      this.spawnedCount++;
      if (
        !boosts.fastForward.active &&
        this.spawnedCount % 3 === 0 &&
        Math.random() < 0.75
      ) {
        boosts.spawn(canvas.width + this.w / 2, topBottomY + gap / 2);
      }
    }

    const { cx, cy } = bird.getCenter();

    for (let i = 0; i < this.position.length; i++) {
      const p = this.position[i];
      p.x -= this.dx * mult;

      if (!boosts.isInvulnerable()) {
        const withinX =
          cx + bird.radius > p.x && cx - bird.radius < p.x + this.w;
        const hitsTop = cy - bird.radius < p.topBottomY;
        const hitsBottom = cy + bird.radius > p.topBottomY + p.gap;

        if (withinX && (hitsTop || hitsBottom)) {
          triggerCrash();
          return;
        }
      }

      if (p.x + this.w < bird.x && !p.passed) {
        p.passed = true;
        if (!boosts.fastForward.active) {
          score.current += 1;
          playSound(SCORE_SND);
        }
      }

      if (p.x + this.w <= 0) {
        this.position.splice(i, 1);
        i--;
      }
    }
  },
};

const ground = {
  x: 0,
  draw() {
    if (!base.complete || !base.naturalWidth) return;
    ctx.drawImage(base, this.x, PLAYABLE_HEIGHT, canvas.width, BASE_HEIGHT);
    ctx.drawImage(
      base,
      this.x + canvas.width,
      PLAYABLE_HEIGHT,
      canvas.width,
      BASE_HEIGHT,
    );
  },
  update() {
    if (state.current === state.game || state.current === state.getReady) {
      const mult =
        state.current === state.game ? boosts.getSpeedMultiplier() : 1;
      this.x = (this.x - 2 * mult) % canvas.width;
    }
  },
};

const restartBtn = {
  x: canvas.width / 2 - 90,
  y: 348,
  w: 180,
  h: 42,
  contains(mx, my) {
    return (
      mx >= this.x &&
      mx <= this.x + this.w &&
      my >= this.y &&
      my <= this.y + this.h
    );
  },
};

function triggerCrash() {
  state.current = state.falling;
  bgmPlayer.stop();
  playSound(HIT_SND);
}

function finishRun() {
  bgmPlayer.stop();
  const prevBest = score.getBest();
  isNewRecord = score.current > 0 && score.current > prevBest;
  score.saveRun(score.current);

  if (isNewRecord) {
    state.current = state.celebrating;
    celebrationTimerMs = 3000;
    confetti.spawn();
    playSound(SCORE_SND);
  } else {
    state.current = state.over;
  }
}

function resetGame() {
  score.previousGame = score.lastRun;
  pipes.reset();
  boosts.reset();
  flyingObstacles.reset();
  bird.reset();
  score.current = 0;
  isNewRecord = false;
  state.current = state.getReady;
  playSound(SWOOSH_SND);
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawScoreTopRight(value) {
  const digits = String(value).split("");
  const digitW = 20;
  const digitH = 30;
  const spacing = 2;
  const totalW = digits.length * (digitW + spacing) - spacing;
  const startX = canvas.width - 14 - totalW;
  const y = 14;

  const allLoaded = digits.every(
    (d) =>
      numberImgs[d] && numberImgs[d].complete && numberImgs[d].naturalWidth,
  );

  ctx.save();
  if (allLoaded) {
    digits.forEach((d, idx) => {
      ctx.drawImage(
        numberImgs[d],
        startX + idx * (digitW + spacing),
        y,
        digitW,
        digitH,
      );
    });
  } else {
    ctx.fillStyle = "#FFF";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "right";
    ctx.strokeText(String(value), canvas.width - 14, 40);
    ctx.fillText(String(value), canvas.width - 14, 40);
  }
  ctx.restore();
}

const ui = {
  draw() {
    drawScoreTopRight(score.current);

    if (state.current === state.game) {
      let badgeY = 14;
      if (boosts.ghostTimerMs > 0) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 180, 216, 0.9)";
        drawRoundedRect(10, badgeY, 118, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(
          `DUCH: ${(boosts.ghostTimerMs / 1000).toFixed(1)}s`,
          18,
          badgeY + 16,
        );
        ctx.restore();
        badgeY += 30;
      }
      if (boosts.fastForward.active) {
        ctx.save();
        ctx.fillStyle = "rgba(247, 127, 0, 0.95)";
        drawRoundedRect(10, badgeY, 138, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "left";
        ctx.fillText(
          `FAST FORWARD (+${boosts.fastForward.pointsLeft})`,
          18,
          badgeY + 16,
        );
        ctx.restore();
      }
    }

    if (state.current === state.getReady) {
      if (getReadyImg.complete && getReadyImg.naturalWidth) {
        ctx.drawImage(getReadyImg, canvas.width / 2 - 184 / 2, 75, 184, 267);
      }
      return;
    }

    if (state.current === state.celebrating) {
      confetti.draw();
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "bold 26px Arial";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#ffd166";
      ctx.strokeText("NOWY REKORD!", canvas.width / 2, 120);
      ctx.fillText("NOWY REKORD!", canvas.width / 2, 120);
      ctx.restore();
      return;
    }

    if (state.current === state.over) {
      if (isNewRecord) confetti.draw();

      ctx.save();
      if (gameOverImg.complete && gameOverImg.naturalWidth) {
        ctx.drawImage(gameOverImg, canvas.width / 2 - 96, 26, 192, 42);
      }

      if (isNewRecord) {
        ctx.textAlign = "center";
        ctx.font = "bold 16px Arial";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#000";
        ctx.fillStyle = "#ffd166";
        ctx.strokeText("GRATULACJE! NOWY REKORD!", canvas.width / 2, 88);
        ctx.fillText("GRATULACJE! NOWY REKORD!", canvas.width / 2, 88);
      }

      ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
      drawRoundedRect(32, 98, canvas.width - 64, 236, 10);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 17px Arial";
      ctx.fillText(`Wynik gry: ${score.lastRun}`, canvas.width / 2, 124);

      ctx.fillStyle = "#ffd166";
      ctx.fillText(
        `Najlepszy wynik: ${score.getBest()}`,
        canvas.width / 2,
        149,
      );

      ctx.fillStyle = "#d9d9d9";
      ctx.font = "14px Arial";
      ctx.fillText(
        `Poprzednia gra: ${score.previousGame}`,
        canvas.width / 2,
        172,
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px Arial";
      ctx.fillText("Top 5 wyników:", canvas.width / 2, 200);

      ctx.font = "14px Arial";
      for (let i = 0; i < 5; i++) {
        const val =
          score.bestScores[i] !== undefined ? score.bestScores[i] : "-";
        ctx.fillText(`${i + 1}. ${val}`, canvas.width / 2, 222 + i * 21);
      }

      ctx.fillStyle = "#e86101";
      drawRoundedRect(
        restartBtn.x,
        restartBtn.y,
        restartBtn.w,
        restartBtn.h,
        8,
      );
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 17px Arial";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "Zagraj ponownie",
        restartBtn.x + restartBtn.w / 2,
        restartBtn.y + restartBtn.h / 2 + 1,
      );
      ctx.restore();
    }
  },
};

function draw() {
  if (bg.complete && bg.naturalWidth) {
    ctx.drawImage(bg, 0, 0, canvas.width, PLAYABLE_HEIGHT);
  } else {
    ctx.fillStyle = "#70c5ce";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  pipes.draw();
  boosts.draw();
  flyingObstacles.draw();
  ground.draw();
  bird.draw();
  ui.draw();
}

function update() {
  bird.update();
  ground.update();
  pipes.update();
  boosts.update();
  flyingObstacles.update();
  if (state.current === state.over && isNewRecord) {
    confetti.update();
  }
  tickCount++;
}

let lastTime = performance.now();
let accumulator = 0;

function loop(now) {
  const delta = Math.min(now - lastTime, 100);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= STEP_MS) {
    update();
    accumulator -= STEP_MS;
  }

  draw();
  requestAnimationFrame(loop);
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function handleKeyDown(e) {
  if (e.code !== "Space") return;
  e.preventDefault();
  if (e.repeat) return;

  if (state.current === state.getReady) {
    state.current = state.game;
    bgmPlayer.start();
    bird.flap();
  } else if (state.current === state.game) {
    bird.flap();
  } else if (state.current === state.over) {
    resetGame();
  }
}

function handleCanvasClick(e) {
  if (state.current !== state.over) return;
  const { x, y } = getCanvasCoords(e);
  if (restartBtn.contains(x, y)) {
    resetGame();
  }
}

function handleCanvasMouseMove(e) {
  if (state.current !== state.over) {
    canvas.style.cursor = "default";
    return;
  }
  const { x, y } = getCanvasCoords(e);
  canvas.style.cursor = restartBtn.contains(x, y) ? "pointer" : "default";
}

function cleanupListeners() {
  document.removeEventListener("keydown", handleKeyDown);
  canvas.removeEventListener("click", handleCanvasClick);
  canvas.removeEventListener("mousemove", handleCanvasMouseMove);
  bgmPlayer.stop();
}

document.addEventListener("keydown", handleKeyDown);
canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("mousemove", handleCanvasMouseMove);
window.addEventListener("beforeunload", cleanupListeners);

requestAnimationFrame(loop);
