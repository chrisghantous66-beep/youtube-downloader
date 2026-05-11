"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  dark: boolean;
  neonColor: string;
  active: boolean;
}

const W = 320;
const H = 200;
const PADDLE_W = 52;
const PADDLE_H = 7;
const PADDLE_Y = H - 18;
const BALL_R = 4;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_W = (W - 20) / BRICK_COLS;
const BRICK_H = 12;
const BRICK_PAD = 2;
const BRICK_TOP = 28;

type Brick = { x: number; y: number; alive: boolean; hp: number };

function buildBricks(): Brick[] {
  const bricks: Brick[] = [];
  const offsetX = (W - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: offsetX + c * (BRICK_W + BRICK_PAD),
        y: BRICK_TOP + r * (BRICK_H + BRICK_PAD),
        alive: true,
        hp: BRICK_ROWS - r,
      });
    }
  }
  return bricks;
}

const BRICK_COLORS_DARK = ["#ff6b9d", "#ff4081", "#f50057", "#c51162", "#880e4f"];
const BRICK_COLORS_LIGHT = ["#e91e63", "#c2185b", "#ad1457", "#880e4f", "#6a1b3a"];

export default function Breakout({ dark, neonColor, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover" | "win">("idle");
  const stateRef = useRef({
    paddleX: W / 2 - PADDLE_W / 2,
    ballX: W / 2,
    ballY: PADDLE_Y - 10,
    ballDX: 0,
    ballDY: 0,
    bricks: buildBricks(),
    score: 0,
    lives: 3,
    highScore: 0,
    gameState: "idle" as "idle" | "playing" | "gameover" | "win",
    neonColor: neonColor,
  });
  const rafRef = useRef<number>(0);

  // Keep ref in sync with props
  stateRef.current.neonColor = neonColor;

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.paddleX = W / 2 - PADDLE_W / 2;
    s.ballX = W / 2;
    s.ballY = PADDLE_Y - 10;
    s.ballDX = 0;
    s.ballDY = 0;
    s.bricks = buildBricks();
    s.score = 0;
    s.lives = 3;
    s.gameState = "idle";
    setScore(0);
    setLives(3);
    setGameState("idle");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bg = dark ? "#0d0d1a" : "#e8e8f0";
    const textColor = dark ? "#ffffff" : "#1a1a2e";
    const textDim = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    const paddleColor = neonColor;
    const ballColor = dark ? "#ffffff" : "#1a1a2e";
    const brickColors = dark ? BRICK_COLORS_DARK : BRICK_COLORS_LIGHT;
    const borderColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
    const wallColor = dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";

    let animating = true;

    function draw() {
      const s = stateRef.current;
      ctx!.clearRect(0, 0, W, H);

      // Background
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      // Border
      ctx!.strokeStyle = borderColor;
      ctx!.lineWidth = 1;
      ctx!.strokeRect(0.5, 0.5, W - 1, H - 1);

      // Walls (top, left, right)
      ctx!.fillStyle = wallColor;
      ctx!.fillRect(0, 0, W, 2);
      ctx!.fillRect(0, 0, 2, H);
      ctx!.fillRect(W - 2, 0, 2, H);

      // Bricks
      for (const b of s.bricks) {
        if (!b.alive) continue;
        const ci = Math.min(b.hp - 1, brickColors.length - 1);
        ctx!.fillStyle = brickColors[Math.max(0, ci)];
        ctx!.shadowColor = brickColors[Math.max(0, ci)];
        ctx!.shadowBlur = 4;
        ctx!.fillRect(b.x, b.y, BRICK_W, BRICK_H);
        ctx!.shadowBlur = 0;
      }

      // Paddle
      ctx!.fillStyle = paddleColor;
      ctx!.shadowColor = paddleColor;
      ctx!.shadowBlur = 8;
      const px = s.paddleX;
      const py = PADDLE_Y;
      ctx!.beginPath();
      ctx!.roundRect(px, py, PADDLE_W, PADDLE_H, 3);
      ctx!.fill();
      ctx!.shadowBlur = 0;

      // Ball
      ctx!.fillStyle = ballColor;
      ctx!.shadowColor = dark ? neonColor : neonColor;
      ctx!.shadowBlur = dark ? 6 : 3;
      ctx!.beginPath();
      ctx!.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.shadowBlur = 0;

      // Trail
      if (s.gameState === "playing") {
        ctx!.fillStyle = neonColor + "22";
        ctx!.beginPath();
        ctx!.arc(s.ballX - s.ballDX * 0.8, s.ballY - s.ballDY * 0.8, BALL_R * 0.7, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Score & Lives (on canvas)
      ctx!.fillStyle = textDim;
      ctx!.font = "10px monospace";
      ctx!.textAlign = "left";
      ctx!.fillText(`SCORE ${s.score}`, 6, 14);
      ctx!.fillStyle = neonColor + "88";
      ctx!.textAlign = "center";
      ctx!.fillText(`BEST ${s.highScore}`, W / 2, 14);
      ctx!.fillStyle = textDim;
      ctx!.textAlign = "right";
      ctx!.fillText(`LIVES ${s.lives}`, W - 6, 14);
      ctx!.textAlign = "start";

      // Game state overlays
      if (s.gameState === "idle") {
        ctx!.fillStyle = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
        ctx!.fillRect(0, 0, W, H);
        ctx!.fillStyle = textColor;
        ctx!.font = "bold 13px monospace";
        ctx!.textAlign = "center";
        ctx!.fillText("CLICK OR PRESS SPACE", W / 2, H / 2 - 4);
        ctx!.fillStyle = textDim;
        ctx!.font = "10px monospace";
        ctx!.fillText("Mouse to move · Click to launch", W / 2, H / 2 + 14);
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
        ctx!.fillText("Click or Space to retry", W / 2, H / 2 + 30);
        ctx!.textAlign = "start";
      } else if (s.gameState === "win") {
        ctx!.fillStyle = dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.7)";
        ctx!.fillRect(0, 0, W, H);
        ctx!.fillStyle = neonColor;
        ctx!.font = "bold 14px monospace";
        ctx!.textAlign = "center";
        ctx!.fillText("YOU WIN!", W / 2, H / 2 - 8);
        ctx!.fillStyle = textColor;
        ctx!.font = "11px monospace";
        ctx!.fillText(`Score: ${s.score}`, W / 2, H / 2 + 12);
        ctx!.fillStyle = textDim;
        ctx!.font = "10px monospace";
        ctx!.fillText("Click or Space to play again", W / 2, H / 2 + 30);
        ctx!.textAlign = "start";
      }
    }

    function update() {
      const s = stateRef.current;
      if (s.gameState !== "playing") return;

      // Move ball
      s.ballX += s.ballDX;
      s.ballY += s.ballDY;

      // Wall collisions
      if (s.ballX - BALL_R <= 2) {
        s.ballX = 2 + BALL_R;
        s.ballDX = Math.abs(s.ballDX);
      }
      if (s.ballX + BALL_R >= W - 2) {
        s.ballX = W - 2 - BALL_R;
        s.ballDX = -Math.abs(s.ballDX);
      }
      if (s.ballY - BALL_R <= 2) {
        s.ballY = 2 + BALL_R;
        s.ballDY = Math.abs(s.ballDY);
      }

      // Fall below paddle
      if (s.ballY > H + 10) {
        s.lives--;
        setLives(s.lives);
        if (s.lives <= 0) {
          s.gameState = "gameover";
          setGameState("gameover");
          if (s.score > s.highScore) {
            s.highScore = s.score;
            setHighScore(s.score);
            try { localStorage.setItem("vg_breakout_hs", String(s.score)); } catch {}
          }
        } else {
          s.paddleX = W / 2 - PADDLE_W / 2;
          s.ballX = W / 2;
          s.ballY = PADDLE_Y - 10;
          s.ballDX = 0;
          s.ballDY = 0;
          s.gameState = "idle";
          setGameState("idle");
        }
        return;
      }

      // Paddle collision
      if (
        s.ballDY > 0 &&
        s.ballY + BALL_R >= PADDLE_Y &&
        s.ballY + BALL_R <= PADDLE_Y + PADDLE_H + 4 &&
        s.ballX >= s.paddleX - BALL_R &&
        s.ballX <= s.paddleX + PADDLE_W + BALL_R
      ) {
        const hitPos = (s.ballX - s.paddleX) / PADDLE_W;
        const angle = (hitPos - 0.5) * Math.PI * 0.7;
        const speed = Math.sqrt(s.ballDX * s.ballDX + s.ballDY * s.ballDY) * 1.02;
        s.ballDX = Math.sin(angle) * speed;
        s.ballDY = -Math.cos(angle) * speed;
        s.ballY = PADDLE_Y - BALL_R;
        const minDY = 1.8;
        if (Math.abs(s.ballDY) < minDY) s.ballDY = -minDY;
      }

      // Brick collisions
      for (const b of s.bricks) {
        if (!b.alive) continue;
        if (
          s.ballX + BALL_R > b.x &&
          s.ballX - BALL_R < b.x + BRICK_W &&
          s.ballY + BALL_R > b.y &&
          s.ballY - BALL_R < b.y + BRICK_H
        ) {
          b.alive = false;
          s.score += b.hp * 10;
          setScore(s.score);

          // Bounce
          const overlapLeft = s.ballX + BALL_R - b.x;
          const overlapRight = b.x + BRICK_W - (s.ballX - BALL_R);
          const overlapTop = s.ballY + BALL_R - b.y;
          const overlapBottom = b.y + BRICK_H - (s.ballY - BALL_R);
          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);

          if (minOverlapX < minOverlapY) {
            s.ballDX = -s.ballDX;
          } else {
            s.ballDY = -s.ballDY;
          }
          break;
        }
      }

      // Check win
      if (s.bricks.every((b) => !b.alive)) {
        s.score += 100;
        setScore(s.score);
        if (s.score > s.highScore) {
          s.highScore = s.score;
          setHighScore(s.score);
          try { localStorage.setItem("vg_breakout_hs", String(s.score)); } catch {}
        }
        s.gameState = "win";
        setGameState("win");
      }
    }

    function loop() {
      if (!animating) return;
      update();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    // Load high score
    try {
      const hs = localStorage.getItem("vg_breakout_hs");
      if (hs) {
        stateRef.current.highScore = parseInt(hs, 10) || 0;
        setHighScore(stateRef.current.highScore);
      }
    } catch {}

    if (active) {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw();
    }

    // Mouse/Touch move
    function onMove(ex: number, ey: number) {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const mx = (ex - rect.left) * scaleX;
      const s = stateRef.current;
      s.paddleX = Math.max(2, Math.min(W - PADDLE_W - 2, mx - PADDLE_W / 2));
      if (s.gameState === "idle") {
        s.ballX = s.paddleX + PADDLE_W / 2;
        s.ballY = PADDLE_Y - 10;
      }
    }

    function onMouseMove(e: MouseEvent) {
      onMove(e.clientX, e.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }

    function launch() {
      const s = stateRef.current;
      if (s.gameState === "idle") {
        const angle = (Math.random() - 0.5) * 0.5;
        const speed = 3.5;
        s.ballDX = Math.sin(angle) * speed;
        s.ballDY = -Math.cos(angle) * speed;
        s.gameState = "playing";
        setGameState("playing");
      } else if (s.gameState === "gameover" || s.gameState === "win") {
        reset();
      }
    }

    function onClick() {
      launch();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        launch();
      }
      if (e.key === "ArrowLeft" || e.key === "a") {
        const s = stateRef.current;
        s.paddleX = Math.max(2, s.paddleX - 15);
        if (s.gameState === "idle") {
          s.ballX = s.paddleX + PADDLE_W / 2;
        }
      }
      if (e.key === "ArrowRight" || e.key === "d") {
        const s = stateRef.current;
        s.paddleX = Math.min(W - PADDLE_W - 2, s.paddleX + 15);
        if (s.gameState === "idle") {
          s.ballX = s.paddleX + PADDLE_W / 2;
        }
      }
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onClick);
    window.addEventListener("keydown", onKey);

    return () => {
      animating = false;
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onClick);
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
          Mouse · Space · Arrows
        </span>
        <span className="text-[9px] tracking-[0.15em] uppercase font-mono" style={{ color: neonColor }}>
          SCORE {score}
        </span>
      </div>
    </div>
  );
}
