import { db } from "./firebase"; // Đảm bảo đúng đường dẫn file firebase config của bạn
import { collection, addDoc } from "firebase/firestore";

const songs = [
  {
    name: "Lòng Mẹ",
    tempo: 90,
    note: "Nhạc trữ tình nổi tiếng",
  },
  {
    name: "Mưa Trên Cuộc Tình",
    tempo: 100,
    note: "Ballad nhẹ nhàng",
  },
];

const seedSongs = async () => {
  for (const song of songs) {
    await addDoc(collection(db, "songs"), song);
  }
  alert("Seed xong!");
};
