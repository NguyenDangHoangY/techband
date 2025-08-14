import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Box,
  Input,
  NumberInput,
  NumberInputField,
  useToast,
  IconButton,
  HStack,
  Tooltip,
  Text,
  Flex,
} from "@chakra-ui/react";
import { FaBold, FaItalic } from "react-icons/fa";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import ReactMarkdown from "react-markdown";

const SongDetailModal = ({ song, isOpen, onClose, onSongUpdated }) => {
  const [name, setName] = useState("");
  const [tempo, setTempo] = useState(100);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  // Tab tempo state
  const [lastTap, setLastTap] = useState(null);
  const [tapCount, setTapCount] = useState(0);
  const [tapHistory, setTapHistory] = useState([]);
  const tapTimeoutRef = useRef(null);

  const toast = useToast();
  const initialRef = useRef(null);

  useEffect(() => {
    if (song) {
      setName(song.name || "");
      setTempo(song.tempo || 100);
      setNote(song.note || "");
      setEditing(false);
      setTapCount(0);
      setTapHistory([]);
      setLastTap(null);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    }
  }, [song]);

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, "songs", song.id), {
        name,
        tempo,
        note,
      });
      toast({ title: "Cập nhật thành công!", status: "success" });
      if (onSongUpdated) onSongUpdated({ ...song, name, tempo, note });
      setEditing(false);
    } catch (e) {
      toast({ title: "Có lỗi khi cập nhật.", status: "error" });
    }
  };

  // Markdown shortcut buttons
  const handleInsert = (syntax) => {
    if (!editing) return;
    let selStart = initialRef.current?.selectionStart || 0;
    let selEnd = initialRef.current?.selectionEnd || 0;
    let before = note.substring(0, selStart);
    let selection = note.substring(selStart, selEnd);
    let after = note.substring(selEnd);
    let insertText = "";
    if (syntax === "bold") {
      insertText = `**${selection || "in đậm"}**`;
    } else if (syntax === "italic") {
      insertText = `*${selection || "nghiêng"}*`;
    }
    setNote(before + insertText + after);
    setTimeout(() => {
      if (initialRef.current) {
        initialRef.current.focus();
      }
    }, 10);
  };

  // Tab tempo logic
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      initialFocusRef={initialRef}
      closeOnOverlayClick
      isCentered
      motionPreset="slideInBottom"
    >
      <ModalOverlay />
      <ModalContent
        minH="65vh"
        maxW="95vw"
        borderRadius="2xl"
        boxShadow="2xl"
        bg="white"
        position="relative"
        overflow="hidden"
      >
        <ModalCloseButton zIndex={2} />
        <ModalBody pt={8} pb={6} px={[2, 8]}>
          {/* Tên bài hát - màu đen */}
          <Box
            textAlign="center"
            fontSize={["2xl", "3xl"]}
            fontWeight="bold"
            mb={1}
            letterSpacing="wider"
            color="black"
            textShadow="0 4px 16px rgba(0,0,0,0.04)"
          >
            {editing ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                isReadOnly={!editing}
                fontSize={["2xl", "3xl"]}
                fontWeight="bold"
                textAlign="center"
                autoFocus
                border="none"
                px={0}
                _focus={{ boxShadow: "none" }}
                color="black"
              />
            ) : (
              name
            )}
          </Box>
          {/* Tempo nhạc lý, căn trái, màu đen, không BPM */}
          <Box
            display="flex"
            alignItems="center"
            fontSize="xl"
            fontWeight="bold"
            color="black"
            mb={4}
            gap={2}
            justifyContent="flex-start"
            pl={["2", "8"]}
            mt={2}
          >
            <span style={{ fontSize: "1.5em" }}>♩</span>
            {editing ? (
              <Flex align="center" gap={2}>
                <NumberInput
                  value={tempo}
                  min={30}
                  max={300}
                  onChange={(_, n) => setTempo(n)}
                  width="100px"
                  size="md"
                  mr={2}
                >
                  <NumberInputField
                    border="none"
                    fontWeight="bold"
                    fontSize="xl"
                    px={0}
                    textAlign="center"
                    _focus={{ boxShadow: "none" }}
                    color="black"
                  />
                </NumberInput>
                <Button
                  size="lg" // Tăng kích thước nút Tab tempo
                  colorScheme="blue"
                  variant="outline"
                  onClick={handleTapTempo}
                  type="button"
                  ml={2}
                  px={8} // Tăng chiều ngang nút
                  fontSize="xl" // Tăng font chữ
                  height="52px" // Tăng chiều cao nút trên mobile
                >
                  Tab tempo
                </Button>
                <Text fontSize="sm" color="gray.500">
                  {tapCount > 1 ? `(${tapCount} nhịp)` : ""}
                </Text>
              </Flex>
            ) : (
              <Box
                as="span"
                fontWeight="bold"
                fontSize="xl"
                color="black"
              >{`= ${tempo}`}</Box>
            )}
          </Box>
          {editing && tapCount > 1 && (
            <Text fontSize="xs" color="gray.500" mt={-2} mb={2} pl={["2", "8"]}>
              Nhấn theo nhịp điệu bài hát, tempo sẽ tự động cập nhật.
            </Text>
          )}
          {/* Note: Markdown, không font handwriting */}
          <Box
            mt={2}
            p={5}
            bg="gray.50"
            borderRadius="lg"
            boxShadow="sm"
            fontSize="xl"
            minH="160px"
            color="gray.800"
            style={{
              whiteSpace: "pre-wrap",
              letterSpacing: "0.01em",
            }}
            position="relative"
          >
            {editing && (
              <HStack spacing={2} mb={2}>
                <Tooltip label="In đậm">
                  <IconButton
                    icon={<FaBold />}
                    aria-label="In đậm"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleInsert("bold")}
                  />
                </Tooltip>
                <Tooltip label="Nghiêng">
                  <IconButton
                    icon={<FaItalic />}
                    aria-label="Nghiêng"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleInsert("italic")}
                  />
                </Tooltip>
              </HStack>
            )}
            {editing ? (
              <textarea
                ref={initialRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={8}
                style={{
                  fontSize: "1.6em", // Tăng font-size textarea
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  minHeight: "160px", // Tăng chiều cao tối thiểu
                  padding: "10px 0",
                }}
                placeholder="Ghi chú, lyric, hợp âm..."
              />
            ) : note ? (
              <ReactMarkdown
                components={{
                  strong: ({ node, ...props }) => (
                    <span style={{ fontWeight: "bold" }} {...props} />
                  ),
                  em: ({ node, ...props }) => (
                    <span style={{ fontStyle: "italic" }} {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <div style={{ margin: 0 }} {...props} />
                  ),
                }}
              >
                {note}
              </ReactMarkdown>
            ) : (
              <Box color="gray.400" fontStyle="italic">
                (Chưa có ghi chú cho bài hát này)
              </Box>
            )}
          </Box>
        </ModalBody>
        <ModalFooter>
          {editing ? (
            <>
              <Button colorScheme="teal" mr={3} onClick={handleSave}>
                Lưu
              </Button>
              <Button onClick={() => setEditing(false)}>Huỷ</Button>
            </>
          ) : (
            <Button colorScheme="teal" onClick={() => setEditing(true)}>
              Chỉnh sửa
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SongDetailModal;
