// === CONFIGURATION ===
const CONFIG = {
    GRID_SIZE: 15,
    CELL_SIZE: 40,
    WALL_CHANCE: 0.3,
    ENEMY_COUNT: 2,
    POWERUP_COUNT: 3,
    ADAPTATION_RATE: 0.15
};

// === GAME STATE ===
let game = {
    status: 'menu', // menu, playing, gameover
    level: 1,
    score: 0,
    health: 100,
    grid: [],
    player: { x: 1, y: 1, vx: 1, vy: 1 }, // vx/vy for smooth movement
    exit: { x: 13, y: 13 },
    enemies: [],
    powerups: [],
    particles: [],
    history: [],
    tickCount: 0,
    difficulty: 1,
    abilityCharge: 100
};

// === DOM ELEMENTS ===
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const elements = {
    startScreen: document.getElementById('start-screen'),
    helpScreen: document.getElementById('help-screen'),
    gameoverScreen: document.getElementById('gameover-screen'),
    gameInterface: document.getElementById('game-interface'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn'),
    helpBtn: document.getElementById('help-btn'),
    closeHelp: document.getElementById('close-help'),
    message: document.getElementById('message'),
    hpDisplay: document.getElementById('hp-display'),
    scoreDisplay: document.getElementById('score-display'),
    levelDisplay: document.getElementById('level-display'),
    finalScore: document.getElementById('final-score'),
    finalLevel: document.getElementById('final-level'),
    gameoverTitle: document.getElementById('gameover-title')
};

// === INITIALIZATION ===
window.addEventListener('load', init);

function init() {
    setupEventListeners();
    setupThemes();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function setupEventListeners() {
    // Menu
    elements.startBtn.addEventListener('click', startGame);
    elements.restartBtn.addEventListener('click', () => {
        hideOverlay(elements.gameoverScreen);
        startGame();
    });
    elements.helpBtn.addEventListener('click', () => showOverlay(elements.helpScreen));
    elements.closeHelp.addEventListener('click', () => hideOverlay(elements.helpScreen));

    // Keyboard
    document.addEventListener('keydown', handleKeyboard);

    // Mobile controls
    document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const dir = btn.dataset.dir;
            const moves = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
            if (moves[dir]) movePlayer(moves[dir][0], moves[dir][1]);
        });
    });

    const abilityBtn = document.getElementById('ability-btn');
    if (abilityBtn) {
        abilityBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            useAbility();
        });
    }
}

function setupThemes() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            document.body.setAttribute('data-theme', theme);
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function handleKeyboard(e) {
    if (game.status !== 'playing') return;

    const key = e.key.toLowerCase();

    // Movement
    if (key === 'w' || key === 'arrowup') movePlayer(0, -1);
    if (key === 's' || key === 'arrowdown') movePlayer(0, 1);
    if (key === 'a' || key === 'arrowleft') movePlayer(-1, 0);
    if (key === 'd' || key === 'arrowright') movePlayer(1, 0);

    // Ability
    if (key === ' ') {
        e.preventDefault();
        useAbility();
    }
}

// === GAME FLOW ===
function startGame() {
    hideOverlay(elements.startScreen);
    elements.gameInterface.style.display = 'flex';

    // Reset game state
    game.status = 'playing';
    game.health = 100;
    game.score = 0;
    game.level = 1;
    game.difficulty = 1;
    game.abilityCharge = 100;
    game.tickCount = 0;

    initLevel();
    updateUI();
    requestAnimationFrame(gameLoop);
}

function initLevel() {
    generateMaze();
    spawnPlayer();
    spawnExit();
    spawnEnemies();
    spawnPowerups();
    game.history = [];
    showMessage('LEVEL ' + game.level);
}

function gameLoop() {
    if (game.status !== 'playing') return;

    update();
    render();

    game.tickCount++;
    requestAnimationFrame(gameLoop);
}

function update() {
    // Smooth movement
    game.player.vx += (game.player.x - game.player.vx) * 0.25;
    game.player.vy += (game.player.y - game.player.vy) * 0.25;

    // Update enemies
    if (game.tickCount % 60 === 0) {
        game.enemies.forEach(updateEnemy);
    }

    // Smooth enemy movement
    game.enemies.forEach(e => {
        e.vx += (e.x - e.vx) * 0.1;
        e.vy += (e.y - e.vy) * 0.1;
    });

    // Check collisions
    checkCollisions();

    // Ability charge
    if (game.abilityCharge < 100) {
        game.abilityCharge = Math.min(100, game.abilityCharge + 0.3);
    }

    // Adapt maze
    if (game.tickCount % 200 === 0) {
        adaptMaze();
    }
}

// === MAZE GENERATION ===
function generateMaze() {
    game.grid = [];
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        const row = [];
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
            const isEdge = x === 0 || y === 0 || x === CONFIG.GRID_SIZE - 1 || y === CONFIG.GRID_SIZE - 1;
            row.push({
                type: isEdge ? 'wall' : (Math.random() < CONFIG.WALL_CHANCE ? 'wall' : 'empty'),
                adaptability: Math.random()
            });
        }
        game.grid.push(row);
    }

    // Ensure start and end are empty
    game.grid[1][1].type = 'empty';
    game.grid[CONFIG.GRID_SIZE - 2][CONFIG.GRID_SIZE - 2].type = 'empty';

    // Ensure path exists
    ensurePath();
}

function ensurePath() {
    let x = 1, y = 1;
    const ex = CONFIG.GRID_SIZE - 2;
    const ey = CONFIG.GRID_SIZE - 2;

    while (x !== ex || y !== ey) {
        game.grid[y][x].type = 'empty';
        if (Math.random() < 0.5 && x !== ex) {
            x += x < ex ? 1 : -1;
        } else if (y !== ey) {
            y += y < ey ? 1 : -1;
        }
    }
}

function adaptMaze() {
    for (let y = 1; y < CONFIG.GRID_SIZE - 1; y++) {
        for (let x = 1; x < CONFIG.GRID_SIZE - 1; x++) {
            const dist = Math.abs(x - game.player.x) + Math.abs(y - game.player.y);
            if (dist < 4) continue;

            if (Math.random() < 0.01) {
                const cell = game.grid[y][x];
                cell.type = cell.type === 'wall' ? 'empty' : 'wall';
            }
        }
    }
}

// === ENTITIES ===
function spawnPlayer() {
    game.player = { x: 1, y: 1, vx: 1, vy: 1 };
}

function spawnExit() {
    game.exit = { x: CONFIG.GRID_SIZE - 2, y: CONFIG.GRID_SIZE - 2 };
}

function spawnEnemies() {
    game.enemies = [];
    const count = CONFIG.ENEMY_COUNT + Math.floor(game.difficulty / 2);
    for (let i = 0; i < count; i++) {
        const pos = findEmptyCell();
        game.enemies.push({ x: pos.x, y: pos.y, vx: pos.x, vy: pos.y });
    }
}

function spawnPowerups() {
    game.powerups = [];
    for (let i = 0; i < CONFIG.POWERUP_COUNT; i++) {
        const pos = findEmptyCell();
        game.powerups.push({
            x: pos.x,
            y: pos.y,
            type: Math.random() < 0.5 ? 'health' : 'score'
        });
    }
}

function findEmptyCell() {
    let x, y, tries = 0;
    do {
        x = Math.floor(Math.random() * (CONFIG.GRID_SIZE - 2)) + 1;
        y = Math.floor(Math.random() * (CONFIG.GRID_SIZE - 2)) + 1;
        tries++;
    } while (game.grid[y][x].type !== 'empty' && tries < 100);
    return { x, y };
}

// === PLAYER ===
function movePlayer(dx, dy) {
    const newX = game.player.x + dx;
    const newY = game.player.y + dy;

    if (isValid(newX, newY)) {
        game.player.x = newX;
        game.player.y = newY;
        game.history.push({ dx, dy });
        if (game.history.length > 20) game.history.shift();

        // Check win
        if (newX === game.exit.x && newY === game.exit.y) {
            levelComplete();
        }
    }
}

function isValid(x, y) {
    return x >= 0 && x < CONFIG.GRID_SIZE &&
        y >= 0 && y < CONFIG.GRID_SIZE &&
        game.grid[y][x].type === 'empty';
}

// === ENEMIES ===
function updateEnemy(enemy) {
    const dx = Math.sign(game.player.x - enemy.x);
    const dy = Math.sign(game.player.y - enemy.y);

    if (Math.random() < 0.3) {
        const rdx = Math.random() < 0.5 ? 1 : -1;
        if (isValid(enemy.x + rdx, enemy.y)) {
            enemy.x += rdx;
            return;
        }
    }

    if (dx !== 0 && isValid(enemy.x + dx, enemy.y)) {
        enemy.x += dx;
    } else if (dy !== 0 && isValid(enemy.x, enemy.y + dy)) {
        enemy.y += dy;
    }
}

// === COLLISIONS ===
function checkCollisions() {
    // Powerups
    for (let i = game.powerups.length - 1; i >= 0; i--) {
        const p = game.powerups[i];
        if (Math.abs(p.x - game.player.vx) < 0.5 && Math.abs(p.y - game.player.vy) < 0.5) {
            if (p.type === 'health') {
                game.health = Math.min(100, game.health + 20);
                showMessage('+20 HP');
            } else {
                game.score += 100;
                showMessage('+100');
            }
            game.powerups.splice(i, 1);
            updateUI();
        }
    }

    // Enemies
    game.enemies.forEach(e => {
        const dist = Math.hypot(e.vx - game.player.vx, e.vy - game.player.vy);
        if (dist < 0.6) {
            game.health -= 0.5;
            if (game.health <= 0) {
                gameOver();
            }
            updateUI();
        }
    });
}

// === ABILITY ===
function useAbility() {
    if (game.abilityCharge >= 100) {
        game.abilityCharge = 0;
        showMessage('PULSE!');

        // Push enemies away
        game.enemies.forEach(e => {
            const dx = Math.sign(e.x - game.player.x);
            const dy = Math.sign(e.y - game.player.y);
            const newX = e.x + dx * 3;
            const newY = e.y + dy * 3;
            if (isValid(newX, newY)) {
                e.x = newX;
                e.y = newY;
            }
        });
    }
}

// === LEVEL/GAME END ===
function levelComplete() {
    game.level++;
    game.score += 500;
    game.difficulty += 0.5;
    showMessage('LEVEL COMPLETE!');
    setTimeout(() => {
        initLevel();
    }, 2000);
}

function gameOver() {
    game.status = 'gameover';
    elements.finalScore.textContent = Math.floor(game.score);
    elements.finalLevel.textContent = game.level;
    showOverlay(elements.gameoverScreen);
}

// === RENDERING ===
function resizeCanvas() {
    const container = document.querySelector('.game-area');
    const size = Math.min(container.clientWidth, container.clientHeight) - 20;
    canvas.width = size;
    canvas.height = size;
}

function render() {
    const size = canvas.width;
    const cellSize = size / CONFIG.GRID_SIZE;

    // Clear
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, size, size);

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CONFIG.GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(size, i * cellSize);
        ctx.stroke();
    }

    // Draw walls
    ctx.fillStyle = '#1a2a3a';
    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
            if (game.grid[y][x].type === 'wall') {
                ctx.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
            }
        }
    }

    // Draw exit
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
        game.exit.x * cellSize + cellSize / 2,
        game.exit.y * cellSize + cellSize / 2,
        cellSize / 3,
        0,
        Math.PI * 2
    );
    ctx.stroke();

    // Draw powerups
    game.powerups.forEach(p => {
        ctx.fillStyle = p.type === 'health' ? '#ff0055' : '#ffee00';
        ctx.beginPath();
        ctx.arc(
            p.x * cellSize + cellSize / 2,
            p.y * cellSize + cellSize / 2,
            cellSize / 5,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });

    // Draw enemies
    ctx.fillStyle = '#ff0055';
    game.enemies.forEach(e => {
        ctx.beginPath();
        ctx.arc(
            e.vx * cellSize + cellSize / 2,
            e.vy * cellSize + cellSize / 2,
            cellSize / 3,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });

    // Draw player
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(
        game.player.vx * cellSize + cellSize / 2,
        game.player.vy * cellSize + cellSize / 2,
        cellSize / 3,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// === UI ===
function updateUI() {
    elements.hpDisplay.textContent = Math.floor(game.health);
    elements.scoreDisplay.textContent = Math.floor(game.score);
    elements.levelDisplay.textContent = game.level;
}

function showMessage(text) {
    elements.message.textContent = text;
    elements.message.classList.add('show');
    setTimeout(() => {
        elements.message.classList.remove('show');
    }, 1500);
}

function showOverlay(el) {
    el.classList.add('active');
}

function hideOverlay(el) {
    el.classList.remove('active');
}
