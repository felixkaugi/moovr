import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { getRedirectResult, signInWithPopup, signInWithRedirect, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, googleProvider } from "../../../firebase";
import Cookies from "js-cookie";
import "react-toastify/dist/ReactToastify.css";
import { BaseURL } from "../../../utils/BaseURL";

const Login = () => {
  const location = useLocation();
  const role = location.state?.role || null; // fallback to null if not provided

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          handleGoogleLoginResult(result);
        }
      })
      .catch((error) => {
        console.error("Google Redirect Result Error:", error);
        if (error.code !== 'auth/redirect-cancelled-by-user') {
          toast.error("Google sign-in failed. Please try again.");
        }
      });
  }, []);

  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (e) => {
    if (e) e.preventDefault();
    if (!forgotEmail) {
      toast.error("Please enter your email address");
      return;
    }

    try {
      setIsResetting(true);
      await sendPasswordResetEmail(auth, forgotEmail);
      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotModal(false);
      setForgotEmail("");
    } catch (error) {
      console.error("Reset Error:", error);
      let message = "Failed to send reset email.";
      if (error.code === "auth/user-not-found") {
        message = "No account found with this email.";
      }
      toast.error(message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleLoginSuccess = async (user) => {
    try {
      const idToken = await user.getIdToken();
      console.log("Auth successful, verifying with backend...");

      const response = await axios.post(`${BaseURL}/auth/firebase-verify`, {
        idToken,
        role: role || "user"
      });

      console.log("Backend response:", response.data);

      const { user: backendUser, isRegistered } = response.data;
      if (response.data.token) {
        const { token } = response.data;
        const roleToSet = backendUser.role || role || "user";

        Cookies.set("token", token, { expires: 7, path: '/' });
        Cookies.set("role", roleToSet, { expires: 7, path: '/' });
        localStorage.setItem("token", token);
        localStorage.setItem("role", roleToSet);
        localStorage.setItem("userData", JSON.stringify(backendUser));

        toast.success("Login successful!");
        
        let target = "/ride";
        if (roleToSet === "driver") {
          const isProfileComplete = backendUser.profilePicture && 
                                  backendUser.documents?.proofOfResidency &&
                                  backendUser.documents?.drivingLicense && 
                                  backendUser.documents?.vehicleRegistrationBook &&
                                  backendUser.documents?.vehicleInsurance &&
                                  backendUser.termsAccepted;
          target = isProfileComplete ? "/d/dashboard" : "/d/";
        }

        console.log("Redirecting to:", target);
        setTimeout(() => {
          window.location.href = target;
        }, 500);
      } else if (backendUser && isRegistered === false) {
        localStorage.setItem("userData", JSON.stringify(backendUser));
        toast.success("Please complete your profile to continue.");
        navigate("/name");
      } else {
        toast.error(response.data.message || "Login failed.");
      }
    } catch (error) {
      console.error("Backend Verification Error:", error);
      toast.error(error.response?.data?.message || error.message || "Login failed.");
    }
  };

  const handleGoogleLoginResult = async (result) => {
    try {
      setLoading(true);
      await handleLoginSuccess(result.user);
    } catch (error) {
      console.error("Google Login Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    try {
      setLoading(true);
      console.log("Attempting to sign in with email/password...");
      const result = await signInWithEmailAndPassword(auth, email, password);
      await handleLoginSuccess(result.user);
    } catch (error) {
      console.error("Login Error:", error);
      let errorMessage = "Failed to sign in. Please check your credentials.";
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password.";
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user) {
        await handleGoogleLoginResult(result);
      }
    } catch (error) {
      console.error("Google Login Popup Error:", error);
      if (error.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error("Google Login Redirect Error:", redirectError);
          toast.error("Google sign-in failed. Please try again.");
          setLoading(false);
        }
      } else if (error.code !== 'auth/cancelled-by-user' && error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || "Google Sign-In failed.");
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden max-w-5xl h-[550px] grid md:grid-cols-2">
        <div className="p-8 w-96 mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">Login to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                placeholder="example@mail.com"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <button 
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-purple-600 hover:underline font-medium"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-4 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-purple-300"
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
          </form>

          <div className="text-center mt-4">
            <p>
              Don't have an account?{" "}
              <Link
                to={role === "driver" ? "/d/signup" : "/signup"}
                className="text-purple-600 hover:underline font-medium"
              >
                Sign up
              </Link>
            </p>
          </div>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-gray-400 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2.5 border border-gray-300 rounded-full flex items-center justify-center space-x-2 hover:bg-gray-50 transition shadow-sm"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">Continue with Google</span>
            </button>
            <button className="w-full py-2.5 border border-gray-300 rounded-full flex items-center justify-center space-x-2 hover:bg-gray-50 transition shadow-sm">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/633px-Apple_logo_black.svg.png"
                alt="Apple"
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">Continue with Apple</span>
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-6 text-center">
            By proceeding, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <div className="hidden md:block">
          <img
            src="/Login-BG.jpg"
            alt="Login Graphic"
            className="object-cover h-full w-full"
          />
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Reset Password</h3>
            <p className="text-gray-600 text-sm mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                placeholder="example@mail.com"
                required
              />
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 py-3 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:bg-purple-300"
                >
                  {isResetting ? "Sending..." : "Send Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
