import React, { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const RideForm = () => {
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const pickupInputRef = useRef(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setPickupLocation(location);
          if (pickupInputRef.current) {
            pickupInputRef.current.value = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
          }
        },
        (error) => {
          console.error("Error detecting location:", error);
        }
      );
    }
  }, []);

  const handleInputChange = (e, type) => {
    const value = e.target.value;
    const [lat, lng] = value.split(",").map((coord) => parseFloat(coord.trim()));
    const location = { lat, lng };
    if (type === "pickup") {
      setPickupLocation(location);
    } else {
      setDropoffLocation(location);
    }
  };

  const markerIcon = new L.Icon({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  return (
    <div className="bg-white p-8 rounded-lg w-full max-w-lg mx-auto mt-8">
      <h3 className="text-xl font-semibold mb-4">Get your ride</h3>
      <form className="space-y-6">
        {/* Pickup Location */}
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-4">
          <input
            ref={pickupInputRef}
            type="text"
            placeholder="Enter pickup location coordinates (e.g., 51.505, -0.09)"
            className="bg-transparent focus:outline-none w-full"
            onChange={(e) => handleInputChange(e, "pickup")}
          />
        </div>

        {/* Dropoff Location */}
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-4">
          <input
            type="text"
            placeholder="Enter dropoff location coordinates (e.g., 51.515, -0.10)"
            className="bg-transparent focus:outline-none w-full"
            onChange={(e) => handleInputChange(e, "dropoff")}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-3 bg-purple-500 text-white rounded-full text-lg hover:bg-purple-600"
        >
          Search
        </button>
      </form>

      {/* Map Section */}
      <MapContainer
        center={[51.505, -0.09]}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-64 mt-6 rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
        />

        {pickupLocation && (
          <Marker position={pickupLocation} icon={markerIcon}>
            <Popup>Pickup Location</Popup>
          </Marker>
        )}

        {dropoffLocation && (
          <Marker position={dropoffLocation} icon={markerIcon}>
            <Popup>Dropoff Location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default RideForm;
