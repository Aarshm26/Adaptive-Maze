// === ADAPTIVE MAZE v6.1 - Final Polish ===

// === CONFIGURATION ===
const CONFIG = {
    GRID_SIZE: 15,
    CELL_SIZE: 40,
    WALL_CHANCE: 0.3,
    ENEMY_BASE_COUNT: 2,
    POWERUP_COUNT: 3,
    ADAPTATION_RATE: 0.15,
    ENEMY_ATTACK_DAMAGE: 10,
    COMBO_TIMEOUT: 3000
};

// === GAME STATE ===
let game = {
    status: 'menu',
    level: 1,
    score: 0,
    highScore: localStorage.getItem('adapt_high_score') || 0,
    health: 100,
    abilityCharge: 100,
    combo: 1,
    maxCombo: 1,
    comboTimer: null,
    grid: [],
    player: { x: 1, y: 1, vx: 1, vy: 1 },
    exit: { x: 13, y: 13 },
    enemies: [],
    powerups: [],
    particles: [],
    history: [],
    tickCount: 0,
    difficulty: 1,
    inLevelTransition: false,
    soundEnabled: true,
    paused: false,
    debugMode: false,
    fps: 0,
    lastTick: performance.now(),
    lastHudUpdate: performance.now(),
    nodesSearched: 0
};

// === DOM ELEMENTS ===
let canvas, ctx, minimap, minimapCtx, elements, currentTheme = 'cyberpunk';

// === IMPROVED AUDIO ===
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Improved audio with better waveforms and envelopes
function playSound(type, volume = 0.2) {
    if (!game.soundEnabled || !audioCtx) return;

    const sounds = {
        move: () => playTone(300, 'sine', 0.05, volume * 0.3),
        collect: () => playMelody([400, 600, 800], 0.1, volume * 0.4),
        damage: () => playNoise(0.15, volume * 0.3),
        pulse: () => playPulseSound(volume * 0.5),
        levelComplete: () => playMelody([600, 700, 800, 1000], 0.15, volume * 0.6),
        gameOver: () => playDescending([400, 300, 200, 100], 0.2, volume * 0.4),
        combo: () => playMelody([800, 1000, 1200], 0.08, volume * 0.5)
    };

    if (sounds[type]) sounds[type]();
}

function playTone(freq, type, duration, volume) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playMelody(notes, noteDuration, volume) {
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'sine', noteDuration, volume), i * noteDuration * 800);
    });
}

function playDescending(notes, noteDuration, volume) {
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'triangle', noteDuration, volume * 0.7), i * noteDuration * 600);
    });
}

function playNoise(duration, volume) {
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    noise.buffer = buffer;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start();
}

function playPulseSound(volume) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

// === INITIALIZATION ===
window.addEventListener('load', init);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
    });
}

function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    minimap = document.getElementById('minimap');
    minimapCtx = minimap.getContext('2d');

    elements = {
        startScreen: document.getElementById('start-screen'),
        helpScreen: document.getElementById('help-screen'),
        gameoverScreen: document.getElementById('gameover-screen'),
        gameInterface: document.getElementById('game-interface'),
        message: document.getElementById('message'),
        comboPopup: document.getElementById('combo-popup'),
        pulseEffect: document.getElementById('pulse-effect'),
        hpDisplay: document.getElementById('hp-display'),
        scoreDisplay: document.getElementById('score-display'),
        levelDisplay: document.getElementById('level-display'),
        abilityDisplay: document.getElementById('ability-display'),
        comboDisplay: document.getElementById('combo-display'),
        hpBar: document.getElementById('hp-bar'),
        abilityBar: document.getElementById('ability-bar'),
        finalCombo: document.getElementById('final-combo'),
        gameoverTitle: document.getElementById('gameover-title'),
        highscoreDisplay: document.getElementById('highscore-display'),
        techHud: document.getElementById('technical-hud'),
        techFps: document.getElementById('tech-fps'),
        techSearch: document.getElementById('tech-search'),
        techEntities: document.getElementById('tech-entities')
    };

    // Ensure HUD matches initial state
    elements.techHud.style.display = game.debugMode ? 'block' : 'none';

    setupEventListeners();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function setupEventListeners() {
    // Menu
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', () => {
        hideOverlay(elements.gameoverScreen);
        startGame();
    });

    // Help
    document.getElementById('menu-help-btn').addEventListener('click', () => showOverlay(elements.helpScreen));
    document.getElementById('close-help').addEventListener('click', () => hideOverlay(elements.helpScreen));

    // Settings - PAUSE GAME
    document.getElementById('settings-btn').addEventListener('click', () => {
        game.paused = true;
        showOverlay(elements.startScreen);
    });

    // Debug toggle
    document.getElementById('debug-btn').addEventListener('click', () => {
        game.debugMode = !game.debugMode;
        elements.techHud.style.display = game.debugMode ? 'block' : 'none';
        playSound('move');
    });

    // Sound toggle
    document.getElementById('sound-toggle').addEventListener('click', (e) => {
        game.soundEnabled = !game.soundEnabled;
        e.target.textContent = game.soundEnabled ? '🔊' : '🔇';
        playSound('move');
    });

    // Theme switcher
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            changeTheme(btn.dataset.theme);
            playSound('move');
        });
    });

    // Keyboard
    document.addEventListener('keydown', handleKeyboard);

    // Mobile controls
    document.querySelectorAll('.dpad-btn').forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const moves = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
            const dir = moves[btn.dataset.dir];
            if (dir && game.status === 'playing' && !game.paused) movePlayer(dir[0], dir[1]);
        });
    });

    const mobileAbility = document.getElementById('mobile-ability');
    if (mobileAbility) {
        mobileAbility.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (game.status === 'playing' && !game.paused) useAbility();
        });
    }
}

function changeTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-theme="${theme}"]`).classList.add('active');
}

function handleKeyboard(e) {
    if (game.status !== 'playing' || game.paused) return;

    const key = e.key.toLowerCase();

    if (key === 'w' || key === 'arrowup') { e.preventDefault(); movePlayer(0, -1); }
    if (key === 's' || key === 'arrowdown') { e.preventDefault(); movePlayer(0, 1); }
    if (key === 'a' || key === 'arrowleft') { e.preventDefault(); movePlayer(-1, 0); }
    if (key === 'd' || key === 'arrowright') { e.preventDefault(); movePlayer(1, 0); }
    if (key === ' ') { e.preventDefault(); useAbility(); }
}

// === GAME FLOW ===
function startGame() {
    initAudio();
    hideOverlay(elements.startScreen);
    elements.gameInterface.style.display = 'flex';

    game.status = 'playing';
    game.paused = false; // UNPAUSE when starting
    game.health = 100;
    game.score = 0;
    game.level = 1;
    game.difficulty = 1;
    game.abilityCharge = 100;
    game.combo = 1;
    game.maxCombo = 1;
    game.tickCount = 0;
    game.inLevelTransition = false;

    initLevel();
    playSound('levelComplete');
    updateUI();
}

function initLevel() {
    game.inLevelTransition = false;
    generateMaze();
    spawnPlayer();
    spawnExit();
    spawnEnemies();
    spawnPowerups();
    game.history = [];
    game.particles = [];
    showMessage('SECTOR ' + game.level);
}

let lastFrameTime = 0;
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (game.status === 'playing' && !game.paused) {
        update();
    }

    render();
    renderMinimap();

    updateTechnicalHUD();
    updateUI();

    if (game.status === 'playing' && !game.paused) {
        game.tickCount++;
    }
    requestAnimationFrame(gameLoop);
}

// Start the animation loop immediately on load
window.addEventListener('load', () => {
    requestAnimationFrame(gameLoop);
});

function update() {
    // Smooth movement
    game.player.vx += (game.player.x - game.player.vx) * 0.25;
    game.player.vy += (game.player.y - game.player.vy) * 0.25;

    // Update enemies with A* pathfinding
    if (game.tickCount % 30 === 0) {
        game.enemies.forEach(updateEnemyAI);
    }

    // Smooth enemy movement
    game.enemies.forEach(e => {
        e.vx += (e.x - e.vx) * 0.15;
        e.vy += (e.y - e.vy) * 0.15;
    });

    // Check collisions
    checkCollisions();

    // Ability charge
    if (game.abilityCharge < 100) {
        game.abilityCharge = Math.min(100, game.abilityCharge + 0.5);
    }

    // Adapt maze
    if (game.tickCount % 150 === 0) {
        adaptMaze();
    }

    // Update particles
    updateParticles();
}

// === A* PATHFINDING ===
function aStarPath(start, goal) {
    const openSet = [{ ...start, g: 0, h: heuristic(start, goal), f: heuristic(start, goal), parent: null }];
    const closedSet = [];

    function heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    while (openSet.length > 0) {
        let currentIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < openSet[currentIndex].f) {
                currentIndex = i;
            }
        }
        const current = openSet[currentIndex];

        if (current.x === goal.x && current.y === goal.y) {
            const path = [];
            let temp = current;
            while (temp.parent) {
                path.unshift({ x: temp.x, y: temp.y });
                temp = temp.parent;
            }
            return path;
        }

        openSet.splice(currentIndex, 1);
        closedSet.push(current);
        game.nodesSearched++; // Track technical metric

        const neighbors = [
            { x: current.x + 1, y: current.y },
            { x: current.x - 1, y: current.y },
            { x: current.x, y: current.y + 1 },
            { x: current.x, y: current.y - 1 }
        ];

        for (const neighbor of neighbors) {
            if (!isValid(neighbor.x, neighbor.y)) continue;
            if (closedSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) continue;

            const g = current.g + 1;
            const h = heuristic(neighbor, goal);
            const f = g + h;

            const existingOpen = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
            if (existingOpen) {
                if (g < existingOpen.g) {
                    existingOpen.g = g;
                    existingOpen.f = f;
                    existingOpen.parent = current;
                }
            } else {
                openSet.push({ ...neighbor, g, h, f, parent: current });
            }
        }

        if (closedSet.length > 200) break;
    }

    return [];
}

function updateEnemyAI(enemy) {
    const path = aStarPath({ x: enemy.x, y: enemy.y }, { x: game.player.x, y: game.player.y });

    if (path.length > 0) {
        const next = path[0];
        enemy.x = next.x;
        enemy.y = next.y;
        enemy.intelligence = Math.min(0.95, (enemy.intelligence || 0.5) + 0.01);
    } else {
        const dx = Math.sign(game.player.x - enemy.x);
        const dy = Math.sign(game.player.y - enemy.y);

        if (Math.abs(dx) > Math.abs(dy) && isValid(enemy.x + dx, enemy.y)) {
            enemy.x += dx;
        } else if (isValid(enemy.x, enemy.y + dy)) {
            enemy.y += dy;
        }
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

    game.grid[1][1].type = 'empty';
    game.grid[CONFIG.GRID_SIZE - 2][CONFIG.GRID_SIZE - 2].type = 'empty';

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
            if (x === game.exit.x && y === game.exit.y) continue;

            const cell = game.grid[y][x];

            if (Math.random() < cell.adaptability * CONFIG.ADAPTATION_RATE * 0.5) {
                const wasWall = cell.type === 'wall';
                cell.type = wasWall ? 'empty' : 'wall';

                const testPath = aStarPath({ x: game.player.x, y: game.player.y }, game.exit);
                if (testPath.length === 0) {
                    cell.type = wasWall ? 'wall' : 'empty';
                } else {
                    spawnParticles(x, y, 'adapt', 3);
                }
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
    const count = CONFIG.ENEMY_BASE_COUNT + Math.floor(game.difficulty / 2);
    for (let i = 0; i < count; i++) {
        const pos = findEmptyCell();
        game.enemies.push({
            x: pos.x,
            y: pos.y,
            vx: pos.x,
            vy: pos.y,
            intelligence: 0.5 + (game.difficulty * 0.1)
        });
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
    } while ((game.grid[y][x].type !== 'empty' || (x === game.player.x && y === game.player.y)) && tries < 100);
    return { x, y };
}

// === PLAYER ===
function movePlayer(dx, dy) {
    if (game.inLevelTransition) return;

    const newX = game.player.x + dx;
    const newY = game.player.y + dy;

    if (isValid(newX, newY)) {
        game.player.x = newX;
        game.player.y = newY;
        game.history.push({ dx, dy });
        if (game.history.length > 20) game.history.shift();

        playSound('move');

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

// === COMBO SYSTEM ===
function addCombo() {
    game.combo++;
    if (game.combo > game.maxCombo) game.maxCombo = game.combo;

    if (game.combo > 2) {
        showComboPopup('x' + game.combo + ' COMBO!');
        playSound('combo');
    }

    if (game.comboTimer) clearTimeout(game.comboTimer);
    game.comboTimer = setTimeout(() => {
        game.combo = 1;
    }, CONFIG.COMBO_TIMEOUT);
}

function showComboPopup(text) {
    elements.comboPopup.textContent = text;
    elements.comboPopup.classList.add('show');
    setTimeout(() => {
        elements.comboPopup.classList.remove('show');
    }, 1000);
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
                playSound('collect');
            } else {
                const points = 100 * game.combo;
                game.score += points;
                showMessage('+' + points);
                playSound('collect');
            }
            addCombo();
            spawnParticles(p.x, p.y, 'collect', 15);
            game.powerups.splice(i, 1);
        }
    }

    // Enemies
    game.enemies.forEach(e => {
        const dist = Math.hypot(e.vx - game.player.vx, e.vy - game.player.vy);
        if (dist < 0.7) {
            if (game.tickCount % 30 === 0) {
                game.health -= CONFIG.ENEMY_ATTACK_DAMAGE;
                playSound('damage');
                spawnParticles(game.player.vx, game.player.vy, 'damage', 10);
                game.combo = 1; // Reset combo on damage

                if (game.health <= 0) {
                    gameOver();
                }
            }
        }
    });
}

// === ABILITY ===
function useAbility() {
    if (game.abilityCharge >= 100) {
        game.abilityCharge = 0;
        showMessage('NEURAL PULSE!');
        playSound('pulse');

        elements.pulseEffect.classList.add('active');
        setTimeout(() => elements.pulseEffect.classList.remove('active'), 600);

        game.enemies.forEach(e => {
            const dx = e.x - game.player.x;
            const dy = e.y - game.player.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                const pushDist = 4;
                const newX = e.x + Math.sign(dx) * pushDist;
                const newY = e.y + Math.sign(dy) * pushDist;

                const finalX = Math.max(1, Math.min(CONFIG.GRID_SIZE - 2, newX));
                const finalY = Math.max(1, Math.min(CONFIG.GRID_SIZE - 2, newY));

                if (isValid(finalX, finalY)) {
                    e.x = finalX;
                    e.y = finalY;
                }

                spawnParticles(e.vx, e.vy, 'pulse', 20);
            }
        });
    } else {
        showMessage('CHARGING...');
        playSound('move');
    }
}

// === PARTICLES ===
class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 1.0;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.05 + Math.random() * 0.1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 0.1 + Math.random() * 0.2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }
}

function spawnParticles(x, y, type, count) {
    for (let i = 0; i < count; i++) {
        game.particles.push(new Particle(x + 0.5, y + 0.5, type));
    }
}

function updateParticles() {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        game.particles[i].update();
        if (game.particles[i].life <= 0) {
            game.particles.splice(i, 1);
        }
    }
}

// === LEVEL/GAME END ===
function levelComplete() {
    if (game.inLevelTransition) return;

    game.inLevelTransition = true;
    game.level++;
    game.score += 500 * game.combo;
    game.difficulty += 0.5;

    // Persist High Score
    if (game.score > game.highScore) {
        game.highScore = game.score;
        localStorage.setItem('adapt_high_score', game.highScore);
    }

    showMessage('SECTOR CLEARED!');
    playSound('levelComplete');
    spawnParticles(game.exit.x, game.exit.y, 'victory', 30);

    setTimeout(() => {
        initLevel();
    }, 2000);
}

function gameOver() {
    if (game.status === 'gameover') return;
    game.status = 'gameover';

    // Slight delay for impact
    setTimeout(() => {
        elements.finalScore.textContent = Math.floor(game.score);
        elements.finalLevel.textContent = game.level;
        elements.finalCombo.textContent = 'x' + game.maxCombo;

        // Persist High Score
        if (game.score > game.highScore) {
            game.highScore = game.score;
            localStorage.setItem('adapt_high_score', game.highScore);
        }

        playSound('gameOver');
        showOverlay(elements.gameoverScreen);
    }, 500);

    // Immediate haptics
    if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
}

// === RENDERING ===
function resizeCanvas() {
    const container = document.querySelector('.game-area');
    if (!container) return;
    const size = Math.min(container.clientWidth, container.clientHeight) - 20;
    canvas.width = size;
    canvas.height = size;
    minimap.width = 140;
    minimap.height = 140;
}

function getThemeColors() {
    const themes = {
        cyberpunk: {
            bg: '#0a0e27',
            grid: 'rgba(0, 243, 255, 0.15)',
            wall: '#1a2a3f',
            wallBorder: '#2a4a6f',
            exit: '#00f3ff',
            player: '#00f3ff',
            enemy: '#ff0055',
            healthPowerup: '#ff0055', scorePowerup: '#ffee00',
            particle: '#00f3ff'
        },
        arcade: {
            bg: '#1a1a2e',
            grid: 'rgba(255, 255, 255, 0.05)',
            wall: '#3d3d5c',
            wallBorder: '#f72585',
            exit: '#ffd60a',
            player: '#4cc9f0',
            enemy: '#f72585',
            healthPowerup: '#f72585',
            scorePowerup: '#ffd60a',
            particle: '#4cc9f0'
        },
        noir: {
            bg: '#000000',
            grid: 'rgba(255, 255, 255, 0.2)',
            wall: '#2a2a2a',
            wallBorder: '#444444',
            exit: '#ffffff',
            player: '#ffffff',
            enemy: '#888888',
            healthPowerup: '#ffffff',  // Changed to white
            scorePowerup: '#cccccc',   // Changed to lighter gray
            particle: '#ffffff'
        }
    };

    return themes[currentTheme] || themes.cyberpunk;
}

function render() {
    const size = canvas.width;
    const cellSize = size / CONFIG.GRID_SIZE;
    const colors = getThemeColors();

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = colors.grid;
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

    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
            if (game.grid[y][x].type === 'wall') {
                const px = x * cellSize;
                const py = y * cellSize;

                ctx.fillStyle = colors.wall;
                ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

                ctx.strokeStyle = colors.wallBorder;
                ctx.lineWidth = 1;
                ctx.strokeRect(px + 3, py + 3, cellSize - 6, cellSize - 6);
            }
        }
    }

    ctx.strokeStyle = colors.exit;
    ctx.lineWidth = 3;
    const exitPulse = Math.sin(game.tickCount * 0.1) * 3;
    ctx.beginPath();
    ctx.arc(
        game.exit.x * cellSize + cellSize / 2,
        game.exit.y * cellSize + cellSize / 2,
        cellSize / 3 + exitPulse,
        0,
        Math.PI * 2
    );
    ctx.stroke();
    ctx.fillStyle = colors.exit + '33';
    ctx.fill();

    // IMPROVED NOIR POWERUPS - Different shapes
    game.powerups.forEach(p => {
        const px = p.x * cellSize + cellSize / 2;
        const py = p.y * cellSize + cellSize / 2;
        const powerupPulse = Math.sin(game.tickCount * 0.15) * 2;
        const radius = cellSize / 5 + powerupPulse;

        ctx.fillStyle = p.type === 'health' ? colors.healthPowerup : colors.scorePowerup;

        if (currentTheme === 'noir') {
            // Health = Plus sign, Score = Diamond
            ctx.beginPath();
            if (p.type === 'health') {
                // Plus sign
                const size = radius * 0.7;
                ctx.fillRect(px - size / 4, py - size, size / 2, size * 2);
                ctx.fillRect(px - size, py - size / 4, size * 2, size / 2);
            } else {
                // Diamond
                ctx.moveTo(px, py - radius);
                ctx.lineTo(px + radius, py);
                ctx.lineTo(px, py + radius);
                ctx.lineTo(px - radius, py);
                ctx.closePath();
            }
            ctx.fill();
        } else {
            // Other themes - simple circles
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    game.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        const particleColors = {
            collect: colors.scorePowerup,
            damage: colors.enemy,
            pulse: '#bd00ff',
            adapt: colors.particle,
            victory: colors.exit
        };
        ctx.fillStyle = particleColors[p.type] || colors.particle;
        ctx.fillRect(
            p.x * cellSize - p.size * cellSize / 2,
            p.y * cellSize - p.size * cellSize / 2,
            p.size * cellSize,
            p.size * cellSize
        );
    });
    ctx.globalAlpha = 1;

    game.enemies.forEach(e => {
        ctx.fillStyle = colors.enemy;
        ctx.beginPath();
        const ex = e.vx * cellSize + cellSize / 2;
        const ey = e.vy * cellSize + cellSize / 2;
        const er = cellSize / 3.5;

        ctx.moveTo(ex, ey - er);
        ctx.lineTo(ex + er, ey);
        ctx.lineTo(ex, ey + er);
        ctx.lineTo(ex - er, ey);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 10;
        ctx.shadowColor = colors.enemy;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    ctx.fillStyle = colors.player;
    ctx.shadowBlur = 15;
    ctx.shadowColor = colors.player;
    ctx.beginPath();
    ctx.arc(
        game.player.vx * cellSize + cellSize / 2,
        game.player.vy * cellSize + cellSize / 2,
        cellSize / 3.5,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    if (game.abilityCharge >= 100) {
        ctx.strokeStyle = '#bd00ff';
        ctx.lineWidth = 2;
        const abilityPulse = Math.sin(game.tickCount * 0.2) * 3;
        ctx.beginPath();
        ctx.arc(
            game.player.vx * cellSize + cellSize / 2,
            game.player.vy * cellSize + cellSize / 2,
            cellSize / 2.5 + abilityPulse,
            0,
            Math.PI * 2
        );
        ctx.stroke();
    }
}

// === MINIMAP ===
function renderMinimap() {
    const size = 140;
    const cellSize = size / CONFIG.GRID_SIZE;
    const colors = getThemeColors();

    minimapCtx.fillStyle = colors.bg;
    minimapCtx.fillRect(0, 0, size, size);

    for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
            if (game.grid[y][x].type === 'wall') {
                minimapCtx.fillStyle = colors.wall;
                minimapCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    minimapCtx.fillStyle = colors.exit;
    minimapCtx.fillRect(game.exit.x * cellSize, game.exit.y * cellSize, cellSize, cellSize);

    game.enemies.forEach(e => {
        minimapCtx.fillStyle = colors.enemy;
        minimapCtx.fillRect(e.x * cellSize, e.y * cellSize, cellSize, cellSize);
    });

    minimapCtx.fillStyle = colors.player;
    minimapCtx.fillRect(game.player.x * cellSize, game.player.y * cellSize, cellSize, cellSize);
}

// === UI ===
function updateUI() {
    elements.hpDisplay.textContent = Math.floor(game.health);
    elements.scoreDisplay.textContent = Math.floor(game.score);
    elements.levelDisplay.textContent = game.level;
    elements.abilityDisplay.textContent = Math.floor(game.abilityCharge);
    elements.comboDisplay.textContent = 'x' + game.combo;

    elements.hpBar.style.width = Math.max(0, game.health) + '%';
    elements.abilityBar.style.width = Math.max(0, game.abilityCharge) + '%';
    elements.highscoreDisplay.textContent = Math.floor(game.highScore);
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
    if (el === elements.startScreen && game.status === 'playing') {
        game.paused = false; // Unpause when closing settings
    }
}

function updateTechnicalHUD() {
    if (!game.debugMode) return;
    const now = performance.now();
    game.lastTick = now;
    if (game.tickCount % 30 === 0) {
        const timeDiff = now - game.lastHudUpdate;
        game.fps = Math.round(30000 / timeDiff);
        game.lastHudUpdate = now;
        elements.techFps.textContent = game.fps;
        elements.techSearch.textContent = game.nodesSearched;
        elements.techEntities.textContent = 1 + game.enemies.length + game.powerups.length + game.particles.length;
    }
    if (game.tickCount % 120 === 0) game.nodesSearched = 0;
}
}