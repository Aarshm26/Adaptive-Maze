// Adaptive Maze Escape - Premium Version
// index.js - Core Logic, Physics & Rendering

// --- CONSTANTS & CONFIG ---
const CONFIG = {
    GRID_SIZE: 15,
    CELL_BASE_SIZE: 40, // Base calculation size
    WALL_CHANCE: 0.3,
    POWERUP_CHANCE: 0.05,
    ENEMY_COUNT: 2,
    ADAPTATION_RATE: 0.15,
    PLAYER_SPEED: 0.15, // Grid units per frame (lerp factor)
    ENEMY_SPEED: 0.08,
    PARTICLE_LIMIT: 100
};

// --- GAME STATE ---
let gameState = {
    status: 'MENU', // MENU, PLAYING, GAMEOVER, VICTORY
    grid: [],

    // Entities (positions are floating point for smooth movement)
    player: {
        x: 1, y: 1, // Target grid position
        cx: 1, cy: 1, // Current visual position
        health: 100,
        score: 0,
        history: [] // For adaptation logic
    },

    exit: { x: 13, y: 13 },
    enemies: [],
    powerups: [],
    particles: [],

    level: 1,
    difficulty: 1,
    tickCount: 0,

    // Input
    keys: { Up: false, Down: false, Left: false, Right: false }
};

let gameLoopId;
let lastTime = 0;

// --- INITIALIZATION ---
window.onload = () => {
    initUI();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(gameLoop);
};

function initUI() {
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');

    startBtn.addEventListener('click', () => {
        document.getElementById('start-screen').classList.remove('active');
        startGame();
    });

    restartBtn.addEventListener('click', () => {
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.remove('active'); // Ensure active is removed
        startGame();
    });

    // Input Handling
    window.addEventListener('keydown', (e) => {
        if (gameState.status !== 'PLAYING') return;
        const k = e.key;
        if (k === 'w' || k === 'ArrowUp') handleInput(0, -1);
        if (k === 's' || k === 'ArrowDown') handleInput(0, 1);
        if (k === 'a' || k === 'ArrowLeft') handleInput(-1, 0);
        if (k === 'd' || k === 'ArrowRight') handleInput(1, 0);
    });
}

function startGame() {
    gameState.status = 'PLAYING';
    gameState.player.health = 100;

    // Keep score if coming from victory, else reset
    if (gameState.status === 'GAMEOVER' || gameState.level === 1) {
        gameState.player.score = 0;
        gameState.level = 1;
        gameState.difficulty = 1;
    }

    generateMaze();
    spawnEnemies();
    spawnPowerups();

    // Reset Player Position
    gameState.player.x = 1; gameState.player.y = 1;
    gameState.player.cx = 1; gameState.player.cy = 1;

    showMessage("SEQUENCE INITIALIZED");
    updateHUD();
}

// --- CORE GAME LOGIC ---

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

    // 1. Smooth Player Movement
    const p = gameState.player;
    p.cx += (p.x - p.cx) * 0.2; // Lerp
    p.cy += (p.y - p.cy) * 0.2;

    // 2. Enemy Logic (Tick based for fairness, movement lerped)
    if (gameState.tickCount % 60 === 0) { // Slower strategic updates
        updateEnemyTargets();
    }
    moveEnemiesSmoothly();

    // 3. Collisions & Interactions
    checkCollisions();

    // 4. Adaptation (The "AISimulation" part)
    if (gameState.tickCount % 200 === 0) adaptMaze(); // Every few seconds

    // 5. Particles
    updateParticles();
}

function handleInput(dx, dy) {
    const targetX = gameState.player.x + dx;
    const targetY = gameState.player.y + dy;

    if (isValidMove(targetX, targetY)) {
        gameState.player.x = targetX;
        gameState.player.y = targetY;
        gameState.player.history.push({ dx, dy });
        if (gameState.player.history.length > 20) gameState.player.history.shift();

        // Spawn walk particles
        playSoundEffect('step');
        spawnParticles(gameState.player.cx, gameState.player.cy, 'move', 3);

        // Check Exit
        if (targetX === gameState.exit.x && targetY === gameState.exit.y) {
            handleLevelComplete();
        }
    }
}

function isValidMove(x, y) {
    return x >= 0 && x < CONFIG.GRID_SIZE &&
        y >= 0 && y < CONFIG.GRID_SIZE &&
        gameState.grid[y][x].type !== 'wall';
}

function handleLevelComplete() {
    gameState.status = 'VICTORY';
    gameState.level++;
    gameState.player.score += 500;
    gameState.difficulty += 0.5;
    showMessage("SECTOR SECURED", 2000);
    spawnParticles(gameState.exit.x, gameState.exit.y, 'victory', 50);
    setTimeout(startGame, 2000);
}

function handleGameOver() {
    gameState.status = 'GAMEOVER';
    document.getElementById('final-score').textContent = Math.floor(gameState.player.score);
    document.getElementById('final-level').textContent = gameState.level;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('active'); // Ensure class is added
}

// --- MAZE GENERATION & ADAPTATION ---

function generateMaze() {
    // 1. Init Grid
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

    // 2. Ensure Start & End are clear
    gameState.grid[1][1].type = 'empty';
    const ex = CONFIG.GRID_SIZE - 2;
    const ey = CONFIG.GRID_SIZE - 2;
    gameState.exit = { x: ex, y: ey };
    gameState.grid[ey][ex].type = 'empty';

    // 3. Ensure Solvability
    ensurePath(1, 1, ex, ey);
}

function ensurePath(x1, y1, x2, y2) {
    // Basic Digger if path doesn't exist
    // For simplicity in this robust version, we'll force a random walk path carve
    let curX = x1, curY = y1;
    gameState.grid[curY][curX].type = 'empty';

    while (curX !== x2 || curY !== y2) {
        if (Math.random() > 0.5) {
            curX += (curX < x2) ? 1 : -1;
        } else {
            curY += (curY < y2) ? 1 : -1;
        }
        // Clamp
        curX = Math.max(1, Math.min(CONFIG.GRID_SIZE - 2, curX));
        curY = Math.max(1, Math.min(CONFIG.GRID_SIZE - 2, curY));
        gameState.grid[curY][curX].type = 'empty';
    }
}

function adaptMaze() {
    // Dynamic Difficulty Adjustment logic
    // Add walls behind player, remove walls in front if stuck

    // Simple adaptation: Randomly flip adaptable cells far from player
    for (let y = 1; y < CONFIG.GRID_SIZE - 1; y++) {
        for (let x = 1; x < CONFIG.GRID_SIZE - 1; x++) {
            // Dist check
            let dist = Math.abs(x - gameState.player.x) + Math.abs(y - gameState.player.y);
            if (dist < 4) continue; // Don't change immediate vicinity

            if (Math.random() < 0.01) { // Low chance per tick
                const cell = gameState.grid[y][x];
                // Toggle
                const newType = cell.type === 'wall' ? 'empty' : 'wall';
                cell.type = newType;

                // Visual Effect
                spawnParticles(x, y, newType === 'wall' ? 'build' : 'break', 5);
            }
        }
    }
    // Re-ensure path occasionally would be expensive, so we just trust the randomness or
    // implemented A* validation if movement fails consistently (omitted for perf/code size balance)
}

// --- ENTITIES & AI ---

function spawnEnemies() {
    gameState.enemies = [];
    for (let i = 0; i < CONFIG.ENEMY_COUNT + Math.floor(gameState.difficulty / 2); i++) {
        let pos = findFreeCell();
        gameState.enemies.push({
            x: pos.x, y: pos.y, // Target
            cx: pos.x, cy: pos.y, // Current
            path: []
        });
    }
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

function updateEnemyTargets() {
    // Simple A* or heavy logic can go here. 
    // For this arcade feel, they move towards player with slight randomness
    gameState.enemies.forEach(en => {
        let dx = Math.sign(gameState.player.x - en.x);
        let dy = Math.sign(gameState.player.y - en.y);

        // Randomize to avoid getting stuck or stacking
        if (Math.random() < 0.2) {
            dx = Math.random() < 0.5 ? 1 : -1;
            dy = Math.random() < 0.5 ? 1 : -1;
        }

        // Try move X
        if (dx !== 0 && isValidMove(en.x + dx, en.y)) {
            en.x += dx;
        }
        // Else Try move Y
        else if (dy !== 0 && isValidMove(en.x, en.y + dy)) {
            en.y += dy;
        }
    });
}

function moveEnemiesSmoothly() {
    gameState.enemies.forEach(en => {
        en.cx += (en.x - en.cx) * 0.05; // Slower lerp than player
        en.cy += (en.y - en.cy) * 0.05;
    });
}

function spawnPowerups() {
    gameState.powerups = [];
    const count = 3;
    for (let i = 0; i < count; i++) {
        let pos = findFreeCell();
        gameState.powerups.push({
            x: pos.x, y: pos.y,
            type: Math.random() > 0.5 ? 'health' : 'score'
        });
    }
}

function checkCollisions() {
    // Powerups
    for (let i = gameState.powerups.length - 1; i >= 0; i--) {
        const p = gameState.powerups[i];
        const dist = Math.hypot(p.x - gameState.player.cx, p.y - gameState.player.cy);
        if (dist < 0.5) {
            // Collect
            if (p.type === 'health') {
                gameState.player.health = Math.min(100, gameState.player.health + 20);
                showMessage("INTEGRITY RESTORED");
            } else {
                gameState.player.score += 100;
                showMessage("DATA ACQUIRED");
            }
            spawnParticles(p.x, p.y, 'collect', 10);
            gameState.powerups.splice(i, 1);
            updateHUD();
        }
    }

    // Enemies
    gameState.enemies.forEach(en => {
        const dist = Math.hypot(en.cx - gameState.player.cx, en.cy - gameState.player.cy);
        if (dist < 0.6) {
            gameState.player.health -= 1; // Continuous damage
            // Push back slightly?
            updateHUD();
            if (gameState.player.health <= 0) handleGameOver();
        }
    });
}

// --- PARTICLES ---

class Particle {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.life = 1.0;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = Math.random() * 0.4 + 0.1;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.02;
    }
}

function spawnParticles(x, y, type, count) {
    for (let i = 0; i < count; i++) {
        gameState.particles.push(new Particle(x + 0.5, y + 0.5, type));
    }
    if (gameState.particles.length > CONFIG.PARTICLE_LIMIT) {
        gameState.particles.splice(0, gameState.particles.length - CONFIG.PARTICLE_LIMIT);
    }
}

function updateParticles() {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.update();
        if (p.life <= 0) gameState.particles.splice(i, 1);
    }
}

// --- RENDERING ---

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const wrapper = document.querySelector('.canvas-wrapper');
    const size = Math.min(wrapper.clientWidth, wrapper.clientHeight) - 20;
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

    // 1. Walls
    ctx.fillStyle = '#0b1621'; // Wall base
    ctx.shadowBlur = 0;
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
            if (gameState.grid[y][x].type === 'wall') {
                const px = x * cellSize;
                const py = y * cellSize;

                // Tech Wall look
                ctx.fillStyle = '#0f2438';
                ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

                // Inner highlight
                ctx.strokeStyle = '#00f3ff';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.3;
                ctx.strokeRect(px + 4, py + 4, cellSize - 8, cellSize - 8);
                ctx.globalAlpha = 1.0;
            }
        }
    }

    // 2. Powerups
    gameState.powerups.forEach(p => {
        const px = p.x * cellSize + cellSize / 2;
        const py = p.y * cellSize + cellSize / 2;
        ctx.fillStyle = p.type === 'health' ? '#ff0055' : '#ffee00';
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(px, py, cellSize / 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // 3. Exit
    const ex = gameState.exit.x * cellSize + cellSize / 2;
    const ey = gameState.exit.y * cellSize + cellSize / 2;
    const pulse = Math.sin(Date.now() / 200) * 3;
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, (cellSize / 3) + pulse, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Enemies
    gameState.enemies.forEach(en => {
        const px = en.cx * cellSize + cellSize / 2;
        const py = en.cy * cellSize + cellSize / 2;
        ctx.fillStyle = '#ffae00';
        ctx.beginPath();
        ctx.moveTo(px, py - cellSize / 3);
        ctx.lineTo(px + cellSize / 3, py);
        ctx.lineTo(px, py + cellSize / 3);
        ctx.lineTo(px - cellSize / 3, py);
        ctx.fill();
    });

    // 5. Player
    const plX = gameState.player.cx * cellSize + cellSize / 2;
    const plY = gameState.player.cy * cellSize + cellSize / 2;

    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f3ff';
    ctx.beginPath();
    ctx.arc(plX, plY, cellSize / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. Particles
    gameState.particles.forEach(p => {
        const px = p.x * cellSize;
        const py = p.y * cellSize;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.type === 'move' ? '#00f3ff' : '#ff0055';
        ctx.fillRect(px, py, p.size * cellSize, p.size * cellSize);
    });
    ctx.globalAlpha = 1.0;
}

// --- UTILS ---

function updateHUD() {
    document.getElementById('score-value').textContent = Math.floor(gameState.player.score);
    document.getElementById('health-value').textContent = Math.floor(gameState.player.health);
    document.getElementById('level-value').textContent = gameState.level;
    const bar = document.getElementById('health-bar');
    if (bar) bar.style.width = Math.max(0, gameState.player.health) + '%';
}

function showMessage(text, duration = 1500) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.classList.remove('hidden');
    msg.style.width = 'auto'; // Reset width
    msg.style.overflow = 'visible'; // Reset overflow
    setTimeout(() => { msg.classList.add('hidden'); }, duration);
}

// Mock Sound (Browser policy usually blocks audio without interaction, keeping it silent or placeholder)
function playSoundEffect(type) {
    // Ideally use WebAudio API here
}
