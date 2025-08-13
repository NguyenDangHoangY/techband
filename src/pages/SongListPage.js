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
  HStack,
  useToast,
  Flex,
  useBreakpointValue,
} from "@chakra-ui/react";
import { SearchIcon, DeleteIcon, CloseIcon } from "@chakra-ui/icons";
import { FaThumbtack } from "react-icons/fa";
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
  const [flashRow, setFlashRow] = useState(null);
  const [tickCount, setTickCount] = useState(0);

  const [search, setSearch] = useState("");
  const searchRef = useRef();

  const [editMode, setEditMode] = useState(false);
  const swipeStartXRef = useRef(null);
  const swipeActiveRowRef = useRef(null);

  const [systemSongId, setSystemSongId] = useState(null);

  const toast = useToast();

  // Responsive
  const cellPadding = useBreakpointValue({
    base: "8px",
    md: "10px",
    lg: "16px",
  });
  const rowSpacing = useBreakpointValue({ base: "10px", md: "8px" });
  // Giảm maxWidth của cột tên bài hát, tăng một chút của cột tempo để tránh xuống hàng
  const nameColWidth = useBreakpointValue({
    base: "56vw", // giảm từ 63vw
    md: "180px", // giảm từ 200px
    lg: "200px", // giảm từ 220px
  });
  const tempoColWidth = useBreakpointValue({
    base: "20vw", // tăng từ 14vw -> 20vw cho mobile
    md: "70px", // tăng từ 64px -> 70px cho tablet
    lg: "90px", // tăng từ 80px -> 90px cho desktop
  });
  const iconColWidth = useBreakpointValue({
    base: "36px",
    md: "36px",
    lg: "36px",
  });
  const searchInputPaddingLeft = useBreakpointValue({
    base: "38px",
    md: "44px",
  });

  const { ensureAudioReady } = useMetronomeScheduler({
    bpm: activeTempo,
    isActive: !!activeSongId,
    onTick: useCallback(() => {
      setFlashRow(activeSongId);
      setTickCount((prev) => prev + 1);
      setTimeout(() => setFlashRow(null), 100);
    }, [activeSongId]),
  });

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

  return (
    <Box maxW="600px" mx="auto" p={{ base: 1, md: 2 }}>
      <HStack mb={4} justify="space-between">
        <InputGroup maxW="220px">
          <InputLeftElement pointerEvents="none" width="2.5em">
            <SearchIcon color="gray.400" boxSize="1.2em" />
          </InputLeftElement>
          <Input
            ref={searchRef}
            placeholder="Tìm kiếm bài hát"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            pl="2.5em"
            fontSize="1.1em"
          />
          {search && (
            <InputRightElement width="2.5em">
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
        <Box>
          <Button colorScheme="teal" as="a" href="/add">
            Thêm bài hát
          </Button>
        </Box>
      </HStack>
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
                style={{ width: nameColWidth, minWidth: 0, maxWidth: "56vw" }} // giảm maxWidth
              />
              <col
                style={{ width: tempoColWidth, minWidth: 0, maxWidth: "20vw" }} // tăng maxWidth
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
              {sortedSongs.map((song, idx) => (
                <Tr
                  key={song.id}
                  bg={
                    flashRow === song.id
                      ? "teal.400"
                      : activeSongId === song.id
                      ? "teal.100"
                      : undefined
                  }
                  style={{
                    transition: "background 0.08s",
                  }}
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
                      paddingTop:
                        idx === 0
                          ? cellPadding
                          : `calc(${cellPadding} + ${rowSpacing})`,
                      paddingBottom: cellPadding,
                      fontSize: "1em",
                      background: "inherit",
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
                      paddingTop:
                        idx === 0
                          ? cellPadding
                          : `calc(${cellPadding} + ${rowSpacing})`,
                      paddingBottom: cellPadding,
                      fontSize: "1em",
                      background: "inherit",
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
                      paddingTop:
                        idx === 0
                          ? cellPadding
                          : `calc(${cellPadding} + ${rowSpacing})`,
                      paddingBottom: cellPadding,
                      background: "inherit",
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
                        <Box flex="1" display="flex" justifyContent="flex-end">
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
              ))}
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
