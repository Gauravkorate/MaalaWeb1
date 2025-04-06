import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  CheckCircle,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import axios from "axios";

interface BuyerSubscriptionPromptProps {
  open: boolean;
  onClose: () => void;
  onSubscribe: () => void;
}

export const BuyerSubscriptionPrompt: React.FC<
  BuyerSubscriptionPromptProps
> = ({ open, onClose, onSubscribe }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Implement payment integration here (e.g., Razorpay)
      await axios.post("/api/subscription/renew", {
        type: "buyer",
        amount: 59,
        transactionId: "temp_transaction_id", // Replace with actual transaction ID
      });
      onSubscribe();
    } catch (error) {
      console.error("Failed to process subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="div">
          {t("Unlock Full Access to Maani")}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" color="primary" gutterBottom>
            ₹59/month
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {t(
              "Get unlimited access to product details, negotiations, and exclusive features."
            )}
          </Typography>
        </Box>

        <List>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="primary" />
            </ListItemIcon>
            <Typography>{t("Unlimited product negotiations")}</Typography>
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="primary" />
            </ListItemIcon>
            <Typography>{t("Priority access to local sellers")}</Typography>
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="primary" />
            </ListItemIcon>
            <Typography>{t("AI-powered price recommendations")}</Typography>
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="primary" />
            </ListItemIcon>
            <Typography>{t("Best quality matches")}</Typography>
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircle color="primary" />
            </ListItemIcon>
            <Typography>{t("Cancel anytime")}</Typography>
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t("Maybe Later")}
        </Button>
        <Button
          onClick={handleSubscribe}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? t("Processing...") : t("Subscribe Now")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
