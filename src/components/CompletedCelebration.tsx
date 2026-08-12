import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import successAnimation from "@/assets/lottie/success.json";

type Listener = () => void;
let listeners: Listener[] = [];

export function triggerCompletedCelebration() {
  listeners.forEach((fn) => fn());
}

export function CompletedCelebrationOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fn = () => {
      setShow(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShow(false), 3000);
    };
    listeners.push(fn);
    return () => {
      if (timer) clearTimeout(timer);
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
      style={{ backgroundColor: "transparent" }}
    >
      <div className="w-72 h-72" style={{ backgroundColor: "transparent" }}>
        <Lottie animationData={successAnimation} loop={false} autoplay />
      </div>
    </div>
  );
}
