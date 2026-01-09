/**
 * NEUROMAZE
 * A Portfolio Project showcasing A* Pathfinding, Procedural Generation, and Adaptive AI.
 */

// --- CONFIGURATION ---
const CONSTANTS = {
    GRID_SIZE: 15,
    CELL_SIZE: 40, // Base size, will scale
    WALL_ADAPT_CHANCE: 0.3,
    ENEMY_SPEED: 3.5, // Tiles per second
    PLAYER_SPEED: 8, // Tiles per second (smooth movement)
    COLORS: {
        wall: '#111',
        wallBorder: '#00f3ff',
        floor: '#0a0a16',
        warning: 'rgba(255, 170, 0, 0.3)',
        path: 'rgba(255, 255, 255, 0.05)'
    }
};

// --- UTILITIES ---
class Utils {
    static lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }
    
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static getDistance(a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    }
}

// --- PARTICLE SYSTEM (Visual Polish) ---
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- MAZE LOGIC ---
class Maze {
    constructor(size) {
        this.size = size;
        this.grid = [];
        this.wallsToSpawn = []; // Queue for warning phase
        this.generate();
    }

    generate() {
        this.grid = [];
        for (let y = 0; y < this.size; y++) {
            let row = [];
            for (let x = 0; x < this.size; x++) {
                // Border walls
                if (x === 0 || y === 0 || x === this.size - 1 || y === this.size - 1) {
                    row.push({ type: 'wall', adaptability: 0 });
                } else {
                    // Random internal walls
                    let isWall = Math.random() < 0.25;
                    row.push({ 
                        type: isWall ? 'wall' : 'floor', 
                        adaptability: Math.random(),
                        warningTimer: 0
                    });
                }
            }
            this.grid.push(row);
        }
        // Clear start and end
        this.grid[1][1].type = 'floor';
        this.grid[this.size-2][this.size-2].type = 'floor';
    }

    // A* Pathfinding
    findPath(start, end) {
        let openSet = [start];
        let closedSet = [];
        let cameFrom = {};
        let gScore = {};
        let fScore = {};

        // Helper to generate key
        const k = (pt) => `${pt.x},${pt.y}`;

        gScore[k(start)] = 0;
        fScore[k(start)] = Utils.getDistance(start, end);

        while (openSet.length > 0) {
            // Find node with lowest fScore
            let current = openSet.reduce((a, b) => (fScore[k(a)] < fScore[k(b)] ? a : b));

            if (current.x === end.x && current.y === end.y) {
                let totalPath = [current];
                while (k(current) in cameFrom) {
                    current = cameFrom[k(current)];
                    totalPath.push(current);
                }
                return totalPath.reverse();
            }

            openSet = openSet.filter(n => n !== current);
            closedSet.push(current);

            const neighbors = [
                {x:0, y:-1}, {x:1, y:0}, {x:0, y:1}, {x:-1, y:0}
            ];

            for (let offset of neighbors) {
                let neighbor = { x: current.x + offset.x, y: current.y + offset.y };
                
                // Check bounds and walls
                if (neighbor.x < 0 || neighbor.x >= this.size || neighbor.y < 0 || neighbor.y >= this.size) continue;
                if (this.grid[neighbor.y][neighbor.x].type === 'wall') continue;
                
                // Check if closed
                if (closedSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) continue;

                let tentativeG = gScore[k(current)] + 1;

                if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                    openSet.push(neighbor);
                } else if (tentativeG >= (gScore[k(neighbor)] || Infinity)) {
                    continue;
                }

                cameFrom[k(neighbor)] = current;
                gScore[k(neighbor)] = tentativeG;
                fScore[k(neighbor)] = tentativeG + Utils.getDistance(neighbor, end);
            }
        }
        return []; // No path
    }

    adaptToPlayer(playerPath, playerPos, exitPos) {
        // Logic: Find floor tiles player uses often and threaten to turn them into walls
        // But verify path still exists
        
        // Pick a random spot near player but not ON player
        let attempt = 0;
        while(attempt < 5) {
            let rx = Utils.randomInt(1, this.size-2);
            let ry = Utils.randomInt(1, this.size-2);
            
            // Distance check
            let dist = Utils.getDistance({x:rx, y:ry}, playerPos);
            
            if (this.grid[ry][rx].type === 'floor' && dist > 2 && dist < 6) {
                // Check if making this a wall breaks the game
                this.grid[ry][rx].type = 'wall';
                let pathExists = this.findPath(playerPos, exitPos).length > 0;
                this.grid[ry][rx].type = 'floor'; // Revert

                if (pathExists) {
                    this.grid[ry][rx].type = 'warning';
                    this.grid[ry][rx].warningTimer = 2000; // 2 seconds warning
                    return true;
                }
            }
            attempt++;
        }
        return false;
    }

    update(dt) {
        // Handle warning tiles turning into walls
        for(let y=0; y<this.size; y++) {
            for(let x=0; x<this.size; x++) {
                let cell = this.grid[y][x];
                if (cell.type === 'warning') {
                    cell.warningTimer -= dt;
                    if (cell.warningTimer <= 0) {
                        cell.type = 'wall';
                        // Spawn particles effect handled in game render
                    }
                }
            }
        }
    }
}

// --- ENTITIES ---
class Player {
    constructor(x, y) {
        this.gridX = x;
        this.gridY = y;
        this.visualX = x; // For smooth interpolation
        this.visualY = y;
        this.health = 100;
        this.score = 0;
        this.moveQueue = []; // For handling quick inputs
        this.isMoving = false;
        this.moveTimer = 0;
    }

    move(dx, dy, maze) {
        if (this.isMoving) return; // Wait for current move to finish

        let targetX = this.gridX + dx;
        let targetY = this.gridY + dy;

        // Wall Collision
        let cell = maze.grid[targetY][targetX];
        if (cell.type === 'wall') return;

        this.gridX = targetX;
        this.gridY = targetY;
        this.isMoving = true;
        this.moveTimer = 0;
        this.score++;
    }

    update(dt, playerSpeed) {
        // Smooth slide logic
        if (this.isMoving) {
            // Simple lerp approach
            const speed = playerSpeed * (dt / 1000);
            
            let diffX = this.gridX - this.visualX;
            let diffY = this.gridY - this.visualY;
            
            this.visualX += diffX * 0.3; // Slide factor
            this.visualY += diffY * 0.3;

            // Snap when close
            if (Math.abs(diffX) < 0.01 && Math.abs(diffY) < 0.01) {
                this.visualX = this.gridX;
                this.visualY = this.gridY;
                this.isMoving = false;
            }
        }
    }
}

class Enemy {
    constructor(x, y) {
        this.gridX = x;
        this.gridY = y;
        this.visualX = x;
        this.visualY = y;
        this.path = [];
        this.moveTimer = 0;
        this.moveInterval = 600; // ms per move
    }

    update(dt, maze, playerPos) {
        // Visual smoothing
        let diffX = this.gridX - this.visualX;
        let diffY = this.gridY - this.visualY;
        this.visualX += diffX * 0.1;
        this.visualY += diffY * 0.1;

        // AI Logic
        this.moveTimer += dt;
        if (this.moveTimer > this.moveInterval) {
            this.moveTimer = 0;
            this.calculateMove(maze, playerPos);
        }
    }

    calculateMove(maze, playerPos) {
        // Recalculate path to player
        this.path = maze.findPath({x: this.gridX, y: this.gridY}, playerPos);
        
        // path[0] is current pos, path[1] is next
        if (this.path.length > 1) {
            this.gridX = this.path[1].x;
            this.gridY = this.path[1].y;
        }
    }
}

// --- MAIN GAME ENGINE ---
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ui = {
            overlay: document.getElementById('game-overlay'),
            title: document.getElementById('modal-title'),
            desc: document.getElementById('modal-desc'),
            btn: document.getElementById('start-btn'),
            health: document.getElementById('ui-health'),
            score: document.getElementById('ui-score'),
            level: document.getElementById('ui-level'),
            toast: document.getElementById('toast')
        };

        this.maze = new Maze(CONSTANTS.GRID_SIZE);
        this.player = new Player(1, 1);
        this.enemies = [];
        this.particles = [];
        this.items = []; // Powerups
        
        this.level = 1;
        this.isRunning = false;
        this.lastTime = 0;
        this.exitPos = { x: CONSTANTS.GRID_SIZE - 2, y: CONSTANTS.GRID_SIZE - 2 };

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInputs();
        
        this.ui.btn.addEventListener('click', () => this.startLevel());
        
        // Start Render Loop
        requestAnimationFrame((ts) => this.loop(ts));
    }

    resize() {
        const size = Math.min(window.innerWidth, window.innerHeight - 100, 600);
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / CONSTANTS.GRID_SIZE;
    }

    setupInputs() {
        const handleMove = (dx, dy) => {
            if (this.isRunning) this.player.move(dx, dy, this.maze);
        };

        document.addEventListener('keydown', (e) => {
            if (!this.isRunning) return;
            switch(e.key) {
                case 'ArrowUp': case 'w': case 'W': handleMove(0, -1); break;
                case 'ArrowDown': case 's': case 'S': handleMove(0, 1); break;
                case 'ArrowLeft': case 'a': case 'A': handleMove(-1, 0); break;
                case 'ArrowRight': case 'd': case 'D': handleMove(1, 0); break;
            }
        });

        // Touch Controls
        ['up', 'down', 'left', 'right'].forEach(dir => {
            document.getElementById(`btn-${dir}`).addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent scroll
                if (dir === 'up') handleMove(0, -1);
                if (dir === 'down') handleMove(0, 1);
                if (dir === 'left') handleMove(-1, 0);
                if (dir === 'right') handleMove(1, 0);
            });
        });
    }

    startLevel() {
        this.ui.overlay.classList.add('hidden');
        this.isRunning = true;
        
        // Reset Level State
        this.maze.generate();
        this.maze.findPath({x:1, y:1}, this.exitPos); // Ensure solvable
        
        this.player.gridX = 1; this.player.gridY = 1;
        this.player.visualX = 1; this.player.visualY = 1;
        
        // Spawn Enemies based on level
        this.enemies = [];
        let enemyCount = 1 + Math.floor(this.level / 2);
        for(let i=0; i<enemyCount; i++) {
            let ex = Utils.randomInt(5, CONSTANTS.GRID_SIZE-2);
            let ey = Utils.randomInt(5, CONSTANTS.GRID_SIZE-2);
            if(this.maze.grid[ey][ex].type === 'floor') {
                this.enemies.push(new Enemy(ex, ey));
            }
        }

        // Spawn Items (Health/Score)
        this.items = [];
        for(let i=0; i<3; i++) {
            this.spawnItem();
        }

        this.ui.level.innerText = this.level;
    }

    spawnItem() {
        let x, y;
        do {
            x = Utils.randomInt(1, CONSTANTS.GRID_SIZE-2);
            y = Utils.randomInt(1, CONSTANTS.GRID_SIZE-2);
        } while (this.maze.grid[y][x].type !== 'floor');
        
        this.items.push({ x, y, type: Math.random() > 0.3 ? 'score' : 'health' });
    }

    spawnParticles(x, y, color, count) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    gameOver(won) {
        this.isRunning = false;
        this.ui.overlay.classList.remove('hidden');
        
        if (won) {
            this.ui.title.innerText = "SEQUENCE COMPLETE";
            this.ui.title.style.color = "#0aff0a";
            this.ui.desc.innerText = `Level ${this.level} bypassed. Preparing next firewall layer...`;
            this.ui.btn.innerText = "NEXT LEVEL";
            this.level++;
        } else {
            this.ui.title.innerText = "CONNECTION LOST";
            this.ui.title.style.color = "#ff0055";
            this.ui.desc.innerText = `Caught by security protocol. Final Score: ${this.player.score}`;
            this.ui.btn.innerText = "REBOOT SYSTEM";
            this.level = 1;
            this.player.score = 0;
            this.player.health = 100;
        }
        this.ui.health.innerText = this.player.health;
        this.ui.score.innerText = this.player.score;
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (this.isRunning) {
            this.update(dt);
        }
        this.draw();

        requestAnimationFrame((ts) => this.loop(ts));
    }

    update(dt) {
        this.maze.update(dt);
        this.player.update(dt, CONSTANTS.PLAYER_SPEED);
        
        // Randomly Adapt Maze
        if (Math.random() < 0.005) { // Low chance per tick
            if (this.maze.adaptToPlayer([], {x:this.player.gridX, y:this.player.gridY}, this.exitPos)) {
                this.ui.toast.classList.remove('hidden');
                setTimeout(() => this.ui.toast.classList.add('hidden'), 2000);
            }
        }

        // Entities
        this.enemies.forEach(enemy => enemy.update(dt, this.maze, {x:this.player.gridX, y:this.player.gridY}));
        
        // Collisions
        // 1. Enemy
        this.enemies.forEach(enemy => {
            if (Utils.getDistance(this.player, {x: enemy.visualX, y: enemy.visualY}) < 0.5) {
                this.player.health -= 20;
                this.spawnParticles(this.player.visualX * this.cellSize, this.player.visualY * this.cellSize, '#ff0055', 10);
                this.ui.health.innerText = this.player.health;
                
                // Knockback
                this.player.gridX = 1;
                this.player.gridY = 1;
                this.player.visualX = 1;
                this.player.visualY = 1;

                if (this.player.health <= 0) this.gameOver(false);
            }
        });

        // 2. Items
        for(let i = this.items.length-1; i>=0; i--) {
            let item = this.items[i];
            if (item.x === this.player.gridX && item.y === this.player.gridY) {
                if (item.type === 'health') {
                    this.player.health = Math.min(100, this.player.health + 20);
                    this.spawnParticles(item.x * this.cellSize + this.cellSize/2, item.y * this.cellSize + this.cellSize/2, '#0aff0a', 15);
                } else {
                    this.player.score += 50;
                    this.spawnParticles(item.x * this.cellSize + this.cellSize/2, item.y * this.cellSize + this.cellSize/2, '#ffee00', 15);
                }
                this.items.splice(i, 1);
                this.spawnItem(); // Replace
                this.ui.health.innerText = this.player.health;
                this.ui.score.innerText = this.player.score;
            }
        }

        // 3. Exit
        if (this.player.gridX === this.exitPos.x && this.player.gridY === this.exitPos.y) {
            this.gameOver(true);
        }

        // Particles
        this.particles.forEach((p, index) => {
            p.update();
            if (p.life <= 0) this.particles.splice(index, 1);
        });
    }

    draw() {
        this.ctx.fillStyle = CONSTANTS.COLORS.floor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cs = this.cellSize;

        // Draw Maze
        for(let y=0; y<CONSTANTS.GRID_SIZE; y++) {
            for(let x=0; x<CONSTANTS.GRID_SIZE; x++) {
                let cell = this.maze.grid[y][x];
                let px = x * cs;
                let py = y * cs;

                if (cell.type === 'wall') {
                    this.ctx.fillStyle = CONSTANTS.COLORS.wall;
                    this.ctx.fillRect(px, py, cs, cs);
                    
                    // Neon Border
                    this.ctx.strokeStyle = CONSTANTS.COLORS.wallBorder;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(px + 4, py + 4, cs - 8, cs - 8);
                    
                    // Glow
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = CONSTANTS.COLORS.wallBorder;
                    this.ctx.strokeRect(px + 4, py + 4, cs - 8, cs - 8);
                    this.ctx.shadowBlur = 0;
                } else if (cell.type === 'warning') {
                    // Flashing floor
                    this.ctx.fillStyle = `rgba(255, 170, 0, ${0.3 + Math.sin(Date.now()/100) * 0.2})`;
                    this.ctx.fillRect(px, py, cs, cs);
                } else {
                    // Grid dots
                    this.ctx.fillStyle = '#1a1a2e';
                    this.ctx.fillRect(px + cs/2 - 1, py + cs/2 - 1, 2, 2);
                }
            }
        }

        // Draw Exit
        let ex = this.exitPos.x * cs;
        let ey = this.exitPos.y * cs;
        this.ctx.fillStyle = 'rgba(10, 255, 10, 0.2)';
        this.ctx.fillRect(ex, ey, cs, cs);
        this.ctx.strokeStyle = '#0aff0a';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(ex+5, ey+5, cs-10, cs-10);

        // Draw Items
        this.items.forEach(item => {
            let cx = item.x * cs + cs/2;
            let cy = item.y * cs + cs/2;
            this.ctx.fillStyle = item.type === 'health' ? '#ff0055' : '#ffee00';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 5, 0, Math.PI*2);
            this.ctx.fill();
            // Pulse ring
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.ctx.fillStyle;
            this.ctx.lineWidth = 1;
            this.ctx.arc(cx, cy, 8 + Math.sin(Date.now()/200)*3, 0, Math.PI*2);
            this.ctx.stroke();
        });

        // Draw Player
        let px = this.player.visualX * cs + cs/2;
        let py = this.player.visualY * cs + cs/2;
        
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(px, py, cs/3, 0, Math.PI*2);
        this.ctx.fill();
        
        // Player Glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(px, py, cs/3, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Draw Enemies
        this.enemies.forEach(en => {
            let ex = en.visualX * cs + cs/2;
            let ey = en.visualY * cs + cs/2;
            
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.moveTo(ex, ey - 10);
            this.ctx.lineTo(ex + 10, ey + 10);
            this.ctx.lineTo(ex - 10, ey + 10);
            this.ctx.fill();
            
            // "Eye" line
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(ex, ey);
            this.ctx.lineTo(px, py); // Look at player
            this.ctx.globalAlpha = 0.2; // Faint gaze beam
            this.ctx.stroke();
            this.ctx.globalAlpha = 1.0;
        });

        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx));
    }
}

// Start the game
window.onload = () => {
    new Game();
};
