import React from "react";
import { Routes, Route } from "react-router-dom";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";

// Layout Components
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";

// Pages
import Home from "./pages/Home";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const App: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Header />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          marginTop: "64px", // Height of the header
          marginLeft: "240px", // Width of the sidebar
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default App;
