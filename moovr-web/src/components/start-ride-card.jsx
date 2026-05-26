import React from "react";
import { FaStar } from "react-icons/fa";

const StartRide = () => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 w-[350px] flex flex-col items-center space-y-4">
      {/* Title */}
      <h2 className="text-center text-lg font-semibold text-gray-700">
        Start your ride
      </h2>

      {/* Estimated Time */}
      <div className="flex items-center justify-between w-full px-4">
        <span className="text-gray-400">Estimated time</span>
        <span className="text-sm font-semibold text-purple-500 bg-purple-100 px-3 py-1 rounded-full">
          05 min
        </span>
      </div>

      {/* Driver Info */}
      <div className="flex items-center w-full justify-around mt-2">
        {/* Driver Profile with Rating */}
        <div className="relative flex items-center space-x-2">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-lg">
            <img
              src="/images/avatar.png" // Replace with the driver image
              alt="Driver"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center">
            <span className="font-semibold text-gray-800">Adewale</span>
            <p className="text-sm text-gray-500">Driver</p>
          </div>
          <div className="absolute -bottom-2 left-0 transform translate-x-2 bg-purple-100 text-purple-500 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center space-x-1">
            <FaStar className="text-yellow-500 w-3 h-3" />
            <span>4.9</span>
          </div>
        </div>

        <img
          src="/images/driver/straight-car.png" // Replace with car image
          alt="Car"
          className="w-24 h-12 object-cover"
        />

        {/* Car Information */}
        <div className="text-center">
          <span className="font-semibold text-gray-800 block">82BG879</span>
          <p className="text-sm text-gray-500">Silver Honda Civic</p>
        </div>
      </div>
    </div>
  );
};

export default StartRide;
