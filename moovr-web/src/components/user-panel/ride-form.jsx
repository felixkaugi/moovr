import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { BaseURL } from "../../utils/BaseURL";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { DotLoader } from "react-spinners";

const RideForm = () => {
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [isMapsReady, setIsMapsReady] = useState(false);
  const [distance, setDistance] = useState(null);
  const [pickupType, setPickupType] = useState("now");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const mapInstance = useRef(null);
  const navigate = useNavigate();

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
      .catch((error) => toast.error("Failed to load Google Maps script."));
  }, []);

  const initializeMap = () => {
    const google = window.google;
    if (!google || !google.maps) {
      console.error("Google Maps not loaded properly.");
      return;
    }

    mapInstance.current = new google.maps.Map(mapRef.current, {
      center: { lat: 51.505, lng: -0.09 },
      zoom: 13,
    });

    directionsServiceRef.current = new google.maps.DirectionsService();
    directionsRendererRef.current = new google.maps.DirectionsRenderer();
    directionsRendererRef.current.setMap(mapInstance.current);

    initializeAutocomplete("pickup");
    initializeAutocomplete("dropoff");

    setIsMapsReady(true);
    fetchCurrentLocation();
  };

  const fetchCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: pos }, (results, status) => {
            if (status === "OK") {
              if (results[0]) {
                setPickupLocation(pos);
                setPickupAddress(results[0].formatted_address);
                const pickupInput = document.getElementById("pickup-input");
                if (pickupInput) {
                  pickupInput.value = results[0].formatted_address;
                }
                mapInstance.current.setCenter(pos);
                mapInstance.current.setZoom(14);
              }
            } else {
              console.error("Geocoder failed due to: " + status);
            }
          });
        },
        () => {
          console.info("Geolocation permission denied or error occurred.");
        }
      );
    }
  };

  const initializeAutocomplete = (type) => {
    const input = document.getElementById(`${type}-input`);
    const autocomplete = new window.google.maps.places.Autocomplete(input);
    autocomplete.bindTo("bounds", mapInstance.current);

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) return;

      const location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };

      if (type === "pickup") {
        setPickupLocation(location);
        setPickupAddress(place.formatted_address || "");
      } else {
        setDropoffLocation(location);
        setDropoffAddress(place.formatted_address || "");
      }

      mapInstance.current.setCenter(place.geometry.location);
      mapInstance.current.setZoom(14);
    });
  };

  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      calculateAndDisplayRoute();
    }
  }, [pickupLocation, dropoffLocation]);

  const calculateAndDisplayRoute = () => {
    const directionsService = directionsServiceRef.current;
    const directionsRenderer = directionsRendererRef.current;

    directionsService.route(
      {
        origin: pickupLocation,
        destination: dropoffLocation,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK") {
          directionsRenderer.setDirections(result);
          const route = result.routes[0];
          const distanceInKm = route.legs[0].distance.value / 1000;
          setDistance(distanceInKm);
        } else {
          toast.error("Route calculation failed: " + status);
        }
      }
    );
  };

  const detectCity = (location) => {
    if (!location) return "Lagos";
    const cities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Akure"];
    for (const c of cities) {
      if (location.toLowerCase().includes(c.toLowerCase())) {
        return c;
      }
    }
    return "Lagos";
  };

  const geocodeAddress = (address) => {
    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK") {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
            formatted_address: results[0].formatted_address,
          });
        } else {
          reject(status);
        }
      });
    });
  };

  const handleSeePricing = async () => {
    console.log("handleSeePricing clicked", { pickupLocation, dropoffLocation, distance });
    
    let currentPickupLocation = pickupLocation;
    let currentDropoffLocation = dropoffLocation;
    let currentPickupAddress = pickupAddress;
    let currentDropoffAddress = dropoffAddress;

    setIsLoading(true);

    try {
      // If locations aren't set via autocomplete, try geocoding the input values
      if (!currentPickupLocation) {
        const addr = document.getElementById("pickup-input").value;
        if (addr) {
          const res = await geocodeAddress(addr);
          currentPickupLocation = { lat: res.lat, lng: res.lng };
          currentPickupAddress = res.formatted_address;
          setPickupLocation(currentPickupLocation);
          setPickupAddress(currentPickupAddress);
        }
      }

      if (!currentDropoffLocation) {
        const addr = document.getElementById("dropoff-input").value;
        if (addr) {
          const res = await geocodeAddress(addr);
          currentDropoffLocation = { lat: res.lat, lng: res.lng };
          currentDropoffAddress = res.formatted_address;
          setDropoffLocation(currentDropoffLocation);
          setDropoffAddress(currentDropoffAddress);
        }
      }

      if (!currentPickupLocation || !currentDropoffLocation) {
        toast.error("Please enter valid pickup and dropoff locations.");
        setIsLoading(false);
        return;
      }

      // Trigger route calculation if distance is still null
      if (distance === null) {
        const directionsService = directionsServiceRef.current;
        const result = await new Promise((resolve, reject) => {
          directionsService.route(
            {
              origin: currentPickupLocation,
              destination: currentDropoffLocation,
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (res, status) => {
              if (status === "OK") resolve(res);
              else reject(status);
            }
          );
        });

        const route = result.routes[0];
        const distanceInKm = route.legs[0].distance.value / 1000;
        setDistance(distanceInKm);
        
        const city = detectCity(currentPickupAddress);
        const rideData = {
          pickupLocation: currentPickupAddress,
          dropoffLocation: currentDropoffAddress,
          pickupCoordinates: [currentPickupLocation.lng, currentPickupLocation.lat],
          dropoffCoordinates: [currentDropoffLocation.lng, currentDropoffLocation.lat],
          distance: distanceInKm,
          pickupType,
          city,
          scheduleTime: pickupType === "later" ? scheduleTime : null,
        };
        navigate("/ride/selection", { state: { rideData } });
      } else {
        const city = detectCity(currentPickupAddress);
        const rideData = {
          pickupLocation: currentPickupAddress,
          dropoffLocation: currentDropoffAddress,
          pickupCoordinates: [currentPickupLocation.lng, currentPickupLocation.lat],
          dropoffCoordinates: [currentDropoffLocation.lng, currentDropoffLocation.lat],
          distance,
          pickupType,
          city,
          scheduleTime: pickupType === "later" ? scheduleTime : null,
        };
        navigate("/ride/selection", { state: { rideData } });
      }
    } catch (error) {
      console.error("Error in handleSeePricing:", error);
      toast.error("Failed to calculate route. Please check your locations.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg w-full max-w-6xl mx-auto ">
      <Toaster />
      <h3 className="text-xl font-semibold mb-4">Get your ride</h3>
      <div className="flex flex-col items-center lg:flex-row gap-6">
        {/* Input Fields */}
        <form className="space-y-6 w-full lg:w-1/2" onSubmit={(e) => e.preventDefault()}>
          <div className="flex items-center bg-gray-100 rounded-full px-4 py-4">
            <input
              id="pickup-input"
              type="text"
              placeholder="Enter pickup location"
              className="bg-transparent focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center bg-gray-100 rounded-full px-4 py-4">
            <input
              id="dropoff-input"
              type="text"
              placeholder="Enter dropoff location"
              className="bg-transparent focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center bg-gray-100 rounded-full px-4 py-4">
            <select
              value={pickupType}
              onChange={(e) => setPickupType(e.target.value)}
              className="bg-transparent focus:outline-none w-full"
            >
              <option value="now">Pickup Now</option>
              <option value="later">Schedule Later</option>
            </select>
          </div>

          {pickupType === "later" && (
            <div className="flex items-center bg-gray-100 rounded-full px-4 py-4">
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="bg-transparent focus:outline-none w-full"
                placeholder="Pickup Time"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleSeePricing}
            disabled={isLoading || !isMapsReady}
            className={`w-full py-3 text-lg rounded-full ${
              isMapsReady && !isLoading
                ? "bg-purple-500 text-white hover:bg-purple-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isLoading ? <DotLoader color="#fff" size={24} /> : "See Pricing"}
          </button>
        </form>

        {/* Map Section */}
        <div
          ref={mapRef}
          className="w-full lg:w-1/2 h-64 lg:h-[250px] xl:h-[350px] rounded-lg"
        ></div>
      </div>
    </div>
  );
};

export default RideForm;
