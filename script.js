const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('holdCanvas');
const holdCtx = holdCanvas.getContext('2d');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Scale canvases
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;
// Next Canvas bigger to show 3 pieces: each piece approx 3-4 blocks high. 
nextCanvas.width = 4 * BLOCK_SIZE;
nextCanvas.height = 10 * BLOCK_SIZE; // enough for 3
holdCanvas.width = 4 * BLOCK_SIZE;
holdCanvas.height = 4 * BLOCK_SIZE;

// UI Elements
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const finalScoreEl = document.getElementById('finalScore');

// Modals
const startScreen = document.getElementById('startScreen');
const gameOverModal = document.getElementById('gameOverModal');
const rankingModal = document.getElementById('rankingModal');
const newRecordEntry = document.getElementById('newRecordEntry');

// Buttons
const startBtn = document.getElementById('startBtn');
const showRankBtn = document.getElementById('showRankBtn');
const restartBtn = document.getElementById('restartBtn');
const homeBtn = document.getElementById('homeBtn');
const closeRankBtn = document.getElementById('closeRankBtn');
const saveScoreBtn = document.getElementById('saveScoreBtn');
const nicknameInput = document.getElementById('nicknameInput');
const fullLeaderboardList = document.getElementById('fullLeaderboardList');


// Game State
let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0;
let lines = 0;
let level = 1;
let isPlaying = false;
let isPaused = false;
let gameOver = false;
let dropCounter = 0;
let lastTime = 0;
let dropInterval = 1000;
let bag = [];
let nextQueue = []; // Holds next 3 pieces

// Tetromino definitions
const PIECES = {
    'I': [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // SRS I
    'J': [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    'L': [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    'O': [[1, 1], [1, 1]],
    'S': [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    'Z': [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    'T': [[0, 1, 0], [1, 1, 1], [0, 0, 0]]
};

const COLORS = {
    'I': '#00f0ff', // Cyan
    'J': '#0000ff', // Blue
    'L': '#ffaa00', // Orange
    'O': '#ffff00', // Yellow
    'S': '#00ff00', // Green
    'Z': '#ff0000', // Red
    'T': '#aa00ff'  // Purple
};

class Piece {
    constructor(type) {
        this.type = type;
        this.matrix = PIECES[type];
        // Center logic: 10 cols. 
        // 3-wide pieces (J L S Z T) start at x=3 or 4. 
        // 4-wide (I) start at x=3. 
        // 2-wide (O) start at x=4.
        this.x = Math.floor((COLS - this.matrix[0].length) / 2);
        this.y = 0;
    }
}

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    score: 0,
    color: null,
    type: null
};

let heldPieceType = null;
let canHold = true;

// --- Helper Functions ---

function getNextFromBag() {
    if (bag.length === 0) {
        bag = ['I', 'J', 'L', 'O', 'S', 'Z', 'T'];
        // Shuffle
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
    }
    return bag.pop();
}

function fillNextQueue() {
    while (nextQueue.length < 3) {
        nextQueue.push(getNextFromBag());
    }
}

function createPiece() {
    fillNextQueue();
    const type = nextQueue.shift(); // Take first
    fillNextQueue(); // Ensure 3 items

    const piece = new Piece(type);
    player.matrix = piece.matrix;
    player.pos.x = piece.x;
    player.pos.y = piece.y;
    player.color = COLORS[type];
    player.type = type;

    drawNextQueue();

    // Check collision on spawn (Game Over)
    if (collide(grid, player)) {
        endGame();
    }
}

function drawNextQueue() {
    nextCtx.fillStyle = '#141428';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    // Draw top 3
    let startY = 1;
    for (let i = 0; i < 3; i++) {
        const type = nextQueue[i];
        if (!type) continue;
        const matrix = PIECES[type];
        const color = COLORS[type];

        // simple offset logic
        const offsetX = Math.floor((4 - matrix[0].length) / 2);

        drawMatrix(matrix, { x: offsetX, y: startY }, nextCtx, color);
        startY += 3;
    }
}

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function drawMatrix(matrix, offset, context = ctx, colorOverride = null) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colorOverride || (typeof value === 'string' ? value : player.color);
                context.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                context.strokeStyle = 'rgba(255,255,255,0.5)';
                context.lineWidth = 1;
                context.strokeRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                context.fillStyle = 'rgba(255,255,255,0.2)';
                context.fillRect((x + offset.x) * BLOCK_SIZE + 5, (y + offset.y) * BLOCK_SIZE + 5, BLOCK_SIZE - 10, BLOCK_SIZE - 10);
            }
        });
    });
}

function draw() {
    if (!isPlaying) return;

    // Clear
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * BLOCK_SIZE); ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c * BLOCK_SIZE, 0); ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE); ctx.stroke();
    }

    drawMatrix(grid, { x: 0, y: 0 });
    drawMatrix(player.matrix, player.pos);

    // Ghost Piece
    let ghostPos = { ...player.pos };
    while (!collide(grid, { matrix: player.matrix, pos: { x: ghostPos.x, y: ghostPos.y + 1 } })) {
        ghostPos.y++;
    }
    if (ghostPos.y !== player.pos.y) {
        ctx.globalAlpha = 0.2;
        drawMatrix(player.matrix, ghostPos, ctx, player.color);
        ctx.globalAlpha = 1.0;
    }
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = player.color;
            }
        });
    });
}

function playerDrop() {
    player.pos.y++;
    if (collide(grid, player)) {
        player.pos.y--;
        merge(grid, player);
        arenaSweep();
        if (!gameOver) {
            createPiece();
            canHold = true;
        }
    }
    dropCounter = 0;
}

function playerHardDrop() {
    let drops = 0;
    while (!collide(grid, { matrix: player.matrix, pos: { x: player.pos.x, y: player.pos.y + 1 } })) {
        player.pos.y++;
        drops++;
    }
    score += drops * 2; // Standard hard drop score
    merge(grid, player);
    arenaSweep();
    if (!gameOver) {
        createPiece();
        canHold = true;
    }
}

function playerMove(offset) {
    player.pos.x += offset;
    if (collide(grid, player)) {
        player.pos.x -= offset;
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(grid, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = grid.length - 1; y > 0; --y) {
        for (let x = 0; x < grid[y].length; ++x) {
            if (grid[y][x] === 0) {
                continue outer;
            }
        }
        const row = grid.splice(y, 1)[0].fill(0);
        grid.unshift(row);
        ++y;
        rowCount++;
    }

    if (rowCount > 0) {
        const lineScores = [0, 100, 300, 500, 800]; // Basic
        // Correct Standard: 40, 100, 300, 1200 * (level)
        const stdScores = [0, 40, 100, 300, 1200];

        score += stdScores[rowCount] * level;
        lines += rowCount;

        // Level up every 10 lines
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            // Linear speed up
            // standard speed curve is complex, simplified here:
            dropInterval = Math.max(100, Math.pow(0.8 - ((level - 1) * 0.007), level - 1) * 1000);
            if (isNaN(dropInterval)) dropInterval = 1000;
            // fallback simple linear if math fails
            dropInterval = Math.max(100, 1000 - (level - 1) * 80);
        }

        updateScoreUI();
    }
}

function holdPiece() {
    if (!canHold || gameOver) return;

    // If holding, swap. If empty, put current in hold and spawn next.
    if (heldPieceType === null) {
        heldPieceType = player.type;
        createPiece();
    } else {
        const temp = heldPieceType;
        heldPieceType = player.type;
        // manually creating piece to set properties
        const piece = new Piece(temp);
        player.matrix = piece.matrix;
        player.pos.x = piece.x;
        player.pos.y = piece.y;
        player.color = COLORS[temp];
        player.type = temp;
    }
    canHold = false;

    // Draw Hold
    holdCtx.fillStyle = '#141428';
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    const matrix = PIECES[heldPieceType];
    const color = COLORS[heldPieceType];
    const offsetX = Math.floor((4 - matrix[0].length) / 2);
    const offsetY = Math.floor((4 - matrix.length) / 2);
    drawMatrix(matrix, { x: offsetX, y: offsetY }, holdCtx, color);
}

function updateScoreUI() {
    scoreEl.innerText = score.toLocaleString();
    levelEl.innerText = level;
    linesEl.innerText = lines;
}

function endGame() {
    gameOver = true;
    isPlaying = false;
    finalScoreEl.innerText = score.toLocaleString();
    gameOverModal.classList.remove('hidden');
    checkHighscore();
}

// Game Loop
let requestID;
function update(time = 0) {
    if (!isPlaying || isPaused) {
        if (isPlaying && isPaused) requestID = requestAnimationFrame(update);
        return;
    }
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestID = requestAnimationFrame(update);
}

function startGame() {
    // Reset Data
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    gameOver = false;
    isPaused = false;
    isPlaying = true;
    bag = [];
    nextQueue = [];
    heldPieceType = null;
    canHold = true;
    dropInterval = 1000;

    // UI Reset
    updateScoreUI();
    startScreen.classList.add('hidden');
    gameOverModal.classList.add('hidden');
    rankingModal.classList.add('hidden');
    newRecordEntry.classList.add('hidden');
    saveScoreBtn.disabled = false;
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);

    createPiece();
    lastTime = performance.now();
    update();
}

// Input
document.addEventListener('keydown', event => {
    if (!isPlaying || gameOver || isPaused) {
        if (event.key.toLowerCase() === 'p' && isPlaying && !gameOver) {
            isPaused = !isPaused;
        }
        return;
    }

    switch (event.keyCode) {
        case 37: // Left
            playerMove(-1);
            break;
        case 39: // Right
            playerMove(1);
            break;
        case 40: // Down
            playerDrop();
            score += 1; // Soft drop score
            updateScoreUI();
            break;
        case 38: // Up -> Rotate CW
        case 88: // X
            playerRotate(1);
            break;
        case 90: // Z -> Rotate CCW
            playerRotate(-1);
            break;
        case 32: // Space -> Hard Drop
            playerHardDrop();
            event.preventDefault();
            break;
        case 16: // Shift -> Hold
            holdPiece();
            break;
        case 80: // P
            isPaused = !isPaused;
            break;
    }
});

// Ranking System
const LOCAL_STORAGE_KEY = 'classic_tetris_ranks';

function getRanks() {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveRank(name, score) {
    const ranks = getRanks();
    ranks.push({ name, score });
    ranks.sort((a, b) => b.score - a.score);
    if (ranks.length > 10) ranks.length = 10;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ranks));
    updateLeaderboard();
}

function updateLeaderboard() {
    const ranks = getRanks();
    const html = ranks.map((r, i) => `
        <li>
            <span class="rank">${i + 1}</span>
            <span class="name">${r.name}</span>
            <span class="score">${r.score.toLocaleString()}</span>
        </li>
    `).join('');
    fullLeaderboardList.innerHTML = html;
}

function checkHighscore() {
    const ranks = getRanks();
    const minScore = ranks.length < 10 ? 0 : ranks[ranks.length - 1].score;
    if (score > minScore || ranks.length < 10) {
        newRecordEntry.classList.remove('hidden');
    }
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
saveScoreBtn.addEventListener('click', () => {
    const name = nicknameInput.value.trim() || 'PLAYER';
    saveRank(name, score);
    newRecordEntry.classList.add('hidden');
    saveScoreBtn.disabled = true;
});
showRankBtn.addEventListener('click', () => {
    updateLeaderboard();
    startScreen.classList.add('hidden');
    rankingModal.classList.remove('hidden');
});
closeRankBtn.addEventListener('click', () => {
    rankingModal.classList.add('hidden');
    // If we were on start screen return to it, or if game over return loop?
    // Simply show Start Screen if not playing
    if (!isPlaying && !gameOver) {
        startScreen.classList.remove('hidden');
    } else if (gameOver) {
        gameOverModal.classList.remove('hidden');
    }
});
homeBtn.addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// Init
updateLeaderboard();
draw(); // Draw empty grid
