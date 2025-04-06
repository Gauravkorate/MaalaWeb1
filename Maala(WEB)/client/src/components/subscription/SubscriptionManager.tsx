import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import axios from "axios";

interface SubscriptionStatus {
  status: "active" | "inactive" | "trial";
  isTrial: boolean;
  endDate: string;
  trialEndDate?: string;
  autoRenew: boolean;
}

export const SubscriptionManager: React.FC = () => {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await axios.get("/api/subscription/status?type=seller");
      setSubscription(response.data);

      if (response.data.isTrial) {
        const daysResponse = await axios.get(
          "/api/subscription/trial-days?type=seller"
        );
        setDaysRemaining(daysResponse.data.daysRemaining);
      }
    } catch (err) {
      setError("Failed to fetch subscription status");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      // Implement payment integration here (e.g., Razorpay)
      const response = await axios.post("/api/subscription/renew", {
        type: "seller",
        amount: 79,
        transactionId: "temp_transaction_id", // Replace with actual transaction ID
      });
      setSubscription(response.data);
      setShowSubscribeDialog(false);
    } catch (err) {
      setError("Failed to process subscription");
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await axios.post("/api/subscription/cancel", { type: "seller" });
      fetchSubscriptionStatus();
    } catch (err) {
      setError("Failed to cancel subscription");
    }
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t("Subscription Management")}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6">
                {subscription?.isTrial
                  ? t("Free Trial Active")
                  : subscription?.status === "active"
                  ? t("Active Subscription")
                  : t("No Active Subscription")}
              </Typography>
            </Grid>

            {subscription?.isTrial && daysRemaining !== null && (
              <Grid item xs={12}>
                <Typography variant="body1">
                  {t("Days remaining in trial")}: {daysRemaining}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(daysRemaining / 90) * 100}
                  sx={{ mt: 1 }}
                />
              </Grid>
            )}

            {subscription?.status === "active" && (
              <Grid item xs={12}>
                <Typography variant="body1">
                  {t("Next billing date")}:{" "}
                  {new Date(subscription.endDate).toLocaleDateString()}
                </Typography>
              </Grid>
            )}

            <Grid item xs={12}>
              {subscription?.status !== "active" ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => setShowSubscribeDialog(true)}
                >
                  {subscription?.isTrial
                    ? t("Subscribe Now (₹79/month)")
                    : t("Subscribe (₹79/month)")}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleCancelSubscription}
                >
                  {t("Cancel Subscription")}
                </Button>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Dialog
        open={showSubscribeDialog}
        onClose={() => setShowSubscribeDialog(false)}
      >
        <DialogTitle>{t("Subscribe to Maani")}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {t(
              "Subscribe now to continue listing your products and reach more customers."
            )}
          </Typography>
          <Typography variant="h6" sx={{ mt: 2 }}>
            ₹79/month
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("Auto-renewal can be cancelled anytime")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSubscribeDialog(false)}>
            {t("Cancel")}
          </Button>
          <Button onClick={handleSubscribe} variant="contained" color="primary">
            {t("Subscribe")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
