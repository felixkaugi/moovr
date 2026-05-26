import React from "react";
import { useLocation } from "react-router-dom";
import Header from "../../../components/user-panel/header"; // Import your Header component
import StartRideCard from "../../../components/user-panel/start-ride-card"; // Import the new DriverInfoCard component

const StartRideScreen = () => {
  const location = useLocation();
  const { ride } = location.state || {};

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
        <div className="absolute top-[10%] left-[10%]  flex flex-col items-center space-y-4">
          {/* Driver Info Card */}
          <StartRideCard ride={ride} />
        </div>
      </div>
    </div>
  );
};

export default StartRideScreen;
