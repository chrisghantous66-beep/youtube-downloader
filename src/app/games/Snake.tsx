"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  dark: boolean;
  neonColor: string;
  active: boolean;
}

const W = 320;
const H = 200;
const CELL = 16;
const COLS = Math.floor(W / CELL);
const ROWS = Math.floor(H / CELL);
const INITIAL_SPEED = 130;
const MIN_SPEED = 50;

type Point = { x: number; y: number };

function rndPos(): Point {
  return {
    x: Math.floor(Math.random() * (COLS - 2)) + 1,
    y: Math.floor(Math.random() * (ROWS - 2)) + 1,
  };
}

export default function Snake({ dark, neonColor, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">("idle");

  const stateRef = useRef({
    snake: [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }],
    food: rndPos(),
    dir: { x: 0, y: 0 },
    nextDir: { x: 0, y: 0 },
    score: 0,
    highScore: 0,
    gameState: "idle" as "idle" | "playing" | "gameover",
    lastMove: 0,
    speed: INITIAL_SPEED,
  });
  const rafRef = useRef<number>(0);
  const startRef = useRef<(dir: Point) => void>(() => {});

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
    s.food = rndPos();
    s.dir = { x: 0, y: 0 };
    s.nextDir = { x: 0, y: 0 };
    s.score = 0;
    s.gameState = "idle";
    s.speed = INITIAL_SPEED;
    setScore(0);
    setGameState("idle");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bg = dark ? "#0d0d1a" : "#e8e8f0";
    const gridColor = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";
    const snakeColor = neonColor;
    const snakeHeadColor = neonColor;
    const foodColor = dark ? "#ff5544" : "#e53935";
    const textColor = dark ? "#ffffff" : "#1a1a2e";
    const textDim = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    const borderColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";

    let animating = true;
    let lastTime = 0;

    function draw() {
      const s = stateRef.current;
      ctx!.clearRect(0, 0, W, H);

      // Background
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      // Grid
      ctx!.strokeStyle = gridColor;
      ctx!.lineWidth = 0.5;
      for (let x = 0; x <= W; x += CELL) {
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, H);
        ctx!.stroke();
      }
      for (let y = 0; y <= H; y += CELL) {
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(W, y);
        ctx!.stroke();
      }

      // Border
      ctx!.strokeStyle = borderColor;
      ctx!.lineWidth = 1;
      ctx!.strokeRect(0.5, 0.5, W - 1, H - 1);

      // Snake
      for (let i = s.snake.length - 1; i >= 0; i--) {
        const seg = s.snake[i];
        const t = 1 - i / Math.max(s.snake.length, 1);
        const alpha = 0.35 + t * 0.65;
        ctx!.fillStyle = i === 0 ? snakeHeadColor : snakeColor + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        const pad = i === 0 ? 1 : 2;
        ctx!.shadowColor = i === 0 ? snakeHeadColor : "transparent";
        ctx!.shadowBlur = i === 0 ? 6 : 0;
        ctx!.fillRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
        ctx!.shadowBlur = 0;
      }

      // Food
      ctx!.fillStyle = foodColor;
      ctx!.shadowColor = foodColor;
      ctx!.shadowBlur = 8;
      const fx = s.food.x * CELL + CELL / 2;
      const fy = s.food.y * CELL + CELL / 2;
      ctx!.beginPath();
      ctx!.arc(fx, fy, CELL / 2 - 2, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.shadowBlur = 0;

      // Score
      ctx!.fillStyle = textDim;
      ctx!.font = "10px monospace";
      ctx!.textAlign = "left";
      ctx!.fillText(`SCORE ${s.score}`, 6, 14);
      ctx!.textAlign = "right";
      ctx!.fillText(`BEST ${s.highScore}`, W - 6, 14);
      ctx!.textAlign = "start";

      // Overlays
      if (s.gameState === "idle") {
        ctx!.fillStyle = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
        ctx!.fillRect(0, 0, W, H);
        ctx!.fillStyle = textColor;
        ctx!.font = "bold 13px monospace";
        ctx!.textAlign = "center";
        ctx!.fillText("PRESS AN ARROW KEY", W / 2, H / 2 - 4);
        ctx!.fillStyle = textDim;
        ctx!.font = "10px monospace";
        ctx!.fillText("Arrows / WASD / Swipe", W / 2, H / 2 + 14);
        ctx!.textAlign = "start";
      } else if (s.gameState === "gameover") {
        ctx!.fillStyle = dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.7)";
        ctx!.fillRect(0, 0, W, H);
        ctx!.fillStyle = "#ff4050";
        ctx!.font = "bold 14px monospace";
        ctx!.textAlign = "center";
        ctx!.fillText("GAME OVER", W / 2, H / 2 - 8);
        ctx!.fillStyle = textColor;
        ctx!.font = "11px monospace";
        ctx!.fillText(`Score: ${s.score}`, W / 2, H / 2 + 12);
        ctx!.fillStyle = textDim;
        ctx!.font = "10px monospace";
        ctx!.fillText("Arrow key to retry", W / 2, H / 2 + 30);
        ctx!.textAlign = "start";
      }
    }

    function moveSnake() {
      const s = stateRef.current;
      if (s.gameState !== "playing") return;

      // Apply direction
      if (s.nextDir.x !== 0 || s.nextDir.y !== 0) {
        s.dir = { ...s.nextDir };
      }

      if (s.dir.x === 0 && s.dir.y === 0) return;

      const head = s.snake[0];
      const newHead = { x: head.x + s.dir.x, y: head.y + s.dir.y };

      // Wall collision
      if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
        s.gameState = "gameover";
        setGameState("gameover");
        if (s.score > s.highScore) {
          s.highScore = s.score;
          setHighScore(s.score);
          try { localStorage.setItem("vg_snake_hs", String(s.score)); } catch {}
        }
        return;
      }

      // Self collision
      for (const seg of s.snake) {
        if (seg.x === newHead.x && seg.y === newHead.y) {
          s.gameState = "gameover";
          setGameState("gameover");
          if (s.score > s.highScore) {
            s.highScore = s.score;
            setHighScore(s.score);
            try { localStorage.setItem("vg_snake_hs", String(s.score)); } catch {}
          }
          return;
        }
      }

      s.snake.unshift(newHead);

      // Eat food
      if (newHead.x === s.food.x && newHead.y === s.food.y) {
        s.score += 10;
        setScore(s.score);
        s.food = rndPos();
        // Ensure food not on snake
        while (s.snake.some((seg) => seg.x === s.food.x && seg.y === s.food.y)) {
          s.food = rndPos();
        }
        s.speed = Math.max(MIN_SPEED, s.speed - 3);
      } else {
        s.snake.pop();
      }
    }

    function loop(time: number) {
      if (!animating) return;
      const s = stateRef.current;

      if (s.gameState === "playing" && time - s.lastMove >= s.speed) {
        moveSnake();
        s.lastMove = time;
      }

      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    if (active) {
      draw();
      rafRef.current = requestAnimationFrame(loop);
      stateRef.current.lastMove = performance.now();
    } else {
      draw();
    }

    function start(dir: Point) {
      const s = stateRef.current;
      if (s.gameState === "gameover") {
        reset();
        // start fresh after reset
        setTimeout(() => {
          const s2 = stateRef.current;
          s2.dir = dir;
          s2.nextDir = dir;
          s2.gameState = "playing";
          s2.lastMove = performance.now();
          setGameState("playing");
        }, 50);
        return;
      }
      if (s.gameState === "idle") {
        s.dir = dir;
        s.nextDir = dir;
        s.gameState = "playing";
        s.lastMove = performance.now();
        setGameState("playing");
        return;
      }
      // Queue direction change
      if (
        (dir.x !== 0 && s.dir.x === 0) ||
        (dir.y !== 0 && s.dir.y === 0)
      ) {
        s.nextDir = dir;
      }
    }

    function onKey(e: KeyboardEvent) {
      const keyMap: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
        W: { x: 0, y: -1 },
        S: { x: 0, y: 1 },
        A: { x: -1, y: 0 },
        D: { x: 1, y: 0 },
      };
      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        start(dir);
      }
    }

    // Touch swipe
    let touchStart: Point | null = null;
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }
    function onTouchEnd(e: TouchEvent) {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      touchStart = null;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (Math.max(absDx, absDy) < 20) return;
      if (absDx > absDy) {
        start({ x: dx > 0 ? 1 : -1, y: 0 });
      } else {
        start({ x: 0, y: dy > 0 ? 1 : -1 });
      }
    }

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey);
    startRef.current = start;

    // Load high score
    try {
      const hs = localStorage.getItem("vg_snake_hs");
      if (hs) {
        stateRef.current.highScore = parseInt(hs, 10) || 0;
        setHighScore(stateRef.current.highScore);
      }
    } catch {}

    return () => {
      animating = false;
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, dark, neonColor, reset]);

  return (
    <div className="relative w-full max-w-[320px] mx-auto">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-lg cursor-pointer block"
        style={{
          border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
          boxShadow: `0 0 30px ${neonColor}15`,
          background: dark ? "#0d0d1a" : "#e8e8f0",
        }}
      />
      <div className="flex items-center justify-between mt-1.5 px-1">
        <span className="text-[9px] tracking-[0.15em] uppercase font-mono" style={{ color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)" }}>
          Arrows · WASD · D-pad
        </span>
        <span className="text-[9px] tracking-[0.15em] uppercase font-mono" style={{ color: neonColor }}>
          SCORE {score}
        </span>
      </div>
      {/* D-pad */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 w-[120px] mx-auto select-none">
        <div />
        <button type="button" onPointerDown={(e) => { e.preventDefault(); startRef.current({ x: 0, y: -1 }); }}
          className="h-9 rounded-md flex items-center justify-center text-sm transition-all active:scale-90 cursor-pointer"
          style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: neonColor }}>
          ▲
        </button>
        <div />
        <button type="button" onPointerDown={(e) => { e.preventDefault(); startRef.current({ x: -1, y: 0 }); }}
          className="h-9 rounded-md flex items-center justify-center text-sm transition-all active:scale-90 cursor-pointer"
          style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: neonColor }}>
          ◄
        </button>
        <div className="h-9 rounded-md flex items-center justify-center text-[10px] font-mono"
          style={{ color: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" }}>
          ●
        </div>
        <button type="button" onPointerDown={(e) => { e.preventDefault(); startRef.current({ x: 1, y: 0 }); }}
          className="h-9 rounded-md flex items-center justify-center text-sm transition-all active:scale-90 cursor-pointer"
          style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: neonColor }}>
          ►
        </button>
        <div />
        <button type="button" onPointerDown={(e) => { e.preventDefault(); startRef.current({ x: 0, y: 1 }); }}
          className="h-9 rounded-md flex items-center justify-center text-sm transition-all active:scale-90 cursor-pointer"
          style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, color: neonColor }}>
          ▼
        </button>
        <div />
      </div>
    </div>
  );
}
