import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import Header from "../../../components/user-panel/header"; // Import your Header component
import DriverInfoCard from "../../../components/user-panel/driver-info-card"; // Import the new DriverInfoCard component
import { BaseURL } from "../../../utils/BaseURL";
import usePreventLeave from "../../../hooks/usePreventLeave";

const MeetDriverScreen = () => {
  const location = useLocation();
  const [ride, setRide] = useState(location.state?.ride || null);
  const [loading, setLoading] = useState(!Boolean(location.state?.ride));
  const rideId = location.state?.rideId || new URLSearchParams(location.search).get("rideId");

  usePreventLeave(true);

  useEffect(() => {
    const fetchRide = async () => {
      if (ride || !rideId) return;
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${BaseURL}/rides/status/${rideId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data?.ride) {
          setRide(response.data.ride);
        }
      } catch (error) {
        console.error("Unable to fetch ride for meet screen:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [ride, rideId]);

  return (
    <div className="h-screen w-screen">
      {/* Header */}
      <Header disableNavigation />

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

        {/* Floating Driver Info Card */}
        <div className="absolute top-[10%] left-[10%]  flex flex-col items-center space-y-4">
          {loading ? (
            <div className="bg-white rounded-2xl shadow-lg p-6 w-[350px] text-center">
              <p className="text-gray-700">Loading driver details...</p>
            </div>
          ) : (
            <DriverInfoCard ride={ride} />
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetDriverScreen;
