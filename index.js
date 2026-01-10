// Adaptive Maze Escape - v4.0 Super Duper Edition
// index.js - Core Logic, Mobile, Themes, Abilities

// --- CONSTANTS & CONFIG ---
const CONFIG = {
    GRID_SIZE: 15,
    WALL_CHANCE: 0.3,
    ADAPTATION_RATE: 0.15,
    ABILITY_COOLDOWN: 300, // Frames (approx 5s)
    PARTICLE_LIMIT: 100
};

// --- GAME STATE ---
let gameState = {
    status: 'MENU',
    grid: [],

    player: {
        x: 1, y: 1, cx: 1, cy: 1,
        health: 100, score: 0,
        abilityCharge: CONFIG.ABILITY_COOLDOWN,
        history: []
    },

    exit: { x: 13, y: 13 },
    enemies: [],
    powerups: [],
    particles: [],

    level: 1,
    difficulty: 1,
    tickCount: 0,
    theme: 'cyberpunk'
};

let lastTime = 0;
let audioContext = null;

// --- INITIALIZATION ---
window.onload = () => {
    loadSettings();
    initUI();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(gameLoop);
};

function loadSettings() {
    const savedTheme = localStorage.getItem('adaptive-theme') || 'cyberpunk';
    setTheme(savedTheme);
}

function initUI() {
    // Menu
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('game-over-screen').classList.remove('active'); // Directly remove active
        document.getElementById('game-over-screen').classList.add('hidden');
        startGame();
    });

    // Help System
    const helpModal = document.getElementById('help-screen');
    const startScreen = document.getElementById('start-screen');

    document.getElementById('help-btn').addEventListener('click', () => helpModal.classList.add('active'));
    document.getElementById('ingame-help').addEventListener('click', () => {
        // Show start screen as "Pause/Settings" menu
        startScreen.classList.add('active');
        document.getElementById('start-btn').textContent = "RESUME";
    });

    document.getElementById('close-help-btn').addEventListener('click', () => {
        helpModal.classList.remove('active');
        helpModal.classList.add('hidden');
    });

    // Theme Switcher
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setTheme(e.target.dataset.theme);
        });
    });

    // Input Handling
    window.addEventListener('keydown', (e) => {
        if (gameState.status !== 'PLAYING') return;
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'arrowup') handleInput(0, -1);
        if (k === 's' || k === 'arrowdown') handleInput(0, 1);
        if (k === 'a' || k === 'arrowleft') handleInput(-1, 0);
        if (k === 'd' || k === 'arrowright') handleInput(1, 0);
        if (k === ' ' || k === 'enter') triggerAbility();
    });

    // Mobile Controls
    setupTouchButton('btn-up', 0, -1);
    setupTouchButton('btn-down', 0, 1);
    setupTouchButton('btn-left', -1, 0);
    setupTouchButton('btn-right', 1, 0);

    const abBtn = document.getElementById('btn-ability');
    if (abBtn) {
        abBtn.addEventListener('touchstart', (e) => { e.preventDefault(); triggerAbility(); });
    }
}

function setupTouchButton(id, dx, dy) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState.status === 'PLAYING') handleInput(dx, dy);
    });
}

function setTheme(theme) {
    gameState.theme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('adaptive-theme', theme);

    // Update active class
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function startGame() {
    initAudio();
    document.getElementById('start-screen').classList.remove('active');

    gameState.status = 'PLAYING';
    gameState.player.health = 100;
    gameState.player.abilityCharge = CONFIG.ABILITY_COOLDOWN;

    if (gameState.level === 1) { // Reset on full restart
        gameState.player.score = 0;
        gameState.difficulty = 1;
    }

    generateMaze();
    spawnEnemies();
    spawnPowerups();

    gameState.player.x = 1; gameState.player.y = 1;
    gameState.player.cx = 1; gameState.player.cy = 1;

    showMessage("SYSTEM ONLINE");
    updateHUD();
}

// --- CORE LOGIC ---

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (gameState.status === 'PLAYING') {
        update(deltaTime);
    }
    render();
    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    gameState.tickCount++;

    // Ability Recharge
    if (gameState.player.abilityCharge < CONFIG.ABILITY_COOLDOWN) {
        gameState.player.abilityCharge++;
    }

    // Smooth Player
    const p = gameState.player;
    p.cx += (p.x - p.cx) * 0.25;
    p.cy += (p.y - p.cy) * 0.25;

    // Enemy Logic
    if (gameState.tickCount % 60 === 0) updateEnemyTargets();

    gameState.enemies.forEach(en => {
        en.cx += (en.x - en.cx) * 0.08;
        en.cy += (en.y - en.cy) * 0.08;
    });

    checkCollisions();
    if (gameState.tickCount % 200 === 0) adaptMaze();
    updateParticles();
    updateHUD(); // For cooldown bar
}

function handleInput(dx, dy) {
    const targetX = gameState.player.x + dx;
    const targetY = gameState.player.y + dy;

    if (isValidMove(targetX, targetY)) {
        gameState.player.x = targetX;
        gameState.player.y = targetY;
        gameState.player.history.push({ dx, dy });
        if (gameState.player.history.length > 20) gameState.player.history.shift();

        playSound(200, 'square', 0.1);
        spawnParticles(gameState.player.cx, gameState.player.cy, 'move', 2);

        if (targetX === gameState.exit.x && targetY === gameState.exit.y) {
            handleLevelComplete();
        }
    } else {
        // Wall bump effect
        spawnParticles(targetX, targetY, 'wall', 3);
    }
}

function triggerAbility() {
    if (gameState.player.abilityCharge >= CONFIG.ABILITY_COOLDOWN) {
        // PULSE: Stun enemies and push them back
        gameState.player.abilityCharge = 0;
        showMessage("PULSE DISCHARGE!");
        playSound(500, 'sawtooth', 0.5);

        // Visual
        spawnParticles(gameState.player.cx, gameState.player.cy, 'ability', 40);

        // Logic: Push enemies away
        gameState.enemies.forEach(en => {
            const dx = Math.sign(en.x - gameState.player.x);
            const dy = Math.sign(en.y - gameState.player.y);
            const pushX = en.x + (dx * 3);
            const pushY = en.y + (dy * 3);

            // Clamp and check bounds
            if (isValidMove(Math.floor(pushX), Math.floor(pushY))) {
                en.x = Math.max(1, Math.min(CONFIG.GRID_SIZE - 2, Math.floor(pushX)));
                en.y = Math.max(1, Math.min(CONFIG.GRID_SIZE - 2, Math.floor(pushY)));
            }
        });
    } else {
        showMessage("ABILITY CHARGING...");
    }
}

function isValidMove(x, y) {
    return x >= 0 && x < CONFIG.GRID_SIZE &&
        y >= 0 && y < CONFIG.GRID_SIZE &&
        gameState.grid[y][x].type !== 'wall';
}

function checkCollisions() {
    // Powerups
    for (let i = gameState.powerups.length - 1; i >= 0; i--) {
        const p = gameState.powerups[i];
        const dist = Math.hypot(p.x - gameState.player.cx, p.y - gameState.player.cy);
        if (dist < 0.5) {
            if (p.type === 'health') {
                gameState.player.health = Math.min(100, gameState.player.health + 20);
                showMessage("INTEGRITY +20");
                playSound(600, 'sine', 0.2);
            } else {
                gameState.player.score += 100;
                showMessage("DATA +100");
                playSound(800, 'sine', 0.2);
            }
            spawnParticles(p.x, p.y, 'collect', 10);
            gameState.powerups.splice(i, 1);
        }
    }

    // Enemies
    gameState.enemies.forEach(en => {
        const dist = Math.hypot(en.cx - gameState.player.cx, en.cy - gameState.player.cy);
        if (dist < 0.6) {
            gameState.player.health -= 1;
            if (gameState.tickCount % 10 === 0) playSound(100, 'sawtooth', 0.1); // Damage sound
            if (gameState.player.health <= 0) handleGameOver();
        }
    });
}

// --- MAZE & AI --- (Kept similar but optimized)
function generateMaze() {
    gameState.grid = [];
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        let row = [];
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
            let isEdge = x === 0 || y === 0 || x === CONFIG.GRID_SIZE - 1 || y === CONFIG.GRID_SIZE - 1;
            row.push({
                type: isEdge ? 'wall' : (Math.random() < CONFIG.WALL_CHANCE ? 'wall' : 'empty'),
                adaptability: Math.random()
            });
        }
        gameState.grid.push(row);
    }

    gameState.grid[1][1].type = 'empty';
    const ex = CONFIG.GRID_SIZE - 2;
    const ey = CONFIG.GRID_SIZE - 2;
    gameState.exit = { x: ex, y: ey };
    gameState.grid[ey][ex].type = 'empty';

    ensurePath(1, 1, ex, ey);
}

function ensurePath(x1, y1, x2, y2) {
    let curX = x1, curY = y1;
    gameState.grid[curY][curX].type = 'empty';
    while (curX !== x2 || curY !== y2) {
        if (Math.random() > 0.5) curX += (curX < x2) ? 1 : -1;
        else curY += (curY < y2) ? 1 : -1;
        curX = Math.max(1, Math.min(CONFIG.GRID_SIZE - 2, curX));
        curY = Math.max(1, Math.min(CONFIG.GRID_SIZE - 2, curY));
        gameState.grid[curY][curX].type = 'empty';
    }
}

function adaptMaze() {
    // Dynamic changes
    for (let y = 1; y < CONFIG.GRID_SIZE - 1; y++) {
        for (let x = 1; x < CONFIG.GRID_SIZE - 1; x++) {
            let dist = Math.abs(x - gameState.player.x) + Math.abs(y - gameState.player.y);
            if (dist < 4) continue;
            if (Math.random() < 0.01) {
                const cell = gameState.grid[y][x];
                cell.type = cell.type === 'wall' ? 'empty' : 'wall';
                spawnParticles(x, y, 'build', 4);
            }
        }
    }
}

function spawnEnemies() {
    gameState.enemies = [];
    for (let i = 0; i < 3 + Math.floor(gameState.difficulty / 2); i++) {
        let pos = findFreeCell();
        gameState.enemies.push({ x: pos.x, y: pos.y, cx: pos.x, cy: pos.y });
    }
}

function updateEnemyTargets() {
    gameState.enemies.forEach(en => {
        let dx = Math.sign(gameState.player.x - en.x);
        let dy = Math.sign(gameState.player.y - en.y);
        if (Math.random() < 0.3) { dx = Math.random() < 0.5 ? 1 : -1; }

        if (dx !== 0 && isValidMove(en.x + dx, en.y)) en.x += dx;
        else if (dy !== 0 && isValidMove(en.x, en.y + dy)) en.y += dy;
    });
}

function findFreeCell() {
    let x, y, tries = 0;
    do {
        x = Math.floor(Math.random() * (CONFIG.GRID_SIZE - 2)) + 1;
        y = Math.floor(Math.random() * (CONFIG.GRID_SIZE - 2)) + 1;
        tries++;
    } while (gameState.grid[y][x].type === 'wall' && tries < 100);
    return { x, y };
}

function spawnPowerups() {
    gameState.powerups = [];
    for (let i = 0; i < 3; i++) {
        let pos = findFreeCell();
        gameState.powerups.push({ x: pos.x, y: pos.y, type: Math.random() > 0.5 ? 'health' : 'score' });
    }
}

function handleLevelComplete() {
    gameState.level++;
    gameState.player.score += 500;
    gameState.difficulty += 0.5;
    playSound(1000, 'triangle', 0.5);
    showMessage("SECTOR SECURED", 2000);
    spawnParticles(gameState.exit.x, gameState.exit.y, 'victory', 60);
    setTimeout(startGame, 2000);
}

function handleGameOver() {
    gameState.status = 'GAMEOVER';
    document.getElementById('final-score').textContent = Math.floor(gameState.player.score);
    document.getElementById('final-level').textContent = gameState.level;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('active');
}

// --- PARTICLES & AUDIO ---
class Particle {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.life = 1.0;
        const speed = Math.random() * 0.15;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = Math.random() * 0.5 + 0.1;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life -= 0.03; }
}

function spawnParticles(x, y, type, count) {
    for (let i = 0; i < count; i++) gameState.particles.push(new Particle(x + 0.5, y + 0.5, type));
    if (gameState.particles.length > CONFIG.PARTICLE_LIMIT) gameState.particles.splice(0, gameState.particles.length - CONFIG.PARTICLE_LIMIT);
}

function updateParticles() {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.update();
        if (p.life <= 0) gameState.particles.splice(i, 1);
    }
}

function initAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(freq, type, vol) {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, audioContext.currentTime + 0.1);
    gain.gain.setValueAtTime(vol, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.1);
}

// --- RENDERING ---
function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const wrapper = document.querySelector('.canvas-wrapper');
    const size = Math.min(wrapper.clientWidth, wrapper.clientHeight) - 10;
    canvas.width = size;
    canvas.height = size;
}

function render() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cellSize = size / CONFIG.GRID_SIZE;

    // Clear
    ctx.clearRect(0, 0, size, size);

    if (gameState.status === 'MENU' || !gameState.grid.length) return;

    // Grid rendering (Walls)
    // Style depends on theme slightly, handled by CSS mostly but colors here:
    // We can pull colors from CSS variables if we want perfection, but hardcoded fallback is robust
    let wallColor = '#0f2438';
    let wallStroke = '#00f3ff';
    if (gameState.theme === 'arcade') { wallColor = '#57606f'; wallStroke = '#2f3542'; }
    if (gameState.theme === 'noir') { wallColor = '#333'; wallStroke = '#ddd'; }

    ctx.fillStyle = wallColor;
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
            if (gameState.grid[y][x].type === 'wall') {
                const px = x * cellSize;
                const py = y * cellSize;
                ctx.fillStyle = wallColor;
                ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

                if (gameState.theme !== 'arcade') { // Minimal detail for arcade
                    ctx.strokeStyle = wallStroke;
                    ctx.globalAlpha = 0.3;
                    ctx.strokeRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
                    ctx.globalAlpha = 1.0;
                }
            }
        }
    }

    // Entities
    renderEntities(ctx, cellSize);
}

function renderEntities(ctx, cellSize) {
    // Powerups
    gameState.powerups.forEach(p => {
        const px = p.x * cellSize + cellSize / 2;
        const py = p.y * cellSize + cellSize / 2;
        ctx.fillStyle = p.type === 'health' ? '#ff0055' : '#ffee00';
        ctx.beginPath(); ctx.arc(px, py, cellSize / 5, 0, Math.PI * 2); ctx.fill();
    });

    // Exit
    const ex = gameState.exit.x * cellSize + cellSize / 2;
    const ey = gameState.exit.y * cellSize + cellSize / 2;
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, cellSize / 3 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2); ctx.stroke();

    // Enemies
    gameState.enemies.forEach(en => {
        const px = en.cx * cellSize + cellSize / 2;
        const py = en.cy * cellSize + cellSize / 2;
        ctx.fillStyle = '#ffae00';
        if (gameState.theme === 'noir') ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(px, py - cellSize / 3);
        ctx.lineTo(px + cellSize / 3, py);
        ctx.lineTo(px, py + cellSize / 3);
        ctx.lineTo(px - cellSize / 3, py);
        ctx.fill();
    });

    // Player
    const plX = gameState.player.cx * cellSize + cellSize / 2;
    const plY = gameState.player.cy * cellSize + cellSize / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(plX, plY, cellSize / 3.5, 0, Math.PI * 2); ctx.fill();

    // Ability Pulse Visual
    if (gameState.player.abilityCharge < CONFIG.ABILITY_COOLDOWN) {
        ctx.strokeStyle = '#bd00ff';
        ctx.beginPath();
        ctx.arc(plX, plY, (cellSize / 2) * (gameState.player.abilityCharge / CONFIG.ABILITY_COOLDOWN), 0, Math.PI * 2);
        ctx.stroke();
    } else {
        ctx.strokeStyle = '#bd00ff';
        ctx.beginPath(); ctx.arc(plX, plY, cellSize / 2 + Math.sin(Date.now() / 100) * 2, 0, Math.PI * 2); ctx.stroke();
    }

    // Particles
    gameState.particles.forEach(p => {
        const px = p.x * cellSize;
        const py = p.y * cellSize;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = '#00f3ff';
        if (p.type === 'ability') ctx.fillStyle = '#bd00ff';
        if (p.type === 'collect') ctx.fillStyle = '#ffee00';
        ctx.fillRect(px, py, p.size * cellSize, p.size * cellSize);
    });
    ctx.globalAlpha = 1.0;
}

function updateHUD() {
    document.getElementById('score-value').textContent = Math.floor(gameState.player.score);
    document.getElementById('health-value').textContent = Math.floor(gameState.player.health);
    document.getElementById('level-value').textContent = gameState.level;
    const hpBar = document.getElementById('health-bar');
    if (hpBar) hpBar.style.width = Math.max(0, gameState.player.health) + '%';

    // Ability Bar
    const abBar = document.getElementById('ability-bar');
    const abText = document.getElementById('ability-status');
    const chargePct = (gameState.player.abilityCharge / CONFIG.ABILITY_COOLDOWN) * 100;
    if (abBar) abBar.style.width = chargePct + '%';
    if (abText) abText.textContent = chargePct >= 100 ? 'READY' : 'CHARGING';
}

function showMessage(text, duration = 1500) {
    const msg = document.getElementById('message');
    msg.textContent = Text = text;
    msg.classList.remove('hidden');
    msg.style.opacity = 1;
    setTimeout(() => { msg.classList.add('hidden'); }, duration);
}
