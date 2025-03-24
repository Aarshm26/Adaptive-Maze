// Adaptive Maze Escape - Main Game Implementation
// index.js - Main game logic

// Constants
const CELL_SIZE = 40;
const GRID_SIZE = 15;
const WALL_CHANCE = 0.3;
const POWERUP_CHANCE = 0.05;
const ENEMY_COUNT = 2;
const ADAPTATION_RATE = 0.15; // How quickly the maze adapts to player movements

// Game state
let gameState = {
    player: { x: 1, y: 1, health: 100, score: 0 },
    exit: { x: GRID_SIZE - 2, y: GRID_SIZE - 2 },
    enemies: [],
    powerups: [],
    maze: [],
    playerHistory: [], // Track recent player movements for AI adaptation
    difficultyLevel: 1,
    level: 1, // Added a separate level counter for display
    gameOver: false,
    won: false,
    tickCount: 0
};

// Game loop variable declared globally
let gameLoop;

function render() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Calculate cell size based on current canvas size
    const cellSize = canvas.width / GRID_SIZE;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Render maze
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = gameState.maze[y][x];
            ctx.fillStyle = cell.type === 'wall' ? '#333333' : '#EEEEEE';
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
    }
    
    // Render exit
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(
        gameState.exit.x * cellSize + cellSize * 0.2,
        gameState.exit.y * cellSize + cellSize * 0.2,
        cellSize * 0.6,
        cellSize * 0.6
    );
    
    // Render powerups
    for (const powerup of gameState.powerups) {
        ctx.fillStyle = powerup.type === 'health' ? '#FF0000' : '#0000FF';
        ctx.beginPath();
        ctx.arc(
            powerup.x * cellSize + cellSize / 2,
            powerup.y * cellSize + cellSize / 2,
            cellSize / 4,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    
    // Render enemies - Fixed the color value by removing the space
    for (const enemy of gameState.enemies) {
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(
            enemy.x * cellSize + cellSize * 0.15,
            enemy.y * cellSize + cellSize * 0.15,
            cellSize * 0.7,
            cellSize * 0.7
        );
    }
    
    // Render player
    ctx.fillStyle = '#0066FF';
    ctx.beginPath();
    ctx.arc(
        gameState.player.x * cellSize + cellSize / 2,
        gameState.player.y * cellSize + cellSize / 2,
        cellSize / 2 - 5,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// Initialize the game
function initGame() {
    // If player won the level, increment level counter
    if (gameState.won) {
        gameState.level++;
        gameState.difficultyLevel += 0.5;
    } else if (gameState.gameOver) {
        // Reset level on game over
        gameState.difficultyLevel = 1;
        gameState.level = 1;
    }
    
    // Create initial maze
    generateMaze();
    
    // Place player at the start
    gameState.player = { x: 1, y: 1, health: 100, score: gameState.won ? gameState.player.score : 0 };
    
    // Set exit location
    gameState.exit = { x: GRID_SIZE - 2, y: GRID_SIZE - 2 };
    
    // Ensure path exists from start to exit
    ensurePathExists(gameState.player, gameState.exit);
    
    // Place enemies
    spawnEnemies();
    
    // Place powerups
    spawnPowerups();
    
    // Reset game state
    gameState.playerHistory = [];
    gameState.gameOver = false;
    gameState.won = false;
    gameState.tickCount = 0;
    
    // Clear any existing loop and start fresh
    if (gameLoop) {
        clearInterval(gameLoop);
    }
    gameLoop = setInterval(update, 100);
    
    // Update UI elements
    updateUI();
    
    // Render initial state
    render();
}

window.onload = function() {
    const canvas = document.getElementById('gameCanvas');
    // Set canvas size based on GRID_SIZE
    canvas.width = GRID_SIZE * 40;  // Use a base cell size of 40 pixels
    canvas.height = GRID_SIZE * 40;

    // Add CSS to prevent the entire page from scrolling
    const style = document.createElement('style');
    style.innerHTML = `
        html, body {
            height: 100%;
            overflow: hidden;
            margin: 0;
            padding: 0;
        }
        #gameContainer {
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100vh;
            padding: 20px;
            box-sizing: border-box;
        }
    `;
    document.head.appendChild(style);

    initGame();
    resizeCanvas();  // Call this after initGame to adjust display size
    
    // Add a window resize event listener to ensure the canvas adapts to screen size changes
    window.addEventListener('resize', resizeCanvas);
};

// Generate a random maze
function generateMaze() {
    gameState.maze = [];
    
    // Initialize with empty cells
    for (let y = 0; y < GRID_SIZE; y++) {
        const row = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            // Border walls
            if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1) {
                row.push({ type: 'wall', adaptability: 0 });
            } else {
                // Random walls inside
                row.push({ 
                    type: Math.random() < WALL_CHANCE ? 'wall' : 'empty',
                    adaptability: Math.random() // How likely this cell is to change
                });
            }
        }
        gameState.maze.push(row);
    }
    
    // Ensure start and exit are empty
    gameState.maze[1][1].type = 'empty';
    gameState.maze[GRID_SIZE - 2][GRID_SIZE - 2].type = 'empty';
}

// Make sure there's a valid path from start to exit
function ensurePathExists(start, end) {
    // Simple implementation using a breadth-first search
    const visited = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
    const queue = [{ x: start.x, y: start.y, path: [] }];
    visited[start.y][start.x] = true;
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        // Check if we've reached the end
        if (current.x === end.x && current.y === end.y) {
            return true; // Path exists
        }
        
        // Check neighbors (4 directions)
        const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 1, dy: 0 },  // Right
            { dx: 0, dy: 1 },  // Down
            { dx: -1, dy: 0 }  // Left
        ];
        
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            
            // Check if the new position is valid and unvisited
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && !visited[ny][nx]) {
                if (gameState.maze[ny][nx].type === 'empty' || (nx === end.x && ny === end.y)) {
                    visited[ny][nx] = true;
                    queue.push({ x: nx, y: ny, path: [...current.path, { x: nx, y: ny }] });
                }
            }
        }
    }
    
    // If we get here, no path exists - carve one
    const path = carvePath(start, end);
    for (const point of path) {
        gameState.maze[point.y][point.x].type = 'empty';
    }
    return true;
}

// Carve a path between two points if no path exists
function carvePath(start, end) {
    const path = [];
    let x = start.x;
    let y = start.y;
    
    // Simple algorithm to carve a path
    while (x !== end.x || y !== end.y) {
        path.push({ x, y });
        
        if (x < end.x && Math.random() < 0.5) {
            x++;
        } else if (x > end.x && Math.random() < 0.5) {
            x--;
        } else if (y < end.y) {
            y++;
        } else if (y > end.y) {
            y--;
        }
    }
    path.push(end);
    return path;
}

// Spawn enemies at random locations
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
            path: [] // For storing A* path
        });
    }
}

// Spawn powerups
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

// Update game state - called every tick
function update() {
    if (gameState.gameOver || gameState.won) return;
    
    gameState.tickCount++;
    
    // Update enemy positions
    moveEnemies();
    
    // Check for collisions with enemies
    checkEnemyCollisions();
    
    // Check for powerup collection
    checkPowerupCollection();
    
    // Check win condition
    if (gameState.player.x === gameState.exit.x && gameState.player.y === gameState.exit.y) {
        gameState.won = true;
        showMessage("Level Complete! Starting next level...");
        
        // Update UI immediately to show new level
        updateUI();
        
        setTimeout(() => {
            initGame();
        }, 2000);
    }
    
    // Adapt maze - but not too frequently
    if (gameState.tickCount % 10 === 0) {
        adaptMaze();
    }
    
    // Render current state
    render();
}

// A* Pathfinding implementation
function aStarPathfinding(start, end) {
    // Create open and closed lists
    const openList = [];
    const closedList = [];
    
    // Calculate heuristic (Manhattan distance)
    const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    
    // Add starting point to open list
    openList.push({
        x: start.x,
        y: start.y,
        g: 0,
        h: heuristic(start, end),
        f: heuristic(start, end),
        parent: null
    });
    
    while (openList.length > 0) {
        // Sort the open list to get the node with the lowest f value
        openList.sort((a, b) => a.f - b.f);
        
        // Get the node with the lowest f score
        const current = openList.shift();
        
        // Add current to closed list
        closedList.push(current);
        
        // Check if we've reached the destination
        if (current.x === end.x && current.y === end.y) {
            // Backtrack to get the path
            const path = [];
            let currentNode = current;
            
            while (currentNode.parent) {
                path.push({ x: currentNode.x, y: currentNode.y });
                currentNode = currentNode.parent;
            }
            
            // Return the path in reverse (from start to end)
            return path.reverse();
        }
        
        // Check neighbors (4 directions: up, right, down, left)
        const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 1, dy: 0 },  // Right
            { dx: 0, dy: 1 },  // Down
            { dx: -1, dy: 0 }  // Left
        ];
        
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            
            // Check if the neighbor is valid
            if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE || 
                gameState.maze[ny][nx].type === 'wall') {
                continue;
            }
            
            // Check if the neighbor is in the closed list
            if (closedList.some(node => node.x === nx && node.y === ny)) {
                continue;
            }
            
            // Calculate g, h, and f values
            const g = current.g + 1; // Cost to move is 1
            const h = heuristic({x: nx, y: ny}, end);
            const f = g + h;
            
            // Check if the neighbor is already in the open list
            const existingOpenNode = openList.find(node => node.x === nx && node.y === ny);
            
            if (existingOpenNode) {
                // If we have a better path, update the node
                if (g < existingOpenNode.g) {
                    existingOpenNode.g = g;
                    existingOpenNode.f = g + existingOpenNode.h;
                    existingOpenNode.parent = current;
                }
            } else {
                // Add neighbor to open list
                openList.push({
                    x: nx,
                    y: ny,
                    g: g,
                    h: h,
                    f: f,
                    parent: current
                });
            }
        }
    }
    
    // No path found
    return [];
}

// Move enemies using A* pathfinding
function moveEnemies() {
    for (const enemy of gameState.enemies) {
        // Decide whether to use intelligence or random movement
        if (Math.random() < enemy.intelligence) {
            // Use A* pathfinding to find path to player
            if (enemy.path.length === 0 || gameState.tickCount % 5 === 0) {
                // Recalculate path every 5 ticks or when path is empty
                enemy.path = aStarPathfinding(
                    { x: enemy.x, y: enemy.y },
                    { x: gameState.player.x, y: gameState.player.y }
                );
            }
            
            // Follow the path if it exists
            if (enemy.path.length > 0) {
                const nextStep = enemy.path.shift();
                const dx = nextStep.x - enemy.x;
                const dy = nextStep.y - enemy.y;
                
                enemy.x = nextStep.x;
                enemy.y = nextStep.y;
                enemy.lastMove = { x: dx, y: dy };
            } else {
                // Fallback to basic movement if no path found
                const dx = Math.sign(gameState.player.x - enemy.x);
                const dy = Math.sign(gameState.player.y - enemy.y);
                
                let moved = false;
                
                if (Math.abs(dx) > Math.abs(dy) || (Math.abs(dx) === Math.abs(dy) && Math.random() < 0.5)) {
                    if (isValidMove(enemy.x + dx, enemy.y)) {
                        enemy.x += dx;
                        enemy.lastMove = { x: dx, y: 0 };
                        moved = true;
                    }
                }
                
                if (!moved) {
                    if (isValidMove(enemy.x, enemy.y + dy)) {
                        enemy.y += dy;
                        enemy.lastMove = { x: 0, y: dy };
                        moved = true;
                    }
                }
                
                if (!moved) {
                    if (dx !== 0 && isValidMove(enemy.x + dx, enemy.y)) {
                        enemy.x += dx;
                        enemy.lastMove = { x: dx, y: 0 };
                    } else if (dy !== 0 && isValidMove(enemy.x, enemy.y + dy)) {
                        enemy.y += dy;
                        enemy.lastMove = { x: 0, y: dy };
                    }
                }
            }
        } else {
            // Random movement
            const directions = [
                { dx: 0, dy: -1 },
                { dx: 1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 }
            ];
            
            const validDirections = directions.filter(dir => 
                isValidMove(enemy.x + dir.dx, enemy.y + dir.dy)
            );
            
            if (validDirections.length > 0) {
                const dir = validDirections[Math.floor(Math.random() * validDirections.length)];
                enemy.x += dir.dx;
                enemy.y += dir.dy;
                enemy.lastMove = { x: dir.dx, y: dir.dy };
            }
        }
        
        // Increase intelligence slightly each move (learning)
        enemy.intelligence = Math.min(0.9, enemy.intelligence + 0.001 * gameState.difficultyLevel);
    }
}

// Check if a move is valid (not a wall)
function isValidMove(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && 
           gameState.maze[y][x].type !== 'wall';
}

// Check for collisions with enemies
function checkEnemyCollisions() {
    for (const enemy of gameState.enemies) {
        if (enemy.x === gameState.player.x && enemy.y === gameState.player.y) {
            // Player hit by enemy
            gameState.player.health -= 10;
            // Push player back
            const dx = -enemy.lastMove.x;
            const dy = -enemy.lastMove.y;
            if (isValidMove(gameState.player.x + dx, gameState.player.y + dy)) {
                gameState.player.x += dx;
                gameState.player.y += dy;
            }
            
            // Update UI to reflect health change
            updateUI();
            
            if (gameState.player.health <= 0) {
                gameState.gameOver = true;
                showMessage("Game Over! You were caught!");
                setTimeout(() => {
                    initGame();
                }, 3000);
            }
        }
    }
}

// Check for powerup collection
function checkPowerupCollection() {
    for (let i = gameState.powerups.length - 1; i >= 0; i--) {
        const powerup = gameState.powerups[i];
        if (powerup.x === gameState.player.x && powerup.y === gameState.player.y) {
            // Collect powerup
            if (powerup.type === 'health') {
                gameState.player.health = Math.min(100, gameState.player.health + 20);
                showMessage("+20 Health!");
            } else if (powerup.type === 'speed') {
                gameState.player.score += 100;
                showMessage("+100 Score!");
            }
            
            // Remove collected powerup
            gameState.powerups.splice(i, 1);
            
            // Update UI to reflect changes
            updateUI();
        }
    }
}

// Adapt maze based on player movement patterns
function adaptMaze() {
    if (gameState.playerHistory.length < 5) return;
    
    // Only adapt cells that are somewhat far from player to avoid immediate trapping
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            // Don't adapt border, player position, or exit
            if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1 ||
                (x === gameState.player.x && y === gameState.player.y) ||
                (x === gameState.exit.x && y === gameState.exit.y)) {
                continue;
            }
            
            // Calculate distance to player
            const distToPlayer = Math.abs(x - gameState.player.x) + Math.abs(y - gameState.player.y);
            
            // Don't adapt cells too close to player
            if (distToPlayer < 3) continue;
            
            // Check if this cell should adapt
            if (Math.random() < gameState.maze[y][x].adaptability * ADAPTATION_RATE) {
                // Look at player's recent movements to decide adaptation
                const recentMoves = gameState.playerHistory.slice(-5);
                
                // Count how often player moved horizontally vs vertically
                const horizontalMoves = recentMoves.filter(move => Math.abs(move.dx) > Math.abs(move.dy)).length;
                const verticalMoves = recentMoves.length - horizontalMoves;
                
                // If player moves horizontally more, add vertical walls and vice versa
                const playerDirection = horizontalMoves > verticalMoves ? 'horizontal' : 'vertical';
                
                // Determine if we should add or remove a wall
                let shouldBeWall;
                
                if (playerDirection === 'horizontal' && y % 2 === 0) {
                    shouldBeWall = Math.random() < 0.7; // 70% chance to add vertical walls
                } else if (playerDirection === 'vertical' && x % 2 === 0) {
                    shouldBeWall = Math.random() < 0.7; // 70% chance to add horizontal walls
                } else {
                    shouldBeWall = Math.random() < 0.3; // Otherwise, 30% chance to add any wall
                }
                
                // Don't change if it would block the exit
                const newMaze = JSON.parse(JSON.stringify(gameState.maze));
                newMaze[y][x].type = shouldBeWall ? 'wall' : 'empty';
                
                // Only make the change if it doesn't block the path to exit
                if (!shouldBeWall || pathExistsWithChange(gameState.player, gameState.exit, { x, y, type: 'wall' })) {
                    gameState.maze[y][x].type = shouldBeWall ? 'wall' : 'empty';
                }
            }
        }
    }
    
    // Occasionally spawn new powerups based on player's needs
    if (Math.random() < 0.2) {
        const needsHealth = gameState.player.health < 50;
        spawnSpecificPowerup(needsHealth ? 'health' : 'speed');
    }
}

function pathExistsWithChange(start, end, change) {
    // Create a temporary maze copy
    const tempMaze = [];
    for (let y = 0; y < GRID_SIZE; y++) {
        tempMaze[y] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            tempMaze[y][x] = { ...gameState.maze[y][x] };
        }
    }
    
    // Apply the proposed change
    tempMaze[change.y][change.x].type = change.type;
    
    // Use breadth-first search to check for a path
    const visited = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
    const queue = [{ x: start.x, y: start.y }];
    visited[start.y][start.x] = true;
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        // Check if we've reached the end
        if (current.x === end.x && current.y === end.y) {
            return true; // Path exists
        }
        
        // Check neighbors
        const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 1, dy: 0 },  // Right
            { dx: 0, dy: 1 },  // Down
            { dx: -1, dy: 0 }  // Left
        ];
        
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && 
                !visited[ny][nx] && tempMaze[ny][nx].type !== 'wall') {
                visited[ny][nx] = true;
                queue.push({ x: nx, y: ny });
            }
        }
    }
    
    return false; // No path exists
}

// Spawn a specific type of powerup based on player needs
function spawnSpecificPowerup(type) {
    let attempts = 0;
    while (attempts < 10) {
        const x = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
        const y = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
        
        if (gameState.maze[y][x].type === 'empty' &&
            (x !== gameState.player.x || y !== gameState.player.y) &&
            (x !== gameState.exit.x || y !== gameState.exit.y)) {
            
            // Check if a powerup already exists here
            const powerupExists = gameState.powerups.some(p => p.x === x && p.y === y);
            
            if (!powerupExists) {
                gameState.powerups.push({ x, y, type });
                break;
            }
        }
        attempts++;
    }
}

// Handle player movement
function movePlayer(dx, dy) {
    const newX = gameState.player.x + dx;
    const newY = gameState.player.y + dy;
    
    if (isValidMove(newX, newY)) {
        gameState.player.x = newX;
        gameState.player.y = newY;
        
        // Record this move for adaptation
        gameState.playerHistory.push({ dx, dy });
        if (gameState.playerHistory.length > 20) {
            gameState.playerHistory.shift();
        }
        
        // Update score
        gameState.player.score += 1;
        
        // Check for powerup collection
        checkPowerupCollection();
        
        // Update UI to reflect score change
        updateUI();
        
        // Check win condition
        if (gameState.player.x === gameState.exit.x && gameState.player.y === gameState.exit.y) {
            gameState.won = true;
            showMessage("Level Complete! Starting next level...");
            
            // Update UI immediately to show new level
            updateUI();
            
            setTimeout(() => {
                initGame();
            }, 2000);
        }
    }
}

// Function to update UI elements
function updateUI() {
    document.getElementById('health-value').textContent = gameState.player.health;
    document.getElementById('score-value').textContent = gameState.player.score;
    document.getElementById('level-value').textContent = gameState.level;
}

function resizeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    const container = document.querySelector('.canvas-container');
    
    if (!container) {
        console.error('Canvas container not found');
        return;
    }
    
    const containerWidth = container.clientWidth;

    const maxSize = 350;
    const size = Math.min(containerWidth - 20, maxSize);

    // Update both style and logical size
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = size;   // Logical width
    canvas.height = size;  // Logical height

    render();  // Redraw after resizing
}

// Show message on screen
function showMessage(text) {
    const messageElement = document.getElementById('message');
    messageElement.textContent = text;
    messageElement.style.display = 'block';
    
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 2000);
}

// Event listeners for keyboard input
document.addEventListener('keydown', (e) => {
    if (gameState.gameOver || gameState.won) return;
    
    // Prevent default behavior for arrow keys to avoid page scrolling
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.key)) {
        e.preventDefault();
    }
    
    switch (e.key) {
        case 'ArrowUp':
            movePlayer(0, -1);
            break;
        case 'ArrowRight':
            movePlayer(1, 0);
            break;
        case 'ArrowDown':
            movePlayer(0, 1);
            break;
        case 'ArrowLeft':
            movePlayer(-1, 0);
            break;
    }
    
    // Render after movement
    render();
});
