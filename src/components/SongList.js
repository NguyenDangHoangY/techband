import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Button, VStack, Spinner, Text } from "@chakra-ui/react";

const SongList = ({ onSelectSong }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <Spinner />;

  return (
    <VStack align="stretch">
      <Text fontSize="xl" mb={2}>
        Danh sách bài hát
      </Text>
      {songs.map((song) => (
        <Button
          key={song.id}
          onClick={() => onSelectSong(song)}
          justifyContent="flex-start"
          variant="outline"
        >
          {song.name} {song.tempo ? `(${song.tempo} BPM)` : ""}
        </Button>
      ))}
    </VStack>
  );
};

export default SongList;
