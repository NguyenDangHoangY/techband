import { useRef, useEffect } from "react";

// Đã cập nhật: tự động dừng sau 24 nhịp, truyền thêm onStop

export default function useMetronomeScheduler({
  bpm,
  isActive,
  onTick,
  onStop,
}) {
  const audioCtxRef = useRef(null);
  const bufferRef = useRef(null);
  const timerRef = useRef(null);
  const nextTickTimeRef = useRef(0);
  const bufferLoadedRef = useRef(false);

  // Số nhịp đã phát, reset mỗi lần kích hoạt
  const tickCountRef = useRef(0);

  // Hàm này cần được gọi từ onClick/onTouch của người dùng
  const ensureAudioReady = async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
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

    tickCountRef.current = 0;

    function scheduleTick(when) {
      // Chớp nháy và phát tiếng đồng thời (khớp tuyệt đối)
      if (onTick) {
        onTick();
      }
      tickCountRef.current += 1;
      if (tickCountRef.current >= 25) {
        stopped = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        if (onStop) onStop();
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = bufferRef.current;
      source.connect(ctx.destination);
      source.start(when);
    }

    function scheduler() {
      const lookahead = 0.1;
      let now = ctx.currentTime;
      while (nextTickTimeRef.current < now + lookahead && !stopped) {
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
  }, [isActive, bpm, onTick, onStop, bufferRef.current]);

  return { ensureAudioReady, audioCtxRef, bufferRef };
}
