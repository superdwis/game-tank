(() => {
  const canvas = document.getElementById("battlefield");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("gameOverlay");
  const startButton = document.getElementById("startButton");
  const buttonText = document.getElementById("buttonText");
  const overlayKicker = document.getElementById("overlayKicker");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMessage = document.getElementById("overlayMessage");
  const scoreValue = document.getElementById("scoreValue");
  const waveValue = document.getElementById("waveValue");
  const healthPips = document.getElementById("healthPips");
  const arenaState = document.getElementById("arenaState");
  const threatValue = document.getElementById("threatValue");
  const pauseButton = document.getElementById("pauseButton");
  const pauseButtonText = document.getElementById("pauseButtonText");
  const pauseIndicator = document.getElementById("pauseIndicator");

  const WIDTH = 480;
  const HEIGHT = 300;
  const keys = new Set();
  const pointer = { x: WIDTH / 2, y: HEIGHT / 2 };
  const obstacles = [
    { x: 128, y: 58, w: 42, h: 13, type: "crate" },
    { x: 128, y: 71, w: 13, h: 38, type: "crate" },
    { x: 311, y: 47, w: 45, h: 14, type: "sandbag" },
    { x: 356, y: 47, w: 14, h: 42, type: "sandbag" },
    { x: 204, y: 120, w: 29, h: 22, type: "rock" },
    { x: 74, y: 211, w: 47, h: 13, type: "crate" },
    { x: 121, y: 185, w: 13, h: 39, type: "crate" },
    { x: 335, y: 206, w: 50, h: 14, type: "sandbag" },
    { x: 321, y: 220, w: 14, h: 32, type: "sandbag" },
    { x: 256, y: 265, w: 32, h: 12, type: "rock" }
  ];
  const decorations = [];
  let state = "ready";
  let player;
  let enemies = [];
  let bullets = [];
  let particles = [];
  let score = 0;
  let wave = 1;
  let health = 3;
  let spawnRemaining = 0;
  let spawnClock = 0;
  let nextWaveClock = 0;
  let fireClock = 0;
  let elapsed = 0;
  let lastFrame = 0;
  let hitFlash = 0;
  let randomSeed = 1407;

  function random() {
    randomSeed = (randomSeed * 16807) % 2147483647;
    return (randomSeed - 1) / 2147483646;
  }

  for (let i = 0; i < 95; i++) {
    decorations.push({
      x: 12 + random() * (WIDTH - 24),
      y: 12 + random() * (HEIGHT - 24),
      tone: Math.floor(random() * 3),
      size: random() > .83 ? 2 : 1
    });
  }

  function resetGame() {
    player = { x: 70, y: 150, angle: 0, speed: 91, radius: 8, invulnerable: 0 };
    enemies = [];
    bullets = [];
    particles = [];
    score = 0;
    wave = 1;
    health = 3;
    spawnRemaining = 3;
    spawnClock = 0;
    nextWaveClock = 0;
    fireClock = 0;
    elapsed = 0;
    hitFlash = 0;
    randomSeed = 1407;
    state = "playing";
    overlay.classList.add("is-hidden");
    pauseIndicator.hidden = true;
    pauseButton.disabled = false;
    pauseButtonText.textContent = "PAUSE";
    updateHud();
    spawnEnemy();
    spawnEnemy();
    arenaState.textContent = "ENGAGED";
  }

  function updateHud() {
    scoreValue.textContent = String(score).padStart(6, "0");
    waveValue.textContent = String(wave).padStart(2, "0");
    healthPips.setAttribute("aria-label", `${health} dari 3 armor tersisa`);
    [...healthPips.children].forEach((pip, index) => {
      pip.classList.toggle("is-empty", index >= health);
    });
    threatValue.textContent = wave >= 5 ? "EXTREME" : wave >= 3 ? "HIGH" : wave >= 2 ? "MEDIUM" : "LOW";
  }

  function showOverlay(kind) {
    overlay.classList.remove("is-hidden");
    if (kind === "over") {
      overlayKicker.textContent = "MISSION FAILED";
      overlayTitle.innerHTML = "TANK<br /><span>DESTROYED.</span>";
      overlayMessage.textContent = `Skor akhir ${String(score).padStart(6, "0")} — kamu bertahan sampai wave ${String(wave).padStart(2, "0")}.`;
      buttonText.textContent = "COBA LAGI";
      arenaState.textContent = "MISSION OVER";
    } else {
      overlayKicker.textContent = "YOUR MISSION STARTS NOW";
      overlayTitle.innerHTML = "READY<br /><span>COMMANDER?</span>";
      overlayMessage.textContent = "Hancurkan tank musuh. Bertahan selama mungkin.";
      buttonText.textContent = "MULAI MISI";
      arenaState.textContent = "STANDBY";
    }
  }

  function spawnEnemy() {
    const spots = [
      { x: 435, y: 48 }, { x: 440, y: 252 }, { x: 255, y: 36 },
      { x: 255, y: 270 }, { x: 410, y: 150 }, { x: 390, y: 65 }
    ];
    const spot = spots[Math.floor(random() * spots.length)];
    let position = { ...spot };
    for (let i = 0; i < spots.length; i++) {
      const candidate = spots[(i + i + wave) % spots.length];
      if (!obstacles.some((wall) => circleRect(candidate.x, candidate.y, 10, wall))) {
        position = candidate;
        break;
      }
    }
    enemies.push({
      x: position.x,
      y: position.y,
      angle: Math.PI,
      speed: 28 + Math.min(wave * 2, 16),
      radius: 8,
      fire: .7 + random() * 1.4,
      moveClock: .3 + random() * 1.1,
      health: wave >= 4 ? 2 : 1
    });
  }

  function circleRect(x, y, radius, rect) {
    const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - closestX;
    const dy = y - closestY;
    return dx * dx + dy * dy < radius * radius;
  }

  function canOccupy(x, y, radius) {
    if (x < radius + 7 || x > WIDTH - radius - 7 || y < radius + 7 || y > HEIGHT - radius - 7) return false;
    return !obstacles.some((wall) => circleRect(x, y, radius, wall));
  }

  function moveTank(tank, dx, dy) {
    if (canOccupy(tank.x + dx, tank.y, tank.radius)) tank.x += dx;
    if (canOccupy(tank.x, tank.y + dy, tank.radius)) tank.y += dy;
  }

  function shoot(tank, isEnemy = false) {
    const muzzle = 13;
    bullets.push({
      x: tank.x + Math.cos(tank.angle) * muzzle,
      y: tank.y + Math.sin(tank.angle) * muzzle,
      vx: Math.cos(tank.angle) * 170,
      vy: Math.sin(tank.angle) * 170,
      life: 1.7,
      enemy: isEnemy
    });
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: tank.x + Math.cos(tank.angle) * 12,
        y: tank.y + Math.sin(tank.angle) * 12,
        vx: (random() - .5) * 24 + Math.cos(tank.angle) * 22,
        vy: (random() - .5) * 24 + Math.sin(tank.angle) * 22,
        life: .12 + random() * .1,
        color: "#ffb5a5",
        size: 2
      });
    }
  }

  function explode(x, y, color = "#f27b65", amount = 9) {
    for (let i = 0; i < amount; i++) {
      const angle = random() * Math.PI * 2;
      const speed = 16 + random() * 55;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: .2 + random() * .45,
        color,
        size: random() > .6 ? 3 : 2
      });
    }
  }

  function update(dt) {
    if (state !== "playing") return;
    elapsed += dt;
    fireClock -= dt;
    hitFlash = Math.max(0, hitFlash - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    let mx = 0;
    let my = 0;
    if (keys.has("w") || keys.has("arrowup")) my -= 1;
    if (keys.has("s") || keys.has("arrowdown")) my += 1;
    if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
    if (keys.has("d") || keys.has("arrowright")) mx += 1;
    const length = Math.hypot(mx, my) || 1;
    moveTank(player, mx / length * player.speed * dt, my / length * player.speed * dt);
    player.angle = Math.atan2(pointer.y - player.y, pointer.x - player.x);

    if ((keys.has(" ") || pointer.down) && fireClock <= 0) {
      shoot(player);
      fireClock = .31;
    }

    if (spawnRemaining > 0) {
      spawnClock -= dt;
      if (spawnClock <= 0 && enemies.length < 5) {
        spawnEnemy();
        spawnRemaining--;
        spawnClock = .75;
      }
    } else if (enemies.length === 0) {
      nextWaveClock += dt;
      if (nextWaveClock > 1.35) {
        wave++;
        spawnRemaining = Math.min(3 + wave, 9);
        spawnClock = 0;
        nextWaveClock = 0;
        updateHud();
      }
    }

    for (const enemy of enemies) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      enemy.angle = Math.atan2(dy, dx);
      enemy.moveClock -= dt;
      if (enemy.moveClock <= 0) {
        enemy.moveClock = .35 + random() * .75;
        enemy.direction = random() < .34 ? 0 : (random() < .5 ? -1 : 1);
      }
      if (distance > 72) {
        const direction = enemy.direction || 1;
        const forwardX = Math.cos(enemy.angle);
        const forwardY = Math.sin(enemy.angle);
        const strafe = enemy.moveClock > .4 ? 0 : direction * .32;
        moveTank(enemy,
          (forwardX + -forwardY * strafe) * enemy.speed * dt,
          (forwardY + forwardX * strafe) * enemy.speed * dt
        );
      }
      enemy.fire -= dt;
      if (enemy.fire <= 0 && distance < 235) {
        shoot(enemy, true);
        enemy.fire = Math.max(.65, 1.55 - wave * .07) + random() * .55;
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let remove = bullet.life <= 0 || bullet.x < 5 || bullet.x > WIDTH - 5 || bullet.y < 5 || bullet.y > HEIGHT - 5;
      if (!remove && obstacles.some((wall) => circleRect(bullet.x, bullet.y, 2, wall))) {
        explode(bullet.x, bullet.y, "#bd8582", 3);
        remove = true;
      }

      if (!remove && bullet.enemy) {
        if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < player.radius + 2 && player.invulnerable <= 0) {
          health--;
          player.invulnerable = .9;
          hitFlash = .18;
          explode(player.x, player.y, "#ec7956", 12);
          updateHud();
          remove = true;
          if (health <= 0) {
            state = "over";
            pauseButton.disabled = true;
            pauseIndicator.hidden = true;
            showOverlay("over");
          }
        }
      } else if (!remove) {
        const target = enemies.find((enemy) => Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + 2);
        if (target) {
          target.health--;
          explode(bullet.x, bullet.y, "#ffb4a1", 4);
          remove = true;
          if (target.health <= 0) {
            enemies = enemies.filter((enemy) => enemy !== target);
            explode(target.x, target.y, "#f19a54", 13);
            score += 100;
            updateHud();
          }
        }
      }
      if (remove) bullets.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= .94;
      p.vy *= .94;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#281b1e";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#302024";
    ctx.fillRect(8, 8, WIDTH - 16, HEIGHT - 16);
    ctx.fillStyle = "#382428";
    ctx.fillRect(13, 13, WIDTH - 26, HEIGHT - 26);

    for (let x = 14; x < WIDTH - 12; x += 16) {
      for (let y = 14; y < HEIGHT - 12; y += 16) {
        ctx.fillStyle = ((x / 16 + y / 16) % 2 === 0) ? "rgba(214,157,150,.025)" : "rgba(12,7,9,.08)";
        ctx.fillRect(x, y, 15, 15);
      }
    }
    ctx.strokeStyle = "rgba(218,151,154,.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.strokeRect(21.5, 21.5, WIDTH - 43, HEIGHT - 43);
    ctx.setLineDash([]);

    const tones = ["#493238", "#5a3b42", "#3f2a30"];
    for (const dot of decorations) {
      ctx.fillStyle = tones[dot.tone];
      ctx.globalAlpha = .45;
      ctx.fillRect(Math.floor(dot.x), Math.floor(dot.y), dot.size, dot.size);
    }
    ctx.globalAlpha = 1;
    drawObstacleDecorations();
    ctx.fillStyle = "#a24a50";
    ctx.fillRect(6, 6, 7, 7);
    ctx.fillRect(WIDTH - 13, 6, 7, 7);
    ctx.fillRect(6, HEIGHT - 13, 7, 7);
    ctx.fillRect(WIDTH - 13, HEIGHT - 13, 7, 7);
  }

  function drawObstacleDecorations() {
    for (const wall of obstacles) {
      if (wall.type === "crate") {
        ctx.fillStyle = "#583a38";
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.fillStyle = "#81514b";
        ctx.fillRect(wall.x + 2, wall.y + 2, wall.w - 4, 3);
        ctx.fillStyle = "#38292c";
        ctx.fillRect(wall.x + 3, wall.y + wall.h - 4, wall.w - 6, 2);
        ctx.fillStyle = "#70453f";
        ctx.fillRect(wall.x + 5, wall.y + 5, 2, Math.max(2, wall.h - 10));
        if (wall.w > 20) ctx.fillRect(wall.x + wall.w - 8, wall.y + 4, 2, wall.h - 8);
      } else if (wall.type === "sandbag") {
        ctx.fillStyle = "#51403c";
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.fillStyle = "#76504a";
        for (let i = 2; i < wall.w - 2; i += 9) ctx.fillRect(wall.x + i, wall.y + 2, 6, 4);
        ctx.fillStyle = "#392b2d";
        ctx.fillRect(wall.x + 2, wall.y + wall.h - 4, wall.w - 4, 2);
      } else {
        ctx.fillStyle = "#493638";
        ctx.fillRect(wall.x + 3, wall.y, wall.w - 6, wall.h);
        ctx.fillRect(wall.x, wall.y + 4, wall.w, wall.h - 8);
        ctx.fillStyle = "#654548";
        ctx.fillRect(wall.x + 5, wall.y + 4, 7, 4);
        ctx.fillStyle = "#38292d";
        ctx.fillRect(wall.x + wall.w - 8, wall.y + wall.h - 6, 4, 3);
      }
    }
  }

  function drawTank(tank, enemy = false) {
    const x = Math.round(tank.x);
    const y = Math.round(tank.y);
    const body = enemy ? "#bd6045" : "#e6535b";
    const bodyDark = enemy ? "#7d4037" : "#982f3b";
    const trim = enemy ? "#e68a5b" : "#ff9b9d";
    ctx.save();
    ctx.translate(x, y);
    if (enemy && player && Math.hypot(player.x - x, player.y - y) < 70) {
      ctx.fillStyle = "rgba(228,105,66,.08)";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.rotate(tank.angle);
    ctx.fillStyle = "#211619";
    ctx.fillRect(-8, -9, 17, 4);
    ctx.fillRect(-8, 5, 17, 4);
    ctx.fillStyle = enemy ? "#593b32" : "#642d35";
    for (let tx = -6; tx <= 5; tx += 5) {
      ctx.fillRect(tx, -8, 2, 2);
      ctx.fillRect(tx, 6, 2, 2);
    }
    ctx.fillStyle = bodyDark;
    ctx.fillRect(-6, -6, 13, 12);
    ctx.fillStyle = body;
    ctx.fillRect(-5, -5, 11, 10);
    ctx.fillStyle = trim;
    ctx.fillRect(-3, -4, 5, 2);
    ctx.fillRect(-3, 2, 5, 2);
    ctx.fillStyle = bodyDark;
    ctx.fillRect(-1, -3, 7, 6);
    ctx.fillStyle = body;
    ctx.fillRect(0, -2, 7, 4);
    ctx.fillStyle = enemy ? "#d27751" : "#fa7378";
    ctx.fillRect(3, -1, 10, 2);
    ctx.fillStyle = enemy ? "#f0ac6d" : "#ffd0b5";
    ctx.fillRect(11, -1, 2, 2);
    ctx.restore();

    if (enemy && tank.health > 1) {
      ctx.fillStyle = "rgba(12,15,12,.8)";
      ctx.fillRect(x - 9, y - 14, 18, 3);
      ctx.fillStyle = "#f2545b";
      ctx.fillRect(x - 8, y - 13, 15, 1);
    }
  }

  function render() {
    ctx.save();
    ctx.scale(2, 2);
    drawBackground();
    for (const enemy of enemies) drawTank(enemy, true);
    if (player && (player.invulnerable <= 0 || Math.floor(elapsed * 12) % 2 === 0)) drawTank(player);

    for (const bullet of bullets) {
      ctx.fillStyle = bullet.enemy ? "#ff9b6b" : "#ffc0a8";
      ctx.fillRect(Math.round(bullet.x - 2), Math.round(bullet.y - 2), 4, 4);
      ctx.fillStyle = bullet.enemy ? "rgba(255,119,76,.28)" : "rgba(255,139,145,.35)";
      ctx.fillRect(Math.round(bullet.x - bullet.vx * .035), Math.round(bullet.y - bullet.vy * .035), 3, 3);
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life * 3);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    if (state === "playing") {
      ctx.strokeStyle = "rgba(255,100,111,.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pointer.x - 5, pointer.y);
      ctx.lineTo(pointer.x + 5, pointer.y);
      ctx.moveTo(pointer.x, pointer.y - 5);
      ctx.lineTo(pointer.x, pointer.y + 5);
      ctx.stroke();
    }
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,70,50,${hitFlash * .28})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    ctx.restore();
  }

  function frame(timestamp) {
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .04) : 0;
    lastFrame = timestamp;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function setPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) * WIDTH / rect.width;
    pointer.y = (event.clientY - rect.top) * HEIGHT / rect.height;
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      pauseIndicator.hidden = false;
      pauseButtonText.textContent = "RESUME";
      pauseButton.setAttribute("aria-label", "Lanjutkan permainan");
      arenaState.textContent = "PAUSED";
    } else if (state === "paused") {
      state = "playing";
      pauseIndicator.hidden = true;
      pauseButtonText.textContent = "PAUSE";
      pauseButton.setAttribute("aria-label", "Jeda permainan");
      arenaState.textContent = "ENGAGED";
    }
  }

  startButton.addEventListener("click", resetGame);
  pauseButton.addEventListener("click", togglePause);
  canvas.addEventListener("pointermove", setPointer);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 0) {
      setPointer(event);
      pointer.down = true;
      canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointerup", () => { pointer.down = false; });
  canvas.addEventListener("pointercancel", () => { pointer.down = false; });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    keys.add(key);
    if (key === "escape" || key === "p") togglePause();
    if (key === "enter" && state === "ready") resetGame();
    if (key === "enter" && state === "over") resetGame();
  });
  document.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => {
    keys.clear();
    pointer.down = false;
  });

  player = { x: 70, y: 150, angle: 0, radius: 8, invulnerable: 0 };
  updateHud();
  requestAnimationFrame(frame);
})();
