import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Header from "../../../components/user-panel/header"; // Import your Header component
import CompletedCard from "../../../components/user-panel/ride/completed-card"; // Import the new DriverInfoCard component
import axios from "axios";
import { BaseURL } from "../../../utils/BaseURL";

const CompletedScreen = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const rideIdFromQuery = queryParams.get("rideId");

  const [driverInfo, setDriverInfo] = useState({
    driverId: location.state?.driverId || "",
    driverName: location.state?.driverName || "Driver",
  });
  const [rideDetails, setRideDetails] = useState(null);

  useEffect(() => {
    const fetchRideDetails = async () => {
      const idToFetch = rideIdFromQuery || location.state?.rideId;
      if (idToFetch) {
        try {
          const token = localStorage.getItem("token");
          const endpoint = location.state?.isPackage ? `${BaseURL}/package/status/${idToFetch}` : `${BaseURL}/rides/status/${idToFetch}`;
          
          let response;
          try {
            response = await axios.get(endpoint, {
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch (err) {
            // Fallback: try the other endpoint if the first one fails
            const fallbackEndpoint = location.state?.isPackage ? `${BaseURL}/rides/status/${idToFetch}` : `${BaseURL}/package/status/${idToFetch}`;
            response = await axios.get(fallbackEndpoint, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }

          const ride = response.data.ride || response.data.pkg;
          setRideDetails(ride);
          if (ride && ride.driver) {
            setDriverInfo({
              driverId: ride.driver._id || ride.driver,
              driverName: ride.driver.firstName ? `${ride.driver.firstName} ${ride.driver.lastName}` : (ride.driverName || "Driver"),
            });
          }
        } catch (error) {
          console.error("Error fetching ride/package details for completion screen:", error);
        }
      }
    };

    fetchRideDetails();
  }, [rideIdFromQuery, location.state?.rideId]);

  const getPaymentMessage = () => {
    if (!rideDetails) return "";
    if (rideDetails.paymentMethod === "Cash") {
      return `Please pay ${rideDetails.fare} NGN to the driver in cash.`;
    }
    if (rideDetails.paymentMethod === "MoovR Wallet") {
      return "Payment successfully deducted from your MoovR Wallet.";
    }
    if (rideDetails.paymentStatus === "paid") {
      return "Payment successful.";
    }
    return "";
  };

  return (
    <div className="h-screen w-screen">
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
          />
        </div>

        {/* Floating Driver Info Card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center space-y-4">
          {/* Driver Info Card */}
          <CompletedCard 
            path="/ride/review" 
            title={"Destination Reached"} 
            driverId={driverInfo.driverId}
            driverName={driverInfo.driverName}
            message={getPaymentMessage()}
          />
        </div>
      </div>
    </div>
  );
};

export default CompletedScreen;
