import React, { useState, useRef } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Textarea,
  useToast,
  Flex,
  Text,
} from "@chakra-ui/react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function SongAddPage() {
  const [name, setName] = useState("");
  const [tempo, setTempo] = useState(120);
  const [note, setNote] = useState("");
  const [lastTap, setLastTap] = useState(null);
  const [tapCount, setTapCount] = useState(0);
  const [tapHistory, setTapHistory] = useState([]);
  const toast = useToast();
  const navigate = useNavigate();
  const tapTimeoutRef = useRef(null);

  // Xử lý nút "Tab Tempo"
  const handleTapTempo = () => {
    const now = Date.now();
    if (lastTap && now - lastTap < 2000) {
      const newHistory = [...tapHistory, now].slice(-6);
      if (newHistory.length > 1) {
        const intervals = newHistory.slice(1).map((t, i) => t - newHistory[i]);
        const avgInterval =
          intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
        const bpm = Math.round(60000 / avgInterval);
        setTempo(Math.min(300, Math.max(30, bpm)));
      }
      setTapHistory(newHistory);
      setTapCount(tapCount + 1);
    } else {
      setTapHistory([now]);
      setTapCount(1);
    }
    setLastTap(now);

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
      setTapHistory([]);
      setLastTap(null);
    }, 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      toast({ title: "Tên bài hát không được để trống.", status: "error" });
      return;
    }
    await addDoc(collection(db, "songs"), { name, tempo, note });
    toast({ title: "Thêm bài hát thành công!", status: "success" });
    navigate("/");
  };

  return (
    <Box maxW="500px" mx="auto" p={4}>
      <form onSubmit={handleSubmit}>
        <FormControl mb={3} isRequired>
          <FormLabel>Tên bài hát</FormLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormControl>
        <FormControl mb={3}>
          <FormLabel>
            Tempo (BPM)
            <Button
              ml={3}
              size="lg"
              colorScheme="blue"
              variant="outline"
              onClick={handleTapTempo}
              type="button"
              px={8}
              fontSize="xl"
              height="52px"
            >
              Tab tempo
            </Button>
          </FormLabel>
          <Flex align="center" gap={2}>
            <NumberInput
              value={tempo}
              min={30}
              max={300}
              onChange={(_, n) => setTempo(n)}
              width="120px"
            >
              <NumberInputField />
            </NumberInput>
            <Text fontSize="sm" color="gray.500">
              {tapCount > 1 ? `(${tapCount} nhịp)` : ""}
            </Text>
          </Flex>
          {tapCount > 1 && (
            <Text fontSize="xs" color="gray.500" mt={1}>
              Nhấn theo nhịp điệu bài hát, tempo sẽ tự động cập nhật.
            </Text>
          )}
        </FormControl>
        <FormControl mb={3}>
          <FormLabel>Note</FormLabel>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            minHeight="260px" // Tăng diện tích khung nhập liệu lớn hơn nhiều
            resize="vertical"
            fontSize="1.1em"
            p={3}
          />
        </FormControl>
        <Button type="submit" colorScheme="teal">
          Thêm bài hát
        </Button>
        <Button ml={2} onClick={() => navigate("/")}>
          Quay lại
        </Button>
      </form>
    </Box>
  );
}
