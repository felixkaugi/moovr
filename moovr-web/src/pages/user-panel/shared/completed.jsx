import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../../../components/user-panel/header"; // Import your Header component
import CompletedCard from "../../../components/user-panel/ride/completed-card"; // Import the new DriverInfoCard component
import PaymentSelector from "../../../components/user-panel/payment-selector";
import axios from "axios";
import { BaseURL } from "../../../utils/BaseURL";
import toast, { Toaster } from "react-hot-toast";

const CompletedScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const rideIdFromQuery = queryParams.get("rideId");

  const [driverInfo, setDriverInfo] = useState({
    driverId: location.state?.driverId || "",
    driverName: location.state?.driverName || "Driver",
  });
  const [rideDetails, setRideDetails] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Cash");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [shouldRedirectToReview, setShouldRedirectToReview] = useState(false);

  useEffect(() => {
    const fetchRideDetails = async () => {
      const idToFetch = rideIdFromQuery || location.state?.rideId;
      if (!idToFetch) {
        return;
      }
      try {
        const token = localStorage.getItem("token");
        const endpoint = location.state?.isPackage ? `${BaseURL}/package/status/${idToFetch}` : `${BaseURL}/rides/status/${idToFetch}`;
        
        let response;
        try {
          response = await axios.get(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (err) {
          const fallbackEndpoint = location.state?.isPackage ? `${BaseURL}/rides/status/${idToFetch}` : `${BaseURL}/package/status/${idToFetch}`;
          response = await axios.get(fallbackEndpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }

        const ride = response.data.ride || response.data.pkg;
        setRideDetails(ride);
        if (ride) {
          setSelectedPaymentMethod(ride.paymentMethod || "Cash");
          if (ride.driver) {
            setDriverInfo({
              driverId: ride.driver._id || ride.driver,
              driverName: ride.driver.firstName ? `${ride.driver.firstName} ${ride.driver.lastName}` : (ride.driverName || "Driver"),
            });
          }
        }

        const paymentStatus = queryParams.get("payment");
        if (paymentStatus === "success") {
          toast.success("Payment confirmed. Thank you!");
          setShouldRedirectToReview(true);
        }
        if (paymentStatus === "cancel") {
          toast.error("Payment was canceled. Please try another method.");
        }

        if (ride?.paymentStatus === "paid") {
          setShouldRedirectToReview(true);
        }
      } catch (error) {
        console.error("Error fetching ride/package details for completion screen:", error);
      }
    };

    fetchRideDetails();
  }, [rideIdFromQuery, location.state?.rideId]);

  const handleProcessPayment = async () => {
    const idToPay = rideIdFromQuery || location.state?.rideId;
    if (!idToPay || !rideDetails) return;

    setProcessingPayment(true);
    const toastId = toast.loading("Processing payment...");

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${BaseURL}/rides/process-payment/${idToPay}`, {
        paymentMethod: selectedPaymentMethod
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.paymentUrl || response.data.authorization_url) {
        toast.success("Redirecting to payment gateway...", { id: toastId });
        window.location.href = response.data.paymentUrl || response.data.authorization_url;
      } else if (response.data.paymentStatus === "paid") {
        toast.success("Payment successful!", { id: toastId });
        setRideDetails({ ...rideDetails, paymentStatus: "paid", paymentMethod: selectedPaymentMethod });
      } else {
        toast.error("Payment pending or failed. Please try again.", { id: toastId });
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(error.response?.data?.message || "Failed to process payment.", { id: toastId });
    } finally {
      setProcessingPayment(false);
    }
  };

  const getPaymentMessage = () => {
    if (!rideDetails) return "";
    if (rideDetails.paymentStatus === "paid") {
      if (rideDetails.paymentMethod === "Cash") {
        return `Please pay ${rideDetails.fare} NGN to the driver in cash.`;
      }
      if (rideDetails.paymentMethod === "MoovR Wallet") {
        return "Payment successfully deducted from your MoovR Wallet.";
      }
      return "Payment successful.";
    }
    return `Total Fare: ${rideDetails.fare} NGN. Please select a payment method.`;
  };

  useEffect(() => {
    if (shouldRedirectToReview && rideDetails) {
      navigate("/ride/review", {
        state: {
          driverId: driverInfo.driverId,
          driverName: driverInfo.driverName,
          rideId: rideIdFromQuery || location.state?.rideId,
        },
      });
    }
  }, [shouldRedirectToReview, rideDetails, driverInfo, navigate, rideIdFromQuery, location.state]);

  return (
    <div className="h-screen w-screen">
      <Toaster />
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="relative h-full">
        {/* Map Background */}
        <div className="absolute inset-0 ">
          <img
            title="Map"
            src="/images/full-map-img.png"
            className="w-full h-full"
            alt="map"
          />
        </div>

        {/* Floating Content */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center space-y-4">
          {rideDetails && rideDetails.paymentStatus !== "paid" ? (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white rounded-2xl shadow-lg p-6 w-96 text-center">
                <h2 className="font-semibold text-gray-800 mb-2">Settle Payment</h2>
                <p className="text-sm text-gray-600 mb-4">{getPaymentMessage()}</p>
                <PaymentSelector 
                  initialPayment={selectedPaymentMethod}
                  onPaymentMethodChange={setSelectedPaymentMethod}
                  onClick={handleProcessPayment}
                />
                {processingPayment && <p className="text-xs text-purple-500 mt-2">Processing...</p>}
              </div>
            </div>
          ) : (
            <CompletedCard
              path="/ride/review"
              title={"Destination Reached"}
              driverId={driverInfo.driverId}
              driverName={driverInfo.driverName}
              rideId={rideIdFromQuery || location.state?.rideId}
              message={getPaymentMessage()}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CompletedScreen;
