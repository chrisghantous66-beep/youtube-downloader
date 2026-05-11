"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  dark: boolean;
  neonColor: string;
  active: boolean;
}

const W = 320;
const H = 200;
const PLAYER_W = 20;
const PLAYER_H = 12;
const PLAYER_Y = H - 24;
const BULLET_SPEED = 5;
const ENEMY_COLS = 6;
const ENEMY_ROWS = 4;
const ENEMY_W = 18;
const ENEMY_H = 12;
const ENEMY_PAD_X = 14;
const ENEMY_PAD_Y = 10;
const ENEMY_TOP = 24;

type Enemy = { x: number; y: number; alive: boolean; row: number };
type Bullet = { x: number; y: number; dy: number };

function buildEnemies(): Enemy[] {
  const enemies: Enemy[] = [];
  const totalW = ENEMY_COLS * (ENEMY_W + ENEMY_PAD_X) - ENEMY_PAD_X;
  const startX = (W - totalW) / 2;
  for (let r = 0; r < ENEMY_ROWS; r++) {
    for (let c = 0; c < ENEMY_COLS; c++) {
      enemies.push({
        x: startX + c * (ENEMY_W + ENEMY_PAD_X),
        y: ENEMY_TOP + r * (ENEMY_H + ENEMY_PAD_Y),
        alive: true,
        row: r,
      });
    }
  }
  return enemies;
}

const ENEMY_COLORS_DARK = ["#ff6b9d", "#ff8a65", "#ffd54f", "#69f0ae"];
const ENEMY_COLORS_LIGHT = ["#c62828", "#e65100", "#f9a825", "#2e7d32"];

export default function SpaceInvaders({ dark, neonColor, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<"idle" | "playing" | "gameover" | "win">("idle");

  const stateRef = useRef({
    playerX: W / 2 - PLAYER_W / 2,
    enemies: buildEnemies(),
    bullets: [] as Bullet[],
    enemyBullets: [] as Bullet[],
    enemyDir: 1,
    enemySpeed: 0.4,
    score: 0,
    lives: 3,
    highScore: 0,
    gameState: "idle" as "idle" | "playing" | "gameover" | "win",
    lastShot: 0,
    shootCooldown: 400,
    moveLeft: false,
    moveRight: false,
  });
  const rafRef = useRef<number>(0);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.playerX = W / 2 - PLAYER_W / 2;
    s.enemies = buildEnemies();
    s.bullets = [];
    s.enemyBullets = [];
    s.enemyDir = 1;
    s.enemySpeed = 0.4;
    s.score = 0;
    s.lives = 3;
    s.gameState = "idle";
    s.lastShot = 0;
    s.moveLeft = false;
    s.moveRight = false;
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
    const borderColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
    const playerColor = neonColor;
    const bulletColor = dark ? "#ffffff" : "#1a1a2e";
    const enemyColors = dark ? ENEMY_COLORS_DARK : ENEMY_COLORS_LIGHT;
    const enemyBulletColor = "#ff4050";
    const starColor = dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)";

    let animating = true;
    let lastTime = 0;

    // Stars
    const stars: { x: number; y: number; s: number }[] = [];
    for (let i = 0; i < 40; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5 });
    }

    function draw() {
      const s = stateRef.current;
      ctx!.clearRect(0, 0, W, H);

      // Background
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      // Stars
      for (const st of stars) {
        ctx!.fillStyle = starColor;
        ctx!.fillRect(st.x, st.y, st.s, st.s);
      }

      // Border
      ctx!.strokeStyle = borderColor;
      ctx!.lineWidth = 1;
      ctx!.strokeRect(0.5, 0.5, W - 1, H - 1);

      // Ground line
      ctx!.strokeStyle = neonColor + "33";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(0, PLAYER_Y + PLAYER_H + 8);
      ctx!.lineTo(W, PLAYER_Y + PLAYER_H + 8);
      ctx!.stroke();

      // Enemies
      for (const e of s.enemies) {
        if (!e.alive) continue;
        const ci = Math.min(e.row, enemyColors.length - 1);
        ctx!.fillStyle = enemyColors[ci];
        // Draw alien shape
        const cx = e.x + ENEMY_W / 2;
        const cy = e.y + ENEMY_H / 2;
        ctx!.beginPath();
        // Body
        ctx!.roundRect(e.x, e.y + 3, ENEMY_W, ENEMY_H - 3, 3);
        ctx!.fill();
        // Head
        ctx!.fillStyle = enemyColors[ci] + "cc";
        ctx!.beginPath();
        ctx!.arc(cx, e.y + 4, ENEMY_W / 3, 0, Math.PI * 2);
        ctx!.fill();
        // Eyes
        ctx!.fillStyle = dark ? "#fff" : "#000";
        ctx!.beginPath();
        ctx!.arc(cx - 3, e.y + ENEMY_H / 2, 1.5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(cx + 3, e.y + ENEMY_H / 2, 1.5, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      // Player
      ctx!.fillStyle = playerColor;
      ctx!.shadowColor = playerColor;
      ctx!.shadowBlur = 10;
      const px = s.playerX;
      const py = PLAYER_Y;
      ctx!.beginPath();
      ctx!.moveTo(px + PLAYER_W / 2, py);
      ctx!.lineTo(px, py + PLAYER_H);
      ctx!.lineTo(px + 4, py + PLAYER_H - 3);
      ctx!.lineTo(px + PLAYER_W / 2, py + 2);
      ctx!.lineTo(px + PLAYER_W - 4, py + PLAYER_H - 3);
      ctx!.lineTo(px + PLAYER_W, py + PLAYER_H);
      ctx!.closePath();
      ctx!.fill();
      ctx!.shadowBlur = 0;

      // Player glow
      ctx!.fillStyle = neonColor + "44";
      ctx!.beginPath();
      ctx!.arc(px + PLAYER_W / 2, py + PLAYER_H / 2, PLAYER_W, 0, Math.PI * 2);
      ctx!.fill();

      // Bullets
      for (const b of s.bullets) {
        ctx!.fillStyle = bulletColor;
        ctx!.shadowColor = neonColor;
        ctx!.shadowBlur = 4;
        ctx!.fillRect(b.x - 1.5, b.y - 4, 3, 8);
        ctx!.shadowBlur = 0;
      }

      // Enemy bullets
      for (const b of s.enemyBullets) {
        ctx!.fillStyle = enemyBulletColor;
        ctx!.shadowColor = enemyBulletColor;
        ctx!.shadowBlur = 4;
        ctx!.fillRect(b.x - 1, b.y - 3, 2, 6);
        ctx!.shadowBlur = 0;
      }

      // Score & Lives
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

      // Overlays
      if (s.gameState === "idle") {
        ctx!.fillStyle = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
        ctx!.fillRect(0, 0, W, H);
        ctx!.fillStyle = textColor;
        ctx!.font = "bold 13px monospace";
        ctx!.textAlign = "center";
        ctx!.fillText("CLICK OR PRESS SPACE", W / 2, H / 2 - 4);
        ctx!.fillStyle = textDim;
        ctx!.font = "10px monospace";
        ctx!.fillText("Arrows to move · Space/Click to shoot", W / 2, H / 2 + 14);
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

    function update(time: number) {
      const s = stateRef.current;
      if (s.gameState !== "playing") return;

      const dt = lastTime ? Math.min(time - lastTime, 50) : 16;
      lastTime = time;

      // Player movement
      const playerSpeed = 0.2;
      if (s.moveLeft) s.playerX = Math.max(2, s.playerX - playerSpeed * dt);
      if (s.moveRight) s.playerX = Math.min(W - PLAYER_W - 2, s.playerX + playerSpeed * dt);

      // Move bullets
      for (const b of s.bullets) {
        b.y += b.dy * (dt / 16);
      }
      s.bullets = s.bullets.filter((b) => b.y > -10);

      // Move enemy bullets
      for (const b of s.enemyBullets) {
        b.y += b.dy * (dt / 16);
      }
      s.enemyBullets = s.enemyBullets.filter((b) => b.y < H + 10);

      // Enemy movement
      const aliveEnemies = s.enemies.filter((e) => e.alive);
      if (aliveEnemies.length === 0) {
        s.score += 200;
        setScore(s.score);
        if (s.score > s.highScore) {
          s.highScore = s.score;
          setHighScore(s.score);
          try { localStorage.setItem("vg_invaders_hs", String(s.score)); } catch {}
        }
        s.gameState = "win";
        setGameState("win");
        return;
      }

      let hitEdge = false;
      for (const e of aliveEnemies) {
        e.x += s.enemyDir * s.enemySpeed * (dt / 16);
        if (e.x <= 2 || e.x + ENEMY_W >= W - 2) {
          hitEdge = true;
        }
      }
      if (hitEdge) {
        s.enemyDir *= -1;
        for (const e of aliveEnemies) {
          e.y += 8;
        }
        s.enemySpeed += 0.03;
      }

      // Check if enemies reached bottom
      for (const e of aliveEnemies) {
        if (e.y + ENEMY_H >= PLAYER_Y - 8) {
          s.lives = 0;
          setLives(0);
          s.gameState = "gameover";
          setGameState("gameover");
          if (s.score > s.highScore) {
            s.highScore = s.score;
            setHighScore(s.score);
            try { localStorage.setItem("vg_invaders_hs", String(s.score)); } catch {}
          }
          return;
        }
      }

      // Enemy shoot
      if (aliveEnemies.length > 0 && Math.random() < 0.003 * aliveEnemies.length * (dt / 16)) {
        const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        s.enemyBullets.push({ x: shooter.x + ENEMY_W / 2, y: shooter.y + ENEMY_H, dy: 2.5 });
      }

      // Bullet-enemy collisions
      for (const b of s.bullets) {
        for (const e of s.enemies) {
          if (!e.alive) continue;
          if (b.x > e.x && b.x < e.x + ENEMY_W && b.y > e.y && b.y < e.y + ENEMY_H) {
            e.alive = false;
            b.y = -100; // mark for removal
            s.score += (ENEMY_ROWS - e.row) * 25;
            setScore(s.score);
            break;
          }
        }
      }
      s.bullets = s.bullets.filter((b) => b.y > -10);

      // Enemy bullet-player collision
      for (const b of s.enemyBullets) {
        if (
          b.x > s.playerX &&
          b.x < s.playerX + PLAYER_W &&
          b.y > PLAYER_Y &&
          b.y < PLAYER_Y + PLAYER_H
        ) {
          s.lives--;
          setLives(s.lives);
          b.y = H + 100;
          if (s.lives <= 0) {
            s.gameState = "gameover";
            setGameState("gameover");
            if (s.score > s.highScore) {
              s.highScore = s.score;
              setHighScore(s.score);
              try { localStorage.setItem("vg_invaders_hs", String(s.score)); } catch {}
            }
            return;
          }
        }
      }
      s.enemyBullets = s.enemyBullets.filter((b) => b.y < H + 10);
    }

    function loop(time: number) {
      if (!animating) return;
      update(time);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    // Load high score
    try {
      const hs = localStorage.getItem("vg_invaders_hs");
      if (hs) {
        stateRef.current.highScore = parseInt(hs, 10) || 0;
        setHighScore(stateRef.current.highScore);
      }
    } catch {}

    if (active) {
      lastTime = 0;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw();
    }

    function shoot() {
      const s = stateRef.current;
      if (s.gameState === "idle") {
        s.gameState = "playing";
        setGameState("playing");
        lastTime = performance.now();
      }
      if (s.gameState === "gameover" || s.gameState === "win") {
        reset();
        return;
      }
      if (s.gameState !== "playing") return;
      const now = performance.now();
      if (now - s.lastShot < s.shootCooldown) return;
      s.lastShot = now;
      s.bullets.push({ x: s.playerX + PLAYER_W / 2, y: PLAYER_Y, dy: -BULLET_SPEED });
    }

    function onClick(e: MouseEvent) {
      shoot();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        shoot();
      }
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        stateRef.current.moveLeft = true;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        stateRef.current.moveRight = true;
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        stateRef.current.moveLeft = false;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        stateRef.current.moveRight = false;
      }
    }

    // Touch controls
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const mx = (e.touches[0].clientX - rect.left) * scaleX;
      stateRef.current.playerX = Math.max(2, Math.min(W - PLAYER_W - 2, mx - PLAYER_W / 2));
    }
    function onTouchEnd(e: TouchEvent) {
      shoot();
    }

    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      animating = false;
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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
          Arrows · Space · Touch
        </span>
        <span className="text-[9px] tracking-[0.15em] uppercase font-mono" style={{ color: neonColor }}>
          SCORE {score}
        </span>
      </div>
    </div>
  );
}
