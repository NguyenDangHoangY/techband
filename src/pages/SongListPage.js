import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Spinner,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  IconButton,
  useToast,
  Flex,
  useBreakpointValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@chakra-ui/react";
import { SearchIcon, DeleteIcon, CloseIcon } from "@chakra-ui/icons";
import { FaThumbtack, FaGripVertical } from "react-icons/fa";
import { MdVolumeUp } from "react-icons/md";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import SongDetailModal from "../components/SongDetailModal";
import useMetronomeScheduler from "../components/MetronomeScheduler";
import "./SongListPage.css";

function removeAccents(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function getAcronym(str) {
  return (str || "")
    .split(/\s+/)
    .map((w) => (w[0] || "").toLowerCase())
    .join("");
}

function isAcronymMatch(songName, search) {
  const songAcr = getAcronym(removeAccents(songName));
  const searchAcr = search.toLowerCase();
  return songAcr.startsWith(searchAcr);
}

function isMultiWordMatch(songName, search) {
  const nameWords = removeAccents(songName)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const searchWords = search.toLowerCase().split(/\s+/).filter(Boolean);
  let idx = 0;
  for (let i = 0; i < searchWords.length; ++i) {
    let found = false;
    while (idx < nameWords.length) {
      if (nameWords[idx].startsWith(searchWords[i])) {
        found = true;
        ++idx;
        break;
      }
      ++idx;
    }
    if (!found) return false;
  }
  return true;
}

// NEW: Allow partial match for single term, so "mat" matches "Mặt trời không lặn"
function isPartialSingleWordMatch(songName, search) {
  const nameWords = removeAccents(songName)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const searchStr = search.toLowerCase();
  return nameWords.some((w) => w.startsWith(searchStr));
}

const MIN_SWIPE_DISTANCE = 50;

export default function SongListPage() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemSongId, setSystemSongId] = useState(null);
  const [systemTempo, setSystemTempo] = useState(null);
  const [modalSong, setModalSong] = useState(null);
  const [rowAnimState, setRowAnimState] = useState({});
  const fadeTimeouts = useRef({});
  const songRowRefs = useRef({});
  const [search, setSearch] = useState("");
  const searchRef = useRef();
  const [editMode, setEditMode] = useState(false);
  const swipeStartXRef = useRef(null);
  const swipeActiveRowRef = useRef(null);
  const [draggedPinIdx, setDraggedPinIdx] = useState(null);
  const [dragOverPinIdx, setDragOverPinIdx] = useState(null);
  const [pinnedSongsOrder, setPinnedSongsOrder] = useState(null);
  const audioUnlockRef = useRef();
  const [showAudioPopup, setShowAudioPopup] = useState(true);
  const toast = useToast();

  const toolbarPadding = useBreakpointValue({
    base: "6px 2px 6px 2px",
    md: "10px 12px 8px 12px",
  });
  const inputFontSize = useBreakpointValue({
    base: "0.97em",
    md: "1.08em",
  });
  const inputHeight = useBreakpointValue({
    base: "32px",
    md: "38px",
  });
  const buttonFontSize = useBreakpointValue({
    base: "0.97em",
    md: "1em",
  });
  const buttonHeight = useBreakpointValue({
    base: "32px",
    md: "38px",
  });
  const buttonMinW = useBreakpointValue({
    base: "84px",
    sm: "92px",
    md: "110px",
  });
  const buttonMaxW = useBreakpointValue({
    base: "31vw",
    md: "140px",
  });
  const nameColWidth = useBreakpointValue({
    base: "56vw",
    md: "180px",
    lg: "200px",
  });
  const tempoColWidth = useBreakpointValue({
    base: "20vw",
    md: "70px",
    lg: "90px",
  });
  const iconColWidth = useBreakpointValue({
    base: "36px",
    md: "36px",
    lg: "36px",
  });
  const moveIconColWidth = useBreakpointValue({
    base: "20px",
    md: "28px",
    lg: "32px",
  });
  const cellPadding = useBreakpointValue({
    base: "8px",
    md: "10px",
    lg: "16px",
  });
  const rowSpacing = useBreakpointValue({
    base: "10px",
    md: "10px",
    lg: "12px",
  });

  const { ensureAudioReady, testTick } = useMetronomeScheduler({
    bpm: systemTempo,
    isActive: !!systemSongId,
    onTick: useCallback(() => {
      if (!systemSongId) return;
      const msPerTick = systemTempo ? 60000 / systemTempo : 500;
      startRowAnim(systemSongId, msPerTick);
    }, [systemSongId, systemTempo]),
    onStop: useCallback(() => {
      if (systemSongId) {
        const systemStateRef = doc(db, "systemState", "currentSong");
        setDoc(systemStateRef, {});
        setSystemSongId(null);
        setSystemTempo(null);
      }
    }, [systemSongId]),
  });

  useEffect(() => {
    if (systemSongId && systemTempo) {
      ensureAudioReady();
    }
  }, [systemSongId, systemTempo, ensureAudioReady]);

  function startRowAnim(rowId, msPerTick) {
    if (rowId !== systemSongId) return;
    if (fadeTimeouts.current[rowId]) {
      fadeTimeouts.current[rowId].forEach((t) => clearTimeout(t));
    }
    setRowAnimState((prev) => ({ [rowId]: "flash" }));
    const t1 = setTimeout(() => {
      if (rowId === systemSongId)
        setRowAnimState((prev) => ({ [rowId]: "fade" }));
    }, 120);
    const t2 = setTimeout(() => {
      if (rowId === systemSongId)
        setRowAnimState((prev) => ({ [rowId]: "done" }));
    }, msPerTick);
    fadeTimeouts.current[rowId] = [t1, t2];
  }

  useEffect(() => {
    return () => {
      Object.values(fadeTimeouts.current).flat().forEach(clearTimeout);
    };
  }, []);

  const handleCloseAudioPopup = () => setShowAudioPopup(false);

  const handlePlayAudioAllow = async () => {
    if (audioUnlockRef.current) {
      try {
        await audioUnlockRef.current.play();
      } catch (e) {}
    }
    setShowAudioPopup(false);
  };

  const handlePlayAudioUnlock = async () => {
    await ensureAudioReady();
    await testTick();
    // Nếu đang có bài được chọn, force lại tick + anim
    if (systemSongId && systemTempo) {
      const msPerTick = systemTempo ? 60000 / systemTempo : 500;
      startRowAnim(systemSongId, msPerTick);
      // Gọi onTick() nếu metronome scheduler có exposed API, hoặc tự phát tick đầu
    }
  };

  useEffect(() => {
    const fetchSongs = async () => {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "songs"));
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setSongs(data);
      setLoading(false);
    };
    fetchSongs();
  }, []);

  useEffect(() => {
    const systemStateRef = doc(db, "systemState", "currentSong");
    const unsubscribe = onSnapshot(systemStateRef, (snap) => {
      const data = snap.data();
      if (data && data.songId) {
        setSystemSongId(data.songId);
        setSystemTempo(data.tempo || 120);
      } else {
        setSystemSongId(null);
        setSystemTempo(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!systemSongId) return;
    setTimeout(() => {
      const rowRef = songRowRefs.current[systemSongId];
      if (rowRef && rowRef.current && rowRef.current.scrollIntoView) {
        const rowRect = rowRef.current.getBoundingClientRect();
        const viewportHeight =
          window.innerHeight || document.documentElement.clientHeight;
        const scrollY = window.scrollY || window.pageYOffset;
        const targetY =
          rowRect.top +
          scrollY -
          viewportHeight / 2 +
          rowRef.current.offsetHeight / 2;
        window.scrollTo({
          top: targetY,
          behavior: "smooth",
        });
      }
    }, 350);
  }, [systemSongId, songs.length]);

  const handleSwipeStart = (e, songId) => {
    let x = null;
    if (e.touches && e.touches.length > 0) {
      x = e.touches[0].clientX;
    } else {
      x = e.clientX;
    }
    swipeStartXRef.current = x;
    swipeActiveRowRef.current = songId;
  };

  const handleSwipeEnd = (e, songId) => {
    let x = null;
    if (e.changedTouches && e.changedTouches.length > 0) {
      x = e.changedTouches[0].clientX;
    } else {
      x = e.clientX;
    }
    const startX = swipeStartXRef.current;
    swipeStartXRef.current = null;

    if (swipeActiveRowRef.current !== songId) return;
    swipeActiveRowRef.current = null;

    if (startX == null || x == null) return;
    const deltaX = x - startX;
    if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE) return;
    if (deltaX < 0) {
      setEditMode(true);
    } else if (deltaX > 0) {
      setEditMode(false);
    }
  };

  useEffect(() => {
    if (!editMode) return;
    const handleClick = (e) => {
      if (!e.target.closest("table")) setEditMode(false);
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [editMode]);

  const filteredSongs = songs.filter((song) => {
    if (!search.trim()) return true;
    const searchStr = removeAccents(search.trim().toLowerCase());
    if (!searchStr) return true;
    if (!song.name) return false;
    if (searchStr.indexOf(" ") >= 0) {
      return isMultiWordMatch(song.name, searchStr);
    }
    // Nếu search là 1 từ, match bất kỳ từ nào bắt đầu bằng searchStr
    if (isPartialSingleWordMatch(song.name, searchStr)) return true;
    return isAcronymMatch(song.name, searchStr);
  });

  const pinnedSongs = filteredSongs
    .filter((s) => s.pinned)
    .sort((a, b) => {
      if (a.pinnedAt && b.pinnedAt) return a.pinnedAt - b.pinnedAt;
      if (a.pinnedAt) return -1;
      if (b.pinnedAt) return 1;
      return 0;
    });

  const nonPinnedSongs = filteredSongs
    .filter((s) => !s.pinned)
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
      })
    );

  const orderedPinnedSongs =
    pinnedSongsOrder && pinnedSongsOrder.length === pinnedSongs.length
      ? pinnedSongsOrder
          .map((id) => pinnedSongs.find((s) => s.id === id))
          .filter(Boolean)
      : pinnedSongs;

  const sortedSongs = [...orderedPinnedSongs, ...nonPinnedSongs];

  function handleDragStartPin(idx, e) {
    setDraggedPinIdx(idx);
    setDragOverPinIdx(idx);
    e.dataTransfer?.setData("text/plain", "dragging-pinned-song");
    e.dataTransfer?.setDragImage?.(e.target, 16, 16);
  }
  function handleDragOverPin(idx, e) {
    e.preventDefault();
    setDragOverPinIdx(idx);
  }
  function handleDropPin(idx, e) {
    e.preventDefault();
    if (draggedPinIdx == null || draggedPinIdx === idx) {
      setDraggedPinIdx(null);
      setDragOverPinIdx(null);
      return;
    }
    const newOrder = [...orderedPinnedSongs];
    const [removed] = newOrder.splice(draggedPinIdx, 1);
    newOrder.splice(idx, 0, removed);
    setPinnedSongsOrder(newOrder.map((s) => s.id));
    setDraggedPinIdx(null);
    setDragOverPinIdx(null);
    setTimeout(() => {
      const now = Date.now();
      const batch = writeBatch(db);
      newOrder.forEach((song, i) => {
        batch.update(doc(db, "songs", song.id), { pinnedAt: now + i });
      });
      batch.commit();
      setSongs((prev) =>
        prev.map((s) =>
          s.pinned
            ? {
                ...s,
                pinnedAt:
                  newOrder.findIndex((x) => x.id === s.id) !== -1
                    ? now + newOrder.findIndex((x) => x.id === s.id)
                    : s.pinnedAt,
              }
            : s
        )
      );
      setPinnedSongsOrder(null);
    }, 80);
  }
  function handleDragEndPin() {
    setDraggedPinIdx(null);
    setDragOverPinIdx(null);
    setPinnedSongsOrder(null);
  }

  const handlePinSong = async (song, e) => {
    e.stopPropagation();
    if (song.pinned) {
      await updateDoc(doc(db, "songs", song.id), {
        pinned: false,
        pinnedAt: null,
      });
      setSongs((prev) =>
        prev.map((s) =>
          s.id === song.id ? { ...s, pinned: false, pinnedAt: null } : s
        )
      );
    } else {
      const now = Date.now();
      await updateDoc(doc(db, "songs", song.id), {
        pinned: true,
        pinnedAt: now,
      });
      setSongs((prev) =>
        prev.map((s) =>
          s.id === song.id ? { ...s, pinned: true, pinnedAt: now } : s
        )
      );
      toast({
        title: "Đã ghim bài hát",
        status: "success",
        duration: 1200,
        isClosable: true,
      });
    }
  };

  const handleDeleteSong = async (song, e) => {
    e.stopPropagation();
    if (!window.confirm(`Xoá bài "${song.name}"?`)) return;
    await deleteDoc(doc(db, "songs", song.id));
    setSongs((prev) => prev.filter((s) => s.id !== song.id));
    toast({
      title: "Đã xoá bài hát",
      status: "success",
      duration: 1200,
      isClosable: true,
    });
  };

  const handleTempoClick = async (song) => {
    if (editMode) return;
    await ensureAudioReady();
    const systemStateRef = doc(db, "systemState", "currentSong");
    setRowAnimState({});
    if (systemSongId === song.id) {
      await setDoc(systemStateRef, {});
      setSystemSongId(null);
      setSystemTempo(null);
    } else {
      await setDoc(systemStateRef, {
        songId: song.id,
        tempo: song.tempo || 120,
        name: song.name,
        updatedAt: Date.now(),
      });
    }
  };

  const handleRowClick = (song) => {
    if (editMode) return;
    setModalSong(song);
  };

  const handleClearSearch = () => {
    setSearch("");
    if (searchRef.current) {
      searchRef.current.focus();
    }
  };

  function getRowAnimClass(rowId, msPerTick) {
    const state = rowAnimState[rowId];
    if (!state && systemSongId === rowId) {
      return "tr-done";
    }
    if (!state) return "";
    if (state === "flash") return "tr-flash";
    if (state === "fade") return "tr-fade";
    if (state === "done") return "tr-done";
    return "";
  }

  function getRowAnimStyle(rowId) {
    const msPerTick =
      systemSongId === rowId ? (systemTempo ? 60000 / systemTempo : 500) : 500;
    return {
      "--fade-duration": `${msPerTick}ms`,
    };
  }

  return (
    <Box maxW="600px" mx="auto" p={{ base: 1, md: 2 }}>
      <Modal isOpen={showAudioPopup} onClose={handleCloseAudioPopup} isCentered>
        <ModalOverlay />
        <ModalContent maxW="340px">
          <ModalHeader fontSize="lg" fontWeight="bold" textAlign="center">
            Cho phép bật âm thanh
          </ModalHeader>
          <ModalBody>
            <Box fontSize="md" textAlign="center">
              Để sử dụng tính năng nhịp/phát tiếng, vui lòng cấp quyền phát âm
              thanh cho trình duyệt.
              <br />
              <br />
              Nhấn <b>Cho phép</b> để khởi động hệ thống âm thanh.
            </Box>
          </ModalBody>
          <ModalFooter justifyContent="center">
            <Button
              leftIcon={<MdVolumeUp />}
              colorScheme="teal"
              borderRadius="lg"
              fontWeight="600"
              fontSize={buttonFontSize}
              minW={buttonMinW}
              maxW={buttonMaxW}
              height={buttonHeight}
              onClick={handlePlayAudioAllow}
              mr={2}
            >
              Cho phép
            </Button>
            <Button
              variant="ghost"
              onClick={handleCloseAudioPopup}
              borderRadius="lg"
              fontSize={buttonFontSize}
              height={buttonHeight}
              minW="60px"
              maxW="80px"
            >
              Đóng
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Box
        position="sticky"
        top={0}
        zIndex={20}
        bg="white"
        boxShadow="md"
        borderBottom="1px solid #eee"
        pb={1}
        pt={{ base: 0, md: 1 }}
        mb={2}
        style={{
          backdropFilter: "blur(2px)",
        }}
      >
        <Flex align="center" gap={1} px={toolbarPadding} wrap="nowrap" w="100%">
          <InputGroup flex="1" maxW={{ base: "40vw", md: "230px" }}>
            <InputLeftElement pointerEvents="none" width="2.2em">
              <SearchIcon color="gray.400" boxSize="1.1em" />
            </InputLeftElement>
            <Input
              ref={searchRef}
              placeholder="Tìm kiếm bài hát"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              pl="2.2em"
              fontSize={inputFontSize}
              height={inputHeight}
              borderRadius="lg"
              bg="white"
              border="1px solid #c6e0f5"
            />
            {search && (
              <InputRightElement width="2.2em">
                <IconButton
                  aria-label="Xóa tìm kiếm"
                  icon={<CloseIcon />}
                  size="sm"
                  variant="ghost"
                  onClick={handleClearSearch}
                  tabIndex={-1}
                />
              </InputRightElement>
            )}
          </InputGroup>
          <Button
            leftIcon={<MdVolumeUp />}
            colorScheme="teal"
            borderRadius="lg"
            fontWeight="600"
            minW={buttonMinW}
            maxW={buttonMaxW}
            height={buttonHeight}
            fontSize={buttonFontSize}
            onClick={handlePlayAudioUnlock}
            ml={{ base: 1, md: 2 }}
            mr={{ base: 1, md: 2 }}
            px={{ base: 2, md: 4 }}
            flexShrink={0}
          >
            Bật tiếng
          </Button>
          <Button
            colorScheme="teal"
            borderRadius="lg"
            fontWeight="600"
            minW={buttonMinW}
            maxW={buttonMaxW}
            height={buttonHeight}
            fontSize={buttonFontSize}
            as="a"
            href="/add"
            px={{ base: 2, md: 4 }}
            flexShrink={0}
            whiteSpace="nowrap"
          >
            Thêm bài hát
          </Button>
        </Flex>
      </Box>
      <audio
        ref={audioUnlockRef}
        src="/tick.wav"
        preload="auto"
        style={{
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: "none",
          position: "absolute",
        }}
        tabIndex={-1}
        onPlay={() => console.log("[SongListPage] audioUnlockRef played")}
      />
      {loading ? (
        <Spinner />
      ) : (
        <Box overflowX="hidden" w="100%" maxW="100vw">
          <Table
            size="md"
            minW="0"
            style={{
              tableLayout: "fixed",
              width: "100%",
            }}
          >
            <colgroup>
              {editMode ? (
                <col
                  style={{
                    width: moveIconColWidth,
                    minWidth: moveIconColWidth,
                    maxWidth: moveIconColWidth,
                  }}
                />
              ) : null}
              <col
                style={{ width: nameColWidth, minWidth: 0, maxWidth: "56vw" }}
              />
              <col
                style={{ width: tempoColWidth, minWidth: 0, maxWidth: "20vw" }}
              />
              <col
                style={{
                  width: iconColWidth,
                  minWidth: iconColWidth,
                  maxWidth: iconColWidth,
                }}
              />
            </colgroup>
            <Thead>
              <Tr>
                {editMode ? (
                  <Th
                    p={cellPadding}
                    pr={1}
                    minW={moveIconColWidth}
                    maxW={moveIconColWidth}
                    w={moveIconColWidth}
                  ></Th>
                ) : null}
                <Th
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  p={cellPadding}
                  pl={{ base: "4px", md: "10px" }}
                  pr={{ base: "2px", md: "8px" }}
                  fontSize={{ base: "sm", md: "md" }}
                >
                  TÊN BÀI HÁT
                </Th>
                <Th
                  textAlign="center"
                  p={cellPadding}
                  pl={{ base: "2px", md: "2px" }}
                  pr={{ base: "2px", md: "2px" }}
                  fontSize={{ base: "sm", md: "md" }}
                >
                  TEMPO
                </Th>
                <Th textAlign="center" p={0}></Th>
              </Tr>
            </Thead>
            <Tbody>
              {sortedSongs.map((song, idx) => {
                if (!songRowRefs.current[song.id]) {
                  songRowRefs.current[song.id] = React.createRef();
                }
                const rowClass = getRowAnimClass(
                  song.id,
                  systemTempo ? 60000 / systemTempo : 500
                );
                const rowStyle = getRowAnimStyle(song.id);
                const isPinned = song.pinned;
                const pinIdx = isPinned
                  ? orderedPinnedSongs.findIndex((s) => s.id === song.id)
                  : -1;
                const isDragging =
                  draggedPinIdx === pinIdx && draggedPinIdx !== null;
                const isDragOver =
                  dragOverPinIdx === pinIdx &&
                  draggedPinIdx !== null &&
                  draggedPinIdx !== dragOverPinIdx;
                return (
                  <Tr
                    key={song.id}
                    ref={songRowRefs.current[song.id]}
                    className={rowClass}
                    style={{
                      ...rowStyle,
                      ...(isDragging
                        ? { opacity: 0.5, background: "#e2e8f0" }
                        : isDragOver
                        ? { background: "#bee3f8" }
                        : {}),
                    }}
                    onTouchStart={(e) => handleSwipeStart(e, song.id)}
                    onTouchEnd={(e) => handleSwipeEnd(e, song.id)}
                    onMouseDown={(e) => handleSwipeStart(e, song.id)}
                    onMouseUp={(e) => handleSwipeEnd(e, song.id)}
                    draggable={editMode && isPinned}
                    onDragStart={
                      editMode && isPinned
                        ? (e) => handleDragStartPin(pinIdx, e)
                        : undefined
                    }
                    onDragOver={
                      editMode && isPinned
                        ? (e) => handleDragOverPin(pinIdx, e)
                        : undefined
                    }
                    onDrop={
                      editMode && isPinned
                        ? (e) => handleDropPin(pinIdx, e)
                        : undefined
                    }
                    onDragEnd={
                      editMode && isPinned ? handleDragEndPin : undefined
                    }
                  >
                    {editMode ? (
                      <Td
                        p={0}
                        minW={moveIconColWidth}
                        maxW={moveIconColWidth}
                        w={moveIconColWidth}
                        style={{
                          paddingLeft: "2px",
                          paddingRight: "2px",
                          background: "inherit",
                          borderBottom:
                            idx < sortedSongs.length - 1
                              ? "1px solid #e2e8f0"
                              : undefined,
                          verticalAlign: "middle",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isPinned ? (
                          <span
                            style={{
                              cursor: "grab",
                              opacity: 0.95,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "28px",
                              userSelect: "none",
                            }}
                            title="Kéo để sắp xếp"
                          >
                            <FaGripVertical />
                          </span>
                        ) : null}
                      </Td>
                    ) : null}
                    <Td
                      style={{
                        cursor: editMode ? "default" : "pointer",
                        fontWeight: "bold",
                        maxWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        paddingLeft: cellPadding,
                        paddingRight: "2px",
                        paddingTop: cellPadding + rowSpacing,
                        paddingBottom: cellPadding + rowSpacing,
                        fontSize: "1em",
                        background: "inherit",
                        borderBottom:
                          idx < sortedSongs.length - 1
                            ? "1px solid #e2e8f0"
                            : undefined,
                        verticalAlign: "middle",
                      }}
                      onClick={() => handleRowClick(song)}
                      title={song.name}
                    >
                      {song.name}
                      {systemSongId === song.id && (
                        <span
                          style={{ marginLeft: 6 }}
                          title="Đang đồng bộ hệ thống"
                        >
                          🔗
                        </span>
                      )}
                    </Td>
                    <Td
                      textAlign="center"
                      style={{
                        cursor: editMode ? "default" : "pointer",
                        fontWeight: "bold",
                        color: systemSongId === song.id ? "teal" : undefined,
                        paddingLeft: "2px",
                        paddingRight: "2px",
                        paddingTop: cellPadding + rowSpacing,
                        paddingBottom: cellPadding + rowSpacing,
                        fontSize: "1em",
                        background: "inherit",
                        borderBottom:
                          idx < sortedSongs.length - 1
                            ? "1px solid #e2e8f0"
                            : undefined,
                        verticalAlign: "middle",
                      }}
                      onClick={() => handleTempoClick(song)}
                    >
                      {song.tempo || 120}
                      {systemSongId === song.id && (
                        <span style={{ marginLeft: 8 }}>🔊</span>
                      )}
                    </Td>
                    <Td
                      textAlign="center"
                      p={0}
                      style={{
                        paddingTop: cellPadding + rowSpacing,
                        paddingBottom: cellPadding + rowSpacing,
                        background: "inherit",
                        borderBottom:
                          idx < sortedSongs.length - 1
                            ? "1px solid #e2e8f0"
                            : undefined,
                        verticalAlign: "middle",
                      }}
                    >
                      {editMode ? (
                        <Flex
                          w="100%"
                          minW={iconColWidth}
                          justify="space-between"
                          align="center"
                        >
                          <Box
                            flex="1"
                            display="flex"
                            justifyContent="flex-start"
                          >
                            <IconButton
                              aria-label="Pin"
                              icon={<FaThumbtack />}
                              size="xs"
                              colorScheme={song.pinned ? "red" : "gray"}
                              variant="ghost"
                              style={{
                                color: song.pinned ? "#e53e3e" : "#bbb",
                                opacity: song.pinned ? 1 : 0.5,
                                fontSize: "13px",
                                padding: 0,
                                minWidth: "16px",
                                width: "16px",
                                height: "16px",
                              }}
                              onClick={(e) => handlePinSong(song, e)}
                              mr={0}
                              tabIndex={0}
                            />
                          </Box>
                          <Box
                            flex="1"
                            display="flex"
                            justifyContent="flex-end"
                          >
                            <IconButton
                              aria-label="Delete"
                              icon={<DeleteIcon />}
                              size="xs"
                              colorScheme="red"
                              variant="ghost"
                              style={{
                                fontSize: "13px",
                                padding: 0,
                                minWidth: "16px",
                                width: "16px",
                                height: "16px",
                              }}
                              onClick={(e) => handleDeleteSong(song, e)}
                              tabIndex={0}
                            />
                          </Box>
                        </Flex>
                      ) : (
                        song.pinned && (
                          <Box
                            display="flex"
                            justifyContent="center"
                            alignItems="center"
                            w="16px"
                            h="16px"
                            mx="auto"
                            style={{ fontSize: "12px" }}
                          >
                            <FaThumbtack
                              color="#e53e3e"
                              size={12}
                              style={{ opacity: 0.85 }}
                            />
                          </Box>
                        )
                      )}
                    </Td>
                  </Tr>
                );
              })}
              {sortedSongs.length > 0 && (
                <Tr>
                  <Td
                    colSpan={editMode ? 4 : 3}
                    textAlign="center"
                    fontWeight="bold"
                    color="gray.600"
                    fontSize="md"
                    py={2}
                  >
                    Tổng số bài hát: {sortedSongs.length}
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Box>
      )}
      <SongDetailModal
        song={modalSong}
        isOpen={!!modalSong}
        onClose={() => setModalSong(null)}
        onSongUpdated={(updatedSong) => {
          setSongs(
            songs.map((s) => (s.id === updatedSong.id ? updatedSong : s))
          );
          setModalSong(updatedSong);
        }}
      />
    </Box>
  );
}
