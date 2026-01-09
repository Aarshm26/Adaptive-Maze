/**
 * SKETCHLOGIC
 * Hand-drawn aesthetic procedural generation engine.
 */

const CONSTANTS = {
    GRID_SIZE: 15,
    CELL_SIZE: 0, // Calculated at runtime
    ENEMY_SPEED: 3.5,
    PLAYER_SPEED: 8,
    COLORS: {
        ink: '#2c3e50',
        paper: '#ffffff',
        accent: '#e74c3c', // Red pen
        highlight: '#3498db', // Blue pen
        pencil: '#bdc3c7'
    }
};

class Utils {
    static randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    static getDistance(a, b) { return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)); }
    
    // Simulates a hand-drawn line with slight irregularity
    static drawWobblyLine(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        // Add a mid-point with jitter
        const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 4;
        const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 4;
        ctx.quadraticCurveTo(midX, midY, x2, y2);
        ctx.stroke();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = (Math.random() - 0.5) * 3;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        // Draw little squares/confetti instead of perfect circles
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.random() * Math.PI);
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.restore();
        ctx.globalAlpha = 1.0;
    }
}

class Maze {
    constructor(size) {
        this.size = size;
        this.grid = [];
        this.generate();
    }

    generate() {
        this.grid = [];
        for (let y = 0; y < this.size; y++) {
            let row = [];
            for (let x = 0; x < this.size; x++) {
                if (x === 0 || y === 0 || x === this.size - 1 || y === this.size - 1) {
                    row.push({ type: 'wall' });
                } else {
                    row.push({ 
                        type: Math.random() < 0.25 ? 'wall' : 'floor',
                        warningTimer: 0
                    });
                }
            }
            this.grid.push(row);
        }
        this.grid[1][1].type = 'floor';
        this.grid[this.size-2][this.size-2].type = 'floor';
    }

    findPath(start, end) {
        // Standard A* Implementation
        let open = [start], closed = [], cameFrom = {}, gScore = {}, fScore = {};
        const k = (n) => `${n.x},${n.y}`;
        gScore[k(start)] = 0;
        fScore[k(start)] = Utils.getDistance(start, end);

        while(open.length > 0) {
            let current = open.reduce((a,b) => fScore[k(a)] < fScore[k(b)] ? a : b);
            if(current.x === end.x && current.y === end.y) {
                let path = [current];
                while(k(current) in cameFrom) { current = cameFrom[k(current)]; path.push(current); }
                return path.reverse();
            }
            open = open.filter(n => n !== current);
            closed.push(current);

            [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}].forEach(offset => {
                let n = {x: current.x + offset.x, y: current.y + offset.y};
                if(n.x < 0 || n.y < 0 || n.x >= this.size || n.y >= this.size) return;
                if(this.grid[n.y][n.x].type === 'wall' || closed.some(cl => cl.x === n.x && cl.y === n.y)) return;
                
                let g = gScore[k(current)] + 1;
                if(!open.some(o => o.x === n.x && o.y === n.y)) open.push(n);
                else if(g >= gScore[k(n)]) return;
                
                cameFrom[k(n)] = current;
                gScore[k(n)] = g;
                fScore[k(n)] = g + Utils.getDistance(n, end);
            });
        }
        return [];
    }

    adapt(playerPos, exitPos) {
        // "Scribble out" a random floor tile near the player
        for(let i=0; i<5; i++) {
            let rx = Utils.randomInt(1, this.size-2);
            let ry = Utils.randomInt(1, this.size-2);
            let dist = Utils.getDistance({x:rx, y:ry}, playerPos);
            
            if(this.grid[ry][rx].type === 'floor' && dist > 2 && dist < 6) {
                this.grid[ry][rx].type = 'wall';
                if(this.findPath(playerPos, exitPos).length > 0) {
                    this.grid[ry][rx].type = 'warning';
                    this.grid[ry][rx].warningTimer = 1500;
                    return true;
                }
                this.grid[ry][rx].type = 'floor';
            }
        }
        return false;
    }

    update(dt) {
        for(let y=0; y<this.size; y++) {
            for(let x=0; x<this.size; x++) {
                if(this.grid[y][x].type === 'warning') {
                    this.grid[y][x].warningTimer -= dt;
                    if(this.grid[y][x].warningTimer <= 0) this.grid[y][x].type = 'wall';
                }
            }
        }
    }
}

class Player {
    constructor(x, y) {
        this.gx = x; this.gy = y;
        this.vx = x; this.vy = y;
        this.health = 100;
        this.score = 0;
        this.moving = false;
    }

    move(dx, dy, maze) {
        if(this.moving) return;
        if(maze.grid[this.gy + dy][this.gx + dx].type !== 'wall') {
            this.gx += dx;
            this.gy += dy;
            this.moving = true;
            this.score++;
        }
    }

    update(dt) {
        if(this.moving) {
            let dx = this.gx - this.vx, dy = this.gy - this.vy;
            this.vx += dx * 0.3;
            this.vy += dy * 0.3;
            if(Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
                this.vx = this.gx; this.vy = this.gy;
                this.moving = false;
            }
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.maze = new Maze(CONSTANTS.GRID_SIZE);
        this.player = new Player(1, 1);
        this.enemies = [];
        this.items = [];
        this.particles = [];
        this.running = false;
        this.level = 1;
        this.lastTime = 0;
        
        this.ui = {
            overlay: document.getElementById('game-overlay'),
            title: document.getElementById('modal-title'),
            desc: document.getElementById('modal-desc'),
            btn: document.getElementById('start-btn'),
            hp: document.getElementById('ui-health'),
            score: document.getElementById('ui-score'),
            lvl: document.getElementById('ui-level'),
            toast: document.getElementById('toast')
        };

        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.setupInput();
        this.ui.btn.onclick = () => this.startLevel();
        requestAnimationFrame(t => this.loop(t));
    }

    resize() {
        const size = Math.min(window.innerWidth, window.innerHeight - 150, 600);
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / CONSTANTS.GRID_SIZE;
    }

    setupInput() {
        const move = (dx, dy) => { if(this.running) this.player.move(dx, dy, this.maze); };
        document.onkeydown = e => {
            if(e.key === 'w' || e.key === 'ArrowUp') move(0, -1);
            if(e.key === 's' || e.key === 'ArrowDown') move(0, 1);
            if(e.key === 'a' || e.key === 'ArrowLeft') move(-1, 0);
            if(e.key === 'd' || e.key === 'ArrowRight') move(1, 0);
        };
        // Bind Mobile
        ['up','down','left','right'].forEach(d => {
            document.getElementById(`btn-${d}`).ontouchstart = (e) => {
                e.preventDefault();
                if(d==='up') move(0,-1); if(d==='down') move(0,1);
                if(d==='left') move(-1,0); if(d==='right') move(1,0);
            };
        });
    }

    startLevel() {
        this.ui.overlay.classList.add('hidden');
        this.running = true;
        this.maze.generate();
        this.maze.findPath({x:1, y:1}, {x:13, y:13}); // Ensure path
        this.player.gx = 1; this.player.gy = 1;
        this.player.vx = 1; this.player.vy = 1;
        
        this.enemies = [];
        for(let i=0; i < 1 + Math.floor(this.level/2); i++) {
            let ex, ey;
            do { ex = Utils.randomInt(5, 13); ey = Utils.randomInt(5, 13); } 
            while(this.maze.grid[ey][ex].type === 'wall');
            this.enemies.push({x: ex, y: ey, vx: ex, vy: ey, path: [], timer: 0});
        }

        this.items = [];
        for(let i=0; i<3; i++) {
            let ix, iy;
            do { ix = Utils.randomInt(1, 13); iy = Utils.randomInt(1, 13); }
            while(this.maze.grid[iy][ix].type !== 'floor');
            this.items.push({x: ix, y: iy, type: Math.random()>0.5 ? 'hp' : 'score'});
        }
        this.ui.lvl.innerText = this.level;
    }

    loop(t) {
        let dt = t - this.lastTime;
        this.lastTime = t;
        if(this.running) this.update(dt);
        this.draw();
        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        this.player.update(dt);
        this.maze.update(dt);
        
        // Random adaptation
        if(Math.random() < 0.003) {
            if(this.maze.adapt({x:this.player.gx, y:this.player.gy}, {x:13, y:13})) {
                this.ui.toast.classList.remove('hidden');
                setTimeout(() => this.ui.toast.classList.add('hidden'), 2000);
            }
        }

        // Enemies
        this.enemies.forEach(en => {
            let dx = en.x - en.vx; let dy = en.y - en.vy;
            en.vx += dx * 0.1; en.vy += dy * 0.1;
            
            en.timer += dt;
            if(en.timer > 700) {
                en.timer = 0;
                en.path = this.maze.findPath({x:en.x, y:en.y}, {x:this.player.gx, y:this.player.gy});
                if(en.path.length > 1) { en.x = en.path[1].x; en.y = en.path[1].y; }
            }
            // Collision
            if(Utils.getDistance(this.player, {x:en.vx, y:en.vy}) < 0.5) {
                this.player.health -= 20;
                this.ui.hp.innerText = this.player.health;
                // Knockback
                this.player.gx = 1; this.player.gy = 1;
                this.player.vx = 1; this.player.vy = 1;
                if(this.player.health <= 0) this.endGame(false);
            }
        });

        // Items
        for(let i=this.items.length-1; i>=0; i--) {
            let it = this.items[i];
            if(it.x === this.player.gx && it.y === this.player.gy) {
                if(it.type==='hp') this.player.health = Math.min(100, this.player.health+20);
                else this.player.score += 50;
                
                // Spawn confetti
                for(let k=0; k<10; k++) this.particles.push(new Particle(it.x*this.cellSize+this.cellSize/2, it.y*this.cellSize+this.cellSize/2, it.type==='hp'?'#e74c3c':'#f1c40f'));
                
                this.items.splice(i, 1);
                this.ui.hp.innerText = this.player.health;
                this.ui.score.innerText = this.player.score;
            }
        }

        // Win
        if(this.player.gx === 13 && this.player.gy === 13) this.endGame(true);

        this.particles.forEach((p,i) => { p.update(); if(p.life<=0) this.particles.splice(i,1); });
    }

    endGame(win) {
        this.running = false;
        this.ui.overlay.classList.remove('hidden');
        this.ui.title.innerText = win ? "Draft Complete!" : "Scrapped!";
        this.ui.desc.innerText = win ? "Moving to next page..." : `Final Score: ${this.player.score}`;
        this.ui.btn.innerText = win ? "Next Sketch" : "Try Again";
        if(win) this.level++; else { this.level = 1; this.player.score = 0; this.player.health = 100; }
    }

    draw() {
        this.ctx.fillStyle = CONSTANTS.COLORS.paper;
        this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
        
        let cs = this.cellSize;
        
        // Draw Grid (Light Pencil)
        this.ctx.strokeStyle = '#ecf0f1';
        this.ctx.lineWidth = 1;
        for(let i=0; i<=CONSTANTS.GRID_SIZE; i++) {
            this.ctx.beginPath(); this.ctx.moveTo(i*cs, 0); this.ctx.lineTo(i*cs, this.canvas.height); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(0, i*cs); this.ctx.lineTo(this.canvas.width, i*cs); this.ctx.stroke();
        }

        // Draw Walls (Thick Ink)
        this.ctx.strokeStyle = CONSTANTS.COLORS.ink;
        this.ctx.lineWidth = 2.5;
        this.ctx.lineCap = 'round';
        
        for(let y=0; y<CONSTANTS.GRID_SIZE; y++) {
            for(let x=0; x<CONSTANTS.GRID_SIZE; x++) {
                let cell = this.maze.grid[y][x];
                let px = x*cs, py = y*cs;
                
                if(cell.type === 'wall') {
                    // Hatching effect for walls
                    this.ctx.beginPath();
                    this.ctx.rect(px+4, py+4, cs-8, cs-8);
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.moveTo(px+4, py+4); this.ctx.lineTo(px+cs-4, py+cs-4);
                    this.ctx.stroke();
                } else if(cell.type === 'warning') {
                    // Scribble effect
                    this.ctx.strokeStyle = CONSTANTS.COLORS.accent;
                    this.ctx.beginPath();
                    this.ctx.moveTo(px+2, py+cs/2);
                    for(let k=0; k<cs; k+=5) this.ctx.lineTo(px+k, py+cs/2 + Math.sin(k)*5);
                    this.ctx.stroke();
                    this.ctx.strokeStyle = CONSTANTS.COLORS.ink;
                }
            }
        }

        // Exit (Green Circle)
        let ex = 13*cs + cs/2, ey = 13*cs + cs/2;
        this.ctx.strokeStyle = '#27ae60';
        this.ctx.beginPath();
        this.ctx.arc(ex, ey, cs/3, 0, Math.PI*2);
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(39, 174, 96, 0.1)';
        this.ctx.fill();

        // Items
        this.items.forEach(it => {
            let cx = it.x*cs+cs/2, cy = it.y*cs+cs/2;
            this.ctx.fillStyle = it.type==='hp' ? CONSTANTS.COLORS.accent : '#f1c40f';
            this.ctx.beginPath();
            // Draw rough shape
            this.ctx.arc(cx, cy, cs/5, 0, Math.PI*2);
            this.ctx.fill();
        });

        // Player (Hand drawn circle with "eyes")
        let px = this.player.vx*cs + cs/2, py = this.player.vy*cs + cs/2;
        this.ctx.strokeStyle = CONSTANTS.COLORS.highlight;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        // Imperfect circle
        this.ctx.ellipse(px, py, cs/3, cs/3.2, 0.2, 0, Math.PI*2);
        this.ctx.stroke();
        // Eyes
        this.ctx.fillStyle = CONSTANTS.COLORS.ink;
        this.ctx.beginPath(); this.ctx.arc(px-4, py-2, 2, 0, Math.PI*2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(px+4, py-2, 2, 0, Math.PI*2); this.ctx.fill();

        // Enemies (Red X or Spiky shape)
        this.enemies.forEach(en => {
            let ex = en.vx*cs + cs/2, ey = en.vy*cs + cs/2;
            this.ctx.strokeStyle = CONSTANTS.COLORS.accent;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(ex-10, ey-10); this.ctx.lineTo(ex+10, ey+10);
            this.ctx.moveTo(ex+10, ey-10); this.ctx.lineTo(ex-10, ey+10);
            this.ctx.stroke();
        });

        this.particles.forEach(p => p.draw(this.ctx));
    }
}

window.onload = () => new Game();
