"use client";

import React, { useState, useEffect } from "react";
import { FiChevronDown, FiStar } from "react-icons/fi";
import { PieChart, Pie, Cell } from "recharts";
import Header from "../../components/driver-panel/header";
import { Link } from "react-router-dom";
import axios from "axios";
import { BaseURL } from "../../utils/BaseURL";

const Card = ({ children, className = "", ...props }) => (
  <div
    className={`bg-white rounded-xl border border-gray-100 p-6 ${className}`}
    {...props}
  >
    {children}
  </div>
);

const FilterDropdown = ({ selected = "This Month" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1 bg-purple-100 text-sm rounded-full flex items-center gap-1 text-purple-600"
      >
        {selected}
        <FiChevronDown
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg z-10">
          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 rounded-lg">
            This Month
          </button>
          <button className="w-full px-4 py-2 text-left hover:bg-gray-50 rounded-lg">
            Last Month
          </button>
        </div>
      )}
    </div>
  );
};

const StarRating = ({ rating = 5, size = "large" }) => {
  const stars = Array(5).fill(0);
  return (
    <div className="flex items-center justify-center gap-1">
      {stars.map((_, index) => (
        <FiStar
          key={index}
          className={`${
            index < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
          } ${size === "large" ? "w-8 h-8" : "w-4 h-4"}`}
        />
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [ridesData, setRidesData] = useState([]);
  const [totalRides, setTotalRides] = useState(0);
  const [acceptedPercentage, setAcceptedPercentage] = useState(0);
  const [canceledPercentage, setCanceledPercentage] = useState(0);
  const [totalListings, setTotalListings] = useState(0);
  const [averageRating, setAverageRating] = useState(0); // State for average rating
  const [reviewsData, setReviewsData] = useState([]); // State for reviews data
  const [listingsData, setListingsData] = useState([]); // State for reviews data
  const [totalRevenue, setTotalRevenue] = useState(0); // State for total revenue
  const [totalBookings, setTotalBookings] = useState(0); // State for total bookings

  // Reusable function for API calls
  const fetchData = async (url, config = {}) => {
    try {
      const response = await axios.get(url, config);
      return response.data;
    } catch (error) {
      console.error("Error fetching data:", error);
      return null;
    }
  };

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const userDataStr = localStorage.getItem("userData");
        const userData = userDataStr ? JSON.parse(userDataStr) : null;
        const driverId = userData?._id;

        if (!driverId) {
          console.error("Driver ID missing from userData");
          return;
        }

        const token = localStorage.getItem("token");
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };

        const response = await axios.get(
          `${BaseURL}/bookings/driver-bookings`, // Adjust API if needed
          config
        );

        const rentedCars = response.data.bookings || [];

        // Set total bookings
        setTotalBookings(rentedCars.length);
      } catch (error) {
        console.error("Error fetching bookings data:", error);
      }
    };

    fetchBookings();
  }, []);

  // Fetch revenue data
  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        const token = localStorage.getItem("token");
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };

        const response = await axios.get(`${BaseURL}/revenue`, config);

        if (response.data) {
          setTotalRevenue(response.data.Total || 0); // Set the total revenue
        }
      } catch (error) {
        console.error("Error fetching revenue:", error);
      }
    };

    fetchRevenue();
  }, []);

  // Fetch reviews data
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const token = localStorage.getItem("token");
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };

        const response = await axios.get(`${BaseURL}/reviews`, config);
        const { reviews, averageRating } = response.data;

        setReviewsData(reviews);
        setAverageRating(averageRating);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      }
    };

    fetchReviews();
  }, []);

  // Fetch ride data
  useEffect(() => {
    const fetchRides = async () => {
      try {
        const token = localStorage.getItem("token");
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };
        const { data } = await axios.get(`${BaseURL}/rides/driver`, config);
        console.log("rides data of driver", data);

        if (data && data.driverRides) {
          const rides = data.driverRides;
          const total = rides.length;

          const acceptedRides = rides.filter(
            (ride) => ride.status === "completed"
          ).length;
          const canceledRides = rides.filter(
            (ride) => ride.status === "canceled"
          ).length;

          setTotalRides(total || 0);

          const acceptedPct =
            total > 0 ? ((acceptedRides / total) * 100).toFixed(1) : 0;
          const canceledPct =
            total > 0 ? ((canceledRides / total) * 100).toFixed(1) : 0;

          setAcceptedPercentage(acceptedPct);
          setCanceledPercentage(canceledPct);

          setRidesData([
            { name: "Completed", value: acceptedRides, color: "#8257E9" },
            { name: "Canceled", value: canceledRides, color: "#4C1D95" },
          ]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchRides();
  }, []);

  // Fetch listings data
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const userDataStr = localStorage.getItem("userData");
        const userData = userDataStr ? JSON.parse(userDataStr) : null;
        const driverId = userData?._id;

        if (driverId) {
          const response = await axios.get(
            `${BaseURL}/cars/driver/${driverId}/cars`
          );
          const cars = response.data.cars || [];

          // Calculate the status breakdown (Active, Inactive, Cancelled)
          const activeListings = cars.filter(
            (car) => car.status === "active"
          ).length;
          const inactiveListings = cars.filter(
            (car) => car.status === "inactive"
          ).length;
          const canceledListings = cars.filter(
            (car) => car.status === "canceled"
          ).length;

          setTotalListings(cars.length); // Set total listings

          // Adjust Pie chart data based on the status
          if (inactiveListings === cars.length) {
            setListingsData([
              { name: "Inactive", value: cars.length, color: "#7C3AED" },
            ]); // All inactive
          } else {
            setListingsData([
              { name: "Active", value: activeListings, color: "#A855F7" },
              { name: "Inactive", value: inactiveListings, color: "#7C3AED" },
              { name: "Cancelled", value: canceledListings, color: "#EF4444" },
            ]);
          }
        }
      } catch (error) {
        console.error("Error fetching car listings:", error);
      }
    };

    fetchListings();
  }, []);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-xl font-medium mb-6">Dashboard</h1>

        {/* Action Row */}
        <div className="mb-6">
          <Link to="/d/location">
            <button className="w-full py-4 bg-purple-600 text-white rounded-xl font-semibold text-lg hover:bg-purple-700 shadow-md transition-colors flex items-center justify-center gap-2">
              <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
              Go Online to Accept Rides
            </button>
          </Link>
        </div>

        {/* Top Row Stats */}
        <div className="grid md:grid-cols-3 justify-center gap-6 mb-6 mx-auto">
          {/* Revenue Card */}
          <Card className="shadow-md">
            <Link to="/d/revenue">
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-gray-600">Total Revenue</h2>
                <FilterDropdown />
              </div>
              <div className="flex flex-col items-center justify-center pt-3">
                <p className="text-[32px] font-semibold">₦{totalRevenue}</p>
                <p className="text-sm text-gray-500 mt-1">till now</p>
              </div>
            </Link>
          </Card>
          {/* Rides Card */}
          <Card className="shadow-md">
            <Link to="/d/rides">
              <div className="flex justify-between items-start">
                <h2 className="text-gray-600">Total Rides</h2>
                <FilterDropdown />
              </div>
              <div className="flex justify-center mt-4">
                <div className="relative">
                  <PieChart width={120} height={120}>
                    <Pie
                      data={ridesData}
                      cx={60}
                      cy={60}
                      innerRadius={40}
                      outerRadius={55}
                      startAngle={90}
                      endAngle={450}
                      dataKey="value"
                    >
                      {ridesData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-semibold">{totalRides}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#8257E9]" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#4C1D95]" />
                  <span>Canceled</span>
                </div>
              </div>
            </Link>
          </Card>
          {/* Other Cards */}
          <Card className="shadow-md">
            <Link to="/d/rating">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-gray-600">Ratings</h2>
                <FilterDropdown />
              </div>
              <div className="text-center flex flex-col items-center justify-center">
                <img src="/driver/stars.svg" alt="" />
                <p className="text-3xl font-bold mt-4 text-gray-700">
                  {averageRating}
                </p>
                <p className="text-gray-500">
                  Rated by {reviewsData.length} people
                </p>
              </div>
            </Link>
          </Card>
          <Card className="shadow-md">
            <Link to="/d/listing">
              <div className="flex justify-between items-start">
                <h2 className="text-gray-600">Total Listings</h2>
                <FilterDropdown />
              </div>
              <div className="flex justify-center mt-4">
                <div className="relative">
                  <PieChart width={120} height={120}>
                    <Pie
                      data={listingsData} // Use dynamic listings data
                      cx={60}
                      cy={60}
                      innerRadius={40}
                      outerRadius={55}
                      startAngle={90}
                      endAngle={450}
                      dataKey="value"
                    >
                      {listingsData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <text
                      x="53%"
                      y="56%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-2xl font-bold"
                    >
                      {totalListings}
                    </text>
                  </PieChart>
                </div>
              </div>
            </Link>
          </Card>
          {/* Bookings Card */}
          <Card className="shadow-md">
            <Link to="/d/bookings">
              <div className="flex justify-between items-start">
                <h2 className="text-gray-600">Total Bookings</h2>
                <FilterDropdown />
              </div>
              <div className="flex flex-col items-center justify-center pt-3">
                <PieChart width={120} height={120}>
                  <Pie
                    data={[
                      {
                        name: "Total Bookings",
                        value: totalBookings,
                        color: "#A855F7",
                      },
                      {
                        name: "Remaining",
                        value: 100 - totalBookings,
                        color: "#E5E7EB",
                      },
                    ]}
                    cx={60}
                    cy={60}
                    innerRadius={40}
                    outerRadius={55}
                    startAngle={90}
                    endAngle={450}
                    dataKey="value"
                  >
                    {[
                      { name: "Total Bookings", color: "#A855F7" },
                      { name: "Remaining", color: "#E5E7EB" },
                    ].map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <text
                    x="53%"
                    y="56%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-2xl font-bold"
                  >
                    {totalBookings}
                  </text>
                </PieChart>
              </div>
            </Link>
          </Card>
        </div>
      </main>
    </div>
  );
}
