import confetti from "canvas-confetti";

export function celebrateClosedWon() {
  const duration = 1500;
  const end = Date.now() + duration;

  (function frame() {
    // Left cannon — fires up and to the right
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      startVelocity: 55,
      origin: { x: 0, y: 0.75 },
      colors: ["#22c55e", "#facc15", "#3b82f6", "#ec4899"],
      zIndex: 2147483647,
      disableForReducedMotion: false,
    });
    // Right cannon — fires up and to the left
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      startVelocity: 55,
      origin: { x: 1, y: 0.75 },
      colors: ["#22c55e", "#facc15", "#3b82f6", "#ec4899"],
      zIndex: 2147483647,
      disableForReducedMotion: false,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
