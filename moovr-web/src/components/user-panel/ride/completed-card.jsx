import React from "react";
import { Link } from "react-router-dom";

const CompletedCard = ({ title, path, driverId, driverName, buttonText = "Rate your ride", message }) => {
  return (
    <div className=" bg-white rounded-2xl shadow-lg p-8 w-96 text-center">
      <h2 className="font-semibold text-gray-800 mb-2">{title}</h2>
      {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}
      <div className="flex justify-center mb-6">
        <div className="flex items-center justify-center">
          <img
            src="/images/check.png" // Replace with your checkmark icon
            alt="Checkmark"
          />
        </div>
      </div>
      <Link to={path} state={{ driverId, driverName }}>
        <button className="bg-purple-500 text-white py-3 w-full rounded-full text-lg font-semibold hover:bg-purple-600">
          {buttonText}
        </button>
      </Link>
    </div>
  );
};

export default CompletedCard;
