import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  TextField,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Avatar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { PhotoCamera, CloudUpload, CheckCircle } from "@mui/icons-material";
import { styled } from "@mui/material/styles";

const steps = [
  "Business Details",
  "Products",
  "Verification",
  "Delivery Options",
];

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

const languages = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिंदी" },
  { code: "ta", name: "தமிழ்" },
  { code: "mr", name: "मराठी" },
  { code: "bn", name: "বাংলা" },
  { code: "te", name: "తెలుగు" },
  { code: "gu", name: "ગુજરાતી" },
  { code: "kn", name: "ಕನ್ನಡ" },
  { code: "ml", name: "മലയാളം" },
];

const SellerRegistration: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [language, setLanguage] = useState("en");
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    products: [] as File[],
    documents: [] as File[],
    deliveryOptions: {
      pickup: false,
      cod: false,
      onlinePayment: false,
      freeDelivery: false,
      deliveryRadius: 5,
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleLanguageChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const newLanguage = event.target.value as string;
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "products" | "documents"
  ) => {
    const files = event.target.files;
    if (files) {
      setFormData((prev) => ({
        ...prev,
        [type]: [...prev[type], ...Array.from(files)],
      }));
    }
  };

  const handleDeliveryOptionChange = (option: string) => {
    setFormData((prev) => ({
      ...prev,
      deliveryOptions: {
        ...prev.deliveryOptions,
        [option]:
          !prev.deliveryOptions[option as keyof typeof prev.deliveryOptions],
      },
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call to register seller
      console.log("Form data:", formData);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate("/seller/dashboard");
    } catch (err) {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t("Business Name")}
                value={formData.businessName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    businessName: e.target.value,
                  }))
                }
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t("Business Type")}</InputLabel>
                <Select
                  value={formData.businessType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      businessType: e.target.value,
                    }))
                  }
                  label={t("Business Type")}
                >
                  <MenuItem value="retail">{t("Retail Store")}</MenuItem>
                  <MenuItem value="restaurant">{t("Restaurant")}</MenuItem>
                  <MenuItem value="service">{t("Service Provider")}</MenuItem>
                  <MenuItem value="other">{t("Other")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t("Address")}
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                multiline
                rows={3}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t("City")}
                value={formData.city}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, city: e.target.value }))
                }
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t("State")}
                value={formData.state}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, state: e.target.value }))
                }
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t("Pincode")}
                value={formData.pincode}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, pincode: e.target.value }))
                }
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t("Phone")}
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t("Email")}
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t("Upload Product Photos")}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
              {formData.products.map((file, index) => (
                <Paper
                  key={index}
                  elevation={3}
                  sx={{ p: 1, position: "relative", width: 100, height: 100 }}
                >
                  <Avatar
                    src={URL.createObjectURL(file)}
                    variant="square"
                    sx={{ width: "100%", height: "100%" }}
                  />
                  <IconButton
                    size="small"
                    sx={{ position: "absolute", top: 0, right: 0 }}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        products: prev.products.filter((_, i) => i !== index),
                      }));
                    }}
                  >
                    <CheckCircle color="error" />
                  </IconButton>
                </Paper>
              ))}
            </Box>
            <Button
              component="label"
              variant="contained"
              startIcon={<PhotoCamera />}
            >
              {t("Upload Photos")}
              <VisuallyHiddenInput
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileUpload(e, "products")}
              />
            </Button>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t("Upload Verification Documents")}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
              {formData.documents.map((file, index) => (
                <Paper
                  key={index}
                  elevation={3}
                  sx={{ p: 1, position: "relative", width: 100, height: 100 }}
                >
                  <Avatar
                    src={URL.createObjectURL(file)}
                    variant="square"
                    sx={{ width: "100%", height: "100%" }}
                  />
                  <IconButton
                    size="small"
                    sx={{ position: "absolute", top: 0, right: 0 }}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        documents: prev.documents.filter((_, i) => i !== index),
                      }));
                    }}
                  >
                    <CheckCircle color="error" />
                  </IconButton>
                </Paper>
              ))}
            </Box>
            <Button
              component="label"
              variant="contained"
              startIcon={<CloudUpload />}
            >
              {t("Upload Documents")}
              <VisuallyHiddenInput
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => handleFileUpload(e, "documents")}
              />
            </Button>
          </Box>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t("Delivery Options")}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t("Delivery Options")}</InputLabel>
                <Select
                  multiple
                  value={Object.entries(formData.deliveryOptions)
                    .filter(([_, value]) => value)
                    .map(([key]) => key)}
                  onChange={(e) => {
                    const selected = e.target.value as string[];
                    setFormData((prev) => ({
                      ...prev,
                      deliveryOptions: {
                        pickup: selected.includes("pickup"),
                        cod: selected.includes("cod"),
                        onlinePayment: selected.includes("onlinePayment"),
                        freeDelivery: selected.includes("freeDelivery"),
                        deliveryRadius: prev.deliveryOptions.deliveryRadius,
                      },
                    }));
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={t(value)} />
                      ))}
                    </Box>
                  )}
                >
                  <MenuItem value="pickup">{t("Pickup")}</MenuItem>
                  <MenuItem value="cod">{t("Cash on Delivery")}</MenuItem>
                  <MenuItem value="onlinePayment">
                    {t("Online Payment")}
                  </MenuItem>
                  <MenuItem value="freeDelivery">{t("Free Delivery")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={t("Delivery Radius (km)")}
                value={formData.deliveryOptions.deliveryRadius}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    deliveryOptions: {
                      ...prev.deliveryOptions,
                      deliveryRadius: parseInt(e.target.value),
                    },
                  }))
                }
                InputProps={{ inputProps: { min: 1, max: 50 } }}
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <FormControl sx={{ minWidth: 120 }}>
          <Select value={language} onChange={handleLanguageChange} displayEmpty>
            {languages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{t(label)}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>{renderStepContent(activeStep)}</Paper>

      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button disabled={activeStep === 0} onClick={handleBack}>
          {t("Back")}
        </Button>
        <Button
          variant="contained"
          onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={24} />
          ) : activeStep === steps.length - 1 ? (
            t("Submit")
          ) : (
            t("Next")
          )}
        </Button>
      </Box>
    </Box>
  );
};

export default SellerRegistration;
