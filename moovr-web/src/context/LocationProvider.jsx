import React, { createContext, useContext, useState, useEffect } from "react";
import io from "socket.io-client";

// Create the context
const SocketContext = createContext();

// Your server URL where Socket.io is running
const SOCKET_URL = "http://localhost:5000";

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    // Initialize the socket connection
    const socketInstance = io(SOCKET_URL, {
      transports: ["websocket"],
      withCredentials: true,
    });
    setSocket(socketInstance);

    // Join room when user data is available
    const userDataStr = localStorage.getItem("userData");
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        if (userData._id) {
          socketInstance.emit("join", userData._id);
        }
      } catch (e) {
        console.error("Error parsing userData for socket join", e);
      }
    }

    // Cleanup when component unmounts
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const updateLocation = (latitude, longitude) => {
    if (!socket) return;

    setCurrentLocation({ latitude, longitude });

    const userDataStr = localStorage.getItem("userData");
    if (!userDataStr) return;

    try {
      const userData = JSON.parse(userDataStr);
      if (userData.role === "driver") {
        console.log("Sending driver location:", latitude, longitude);
        socket.emit("updateLocation", { driverId: userData._id, coordinates: [longitude, latitude] });
      } else {
        console.log("Sending passenger location:", latitude, longitude);
        socket.emit("updatePassengerLocation", { passengerId: userData._id, coordinates: [longitude, latitude] });
      }
    } catch (e) {
      console.error("Error parsing userData for location update", e);
    }
  };

  // Continuous location update if geolocation changes (like watching position)
  useEffect(() => {
    let watcherId = null;

    const startLocationTracking = async () => {
      if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
        return;
      }

      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state === "denied") {
          console.info("Geolocation permission denied. Location tracking is disabled.");
          return;
        }
      } catch (error) {
        // Browser does not support Permissions API; continue with watchPosition.
      }

      watcherId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateLocation(latitude, longitude);
        },
        (error) => {
          if (error.code === 1) {
            console.info("Geolocation permission denied. Location tracking disabled.");
          } else {
            console.error("Error fetching location:", error);
          }
        },
        { enableHighAccuracy: true }
      );
    };

    startLocationTracking();

    return () => {
      if (watcherId !== null) {
        navigator.geolocation.clearWatch(watcherId);
      }
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, updateLocation, currentLocation }}>
      {children}
    </SocketContext.Provider>
  );
};
