// --- Sound Effects ---
const startSound = new Audio('C:/Users/chait/Downloads/car-engine.mp3'); // local engine start cue
const applePopSound = new Audio('https://cdn.pixabay.com/audio/2022/02/01/audio_2e42b0459c.mp3'); // crisp pop
const gameplayMusic = new Audio('https://cdn.pixabay.com/audio/2022/03/16/audio_0581da0b8b.mp3'); // gentle loop
const endSound = new Audio('C:/Users/chait/Downloads/end.mp3'); // local loss cue
const speedShiftSound = new Audio('C:/Users/chait/Downloads/transition-fleeting-121419.mp3'); // level shift cue
const gameOverSound = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfa4c3e.mp3'); // can use same or different
const clickSound = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_7b3e1c1c9a.mp3'); // click

// Tune volumes
startSound.volume = 0.65;
applePopSound.volume = 0.6;
gameplayMusic.volume = 0.45;
gameplayMusic.loop = true;
endSound.volume = 0.7;
speedShiftSound.volume = 0.75;
speedShiftSound.preload = 'auto';
try { speedShiftSound.load(); } catch (e) {}
gameOverSound.volume = 0.85;
clickSound.volume = 0.5;

function fadeOutAudio(audio, duration = 600) {
    if (!audio) return;
    const initialVolume = audio.volume;
    const steps = 20;
    const stepDuration = duration / steps;
    let currentStep = 0;
    const interval = setInterval(() => {
        currentStep++;
        const newVolume = Math.max(0, initialVolume * (1 - currentStep / steps));
        audio.volume = newVolume;
        if (currentStep >= steps) {
            clearInterval(interval);
            try { audio.pause(); } catch (e) {}
            audio.volume = initialVolume;
        }
    }, stepDuration);
}

function playInstantCue(audio, { playbackRate = 1, volume, poolSize = 4 } = {}) {
    if (!audio) return;
    if (!audio._cuePool) {
        audio._cuePool = Array.from({ length: poolSize }, () => {
            const clone = audio.cloneNode(true);
            clone.preload = 'auto';
            try { clone.load(); } catch (e) {}
            return clone;
        });
        audio._cuePoolIndex = 0;
    }
    const pool = audio._cuePool;
    const index = audio._cuePoolIndex ?? 0;
    const cue = pool[index];
    audio._cuePoolIndex = (index + 1) % pool.length;
    try {
        cue.pause();
        cue.currentTime = 0;
        cue.volume = typeof volume === 'number' ? volume : audio.volume;
        cue.playbackRate = playbackRate;
        cue.play();
    } catch (e) {}
}

class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20;
        // Separate tile counts for non-square canvases
        this.tileCountX = Math.floor(this.canvas.width / this.gridSize);
        this.tileCountY = Math.floor(this.canvas.height / this.gridSize);
        
        // Game state
        this.gameRunning = false;
        this.gamePaused = false;
        this.score = 0;
        this.highScore = localStorage.getItem('snakeHighScore') || 0;
        
        // Snake properties
        this.snake = [
            { x: 10, y: 10 }
        ];
        this.dx = 0;
        this.dy = 0;
        this.speed = 110; // default to Pro speed
        
        // Smooth movement properties
        this.lastUpdateTime = 0;
        this.accumulator = 0;
        this.targetFPS = 60;
        this.frameTime = 1000 / this.targetFPS;
        
        // Interpolation for smooth movement
        this.previousSnake = [];
        this.interpolationFactor = 0;
        
        // Food properties
        this.food = this.generateFood();
        
        // Initialize UI
        this.updateScore();
        this.updateHighScore();
        // Speed presets (lower is faster)
        this.speedPresets = { beginner: 160, pro: 110, ultra: 70 };
        this.speedLabels = {
            [this.speedPresets.beginner]: 'Beginner',
            [this.speedPresets.pro]: 'Pro',
            [this.speedPresets.ultra]: 'Ultra Pro'
        };
        this.updateSpeedLevelLabel();
        this.musicActive = false;
        this.startSoundTimeout = null;
        this.startSoundFadeDuration = 800;
        this.endSoundTimeout = null;
        
        // Event listeners
        this.setupEventListeners();
        
        // Start game loop
        this.gameLoop();
    }
    
    setupEventListeners() {
        // Button controls
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Touch controls for mobile
        this.setupTouchControls();

        // Start game by clicking the apple on the canvas
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }
    
    setupTouchControls() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0 && this.dx !== -1) {
                    this.dx = 1;
                    this.dy = 0;
                } else if (deltaX < 0 && this.dx !== 1) {
                    this.dx = -1;
                    this.dy = 0;
                }
            } else {
                if (deltaY > 0 && this.dy !== -1) {
                    this.dx = 0;
                    this.dy = 1;
                } else if (deltaY < 0 && this.dy !== 1) {
                    this.dx = 0;
                    this.dy = -1;
                }
            }
        });
    }
    
    handleKeyPress(e) {
        // Prevent default for arrow keys, space to avoid page scroll
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        
        // Global shortcuts work even if not running
        if (e.key === ' ') {
            if (!this.gameRunning && !this.isTransitioning) {
                this.startGame();
            } else {
                this.togglePause();
            }
            return;
        }
        
        // Speed presets: 1=low, 2=medium, 3=high
        if (e.key === '1' || e.key === '2' || e.key === '3') {
            const prevSpeed = this.speed;
            if (e.key === '1') this.speed = this.speedPresets.beginner; // slower
            if (e.key === '2') this.speed = this.speedPresets.pro; // default
            if (e.key === '3') this.speed = this.speedPresets.ultra;  // faster
            const newSpeed = this.speed;
            // Reset accumulator to apply immediately without stutter
            this.accumulator = 0;
            this.updateSpeedLevelLabel();
            if (
                (prevSpeed === this.speedPresets.beginner && newSpeed === this.speedPresets.pro) ||
                (prevSpeed === this.speedPresets.pro && newSpeed === this.speedPresets.ultra) ||
                (prevSpeed === this.speedPresets.beginner && newSpeed === this.speedPresets.ultra)
            ) {
                playInstantCue(speedShiftSound, { playbackRate: 1.12 });
            }
            return;
        }
        
        if (!this.gameRunning) return;
        
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                if (this.dy !== 1) {
                    this.dx = 0;
                    this.dy = -1;
                }
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                if (this.dy !== -1) {
                    this.dx = 0;
                    this.dy = 1;
                }
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                if (this.dx !== 1) {
                    this.dx = -1;
                    this.dy = 0;
                }
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                if (this.dx !== -1) {
                    this.dx = 1;
                    this.dy = 0;
                }
                break;
        }
    }
    
    startGame() {
        // Begin transition from start scene; start gameplay after fade
        if (this.gameRunning || this.isTransitioning) return;
        try { clickSound.currentTime = 0; clickSound.play(); } catch (e) {}
        // Warm game start cue layered with UI click
        try {
            startSound.currentTime = 0;
            startSound.volume = 0.65;
            startSound.play();
        } catch (e) {}
        if (this.startSoundTimeout) clearTimeout(this.startSoundTimeout);
        const cueDuration = 4000;
        const fadeLeadIn = Math.max(0, cueDuration - this.startSoundFadeDuration);
        this.startSoundTimeout = setTimeout(() => {
            fadeOutAudio(startSound, this.startSoundFadeDuration);
        }, fadeLeadIn);
        this.isTransitioning = true;
        this.transitionStartTime = performance.now();
        this.transitionDuration = cueDuration; // ms delay to sync with car engine cue
        this.pendingStart = true;
    }

    playEndCue() {
        if (this.endSoundTimeout) clearTimeout(this.endSoundTimeout);
        try {
            endSound.currentTime = 0;
            endSound.volume = 0.7;
            endSound.play();
        } catch (e) {}
        const sustainDuration = 2200;
        const fadeDuration = 1100;
        this.endSoundTimeout = setTimeout(() => {
            fadeOutAudio(endSound, fadeDuration);
        }, sustainDuration);
    }

    startGameplayMusic() {
        if (this.musicActive) {
            this.resumeGameplayMusic();
            return;
        }
        this.musicActive = true;
        try {
            gameplayMusic.currentTime = 0;
            gameplayMusic.play();
        } catch (e) {}
    }

    pauseGameplayMusic() {
        if (!this.musicActive) return;
        try {
            gameplayMusic.pause();
        } catch (e) {}
    }

    resumeGameplayMusic() {
        if (!this.musicActive) return;
        try {
            gameplayMusic.play();
        } catch (e) {}
    }

    stopGameplayMusic() {
        if (!this.musicActive) return;
        this.musicActive = false;
        try {
            gameplayMusic.pause();
            gameplayMusic.currentTime = 0;
        } catch (e) {}
    }
    
    togglePause() {
        if (this.gameRunning) {
            this.gamePaused = !this.gamePaused;
            const pauseBtn = document.getElementById('pauseBtn');
            pauseBtn.textContent = this.gamePaused ? 'Resume' : 'Pause';
            if (this.gamePaused) {
                this.pauseGameplayMusic();
            } else {
                this.resumeGameplayMusic();
            }
        }
    }
    
    restartGame() {
        this.snake = [{ x: 10, y: 10 }];
        this.dx = 0;
        this.dy = 0;
        this.score = 0;
        this.food = this.generateFood();
        this.gameRunning = false;
        this.gamePaused = false;
        this.stopGameplayMusic();
        
        // Reset smooth movement properties
        this.previousSnake = [];
        this.interpolationFactor = 0;
        this.accumulator = 0;
        
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('pauseBtn').textContent = 'Pause';
        
        this.updateScore();
        this.hideGameOverModal();
    }
    
    generateFood() {
        let newFood;
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
            newFood = {
                x: Math.floor(Math.random() * this.tileCountX),
                y: Math.floor(Math.random() * this.tileCountY)
            };
            attempts++;
        } while (this.snake.some(segment => segment.x === newFood.x && segment.y === newFood.y) && attempts < maxAttempts);
        
        // If we can't find a good position, place it in a corner
        if (attempts >= maxAttempts) {
            newFood = { x: 1, y: 1 };
        }
        
        return newFood;
    }
    
    update() {
        if (!this.gameRunning || this.gamePaused) return;
        
        // Store previous snake position for interpolation
        this.previousSnake = this.snake.map(segment => ({ x: segment.x, y: segment.y }));
        
        // Move snake
        const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };
        
        // Check wall collision
        if (head.x < 0 || head.x >= this.tileCountX || head.y < 0 || head.y >= this.tileCountY) {
            this.gameOver();
            return;
        }
        
        // Check self collision
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.gameOver();
            return;
        }
        
        this.snake.unshift(head);
        
        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.updateScore();
            
            // Play eat sound
            try {
                applePopSound.currentTime = 0;
                applePopSound.play();
            } catch (e) {}
            // Layer a soft score chime on each eat
            try {
                const scoreChime = new Audio(clickSound.src);
                scoreChime.volume = 0.35;
                scoreChime.playbackRate = 1.35;
                scoreChime.currentTime = 0;
                scoreChime.play();
            } catch (e) {}
            
            // Create eating effect
            this.createEatingEffect(this.food.x, this.food.y);
            
            this.food = this.generateFood();
            
            // Increase speed every 50 points
        if (this.score % 50 === 0 && this.speed > 50) {
            this.speed -= 10;
            // Milestone chime using click sound as a subtle cue
            try { clickSound.currentTime = 0; clickSound.playbackRate = 1.2; clickSound.play(); } catch (e) {}
        }
        } else {
            this.snake.pop();
        }
        
        // Reset interpolation factor
        this.interpolationFactor = 0;
    }
    
    draw() {
        // Rich multi-stop grass gradient (more shades)
        const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bgGrad.addColorStop(0, '#baf2a9');      // light mint highlight
        bgGrad.addColorStop(0.25, '#a3e49d');
        bgGrad.addColorStop(0.5, '#86cf86');
        bgGrad.addColorStop(0.75, '#6fbb74');
        bgGrad.addColorStop(1, '#5aa565');      // deeper grass
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Directional light sweep for realism
        const lightGrad = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        lightGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
        lightGrad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
        lightGrad.addColorStop(1, 'rgba(0,0,0,0.06)');
        this.ctx.fillStyle = lightGrad;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle vignette to focus center
        const vignette = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, Math.min(this.canvas.width, this.canvas.height) * 0.5,
            this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height) * 0.8
        );
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
        this.ctx.fillStyle = vignette;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle texture overlay
        this.drawNoiseOverlay();

        // Draw shaded checkerboard and refined grid
        this.drawCheckerboard();
        this.drawGrid();
        
        // Draw snake with smooth interpolation
        this.drawSnake();
        
        // Draw food
        this.drawFood();
        
        // Draw eating particles
        this.drawEatingParticles();
        
        // Update apple position display
        this.updateApplePosition();
        
        // Draw game state overlay
        if (!this.gameRunning && !this.isTransitioning) {
            this.drawStartMessage();
        } else if (this.gamePaused) {
            this.drawPauseMessage();
        }

        // Crossfade transition from start overlay
        if (this.isTransitioning) {
            const now = performance.now();
            const t = Math.min(1, (now - this.transitionStartTime) / this.transitionDuration);
            this.ctx.save();
            this.ctx.globalAlpha = 1 - t;
            this.drawStartMessage();
            this.ctx.restore();
        }
    }
    
    drawGrid() {
        // Softer grid lines to reduce visual noise
        this.ctx.strokeStyle = 'rgba(80, 140, 80, 0.4)';
        this.ctx.lineWidth = 1;
        
        // Vertical grid lines
        for (let i = 0; i <= this.tileCountX; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.gridSize, 0);
            this.ctx.lineTo(i * this.gridSize, this.canvas.height);
            this.ctx.stroke();
            
            // Horizontal lines are drawn in the next loop
        }
        // Horizontal grid lines
        for (let j = 0; j <= this.tileCountY; j++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, j * this.gridSize);
            this.ctx.lineTo(this.canvas.width, j * this.gridSize);
            this.ctx.stroke();
        }
    }

    drawCheckerboard() {
        // Subtle alternating tiles with depth and shade variation
        for (let y = 0; y < this.tileCountY; y++) {
            for (let x = 0; x < this.tileCountX; x++) {
                const isLight = (x + y) % 2 === 0;
                const baseAlpha = isLight ? 0.06 : 0.02;
                // Slight vertical falloff for depth
                const falloff = 1 - (y / this.tileCountY) * 0.25;
                this.ctx.fillStyle = `rgba(255, 255, 255, ${baseAlpha * falloff})`;
                this.ctx.fillRect(x * this.gridSize, y * this.gridSize, this.gridSize, this.gridSize);
            }
        }
    }

    // Soft noise overlay to add subtle ground texture
    drawNoiseOverlay() {
        const patternSize = 48;
        const off = document.createElement('canvas');
        off.width = patternSize;
        off.height = patternSize;
        const octx = off.getContext('2d');

        const imageData = octx.createImageData(patternSize, patternSize);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const n = 235 + Math.floor(Math.random() * 20); // very light noise
            imageData.data[i] = n;
            imageData.data[i + 1] = n;
            imageData.data[i + 2] = n;
            imageData.data[i + 3] = 10; // low alpha
        }
        octx.putImageData(imageData, 0, 0);

        const pattern = this.ctx.createPattern(off, 'repeat');
        if (pattern) {
            this.ctx.fillStyle = pattern;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    drawSnake() {
        this.snake.forEach((segment, index) => {
            // Calculate interpolated position for smooth movement
            let drawX = segment.x;
            let drawY = segment.y;
            
            if (this.previousSnake.length > index && this.gameRunning && !this.gamePaused) {
                const prevSegment = this.previousSnake[index];
                drawX = prevSegment.x + (segment.x - prevSegment.x) * this.interpolationFactor;
                drawY = prevSegment.y + (segment.y - prevSegment.y) * this.interpolationFactor;
            }
            
            // Calculate center position for circular segments
            const centerX = drawX * this.gridSize + this.gridSize / 2;
            const centerY = drawY * this.gridSize + this.gridSize / 2;
            const radius = (this.gridSize - 4) / 2;
            
            if (index === 0) {
                // Head - blue with darker outline
                this.ctx.fillStyle = '#4169e1';
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                this.ctx.fill();
                
                // Head outline
                this.ctx.strokeStyle = '#1e3a8a';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                
                // Eyes
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(
                    centerX - radius * 0.3,
                    centerY - radius * 0.3,
                    radius * 0.2,
                    0,
                    2 * Math.PI
                );
                this.ctx.arc(
                    centerX + radius * 0.3,
                    centerY - radius * 0.3,
                    radius * 0.2,
                    0,
                    2 * Math.PI
                );
                this.ctx.fill();
                
                // Pupils
                this.ctx.fillStyle = '#000000';
                this.ctx.beginPath();
                this.ctx.arc(
                    centerX - radius * 0.3,
                    centerY - radius * 0.35,
                    radius * 0.1,
                    0,
                    2 * Math.PI
                );
                this.ctx.arc(
                    centerX + radius * 0.3,
                    centerY - radius * 0.35,
                    radius * 0.1,
                    0,
                    2 * Math.PI
                );
                this.ctx.fill();
                
            } else {
                // Body - lighter blue
                this.ctx.fillStyle = '#6495ed';
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                this.ctx.fill();
                
                // Body outline
                this.ctx.strokeStyle = '#4169e1';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
            }
        });
    }
    
    drawFood() {
        // Check if food exists and has valid coordinates
        if (!this.food || typeof this.food.x === 'undefined' || typeof this.food.y === 'undefined') {
            this.food = this.generateFood();
            return;
        }
        
        const centerX = this.food.x * this.gridSize + this.gridSize / 2;
        const centerY = this.food.y * this.gridSize + this.gridSize / 2;
        const radius = this.gridSize / 2 - 2;
        
        // Draw enhanced position indicator with pulsing effect
        const time = Date.now() * 0.005;
        const pulseAlpha = 0.4 + Math.sin(time) * 0.2;
        this.ctx.fillStyle = `rgba(255, 255, 0, ${pulseAlpha})`;
        this.ctx.fillRect(
            this.food.x * this.gridSize - 2,
            this.food.y * this.gridSize - 2,
            this.gridSize + 4,
            this.gridSize + 4
        );
        
        // Draw multiple apple layers for enhanced presence
        this.drawEnhancedApple(centerX, centerY, radius);
        this.draw3DApple(centerX, centerY, radius);
        this.drawSimpleApple(centerX, centerY, radius);
        
        // Add floating animation effect
        this.drawFloatingEffect(centerX, centerY, radius);
    }
    
    drawEnhancedApple(centerX, centerY, radius) {
        const time = Date.now() * 0.003;
        const pulseScale = 1 + Math.sin(time) * 0.15;
        const scaledRadius = radius * pulseScale;
        
        // Draw outer glow ring
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius + 8, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Draw inner glow ring
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius + 5, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Draw main apple body with enhanced visibility
        const gradient = this.ctx.createRadialGradient(
            centerX - scaledRadius * 0.3, centerY - scaledRadius * 0.3, 0,
            centerX, centerY, scaledRadius
        );
        gradient.addColorStop(0, '#ff0000'); // Bright red center
        gradient.addColorStop(0.3, '#ff3333'); // Light red
        gradient.addColorStop(0.7, '#cc0000'); // Medium red
        gradient.addColorStop(1, '#990000'); // Dark red
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw apple outline for better definition
        this.ctx.strokeStyle = '#800000';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Draw 3D highlight
        const highlightGradient = this.ctx.createRadialGradient(
            centerX - scaledRadius * 0.4, centerY - scaledRadius * 0.4, 0,
            centerX - scaledRadius * 0.4, centerY - scaledRadius * 0.4, scaledRadius * 0.7
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        highlightGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
        highlightGradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.2)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.ctx.fillStyle = highlightGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius, 0, 2 * Math.PI);
        this.ctx.fill();
    }
    
    drawSimpleApple(centerX, centerY, radius) {
        // Simple red circle as backup
        this.ctx.fillStyle = '#ff0000';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Add white highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.beginPath();
        this.ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.4, 0, 2 * Math.PI);
        this.ctx.fill();
    }
    
    draw3DApple(centerX, centerY, radius) {
        // Add pulsing animation
        const time = Date.now() * 0.003;
        const pulseScale = 1 + Math.sin(time) * 0.15;
        const scaledRadius = radius * pulseScale;
        
        // Draw enhanced shadow/ground reflection
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX + 3, centerY + 3, scaledRadius * 0.9, scaledRadius * 0.4, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw main apple body with enhanced visibility
        const gradient = this.ctx.createRadialGradient(
            centerX - scaledRadius * 0.3, centerY - scaledRadius * 0.3, 0,
            centerX, centerY, scaledRadius
        );
        gradient.addColorStop(0, '#ff0000'); // Bright red center
        gradient.addColorStop(0.2, '#ff3333'); // Light red
        gradient.addColorStop(0.5, '#cc0000'); // Medium red
        gradient.addColorStop(0.8, '#990000'); // Dark red
        gradient.addColorStop(1, '#660000'); // Darkest red for depth
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw apple outline for better definition
        this.ctx.strokeStyle = '#800000';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Draw 3D highlight (top-left light source)
        const highlightGradient = this.ctx.createRadialGradient(
            centerX - scaledRadius * 0.4, centerY - scaledRadius * 0.4, 0,
            centerX - scaledRadius * 0.4, centerY - scaledRadius * 0.4, scaledRadius * 0.7
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        highlightGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        highlightGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.ctx.fillStyle = highlightGradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw apple stem with 3D effect
        this.ctx.fillStyle = '#654321';
        this.ctx.fillRect(centerX - 1, centerY - scaledRadius - 4, 2, 5);
        
        // Stem highlight
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(centerX - 1, centerY - scaledRadius - 4, 1, 3);
        
        // Draw detailed apple leaf
        this.ctx.fillStyle = '#228B22';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX + 3, centerY - scaledRadius - 1, 4, 2, Math.PI / 4, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Leaf vein
        this.ctx.strokeStyle = '#006400';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + 1, centerY - scaledRadius - 1);
        this.ctx.lineTo(centerX + 5, centerY - scaledRadius - 3);
        this.ctx.stroke();
        
        // Add enhanced glow effect for better visibility
        this.ctx.shadowColor = '#ff0000';
        this.ctx.shadowBlur = 20 + Math.sin(time * 2) * 8;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        
        // Draw multiple outer glow rings for maximum visibility
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius + 6, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius + 10, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, scaledRadius + 14, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
        
        // Add enhanced sparkle effects
        this.drawSparkles(centerX, centerY, scaledRadius, time);
    }
    
    drawFloatingEffect(centerX, centerY, radius) {
        const time = Date.now() * 0.002;
        const floatOffset = Math.sin(time) * 3;
        
        // Draw floating particles around the apple
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * 2 * Math.PI + time;
            const particleX = centerX + Math.cos(angle) * (radius + 15);
            const particleY = centerY + Math.sin(angle) * (radius + 15) + floatOffset;
            const particleSize = 2 + Math.sin(time * 2 + i) * 1;
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + Math.sin(time + i) * 0.2})`;
            this.ctx.beginPath();
            this.ctx.arc(particleX, particleY, particleSize, 0, 2 * Math.PI);
            this.ctx.fill();
        }
        
        // Draw pulsing rings
        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
            const ringRadius = radius + 12 + i * 8;
            const ringAlpha = 0.3 - (i * 0.1) + Math.sin(time + i) * 0.1;
            
            this.ctx.strokeStyle = `rgba(255, 255, 0, ${ringAlpha})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, ringRadius, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
    }
    
    drawSparkles(centerX, centerY, radius, time) {
        const sparkleCount = 8;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        
        for (let i = 0; i < sparkleCount; i++) {
            const angle = (i / sparkleCount) * 2 * Math.PI + time;
            const sparkleX = centerX + Math.cos(angle) * (radius + 10);
            const sparkleY = centerY + Math.sin(angle) * (radius + 10);
            const sparkleSize = 3 + Math.sin(time * 3 + i) * 1.5;
            
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, 2 * Math.PI);
            this.ctx.fill();
        }
        
        // Add additional inner sparkles for extra visibility
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * 2 * Math.PI + time * 2;
            const sparkleX = centerX + Math.cos(angle) * (radius + 5);
            const sparkleY = centerY + Math.sin(angle) * (radius + 5);
            const sparkleSize = 2 + Math.sin(time * 2 + i) * 1;
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.beginPath();
            this.ctx.arc(sparkleX, sparkleY, sparkleSize, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }
    
    createEatingEffect(x, y) {
        // Create particle explosion effect
        const centerX = x * this.gridSize + this.gridSize / 2;
        const centerY = y * this.gridSize + this.gridSize / 2;
        
        // Add score popup animation
        this.showScorePopup(centerX, centerY);
        
        // Create sparkle burst
        this.createSparkleBurst(centerX, centerY);
    }
    
    showScorePopup(x, y) {
        const scoreElement = document.createElement('div');
        scoreElement.textContent = '+10';
        scoreElement.style.position = 'absolute';
        scoreElement.style.left = (x + this.canvas.offsetLeft) + 'px';
        scoreElement.style.top = (y + this.canvas.offsetTop - 20) + 'px';
        scoreElement.style.color = '#4a7c4a';
        scoreElement.style.fontSize = '20px';
        scoreElement.style.fontWeight = 'bold';
        scoreElement.style.fontFamily = 'Orbitron, monospace';
        scoreElement.style.pointerEvents = 'none';
        scoreElement.style.zIndex = '1000';
        scoreElement.style.textShadow = '0 0 10px rgba(74, 124, 74, 0.8)';
        
        document.body.appendChild(scoreElement);
        
        // Animate the score popup
        let opacity = 1;
        let yPos = y - 20;
        const animate = () => {
            opacity -= 0.02;
            yPos -= 1;
            scoreElement.style.opacity = opacity;
            scoreElement.style.top = yPos + 'px';
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                document.body.removeChild(scoreElement);
            }
        };
        animate();
    }
    
    createSparkleBurst(x, y) {
        const particleCount = 12;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * 2 * Math.PI;
            const speed = 3 + Math.random() * 2;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.02 + Math.random() * 0.02
            });
        }
        
        // Store particles for animation
        if (!this.eatingParticles) {
            this.eatingParticles = [];
        }
        this.eatingParticles.push(...particles);
    }
    
    drawEatingParticles() {
        if (!this.eatingParticles || this.eatingParticles.length === 0) return;
        
        this.ctx.save();
        
        for (let i = this.eatingParticles.length - 1; i >= 0; i--) {
            const particle = this.eatingParticles[i];
            
            // Update particle position
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= particle.decay;
            
            // Draw particle
            if (particle.life > 0) {
                this.ctx.globalAlpha = particle.life;
                this.ctx.fillStyle = `hsl(${Math.random() * 60 + 0}, 100%, 70%)`;
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, 2, 0, 2 * Math.PI);
                this.ctx.fill();
            } else {
                // Remove dead particles
                this.eatingParticles.splice(i, 1);
            }
        }
        
        this.ctx.restore();
    }
    
    drawStartMessage() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#4a7c4a';
        this.ctx.font = 'bold 24px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Press START to begin!', this.canvas.width / 2, this.canvas.height / 2);
    }
    
    drawPauseMessage() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#8b4513';
        this.ctx.font = 'bold 24px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME PAUSED', this.canvas.width / 2, this.canvas.height / 2);
    }
    
    gameOver() {
        this.gameRunning = false;
        this.gamePaused = false;
        this.stopGameplayMusic();
        
        // Play game over sound
        gameOverSound.currentTime = 0;
        gameOverSound.play();
        // Layer a resonant click for emphasis
        try {
            const impactClick = new Audio(clickSound.src);
            impactClick.playbackRate = 1.35;
            impactClick.volume = 0.65;
            impactClick.currentTime = 0;
            impactClick.play();
        } catch (e) {}
        this.playEndCue();

        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('snakeHighScore', this.highScore);
            this.updateHighScore();
        }
        
        // Show game over modal
        this.showGameOverModal();
        
        // Reset UI
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('pauseBtn').textContent = 'Pause';
    }
    
    showGameOverModal() {
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverModal').style.display = 'block';
    }
    
    hideGameOverModal() {
        document.getElementById('gameOverModal').style.display = 'none';
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
    }
    
    updateApplePosition() {
        if (this.food && typeof this.food.x !== 'undefined' && typeof this.food.y !== 'undefined') {
            document.getElementById('applePosition').textContent = `${this.food.x}, ${this.food.y}`;
            document.getElementById('appleStatus').textContent = '🍎 Apple Present';
            document.getElementById('appleStatus').style.color = '#ffffff';
        } else {
            document.getElementById('appleStatus').textContent = '❌ No Apple';
            document.getElementById('appleStatus').style.color = '#ffcccc';
        }
    }
    
    updateHighScore() {
        document.getElementById('highScore').textContent = this.highScore;
    }
    
    updateSpeedLevelLabel() {
        const label = this.speedLabels[this.speed] || 'Custom';
        const el = document.getElementById('speedLevel');
        if (el) el.textContent = label;
    }

    handleCanvasClick(e) {
        // Compute click position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.gameRunning) {
            // In-game apple (optional resume)
            const centerX = this.food.x * this.gridSize + this.gridSize / 2;
            const centerY = this.food.y * this.gridSize + this.gridSize / 2;
            const radius = this.gridSize / 2 + 6;
            const dx = x - centerX;
            const dy = y - centerY;
            if (dx * dx + dy * dy <= radius * radius && this.gamePaused) {
                this.togglePause();
            }
        } else {
            // Click anywhere to start (no tree)
            this.startGame();
        }
    }
    
    gameLoop(currentTime = 0) {
        // Calculate delta time
        const deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;
        
        // Accumulate time
        this.accumulator += deltaTime;
        
        // Update game logic at fixed intervals
        while (this.accumulator >= this.speed) {
            this.update();
            this.accumulator -= this.speed;
        }
        
        // Calculate interpolation factor for smooth movement
        this.interpolationFactor = this.accumulator / this.speed;
        
        // Draw at 60 FPS for smooth rendering
        this.draw();
        
        // Complete transition and start gameplay after fade
        if (this.isTransitioning) {
            const now = performance.now();
            if (now - this.transitionStartTime >= this.transitionDuration) {
                this.isTransitioning = false;
                if (this.pendingStart) {
                    this.gameRunning = true;
                    this.gamePaused = false;
                    this.dx = 1;
                    this.dy = 0;
                    const startBtn = document.getElementById('startBtn');
                    const pauseBtn = document.getElementById('pauseBtn');
                    if (startBtn) startBtn.disabled = true;
                    if (pauseBtn) pauseBtn.disabled = false;
                    this.startGameplayMusic();
                    this.pendingStart = false;
                }
            }
        }

        // Continue the loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SnakeGame();
}); 