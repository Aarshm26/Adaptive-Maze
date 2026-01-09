/**
 * VECTOR SHIFT - Core Logic
 * Featuring A* Pathfinding, Smooth LERP Movement, and Adaptive Grids
 */

const CFG = {
    GRID_SIZE: 15,
    WALL_CHANCE: 0.25,
    PLAYER_SPEED: 0.2, // Visual lerp speed (0-1)
    ENEMY_SPEED: 0.08, // Visual lerp speed
    COLORS: {
        wall: '#1e293b',
        floor: '#0f172a',
        player: '#38bdf8',
        enemy: '#f43f5e',
        exit: '#10b981',
        health: '#f43f5e',
        score: '#fbbf24'
    }
};

// --- UTILITY CLASS ---
class Utils {
    static lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }
    static dist(a, b) {
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    }
}

// --- PARTICLE SYSTEM ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.04;
        this.size *= 0.95;
    }
    draw(ctx, cs) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x * cs, this.y * cs, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- GAME LOGIC ---
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        
        // Logical State
        this.grid = [];
        this.player = { x: 1, y: 1, vx: 1, vy: 1, hp: 100, score: 0, iframe: 0 };
        this.enemies = [];
        this.items = [];
        this.exit = { x: CFG.GRID_SIZE-2, y: CFG.GRID_SIZE-2 };
        
        this.level = 1;
        this.running = false;
        
        // UI References
        this.ui = {
            menu: document.getElementById('main-menu'),
            title: document.getElementById('menu-title'),
            sub: document.getElementById('menu-subtitle'),
            btn: document.getElementById('start-btn'),
            notif: document.getElementById('notification-overlay'),
            hp: document.getElementById('ui-health'),
            score: document.getElementById('ui-score'),
            lvl: document.getElementById('ui-level')
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInputs();
        
        this.ui.btn.addEventListener('click', () => this.startGame());
        
        // Game Loop
        const loop = () => {
            if(this.running) this.update();
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    resize() {
        // Calculate square size based on container
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight);
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / CFG.GRID_SIZE;
    }

    // --- GENERATION ---
    generateMaze() {
        this.grid = [];
        for(let y=0; y<CFG.GRID_SIZE; y++) {
            let row = [];
            for(let x=0; x<CFG.GRID_SIZE; x++) {
                // Borders are walls
                if(x===0 || y===0 || x===CFG.GRID_SIZE-1 || y===CFG.GRID_SIZE-1) {
                    row.push({ type: 'wall', scale: 1 });
                } else {
                    row.push({ 
                        type: Math.random() < CFG.WALL_CHANCE ? 'wall' : 'floor',
                        scale: 0 // For animation
                    });
                }
            }
            this.grid.push(row);
        }
        
        // Clear Start and Exit
        this.grid[1][1].type = 'floor';
        this.grid[this.exit.y][this.exit.x].type = 'floor';
        
        // Ensure path exists (Flood Fill check could go here, but brute force regen is simpler for this scale)
        if(!this.pathExists({x:1,y:1}, this.exit)) this.generateMaze();
    }

    pathExists(start, end) {
        // Simple BFS to check connectivity
        let q = [start];
        let visited = new Set();
        visited.add(`${start.x},${start.y}`);
        
        while(q.length) {
            let curr = q.shift();
            if(curr.x === end.x && curr.y === end.y) return true;
            
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx, dy]) => {
                let nx = curr.x+dx, ny = curr.y+dy;
                if(nx>0 && ny>0 && nx<CFG.GRID_SIZE-1 && ny<CFG.GRID_SIZE-1) {
                    if(this.grid[ny][nx].type !== 'wall' && !visited.has(`${nx},${ny}`)) {
                        visited.add(`${nx},${ny}`);
                        q.push({x:nx, y:ny});
                    }
                }
            });
        }
        return false;
    }

    // --- INPUTS ---
    setupInputs() {
        const move = (dx, dy) => {
            if(!this.running) return;
            const nx = this.player.x + dx;
            const ny = this.player.y + dy;
            if(this.grid[ny][nx].type !== 'wall') {
                this.player.x = nx;
                this.player.y = ny;
                this.player.score++;
                this.updateUI();
                this.adaptMaze(); // Trigger adaptation logic
            }
        };

        window.addEventListener('keydown', e => {
            if(['ArrowUp','w'].includes(e.key)) move(0, -1);
            if(['ArrowDown','s'].includes(e.key)) move(0, 1);
            if(['ArrowLeft','a'].includes(e.key)) move(-1, 0);
            if(['ArrowRight','d'].includes(e.key)) move(1, 0);
        });

        // Simple Swipe for mobile
        let tsX, tsY;
        this.canvas.addEventListener('touchstart', e => {
            tsx = e.touches[0].clientX;
            tsy = e.touches[0].clientY;
        });
        this.canvas.addEventListener('touchend', e => {
            let dx = e.changedTouches[0].clientX - tsx;
            let dy = e.changedTouches[0].clientY - tsy;
            if(Math.abs(dx) > Math.abs(dy)) move(dx>0?1:-1, 0);
            else move(0, dy>0?1:-1);
        });
    }

    // --- GAMEPLAY CONTROL ---
    startGame() {
        this.ui.menu.classList.add('hidden');
        this.player.score = 0;
        this.player.hp = 100;
        this.level = 1;
        this.running = true;
        this.startLevel();
    }

    startLevel() {
        this.exit = { x: CFG.GRID_SIZE-2, y: CFG.GRID_SIZE-2 };
        this.generateMaze();
        this.player.x = 1; this.player.y = 1;
        this.player.vx = 1; this.player.vy = 1; // Reset visuals
        
        // Spawn Enemies
        this.enemies = [];
        let enemyCount = 1 + Math.floor(this.level / 2);
        for(let i=0; i<enemyCount; i++) this.spawnEntity('enemy');
        
        // Spawn Items
        this.items = [];
        for(let i=0; i<3; i++) this.spawnEntity('item');
        
        this.updateUI();
    }

    spawnEntity(type) {
        let x, y;
        do {
            x = Math.floor(Math.random()*(CFG.GRID_SIZE-2))+1;
            y = Math.floor(Math.random()*(CFG.GRID_SIZE-2))+1;
        } while(this.grid[y][x].type === 'wall' || (x===1 && y===1));
        
        if(type === 'enemy') {
            this.enemies.push({ x, y, vx: x, vy: y, timer: 0 });
        } else {
            this.items.push({ x, y, type: Math.random()>0.5 ? 'hp' : 'score' });
        }
    }

    // --- UPDATE LOOP ---
    update() {
        // 1. Smooth Movement (LERP)
        this.player.vx = Utils.lerp(this.player.vx, this.player.x, CFG.PLAYER_SPEED);
        this.player.vy = Utils.lerp(this.player.vy, this.player.y, CFG.PLAYER_SPEED);

        // 2. Wall Animation
        for(let row of this.grid) {
            for(let cell of row) {
                if(cell.type === 'wall' && cell.scale < 1) cell.scale += 0.1;
            }
        }

        // 3. Enemies
        this.enemies.forEach(en => {
            // Visual Lerp
            en.vx = Utils.lerp(en.vx, en.x, CFG.ENEMY_SPEED);
            en.vy = Utils.lerp(en.vy, en.y, CFG.ENEMY_SPEED);
            
            // AI Logic (Move every 60 frames approx)
            en.timer++;
            if(en.timer > 50 - (this.level * 2)) { 
                en.timer = 0;
                this.moveEnemy(en);
            }
            
            // Collision with Player
            let dist = Utils.dist({x:en.vx, y:en.vy}, {x:this.player.vx, y:this.player.vy});
            if(dist < 0.6 && this.player.iframe <= 0) {
                this.hitPlayer();
            }
        });

        if(this.player.iframe > 0) this.player.iframe--;

        // 4. Items
        for(let i = this.items.length-1; i>=0; i--) {
            let it = this.items[i];
            let dist = Utils.dist({x:it.x, y:it.y}, {x:this.player.vx, y:this.player.vy});
            if(dist < 0.5) {
                this.collectItem(it);
                this.items.splice(i, 1);
            }
        }

        // 5. Exit
        if(this.player.x === this.exit.x && this.player.y === this.exit.y) {
            this.levelUp();
        }

        // 6. Particles
        this.particles.forEach((p, i) => {
            p.update();
            if(p.life <= 0) this.particles.splice(i, 1);
        });
    }

    moveEnemy(enemy) {
        // A* Pathfinding (Simplified)
        // Find next step towards player
        let path = this.findPath({x:enemy.x, y:enemy.y}, {x:this.player.x, y:this.player.y});
        if(path && path.length > 1) {
            enemy.x = path[1].x;
            enemy.y = path[1].y;
        }
    }

    findPath(start, end) {
        // Standard A* implementation
        let open = [start], closed = [], cameFrom = {}, gScore = {}, fScore = {};
        const k = n => `${n.x},${n.y}`;
        gScore[k(start)] = 0;
        fScore[k(start)] = Utils.dist(start, end);
        
        while(open.length) {
            let curr = open.reduce((a,b) => fScore[k(a)] < fScore[k(b)] ? a : b);
            if(curr.x === end.x && curr.y === end.y) {
                let path = [curr];
                while(k(curr) in cameFrom) { curr = cameFrom[k(curr)]; path.push(curr); }
                return path.reverse();
            }
            open = open.filter(n => n!==curr);
            closed.push(curr);
            
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx, dy]) => {
                let nx = curr.x+dx, ny = curr.y+dy;
                if(nx<1 || ny<1 || nx>=CFG.GRID_SIZE-1 || ny>=CFG.GRID_SIZE-1) return;
                if(this.grid[ny][nx].type === 'wall' || closed.some(c=>c.x===nx && c.y===ny)) return;
                
                let tentativeG = gScore[k(curr)] + 1;
                if(!open.some(o=>o.x===nx && o.y===ny)) open.push({x:nx, y:ny});
                else if(tentativeG >= gScore[k({x:nx,y:ny})]) return;
                
                cameFrom[k({x:nx,y:ny})] = curr;
                gScore[k({x:nx,y:ny})] = tentativeG;
                fScore[k({x:nx,y:ny})] = tentativeG + Utils.dist({x:nx,y:ny}, end);
            });
        }
        return [];
    }

    hitPlayer() {
        this.player.hp -= 20;
        this.player.iframe = 60; // 1 second invulnerability
        this.spawnParticles(this.player.vx, this.player.vy, CFG.COLORS.health, 10);
        this.updateUI();
        
        // Shake Effect
        this.canvas.style.transform = `translate(${Math.random()*10-5}px, ${Math.random()*10-5}px)`;
        setTimeout(() => this.canvas.style.transform = 'none', 200);

        if(this.player.hp <= 0) this.gameOver();
    }

    collectItem(item) {
        if(item.type === 'hp') {
            this.player.hp = Math.min(100, this.player.hp + 20);
            this.spawnParticles(item.x, item.y, CFG.COLORS.health, 8);
        } else {
            this.player.score += 50;
            this.spawnParticles(item.x, item.y, CFG.COLORS.score, 8);
        }
        this.updateUI();
    }

    adaptMaze() {
        // 10% chance to modify a block near player
        if(Math.random() < 0.1) {
            let rx = Math.floor(Math.random()*(CFG.GRID_SIZE-2))+1;
            let ry = Math.floor(Math.random()*(CFG.GRID_SIZE-2))+1;
            // Don't spawn on entities
            if(Utils.dist({x:rx, y:ry}, this.player) > 2) {
                if(this.grid[ry][rx].type === 'floor') {
                    // Check if blocking creates unsolveable state (simplified)
                    this.grid[ry][rx].type = 'wall';
                    if(!this.pathExists(this.player, this.exit)) {
                        this.grid[ry][rx].type = 'floor'; // Revert
                    } else {
                        this.grid[ry][rx].scale = 0; // Animate in
                    }
                }
            }
        }
    }

    levelUp() {
        this.level++;
        this.player.score += 100;
        
        // Show Toast Notification (No popup)
        this.ui.notif.classList.remove('hidden');
        document.getElementById('notif-title').innerText = `LEVEL ${this.level}`;
        setTimeout(() => this.ui.notif.classList.add('hidden'), 2000);
        
        this.startLevel();
    }

    gameOver() {
        this.running = false;
        this.ui.menu.classList.remove('hidden');
        this.ui.title.innerText = "CRITICAL FAILURE";
        this.ui.sub.innerText = `Final Score: ${this.player.score}`;
        this.ui.btn.innerText = "REBOOT SYSTEM";
    }

    updateUI() {
        this.ui.hp.innerText = this.player.hp;
        this.ui.score.innerText = this.player.score;
        this.ui.lvl.innerText = this.level;
    }

    spawnParticles(gx, gy, color, count) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(gx, gy, color));
        }
    }

    // --- RENDER ---
    draw() {
        // Clear background
        this.ctx.fillStyle = CFG.COLORS.floor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cs = this.cellSize;

        // Draw Grid Elements
        for(let y=0; y<CFG.GRID_SIZE; y++) {
            for(let x=0; x<CFG.GRID_SIZE; x++) {
                let cell = this.grid[y][x];
                let px = x * cs;
                let py = y * cs;

                if(cell.type === 'wall') {
                    let size = cs * cell.scale;
                    let offset = (cs - size) / 2;
                    
                    this.ctx.fillStyle = CFG.COLORS.wall;
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    this.ctx.fillRect(px + offset, py + offset, size, size);
                    this.ctx.shadowBlur = 0;
                    
                    // Top Highlight
                    this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
                    this.ctx.fillRect(px + offset, py + offset, size, size/2);
                } else {
                    // Faint grid dots
                    this.ctx.fillStyle = 'rgba(255,255,255,0.03)';
                    this.ctx.fillRect(px + cs/2 - 1, py + cs/2 - 1, 2, 2);
                }
            }
        }

        // Draw Items
        this.items.forEach(it => {
            let cx = it.x * cs + cs/2;
            let cy = it.y * cs + cs/2;
            this.ctx.fillStyle = it.type === 'hp' ? CFG.COLORS.health : CFG.COLORS.score;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = this.ctx.fillStyle;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, cs/4, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            
            // Float animation
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, (cs/3) + Math.sin(Date.now()/300)*2, 0, Math.PI*2);
            this.ctx.stroke();
        });

        // Draw Exit
        let ex = this.exit.x * cs + cs/2;
        let ey = this.exit.y * cs + cs/2;
        this.ctx.strokeStyle = CFG.COLORS.exit;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(ex, ey, cs/3, 0, Math.PI*2);
        this.ctx.stroke();
        // Pulsing center
        this.ctx.fillStyle = CFG.COLORS.exit;
        this.ctx.globalAlpha = 0.3 + Math.sin(Date.now()/200)*0.2;
        this.ctx.beginPath();
        this.ctx.arc(ex, ey, cs/4, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;

        // Draw Player
        let px = this.player.vx * cs + cs/2;
        let py = this.player.vy * cs + cs/2;
        
        this.ctx.fillStyle = CFG.COLORS.player;
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = CFG.COLORS.player;
        this.ctx.beginPath();
        this.ctx.arc(px, py, cs/3, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        if(this.player.iframe > 0 && Math.floor(Date.now()/50)%2===0) {
            this.ctx.fillStyle = '#fff';
            this.ctx.fill();
        }

        // Draw Enemies
        this.enemies.forEach(en => {
            let ex = en.vx * cs + cs/2;
            let ey = en.vy * cs + cs/2;
            
            this.ctx.fillStyle = CFG.COLORS.enemy;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = CFG.COLORS.enemy;
            
            // Triangle shape for enemy
            this.ctx.beginPath();
            this.ctx.moveTo(ex, ey - cs/3);
            this.ctx.lineTo(ex + cs/3, ey + cs/3);
            this.ctx.lineTo(ex - cs/3, ey + cs/3);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx, cs));
    }
}

// Init
window.onload = () => new Game();
