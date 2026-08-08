# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris clásico implementado en JavaScript vanilla con Canvas 2D, sin dependencias, sin build ni bundler. Tres archivos: `index.html` (DOM y canvas), `style.css` (tema dark/retro), `game.js` (toda la lógica del juego, ~300 líneas).

## Running

No hay proceso de build ni tests. Para jugar/probar cambios, abrir `index.html` directamente en el navegador o servir el directorio con cualquier servidor estático:

```bash
python3 -m http.server 8000
# o
npx serve .
```

## Architecture

Todo el estado del juego vive en variables globales de módulo en `game.js` (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — no hay clases ni módulos ES, es un único script cargado con `<script src="game.js">`.

Flujo principal:

- `init()` crea el tablero, genera la primera pieza (`next` → `spawn()`) y arranca el loop con `requestAnimationFrame`.
- `loop(ts)` acumula delta time; cuando supera `dropInterval` baja la pieza una fila o llama a `lockPiece()` si colisiona.
- `lockPiece()` → `merge()` (fija la pieza en `board`) → `clearLines()` (elimina filas completas, recalcula score/nivel/velocidad) → `spawn()` (promueve `next` a `current` y genera una nueva `next`; si la nueva pieza colisiona al aparecer, dispara `endGame()`).
- `draw()` dibuja grid + tablero fijo + ghost piece (proyección de `ghostY()` con `globalAlpha = 0.2`) + pieza actual, todo en cada frame.
- Input por teclado (`keydown` listener) mueve/rota/hace soft o hard drop; `KeyP` alterna pausa deteniendo/reanudando el `requestAnimationFrame` loop.

Piezas: matrices cuadradas en `PIECES` (índice = color en `COLORS`). Rotación vía `rotateCW()` (transposición + reverso de filas); `tryRotate()` aplica wall kicks probando desplazamientos `[0, -1, 1, -2, 2]` antes de descartar el giro. Colisión centralizada en `collide(shape, ox, oy)`.

Al ajustar `COLS`, `ROWS` o `BLOCK` en `game.js`, hay que actualizar en paralelo el `width`/`height` del `<canvas id="board">` en `index.html` para que coincidan (`COLS × BLOCK`, `ROWS × BLOCK`).
