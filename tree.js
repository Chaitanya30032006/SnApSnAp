class TreeScene {
    constructor() {
        this.canvas = document.getElementById('treeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.apple = { x: this.canvas.width * 0.55, y: this.canvas.height * 0.32, r: 18 };
        this.last = 0;
        this.bind();
        requestAnimationFrame((t) => this.loop(t));
    }
    bind() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const sx = this.canvas.width / rect.width;
            const sy = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * sx;
            const y = (e.clientY - rect.top) * sy;
            const dx = x - this.apple.x;
            const dy = y - this.apple.y;
            if (dx * dx + dy * dy <= (this.apple.r + 8) * (this.apple.r + 8)) {
                window.location.href = 'index.html';
            }
        });
    }
    loop(t) {
        const dt = t - this.last; this.last = t;
        this.draw(t * 0.001);
        requestAnimationFrame((n) => this.loop(n));
    }
    draw(time) {
        const g = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        g.addColorStop(0, '#c7b7ff');
        g.addColorStop(1, '#7a5af5');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const vg = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.35,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.75
        );
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.25)');
        this.ctx.fillStyle = vg;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Ground
        this.ctx.fillStyle = '#2a1847';
        this.ctx.fillRect(0, this.canvas.height * 0.75, this.canvas.width, this.canvas.height * 0.25);

        // Trunk
        const trunkX = this.canvas.width * 0.45;
        const trunkY = this.canvas.height * 0.78;
        const trunkW = 40;
        const trunkH = 200;
        const tg = this.ctx.createLinearGradient(trunkX, trunkY - trunkH, trunkX + trunkW, trunkY);
        tg.addColorStop(0, '#5a3a1b');
        tg.addColorStop(0.5, '#7b4a24');
        tg.addColorStop(1, '#3e2713');
        this.ctx.fillStyle = tg;
        this.roundRect(trunkX, trunkY - trunkH, trunkW, trunkH, 12);
        this.ctx.fill();

        // Canopy blobs
        this.canopy(trunkX + trunkW * 0.5, trunkY - trunkH - 10, 90);
        this.canopy(trunkX + trunkW * 0.1, trunkY - trunkH + 20, 70);
        this.canopy(trunkX + trunkW * 0.9, trunkY - trunkH + 30, 80);

        // Apple with glow and pulse
        const pulse = 1 + Math.sin(time * 3) * 0.1;
        const r = this.apple.r * pulse;
        this.drawApple(this.apple.x, this.apple.y, r);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(this.apple.x, this.apple.y, r + 10 + Math.sin(time * 2) * 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    canopy(cx, cy, r) {
        const g = this.ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.2, cx, cy, r);
        g.addColorStop(0, '#7ddc7a');
        g.addColorStop(0.5, '#4eaf54');
        g.addColorStop(1, '#2f7e38');
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.arc(cx + r * 0.1, cy + r * 0.1, r, 0.2, Math.PI + 0.2);
        this.ctx.stroke();
    }
    drawApple(x, y, r) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 3, y + 3, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
        this.ctx.fill();
        const g = this.ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        g.addColorStop(0, '#ff3b3b');
        g.addColorStop(0.6, '#cc1f1f');
        g.addColorStop(1, '#8b0f0f');
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#6d0c0c';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        this.ctx.beginPath();
        this.ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#6b3f1e';
        this.ctx.fillRect(x - 1, y - r - 6, 2, 10);
        this.ctx.fillStyle = '#2f7e38';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 6, y - r - 2, 6, 3, Math.PI / 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowColor = '#ff3b3b';
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = 'rgba(255,0,0,0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r + 6, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }
    roundRect(x, y, w, h, r) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.arcTo(x + w, y, x + w, y + h, r);
        this.ctx.arcTo(x + w, y + h, x, y + h, r);
        this.ctx.arcTo(x, y + h, x, y, r);
        this.ctx.arcTo(x, y, x + w, y, r);
    }
}

document.addEventListener('DOMContentLoaded', () => new TreeScene());





