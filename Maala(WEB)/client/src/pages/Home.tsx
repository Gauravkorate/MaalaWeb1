import React from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";

const Home: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();

  const featuredDeals = [
    {
      id: 1,
      title: "Premium Laptop",
      price: "$999",
      originalPrice: "$1299",
      discount: "23%",
      image: "https://via.placeholder.com/300x200",
    },
    {
      id: 2,
      title: "Smartphone Pro",
      price: "$699",
      originalPrice: "$899",
      discount: "22%",
      image: "https://via.placeholder.com/300x200",
    },
    {
      id: 3,
      title: "Wireless Headphones",
      price: "$149",
      originalPrice: "$199",
      discount: "25%",
      image: "https://via.placeholder.com/300x200",
    },
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Box
        sx={{
          textAlign: "center",
          mb: 6,
          mt: 4,
        }}
      >
        <Typography variant="h3" component="h1" gutterBottom>
          {t("welcomeToMaani")}
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          {t("findBestDeals")}
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 2,
            maxWidth: 800,
            mx: "auto",
            mt: 4,
          }}
        >
          <TextField
            fullWidth
            variant="outlined"
            placeholder={t("searchProducts")}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              },
            }}
          />
          <Button
            variant="contained"
            size="large"
            sx={{
              px: 4,
              borderRadius: 2,
            }}
          >
            {t("search")}
          </Button>
        </Box>
      </Box>

      <Typography variant="h4" sx={{ mb: 4 }}>
        {t("featuredDeals")}
      </Typography>

      <Grid container spacing={4}>
        {featuredDeals.map((deal) => (
          <Grid item xs={12} sm={6} md={4} key={deal.id}>
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s",
                "&:hover": {
                  transform: "scale(1.02)",
                },
              }}
            >
              <CardMedia
                component="img"
                height="200"
                image={deal.image}
                alt={deal.title}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h6" component="h2">
                  {deal.title}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="h5" color="primary">
                    {deal.price}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textDecoration: "line-through" }}
                  >
                    {deal.originalPrice}
                  </Typography>
                  <Chip label={deal.discount} color="success" size="small" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Home;
