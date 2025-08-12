import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import {
  Box,
  FormControl,
  FormLabel,
  Input,
  NumberInput,
  NumberInputField,
  Textarea,
  Button,
  useToast,
} from "@chakra-ui/react";

const SongForm = ({ selectedSong }) => {
  const [name, setName] = useState("");
  const [tempo, setTempo] = useState();
  const [note, setNote] = useState("");
  const toast = useToast();

  useEffect(() => {
    setName(selectedSong?.name || "");
    setTempo(selectedSong?.tempo);
    setNote(selectedSong?.note || "");
  }, [selectedSong]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      toast({ title: "Tên bài hát không được để trống.", status: "error" });
      return;
    }
    try {
      if (selectedSong && selectedSong.id) {
        // Update
        await updateDoc(doc(db, "songs", selectedSong.id), {
          name,
          tempo,
          note,
        });
        toast({ title: "Cập nhật bài hát thành công.", status: "success" });
      } else {
        // Add new
        await addDoc(collection(db, "songs"), { name, tempo, note });
        toast({ title: "Thêm bài hát thành công.", status: "success" });
      }
      setName("");
      setTempo();
      setNote("");
    } catch (error) {
      toast({ title: "Có lỗi xảy ra.", status: "error" });
    }
  };

  return (
    <Box mt={4}>
      <form onSubmit={handleSubmit}>
        <FormControl mb={2} isRequired>
          <FormLabel>Tên bài hát</FormLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormControl>
        <FormControl mb={2}>
          <FormLabel>Tempo (BPM)</FormLabel>
          <NumberInput
            value={tempo || ""}
            min={30}
            max={300}
            onChange={(_, n) => setTempo(n)}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>
        <FormControl mb={2}>
          <FormLabel>Ghi chú</FormLabel>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </FormControl>
        <Button type="submit" colorScheme="blue" mt={2}>
          {selectedSong ? "Cập nhật" : "Thêm mới"}
        </Button>
      </form>
    </Box>
  );
};

export default SongForm;
