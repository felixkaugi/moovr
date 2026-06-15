const socketIo = require("socket.io");

let io;

module.exports = {
  // Initialize Socket.io with the HTTP server
  init: (server) => {
    io = socketIo(server, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000", "http://localhost:3001"], // Allow your frontend origins
        methods: ["GET", "POST"],
        credentials: true,
      },
    });
    io.on("connection", (socket) => {
      console.log("New client connected", socket.id);

      // Join a private room based on user ID
      socket.on("join", (userId) => {
        if (userId) {
          socket.join(userId.toString());
          console.log(`User ${userId} joined room ${userId}`);
        }
      });

      // Handle location updates from drivers
      socket.on("updateLocation", (data) => {
        console.log("Received driver location:", data);
        const { driverId, coordinates } = data;
        // Broadcast the location update to relevant clients (e.g., riders)
        io.emit("driverLocationUpdate", { driverId, coordinates });
      });

      // Handle location updates from passengers
      socket.on("updatePassengerLocation", (data) => {
        console.log("Received passenger location:", data);
        const { passengerId, coordinates } = data;
        // Broadcast the location update to relevant clients (e.g., drivers)
        io.emit("passengerLocationUpdate", { passengerId, coordinates });
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected");
      });
    });
    return io;
  },
  // Get the initialized Socket.io instance
  getIo: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  },
};
