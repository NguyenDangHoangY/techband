import { useRef, useEffect } from "react";

export default function useMetronomeScheduler({ bpm, isActive, onTick }) {
  const audioCtxRef = useRef(null);
  const bufferRef = useRef(null);
  const timerRef = useRef(null);
  const nextTickTimeRef = useRef(0);
  const bufferLoadedRef = useRef(false);

  // Hàm này cần được gọi từ onClick/onTouch của người dùng
  const ensureAudioReady = async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    // Nếu chưa load buffer, load ngay
    if (!bufferRef.current && !bufferLoadedRef.current) {
      bufferLoadedRef.current = true;
      const response = await fetch("/tick.wav");
      const arrayBuffer = await response.arrayBuffer();
      bufferRef.current = await audioCtxRef.current.decodeAudioData(
        arrayBuffer
      );
    }
  };

  useEffect(() => {
    if (!isActive || !bpm || !bufferRef.current) return;

    const ctx = audioCtxRef.current;
    const interval = 60 / bpm;
    let stopped = false;

    const startAt = ctx.currentTime + 0.05;

    function scheduleTick(when) {
      const source = ctx.createBufferSource();
      source.buffer = bufferRef.current;
      source.connect(ctx.destination);
      source.start(when);
      if (onTick) {
        const now = ctx.currentTime;
        const delay = Math.max((when - now) * 1000, 0);
        setTimeout(onTick, delay);
      }
    }

    function scheduler() {
      const lookahead = 0.1;
      let now = ctx.currentTime;
      while (nextTickTimeRef.current < now + lookahead) {
        scheduleTick(nextTickTimeRef.current);
        nextTickTimeRef.current += interval;
      }
      if (!stopped) {
        timerRef.current = setTimeout(scheduler, 25);
      }
    }

    nextTickTimeRef.current = startAt;
    scheduler();

    return () => {
      stopped = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, bpm, onTick, bufferRef.current]);

  // Trả về hàm phải gọi trước khi bật metronome
  return { ensureAudioReady };
}
