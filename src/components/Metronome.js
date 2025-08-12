import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Text,
  HStack,
  NumberInput,
  NumberInputField,
} from "@chakra-ui/react";

const Metronome = ({ tempo = 120 }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(tempo);
  const [beat, setBeat] = useState(0);
  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Hàm tạo tiếng tick (white noise burst)
  const playTick = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-40 * i) / data.length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  };

  // Bắt buộc phát âm ngay khi bấm Start
  const handleStartStop = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    // Resume context nếu cần
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    if (!isPlaying) {
      setBeat(1);
      playTick(); // Phát tick ngay lập tức khi bấm Start
    } else {
      setBeat(0);
    }
    setIsPlaying((p) => !p);
  };

  // Lập lịch phát tick các lần tiếp theo
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setBeat((b) => b + 1);
        playTick();
      }, (60 * 1000) / bpm);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setBeat(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [isPlaying, bpm]);

  return (
    <Box mt={6} p={4} borderWidth="1px" borderRadius="md">
      <Text fontWeight="bold">Metronome</Text>
      <HStack mt={2}>
        <NumberInput
          value={bpm}
          min={30}
          max={300}
          onChange={(_, n) => setBpm(n)}
        >
          <NumberInputField />
        </NumberInput>
        <Button
          colorScheme={isPlaying ? "red" : "green"}
          onClick={handleStartStop}
        >
          {isPlaying ? "Stop" : "Start"}
        </Button>
        <Text>Beat: {isPlaying ? beat : 0}</Text>
      </HStack>
    </Box>
  );
};

export default Metronome;
