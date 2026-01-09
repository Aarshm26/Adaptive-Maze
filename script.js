// Adaptive Maze Escape - Main Game Implementation

// Constants
const CELL_SIZE = 40;
const GRID_SIZE = 15;
const WALL_CHANCE = 0.3;
const POWERUP_CHANCE = 0.05;
const ENEMY_COUNT = 2;
const ADAPTATION_RATE = 0.15; 

// Game state
let gameState = {
    player: { x: 1, y: 1, health: 100, score: 0 },
    exit: { x: GRID_SIZE - 2, y: GRID_SIZE - 2 },
    enemies: [],
    powerups: [],
    maze: [],
    playerHistory: [],
    difficultyLevel: 1,
    level: 1,
    gameOver: false,
    won: false,
    tickCount: 0
};

let gameLoop;
// Visual animation variable
let animationFrame = 0; 

// --- MODIFIED RENDER FUNCTION (The "Cool" Part) ---
function render() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Animation tick for pulsating effects
    animationFrame++;

    // Calculate cell size dynamically
    const container = document.querySelector('.canvas-wrapper');
    const maxSize = Math.min(container.clientWidth - 20, 600);
    const cellSize = maxSize / GRID_SIZE;
    
    // Ensure canvas logical size matches display
    if(canvas.width !== maxSize) {
        canvas.width = maxSize;
        canvas.height = maxSize;
    }

    // Clear with a tech-grid background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw subtle grid lines
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 0.5;
    for(let i=0; i<=GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i*cellSize, 0); ctx.lineTo(i*cellSize, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i*cellSize); ctx.lineTo(canvas.width, i*cellSize);
        ctx.stroke();
    }

    // Render Maze Elements
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = gameState.maze[y][x];
            const px = x * cellSize;
            const py = y * cellSize;

            if (cell.type === 'wall') {
                // High-Tech Wall: Dark block with a cross
                ctx.fillStyle = '#0f1f33';
                ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
                
                ctx.strokeStyle = '#2a4d7d';
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 6, py + 6, cellSize - 12, cellSize - 12);
                
                // Tech Cross details
                ctx.beginPath();
                ctx.moveTo(px + 6, py + 6);
                ctx.lineTo(px + 10, py + 10);
                ctx.stroke();
            }
        }
    }

    // Render Exit (Pulsing Green Target)
    const ex = gameState.exit.x * cellSize + cellSize/2;
    const ey = gameState.exit.y * cellSize + cellSize/2;
    const pulse = Math.sin(animationFrame * 0.1) * 5;
    
    ctx.strokeStyle = '#00ff9d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, ey, (cellSize/3) + (pulse/2), 0, Math.PI*2);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(0, 255, 157, 0.2)';
    ctx.beginPath();
    ctx.arc(ex, ey, cellSize/4, 0, Math.PI*2);
    ctx.fill();

    // Render Powerups
    for (const powerup of gameState.powerups) {
        const cx = powerup.x * cellSize + cellSize/2;
        const cy = powerup.y * cellSize + cellSize/2;
        
        ctx.shadowBlur = 10;
        if(powerup.type === 'health') {
            ctx.fillStyle = '#ff2a2a';
            ctx.shadowColor = '#ff2a2a';
            // Cross shape
            ctx.fillRect(cx - 2, cy - 8, 4, 16);
            ctx.fillRect(cx - 8, cy - 2, 16, 4);
        } else {
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            // Bolt/Diamond shape
            ctx.beginPath();
            ctx.moveTo(cx, cy - 8);
            ctx.lineTo(cx + 8, cy);
            ctx.lineTo(cx, cy + 8);
            ctx.lineTo(cx - 8, cy);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    // Render Enemies (Glitched Squares)
    for (const enemy of gameState.enemies) {
        const ex = enemy.x * cellSize + cellSize * 0.15;
        const ey = enemy.y * cellSize + cellSize * 0.15;
        const size = cellSize * 0.7;
        
        ctx.fillStyle = '#ffae00'; // Warning Orange
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffae00';
        ctx.fillRect(ex, ey, size, size);
        ctx.shadowBlur = 0;
        
        // "Eye"
        ctx.fillStyle = '#000';
        ctx.fillRect(ex + size/2 - 2, ey + size/2 - 2, 4, 4);
    }

    // Render Player (Tech Core)
    const px = gameState.player.x * cellSize + cellSize/2;
    const py = gameState.player.y * cellSize + cellSize/2;
    
    ctx.fillStyle = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00f0ff';
    ctx.beginPath();
    ctx.arc(px, py, cellSize/3.5, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Rotating Ring around player
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, cellSize/2.5, animationFrame*0.1, animationFrame*0.1 + Math.PI);
    ctx.stroke();

    requestAnimationFrame(() => {}); // Keep visuals alive if needed, though game loop drives physics
}

// --- LOGIC FUNCTIONS (Kept Exact, just updated UI targets) ---

function initGame() {
    if (gameState.won) {
        gameState.level++;
        gameState.difficultyLevel += 0.5;
    } else if (gameState.gameOver) {
        gameState.difficultyLevel = 1;
        gameState.level = 1;
    }
    
    generateMaze();
    gameState.player = { x: 1, y: 1, health: 100, score: gameState.won ? gameState.player.score : 0 };
    gameState.exit = { x: GRID_SIZE - 2, y: GRID_SIZE - 2 };
    ensurePathExists(gameState.player, gameState.exit);
    spawnEnemies();
    spawnPowerups();
    
    gameState.playerHistory = [];
    gameState.gameOver = false;
    gameState.won = false;
    gameState.tickCount = 0;
    
    if (gameLoop) { clearInterval(gameLoop); }
    gameLoop = setInterval(update, 100);
    
    updateUI();
    render();
}

window.onload = function() {
    // Initial UI Setup
    document.getElementById('msg-text').textContent = "PRESS ANY KEY TO START";
    document.getElementById('message-overlay').classList.remove('hidden');
    
    window.addEventListener('keydown', function startOnce() {
        document.getElementById('message-overlay').classList.add('hidden');
        initGame();
        window.removeEventListener('keydown', startOnce);
    });
    
    window.addEventListener('resize', render);
};

function generateMaze() {
    gameState.maze = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        const row = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1) {
                row.push({ type: 'wall', adaptability: 0 });
            } else {
                row.push({ 
                    type: Math.random() < WALL_CHANCE ? 'wall' : 'empty',
                    adaptability: Math.random()
                });
            }
        }
        gameState.maze.push(row);
    }
    gameState.maze[1][1].type = 'empty';
    gameState.maze[GRID_SIZE - 2][GRID_SIZE - 2].type = 'empty';
}

function ensurePathExists(start, end) {
    const visited = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
    const queue = [{ x: start.x, y: start.y, path: [] }];
    visited[start.y][start.x] = true;
    
    while (queue.length > 0) {
        const current = queue.shift();
        if (current.x === end.x && current.y === end.y) { return true; }
        
        const directions = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && !visited[ny][nx]) {
                if (gameState.maze[ny][nx].type === 'empty' || (nx === end.x && ny === end.y)) {
                    visited[ny][nx] = true;
                    queue.push({ x: nx, y: ny, path: [...current.path, { x: nx, y: ny }] });
                }
            }
        }
    }
    
    const path = carvePath(start, end);
    for (const point of path) { gameState.maze[point.y][point.x].type = 'empty'; }
    return true;
}

function carvePath(start, end) {
    const path = [];
    let x = start.x; let y = start.y;
    while (x !== end.x || y !== end.y) {
        path.push({ x, y });
        if (x < end.x && Math.random() < 0.5) x++;
        else if (x > end.x && Math.random() < 0.5) x--;
        else if (y < end.y) y++;
        else if (y > end.y) y--;
    }
    path.push(end);
    return path;
}

function spawnEnemies() {
    gameState.enemies = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
            y = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
        } while (
            (x === gameState.player.x && y === gameState.player.y) ||
            (x === gameState.exit.x && y === gameState.exit.y) ||
            gameState.maze[y][x].type === 'wall'
        );
        gameState.enemies.push({
            x, y,
            intelligence: 0.2 + (Math.random() * 0.3 * gameState.difficultyLevel),
            lastMove: { x: 0, y: 0 },
            path: []
        });
    }
}

function spawnPowerups() {
    gameState.powerups = [];
    for (let y = 1; y < GRID_SIZE - 1; y++) {
        for (let x = 1; x < GRID_SIZE - 1; x++) {
            if (gameState.maze[y][x].type === 'empty' && Math.random() < POWERUP_CHANCE) {
                if ((x !== gameState.player.x || y !== gameState.player.y) && 
                    (x !== gameState.exit.x || y !== gameState.exit.y)) {
                    const type = Math.random() < 0.5 ? 'health' : 'speed';
                    gameState.powerups.push({ x, y, type });
                }
            }
        }
    }
}

function update() {
    if (gameState.gameOver || gameState.won) return;
    gameState.tickCount++;
    moveEnemies();
    checkEnemyCollisions();
    checkPowerupCollection();
    
    if (gameState.player.x === gameState.exit.x && gameState.player.y === gameState.exit.y) {
        gameState.won = true;
        showMessage("SECTOR CLEARED. INITIALIZING NEXT LEVEL...");
        updateUI();
        setTimeout(() => { initGame(); }, 2000);
    }
    
    if (gameState.tickCount % 10 === 0) { adaptMaze(); }
    render();
}

function aStarPathfinding(start, end) {
    const openList = [];
    const closedList = [];
    const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    
    openList.push({ x: start.x, y: start.y, g: 0, h: heuristic(start, end), f: heuristic(start, end), parent: null });
    
    while (openList.length > 0) {
        openList.sort((a, b) => a.f - b.f);
        const current = openList.shift();
        closedList.push(current);
        
        if (current.x === end.x && current.y === end.y) {
            const path = [];
            let currentNode = current;
            while (currentNode.parent) {
                path.push({ x: currentNode.x, y: currentNode.y });
                currentNode = currentNode.parent;
            }
            return path.reverse();
        }
        
        const directions = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            
            if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE || gameState.maze[ny][nx].type === 'wall') continue;
            if (closedList.some(node => node.x === nx && node.y === ny)) continue;
            
            const g = current.g + 1;
            const h = heuristic({x: nx, y: ny}, end);
            const f = g + h;
            const existingOpenNode = openList.find(node => node.x === nx && node.y === ny);
            
            if (existingOpenNode) {
                if (g < existingOpenNode.g) {
                    existingOpenNode.g = g;
                    existingOpenNode.f = g + existingOpenNode.h;
                    existingOpenNode.parent = current;
                }
            } else {
                openList.push({ x: nx, y: ny, g: g, h: h, f: f, parent: current });
            }
        }
    }
    return [];
}

function moveEnemies() {
    for (const enemy of gameState.enemies) {
        if (Math.random() < enemy.intelligence) {
            if (enemy.path.length === 0 || gameState.tickCount % 5 === 0) {
                enemy.path = aStarPathfinding({ x: enemy.x, y: enemy.y }, { x: gameState.player.x, y: gameState.player.y });
            }
            if (enemy.path.length > 0) {
                const nextStep = enemy.path.shift();
                const dx = nextStep.x - enemy.x;
                const dy = nextStep.y - enemy.y;
                enemy.x = nextStep.x;
                enemy.y = nextStep.y;
                enemy.lastMove = { x: dx, y: dy };
            } else {
                // Fallback logic kept identical to provided code
                const dx = Math.sign(gameState.player.x - enemy.x);
                const dy = Math.sign(gameState.player.y - enemy.y);
                let moved = false;
                if (Math.abs(dx) > Math.abs(dy) || (Math.abs(dx) === Math.abs(dy) && Math.random() < 0.5)) {
                    if (isValidMove(enemy.x + dx, enemy.y)) { enemy.x += dx; enemy.lastMove = { x: dx, y: 0 }; moved = true; }
                }
                if (!moved) {
                    if (isValidMove(enemy.x, enemy.y + dy)) { enemy.y += dy; enemy.lastMove = { x: 0, y: dy }; moved = true; }
                }
                if (!moved) {
                    if (dx !== 0 && isValidMove(enemy.x + dx, enemy.y)) { enemy.x += dx; enemy.lastMove = { x: dx, y: 0 }; }
                    else if (dy !== 0 && isValidMove(enemy.x, enemy.y + dy)) { enemy.y += dy; enemy.lastMove = { x: 0, y: dy }; }
                }
            }
        } else {
            const directions = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
            const validDirections = directions.filter(dir => isValidMove(enemy.x + dir.dx, enemy.y + dir.dy));
            if (validDirections.length > 0) {
                const dir = validDirections[Math.floor(Math.random() * validDirections.length)];
                enemy.x += dir.dx;
                enemy.y += dir.dy;
                enemy.lastMove = { x: dir.dx, y: dir.dy };
            }
        }
        enemy.intelligence = Math.min(0.9, enemy.intelligence + 0.001 * gameState.difficultyLevel);
    }
}

function isValidMove(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && gameState.maze[y][x].type !== 'wall';
}

function checkEnemyCollisions() {
    for (const enemy of gameState.enemies) {
        if (enemy.x === gameState.player.x && enemy.y === gameState.player.y) {
            gameState.player.health -= 10;
            const dx = -enemy.lastMove.x;
            const dy = -enemy.lastMove.y;
            if (isValidMove(gameState.player.x + dx, gameState.player.y + dy)) {
                gameState.player.x += dx;
                gameState.player.y += dy;
            }
            updateUI();
            if (gameState.player.health <= 0) {
                gameState.gameOver = true;
                showMessage("CRITICAL FAILURE. SUBJECT TERMINATED.");
                setTimeout(() => { initGame(); }, 3000);
            }
        }
    }
}

function checkPowerupCollection() {
    for (let i = gameState.powerups.length - 1; i >= 0; i--) {
        const powerup = gameState.powerups[i];
        if (powerup.x === gameState.player.x && powerup.y === gameState.player.y) {
            if (powerup.type === 'health') {
                gameState.player.health = Math.min(100, gameState.player.health + 20);
                // No text popup, rely on bar update
            } else if (powerup.type === 'speed') {
                gameState.player.score += 100;
            }
            gameState.powerups.splice(i, 1);
            updateUI();
        }
    }
}

function adaptMaze() {
    if (gameState.playerHistory.length < 5) return;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1 ||
                (x === gameState.player.x && y === gameState.player.y) ||
                (x === gameState.exit.x && y === gameState.exit.y)) { continue; }
            
            const distToPlayer = Math.abs(x - gameState.player.x) + Math.abs(y - gameState.player.y);
            if (distToPlayer < 3) continue;
            
            if (Math.random() < gameState.maze[y][x].adaptability * ADAPTATION_RATE) {
                const recentMoves = gameState.playerHistory.slice(-5);
                const horizontalMoves = recentMoves.filter(move => Math.abs(move.dx) > Math.abs(move.dy)).length;
                const verticalMoves = recentMoves.length - horizontalMoves;
                const playerDirection = horizontalMoves > verticalMoves ? 'horizontal' : 'vertical';
                let shouldBeWall;
                if (playerDirection === 'horizontal' && y % 2 === 0) { shouldBeWall = Math.random() < 0.7; } 
                else if (playerDirection === 'vertical' && x % 2 === 0) { shouldBeWall = Math.random() < 0.7; } 
                else { shouldBeWall = Math.random() < 0.3; }
                
                if (!shouldBeWall || pathExistsWithChange(gameState.player, gameState.exit, { x, y, type: 'wall' })) {
                    gameState.maze[y][x].type = shouldBeWall ? 'wall' : 'empty';
                }
            }
        }
    }
    if (Math.random() < 0.2) {
        const needsHealth = gameState.player.health < 50;
        spawnSpecificPowerup(needsHealth ? 'health' : 'speed');
    }
}

function pathExistsWithChange(start, end, change) {
    const tempMaze = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        tempMaze[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) { tempMaze[y][x] = { ...gameState.maze[y][x] }; }
    }
    tempMaze[change.y][change.x].type = change.type;
    const visited = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
    const queue = [{ x: start.x, y: start.y }];
    visited[start.y][start.x] = true;
    while (queue.length > 0) {
        const current = queue.shift();
        if (current.x === end.x && current.y === end.y) { return true; }
        const directions = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && !visited[ny][nx] && tempMaze[ny][nx].type !== 'wall') {
                visited[ny][nx] = true;
                queue.push({ x: nx, y: ny });
            }
        }
    }
    return false;
}

function spawnSpecificPowerup(type) {
    let attempts = 0;
    while (attempts < 10) {
        const x = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
        const y = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
        if (gameState.maze[y][x].type === 'empty' &&
            (x !== gameState.player.x || y !== gameState.player.y) &&
            (x !== gameState.exit.x || y !== gameState.exit.y)) {
            const powerupExists = gameState.powerups.some(p => p.x === x && p.y === y);
            if (!powerupExists) { gameState.powerups.push({ x, y, type }); break; }
        }
        attempts++;
    }
}

function movePlayer(dx, dy) {
    const newX = gameState.player.x + dx;
    const newY = gameState.player.y + dy;
    if (isValidMove(newX, newY)) {
        gameState.player.x = newX;
        gameState.player.y = newY;
        gameState.playerHistory.push({ dx, dy });
        if (gameState.playerHistory.length > 20) { gameState.playerHistory.shift(); }
        gameState.player.score += 1;
        checkPowerupCollection();
        updateUI();
        if (gameState.player.x === gameState.exit.x && gameState.player.y === gameState.exit.y) {
            gameState.won = true;
            showMessage("SECTOR CLEARED. UPLOADING...");
            updateUI();
            setTimeout(() => { initGame(); }, 2000);
        }
    }
}

// Updated UI function to target new DOM structure
function updateUI() {
    document.getElementById('health-value').textContent = gameState.player.health;
    document.getElementById('health-bar').style.width = gameState.player.health + '%';
    document.getElementById('score-value').textContent = gameState.player.score;
    document.getElementById('level-value').textContent = gameState.level;
}

function showMessage(text) {
    const msgOverlay = document.getElementById('message-overlay');
    const msgTitle = document.getElementById('msg-title');
    const msgText = document.getElementById('msg-text');
    
    msgTitle.textContent = "SYSTEM ALERT";
    msgText.textContent = text;
    msgOverlay.classList.remove('hidden');
    
    // Don't auto-hide Game Over messages, only transient ones
    if (!gameState.gameOver && !gameState.won) {
        setTimeout(() => { msgOverlay.classList.add('hidden'); }, 1500);
    }
}

document.addEventListener('keydown', (e) => {
    if (gameState.gameOver || gameState.won) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.key)) { e.preventDefault(); }
    switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': movePlayer(0, -1); break;
        case 'ArrowRight': case 'd': case 'D': movePlayer(1, 0); break;
        case 'ArrowDown': case 's': case 'S': movePlayer(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': movePlayer(-1, 0); break;
    }
    render();
});
