// @ts-ignore
import React from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SongListPage from "./pages/SongListPage.js";
import SongAddPage from "./pages/SongAddPage.js";
import theme from "./theme";

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/" element={<SongListPage />} />
          <Route path="/add" element={<SongAddPage />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
