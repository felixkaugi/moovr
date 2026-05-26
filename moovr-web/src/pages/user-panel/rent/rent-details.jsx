import React from "react";
import { FaMapMarkerAlt } from "react-icons/fa"; // Icons for details
import Header from "../../../components/user-panel/header";
import { useNavigate } from "react-router-dom";
import { BiArrowBack } from "react-icons/bi";

const RentDetails = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen bg-gray-50">
      {/* Header */}
      <Header />

      <section className="max-w-[1180px] mx-auto p-6 ">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex gap-3 items-center mb-8 cursor-pointer py-2 px-3 rounded-[12px] w-fit hover:bg-gray-100"
        >
          <BiArrowBack size={23} /> Back
        </button>

        {/* Main Content */}
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Left Section - Car Details */}
          <div className="bg-gray-50 p-6 rounded-lg shadow-md w-full md:w-1/2 mb-8 md:mb-0">
            {/* Car Name and Location */}
            <div className="flex items-center justify-between ">
              <div>
                <h2 className="text-lg font-semibold">Honda Civic</h2>
                <p className="text-gray-500 mb-2">82BG879</p>
              </div>
              <div className="flex items-center text-gray-500 text-sm mb-4">
                <FaMapMarkerAlt className="mr-2" />
                <span>Abuja Continental Hotel</span>
              </div>
            </div>

            {/* Car Description */}
            <p className="text-gray-600 text-sm mb-6">
              Experience the thrill of driving a Honda Civic, where luxury meets
              performance. Perfect for those who crave style and excitement on
              every journey.
            </p>

            {/* Specifications */}
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Specifications
            </h3>
            <div className="flex space-x-4 mb-6">
              <div className="flex flex-col space-y-4 items-center justify-center h-[104px] w-[116px] bg-babyPurple rounded-lg">
                <img src="/icons/rent/seats.svg" alt="" />
                <span className="text-sm">4 Seats</span>
              </div>
              <div className="flex flex-col space-y-4 items-center justify-center h-[104px] w-[116px] bg-babyPurple rounded-lg">
                <img src="/icons/rent/gears.svg" alt="" />
                <span className="text-sm">Auto</span>
              </div>
              <div className="flex flex-col space-y-4 items-center justify-center h-[104px] w-[116px] bg-babyPurple rounded-lg">
                <img src="/icons/rent/speedometer.svg" alt="" />
                <span className="text-sm">400Km/h</span>
              </div>
            </div>

            {/* Rental Timeline */}
            <div className="flex items-center justify-between text-gray-700 mb-6">
              <div className="flex flex-col text-center">
                <span className="font-medium">Wed 05, 4:15PM</span>
                <span className="text-xs">Rent start date/time</span>
              </div>
              <img src="/icons/rent/connection.svg" alt="" />{" "}
              <div className="flex flex-col text-center">
                <span className="font-medium">Thu 06, 4:15PM</span>
                <span className="text-xs">Rent end date/time</span>
              </div>
            </div>

            {/* Rental Price */}
            <div className="flex justify-between text-gray-700 mb-2">
              <span className="font-medium">Rental Price</span>
              <span className="text-lg font-semibold">₦10/hour</span>
            </div>

            {/* Payment Method */}
            <div className="flex items-center mt-4">
              <img
                src="/images/mastercard.svg" // Replace with your payment icon path
                alt="Debit Card"
                className="h-6 w-auto mr-2"
              />
              <span className="text-sm font-medium">Debit Card</span>
            </div>
          </div>

          {/* Right Section - Car Image */}
          <div className="relative w-full md:w-1/2">
            <img
              src="/images/BMW.png" // Replace with your car image path
              alt="Rented Car"
              className="w-full max-w-sm mx-auto"
            />
            {/* <div className="absolute top-4 right-4 bg-purple-500 text-white py-2 px-4 rounded-full text-xs font-medium shadow-lg">
            Tap to unlock
          </div> */}
          </div>
        </div>
      </section>
    </div>
  );
};

export default RentDetails;
