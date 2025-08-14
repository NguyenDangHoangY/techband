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
import { FaThumbtack } from "react-icons/fa";
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
} from "firebase/firestore";
import SongDetailModal from "../components/SongDetailModal";
import useMetronomeScheduler from "../components/MetronomeScheduler";
import "./SongListPage.css"; // import CSS file

const seedSongs = async () => {
  for (const song of songsSeed) {
    await addDoc(collection(db, "songs"), song);
  }
  alert("Seed xong!");
};

const MAX_TICKS = 16;
const SYSTEM_STATE_DOC = "currentSong";

function getAcronym(str) {
  return (str || "")
    .split(/\s+/)
    .map((w) => (w[0] || "").toUpperCase())
    .join("");
}

const MIN_SWIPE_DISTANCE = 50; // px

export default function SongListPage() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSongId, setActiveSongId] = useState(null);
  const [activeTempo, setActiveTempo] = useState(null);
  const [modalSong, setModalSong] = useState(null);
  const [tickCount, setTickCount] = useState(0);

  const [rowAnimState, setRowAnimState] = useState({}); // { rowId: "flash" | "fade" | "done" }
  const fadeTimeouts = useRef({}); // { rowId: [timeoutId1, timeoutId2] }
  const songRowRefs = useRef({}); // { songId: rowRef }

  const [search, setSearch] = useState("");
  const searchRef = useRef();
  const [editMode, setEditMode] = useState(false);
  const swipeStartXRef = useRef(null);
  const swipeActiveRowRef = useRef(null);
  const [systemSongId, setSystemSongId] = useState(null);

  const toast = useToast();

  // Responsive tweaks
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

  // Metronome scheduler
  const { ensureAudioReady } = useMetronomeScheduler({
    bpm: activeTempo,
    isActive: !!activeSongId,
    onTick: useCallback(() => {
      if (!activeSongId) return;
      const msPerTick = activeTempo ? 60000 / activeTempo : 500;
      startRowAnim(activeSongId, msPerTick);
    }, [activeSongId, activeTempo]),
  });

  // Animation logic using CSS className and transition-duration
  function startRowAnim(rowId, msPerTick) {
    if (rowId !== activeSongId) return;
    if (fadeTimeouts.current[rowId]) {
      fadeTimeouts.current[rowId].forEach((t) => clearTimeout(t));
    }
    setRowAnimState((prev) => ({ [rowId]: "flash" }));
    const t1 = setTimeout(() => {
      if (rowId === activeSongId)
        setRowAnimState((prev) => ({ [rowId]: "fade" }));
    }, 120);
    const t2 = setTimeout(() => {
      if (rowId === activeSongId)
        setRowAnimState((prev) => ({ [rowId]: "done" }));
    }, msPerTick);
    fadeTimeouts.current[rowId] = [t1, t2];
  }

  useEffect(() => {
    return () => {
      Object.values(fadeTimeouts.current).flat().forEach(clearTimeout);
    };
  }, []);

  const audioUnlockRef = useRef();

  const [showAudioPopup, setShowAudioPopup] = useState(true);

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
    if (audioUnlockRef.current) {
      try {
        await audioUnlockRef.current.play();
      } catch (e) {}
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
    const systemStateRef = doc(db, "systemState", SYSTEM_STATE_DOC);
    const unsubscribe = onSnapshot(systemStateRef, (snap) => {
      const data = snap.data();
      if (data && data.songId) {
        setSystemSongId(data.songId);
        setActiveSongId(data.songId);
        setActiveTempo(data.tempo || 120);
        setTickCount(0);
      } else {
        setSystemSongId(null);
        setActiveSongId(null);
        setActiveTempo(null);
        setTickCount(0);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (tickCount >= MAX_TICKS && activeSongId) {
      setActiveSongId(null);
      setActiveTempo(null);
      setTickCount(0);
    }
  }, [tickCount, activeSongId]);

  // SCROLL TO ACTIVE ROW WHEN ACTIVE SONG CHANGES
  useEffect(() => {
    if (!activeSongId) return;
    setTimeout(() => {
      const rowRef = songRowRefs.current[activeSongId];
      if (rowRef && rowRef.current && rowRef.current.scrollIntoView) {
        const rowRect = rowRef.current.getBoundingClientRect();
        const viewportHeight =
          window.innerHeight || document.documentElement.clientHeight;
        const scrollY = window.scrollY || window.pageYOffset;
        const targetY =
          rowRect.top + scrollY - viewportHeight / 2 + rowRect.height / 2;
        window.scrollTo({
          top: targetY,
          behavior: "smooth",
        });
      }
    }, 350);
  }, [activeSongId, songs.length]);

  // xử lý vuốt sang trái/phải để mở/tắt edit mode
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
    const lower = search.trim().toLowerCase();
    return (
      (song.name || "").toLowerCase().includes(lower) ||
      getAcronym(song.name).toLowerCase().startsWith(lower)
    );
  });

  const sortedSongs = [
    ...filteredSongs
      .filter((s) => s.pinned)
      .sort((a, b) => {
        if (a.pinnedAt && b.pinnedAt) return a.pinnedAt - b.pinnedAt;
        if (a.pinnedAt) return -1;
        if (b.pinnedAt) return 1;
        return 0;
      }),
    ...filteredSongs
      .filter((s) => !s.pinned)
      .sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        })
      ),
  ];

  useEffect(() => {
    Object.values(fadeTimeouts.current).flat().forEach(clearTimeout);
    fadeTimeouts.current = {};
    setRowAnimState({});
    if (activeSongId && activeTempo) {
      startRowAnim(activeSongId, 60000 / activeTempo);
    } else if (activeSongId) {
      startRowAnim(activeSongId, 500);
    }
  }, [activeSongId, activeTempo]);

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
    const systemStateRef = doc(db, "systemState", SYSTEM_STATE_DOC);

    setRowAnimState({});

    if (systemSongId === song.id) {
      await setDoc(systemStateRef, {});
      setActiveSongId(null);
      setActiveTempo(null);
      setTickCount(0);
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
    if (!state && activeSongId === rowId) {
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
      activeSongId === rowId ? (activeTempo ? 60000 / activeTempo : 500) : 500;
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
                  activeTempo ? 60000 / activeTempo : 500
                );
                const rowStyle = getRowAnimStyle(song.id);
                return (
                  <Tr
                    key={song.id}
                    ref={songRowRefs.current[song.id]}
                    className={rowClass}
                    style={rowStyle}
                    onTouchStart={(e) => handleSwipeStart(e, song.id)}
                    onTouchEnd={(e) => handleSwipeEnd(e, song.id)}
                    onMouseDown={(e) => handleSwipeStart(e, song.id)}
                    onMouseUp={(e) => handleSwipeEnd(e, song.id)}
                  >
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
                        color: activeSongId === song.id ? "teal" : undefined,
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
                      {activeSongId === song.id && (
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
                    colSpan={3}
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
