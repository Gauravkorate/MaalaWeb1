import React from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  useTheme,
} from "@mui/material";
import {
  Home as HomeIcon,
  Search as SearchIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

const drawerWidth = 240;

const Sidebar: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();

  const menuItems = [
    { text: t("home"), icon: <HomeIcon />, path: "/" },
    { text: t("search"), icon: <SearchIcon />, path: "/search" },
    { text: t("profile"), icon: <PersonIcon />, path: "/profile" },
    { text: t("settings"), icon: <SettingsIcon />, path: "/settings" },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <Box sx={{ overflow: "auto", mt: "64px" }}>
        <List>
          {menuItems.map((item) => (
            <ListItem button key={item.text}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
            {t("searchHistory")}
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <HistoryIcon />
              </ListItemIcon>
              <ListItemText primary="Laptop" secondary="Today, 2:30 PM" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <HistoryIcon />
              </ListItemIcon>
              <ListItemText
                primary="Smartphone"
                secondary="Yesterday, 4:15 PM"
              />
            </ListItem>
          </List>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
