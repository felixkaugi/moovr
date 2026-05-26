import React from "react";
import Router from "./router/router";
import ErrorBoundary from "./components/ErrorBoundary";

const App = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white text-black dark:bg-gray-900 dark:text-white transition-colors">
        <Router />
      </div>
    </ErrorBoundary>
  );
};

export default App;
