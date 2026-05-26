import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../../../components/user-panel/header"; // Import your Header component
import RideOptions from "../../../components/user-panel/ride-options";
import PaymentSelector from "../../../components/user-panel/payment-selector";
import axios from "axios";
import { BaseURL } from "../../../utils/BaseURL";
import toast, { Toaster } from "react-hot-toast";
import { useSocket } from "../../../context/LocationProvider";

const RideSelectionScreen = () => {
  const { socket } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicleType, setVehicleType] = useState("moovr x");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const rideData = location.state?.rideData;
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  const loadGoogleMapsScript = () => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve();
        return;
      }
      const existingScript = document.getElementById("googleMapsScript");
      if (existingScript) {
        existingScript.onload = resolve;
        return;
      }
      const script = document.createElement("script");
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      script.id = "googleMapsScript";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => initializeMap())
      .catch((error) => console.error("Failed to load Google Maps script.", error));
  }, []);

  const initializeMap = () => {
    const google = window.google;
    if (!google || !google.maps || !mapRef.current) return;

    const center = rideData?.pickupCoordinates 
      ? { lat: rideData.pickupCoordinates[1], lng: rideData.pickupCoordinates[0] }
      : { lat: 6.5244, lng: 3.3792 }; // Lagos default

    mapInstance.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      disableDefaultUI: true,
    });

    // Add pickup marker
    if (rideData?.pickupCoordinates) {
      new google.maps.Marker({
        position: center,
        map: mapInstance.current,
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        },
        title: "Pickup Location"
      });
    }

    fetchNearbyDrivers(center.lng, center.lat);
  };

  const fetchNearbyDrivers = async (lng, lat) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${BaseURL}/rides/nearby-drivers?lng=${lng}&lat=${lat}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNearbyDrivers(response.data);
      updateDriverMarkers(response.data);
    } catch (error) {
      console.error("Error fetching nearby drivers:", error);
    }
  };

  const updateDriverMarkers = (drivers) => {
    const google = window.google;
    if (!google || !google.maps || !mapInstance.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    drivers.forEach(driver => {
      if (driver.location && driver.location.coordinates) {
        const marker = new google.maps.Marker({
          position: { 
            lat: driver.location.coordinates[1], 
            lng: driver.location.coordinates[0] 
          },
          map: mapInstance.current,
          icon: {
            url: "/images/car-icon.png", // Make sure this exists or use a standard one
            scaledSize: new google.maps.Size(30, 30),
          },
          title: `${driver.firstName} ${driver.lastName}`
        });
        markersRef.current.push(marker);
      }
    });
  };

  useEffect(() => {
    if (socket) {
      socket.on("rideAccepted", (ride) => {
        console.log("Ride accepted via socket:", ride);
        toast.success("Ride accepted!");
        navigate("/ride/meet", { state: { rideId: ride._id } });
      });

      // Listen for driver location updates to move markers in real-time
      socket.on("driverLocationUpdate", (data) => {
        // Optional: Implement real-time marker movement if drivers emit their location via socket
      });
    }

    return () => {
      if (socket) {
        socket.off("rideAccepted");
        socket.off("driverLocationUpdate");
      }
    };
  }, [socket, navigate]);

  const handleCreateRide = async () => {
    if (!rideData) return;

    setLoading(true);
    try {
      const response = await axios.post(`${BaseURL}/rides/create`, { ...rideData, vehicleType, paymentMethod }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 201) {
        toast.success("Ride created! Waiting for driver...");
      } else {
        toast.error("Failed to create ride. Please try again.");
        setLoading(false);
      }
    } catch (error) {
      toast.error("Error creating ride. Please try again.");
      console.error("Error creating ride:", error);
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen">
      <Toaster />
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="relative h-full">
        {/* Real Map */}
        <div ref={mapRef} className="absolute inset-0 w-full h-full" />

        {/* Floating Cards */}
        <div className="absolute top-[10%] left-[10%]  flex flex-col items-center space-y-4">
          {/* Ride Options */}
          <RideOptions onSelect={(type) => setVehicleType(type)} />

          {/* Payment Selector */}
          <PaymentSelector 
            onClick={handleCreateRide} 
            onPaymentMethodChange={(method) => setPaymentMethod(method)} 
            initialPayment={paymentMethod}
          />
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="loader"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RideSelectionScreen;
