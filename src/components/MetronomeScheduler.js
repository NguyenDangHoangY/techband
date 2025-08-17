import { useRef, useEffect, useState } from "react";
const MAX_TICKS = 16;

export default function useMetronomeScheduler({
  bpm,
  isActive,
  onTick,
  onStop,
}) {
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);
  const nextTickTimeRef = useRef(0);
  const tickCountRef = useRef(0);

  const [buffer, setBuffer] = useState(null);
  const [bufferLoaded, setBufferLoaded] = useState(false);

  // Đừng dùng session tăng liên tục, chỉ cần ensureAudioReady đúng
  const ensureAudioReady = async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      console.log("[Metronome] AudioContext created");
    }
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
      console.log("[Metronome] AudioContext resumed");
    }
    if (!buffer) {
      const response = await fetch("/tick.wav");
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      setBuffer(decoded);
      setBufferLoaded(true);
      console.log("[Metronome] Buffer loaded");
    } else if (!bufferLoaded) {
      setBufferLoaded(true);
    }
  };

  // Chỉ chạy lại khi các giá trị thực sự thay đổi!
  useEffect(() => {
    if (!isActive || !bpm || !buffer || !bufferLoaded) {
      return;
    }

    const ctx = audioCtxRef.current;
    const interval = 60 / bpm;
    let stopped = false;
    tickCountRef.current = 0;

    function playTick(when) {
      console.log(
        `[Metronome] playTick #${
          tickCountRef.current + 1
        } at ctx.currentTime=${ctx.currentTime.toFixed(
          4
        )}, scheduled at ${when.toFixed(4)}`
      );
      if (onTick) onTick();
      tickCountRef.current += 1;
      if (tickCountRef.current > MAX_TICKS) {
        stopped = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        if (onStop) onStop();
        console.log("[Metronome] Metronome stopped at MAX_TICKS");
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(when);
    }

    function scheduler() {
      const lookahead = 0.1;
      let now = ctx.currentTime;
      console.log(
        `[Metronome] scheduler running at ctx.currentTime=${now.toFixed(
          4
        )}, nextTickTime=${nextTickTimeRef.current.toFixed(4)}, tickCount=${
          tickCountRef.current
        }`
      );
      while (
        nextTickTimeRef.current < now + lookahead &&
        !stopped &&
        tickCountRef.current <= MAX_TICKS
      ) {
        playTick(nextTickTimeRef.current);
        nextTickTimeRef.current += interval;
      }
      if (!stopped && tickCountRef.current <= MAX_TICKS) {
        timerRef.current = setTimeout(scheduler, 25);
      }
    }

    // Tick đầu tiên
    nextTickTimeRef.current = ctx.currentTime + 0.05;
    console.log(
      `[Metronome] START metronome at ctx.currentTime=${ctx.currentTime.toFixed(
        4
      )}, first tick scheduled at ${nextTickTimeRef.current.toFixed(
        4
      )}, bpm=${bpm}, interval=${interval}`
    );
    playTick(nextTickTimeRef.current);
    nextTickTimeRef.current += interval;

    const delayToNextTick = Math.max(
      (nextTickTimeRef.current - ctx.currentTime) * 1000,
      0
    );
    console.log(
      `[Metronome] Scheduling scheduler() after delayToNextTick=${delayToNextTick.toFixed(
        2
      )}ms (tick 2)`
    );

    timerRef.current = setTimeout(() => {
      scheduler();
    }, delayToNextTick);

    return () => {
      stopped = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      console.log("[Metronome] Scheduler CLEANUP");
    };
  }, [isActive, bpm, buffer, bufferLoaded, onStop, onTick]);

  const testTick = async () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      let tickBuffer = buffer;
      if (!tickBuffer) {
        const response = await fetch("/tick.wav");
        const arrayBuffer = await response.arrayBuffer();
        tickBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
        setBuffer(tickBuffer);
        setBufferLoaded(true);
      }
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = tickBuffer;
      source.connect(audioCtxRef.current.destination);
      source.start(0);
      console.log(
        "[Metronome] testTick played at",
        audioCtxRef.current.currentTime
      );
    } catch (e) {
      console.log("Test tick fail!", e);
    }
  };

  return {
    ensureAudioReady,
    testTick,
    audioCtxRef,
    buffer,
    setBuffer,
    bufferLoaded,
  };
}
