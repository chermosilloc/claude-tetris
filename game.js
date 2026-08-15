'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#90caf9', // J - pale blue
      '#ffb74d', // L - orange
    ],
    canvasBg: null,
  },
  neon: {
    colors: [
      null,
      '#00e5ff',
      '#ffea00',
      '#e040fb',
      '#00e676',
      '#ff1744',
      '#448aff',
      '#ff9100',
    ],
    canvasBg: '#05050a',
  },
  pastel: {
    colors: [
      null,
      '#a8d8e8',
      '#fff2b2',
      '#d8b4e2',
      '#b8e0c4',
      '#f4b8c1',
      '#b8c9f0',
      '#f7cba4',
    ],
    canvasBg: null,
  },
  pixel: {
    colors: [
      null,
      '#4dd0e1',
      '#ffd54f',
      '#ba68c8',
      '#81c784',
      '#e57373',
      '#90caf9',
      '#ffb74d',
    ],
    canvasBg: null,
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle-checkbox');
const skinButtons = document.querySelectorAll('.skin-btn');

const GRID_COLORS = { dark: '#22222e', light: '#dcdce6' };
const BLOCK_HIGHLIGHTS = { dark: 'rgba(255,255,255,0.12)', light: 'rgba(255,255,255,0.35)' };
const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor = GRID_COLORS.dark;
let blockHighlight = BLOCK_HIGHLIGHTS.dark;
let currentColors = SKINS.retro.colors;
let currentSkinName = 'retro';

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = currentColors[colorIndex];
  context.globalAlpha = alpha ?? 1;

  switch (currentSkinName) {
    case 'neon':
      drawBlockNeon(context, x, y, color, size);
      break;
    case 'pastel':
      drawBlockPastel(context, x, y, color, size);
      break;
    case 'pixel':
      drawBlockPixel(context, x, y, color, size);
      break;
    default:
      drawBlockRetro(context, x, y, color, size);
  }

  context.globalAlpha = 1;
}

function drawBlockRetro(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = blockHighlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
}

function drawBlockNeon(context, x, y, color, size) {
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.save();
  context.shadowBlur = 14;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  // second pass for a stronger glow core
  context.shadowBlur = 6;
  context.fillRect(px, py, s, s);
  context.restore();
  context.fillStyle = 'rgba(255,255,255,0.5)';
  context.fillRect(px, py, s, 3);
}

function roundedRectPath(context, x, y, w, h, r) {
  if (context.roundRect) {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBlockPastel(context, x, y, color, size) {
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  roundedRectPath(context, px, py, s, s, Math.max(2, size * 0.2));
  context.fillStyle = color;
  context.fill();
  roundedRectPath(context, px, py, s, s * 0.4, Math.max(2, size * 0.2));
  context.fillStyle = blockHighlight;
  context.fill();
}

function drawBlockPixel(context, x, y, color, size) {
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;
  context.fillStyle = color;
  context.fillRect(px, py, s, s);
  // 3x3 dithering pattern using shades of the base color
  const cell = s / 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if ((r + c) % 2 === 0) continue;
      context.fillStyle = 'rgba(0,0,0,0.12)';
      context.fillRect(px + c * cell, py + r * cell, cell, cell);
    }
  }
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.fillRect(px, py, cell, cell);
  context.fillStyle = blockHighlight;
  context.fillRect(px, py, s, 3);
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  gridColor = GRID_COLORS[theme];
  blockHighlight = BLOCK_HIGHLIGHTS[theme];
  themeToggle.checked = theme === 'light';
  localStorage.setItem(THEME_KEY, theme);
  if (current) draw();
}

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

function applySkin(name) {
  const skin = SKINS[name] ? name : 'retro';
  currentSkinName = skin;
  currentColors = SKINS[skin].colors;
  canvas.style.background = SKINS[skin].canvasBg || '';
  nextCanvas.style.background = SKINS[skin].canvasBg || '';
  skinButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.skin === skin));
  localStorage.setItem(SKIN_KEY, skin);
  if (current) draw();
  if (next) drawNext();
}

skinButtons.forEach(btn => {
  btn.addEventListener('click', () => applySkin(btn.dataset.skin));
});

applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
applySkin(localStorage.getItem(SKIN_KEY) || 'retro');

init();
