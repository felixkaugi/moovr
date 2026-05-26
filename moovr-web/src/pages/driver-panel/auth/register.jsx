import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { signInWithPopup, signInWithPhoneNumber, getRedirectResult, signInWithRedirect, RecaptchaVerifier } from "firebase/auth";
import { auth, googleProvider } from "../../../firebase";
import { BaseURL } from "../../../utils/BaseURL";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import Cookies from "js-cookie";
import { getStableRecaptchaVerifier } from "../../../utils/recaptcha";

const DriverRegister = () => {
  const location = useLocation();
  const { role } = location.state || { role: "driver" }; // Default to driver
  const [countryCode, setCountryCode] = useState("+92");
  const [userNumber, setUserNumber] = useState("");
  const [fullPhone, setFullPhone] = useState("+92");
  const navigate = useNavigate();

  useEffect(() => {
    console.log("Selected Role:", role); // Log the selected role

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
  }, [role]);

  const phoneInputRef = React.useRef(null);

  const handleGoogleLoginResult = async (result) => {
    try {
      const user = result.user;
      const idToken = await user.getIdToken();
      console.log("Google Auth successful, verifying with backend...");

      const response = await axios.post(`${BaseURL}/auth/google-login`, {
        idToken,
        role: "driver"
      });

      console.log("Backend response:", response.data);

      if (response.data.token) {
        const { token, user: backendUser } = response.data;
        const roleToSet = backendUser.role || "driver";

        Cookies.set("token", token, { expires: 7, path: '/' });
        Cookies.set("role", roleToSet, { expires: 7, path: '/' });
        localStorage.setItem("token", token);
        localStorage.setItem("role", roleToSet);
        localStorage.setItem("userData", JSON.stringify(backendUser));

        toast.success("Login successful!");
        
        // Check if driver setup is complete
        const isProfileComplete = backendUser.profilePicture && 
                                backendUser.documents?.drivingLicense && 
                                backendUser.documents?.vehicleRegistrationBook;

        let target = "/ride"; // default
        if (roleToSet === "driver") {
          target = isProfileComplete ? "/d/dashboard" : "/d/";
        }

        console.log("Redirecting to:", target);
        setTimeout(() => {
          window.location.href = target;
        }, 500);
      } else {
        toast.success("Google account linked! Please enter your phone number to finish signup.");
        const userData = {
          name: user.displayName,
          email: user.email,
          uid: user.uid,
          photoURL: user.photoURL,
          role: "driver"
        };
        localStorage.setItem("userData", JSON.stringify(userData));
        
        // Focus phone input to guide the user
        if (phoneInputRef.current) {
          phoneInputRef.current.focus();
          phoneInputRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    } catch (error) {
      console.error("Google Login Error:", error);
      toast.error(error.response?.data?.message || error.message || "Google Sign-In failed.");
    }
  };

  const handleCountryChange = (value) => {
    const match = value.match(/^\+\d+/);
    const code = match ? match[0] : "+92";
    setCountryCode(code);
    setFullPhone(code + userNumber);
  };

  const handleUserNumberChange = (e) => {
    let number = e.target.value.replace(/\D/g, "");
    // Strip leading zero if it exists
    if (number.startsWith("0")) {
      number = number.substring(1);
    }
    setUserNumber(number);
    setFullPhone(countryCode + number);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    try {
      const appVerifier = await getStableRecaptchaVerifier();
      if (!appVerifier) {
        throw new Error("reCAPTCHA failed to initialize. Please refresh the page.");
      }

      const confirmationResult = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
      
      // Store confirmationResult globally to access it in the verification page
      window.confirmationResult = confirmationResult;

      toast.success("OTP sent successfully!");

      let userData = {
        phone: fullPhone,
      };

      localStorage.setItem("userData", JSON.stringify(userData));
      navigate("/d/verification");
    } catch (error) {
      console.error("Firebase SMS Error:", error);
      
      let errorMessage = "Failed to send OTP. Please check your phone number.";
      
      if (error.code === "auth/invalid-app-credential") {
        errorMessage = "Invalid app credential. This can happen if reCAPTCHA is misconfigured or the domain is not authorized in Firebase Console.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleGoogleLogin = async () => {
    try {
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
        }
      } else if (error.code !== 'auth/cancelled-by-user' && error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || "Google Sign-In failed.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Toaster />
      <div className="bg-white md:shadow-lg rounded-lg overflow-hidden max-w-5xl h-[550px] grid md:grid-cols-2">
        <div className="p-8 w-96 mx-auto">
          <h2 className="text-2xl font-bold mb-4">Enter your mobile number</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center bg-gray-50 rounded-full px-3 py-2 space-x-2">
              <div className="relative inline-flex">
                <PhoneInput
                  defaultCountry="pk"
                  value={countryCode}
                  onChange={handleCountryChange}
                  inputClassName="hidden"
                  countrySelectorStyleProps={{
                    buttonClassName: `
                      !p-0 !bg-transparent !border-none !shadow-none
                      !h-10 !w-auto !px-2
                      flex items-center justify-center gap-1
                      focus:!ring-0
                      group
                    `,
                    buttonContentWrapperClassName: `
                      flex items-center justify-center gap-2
                      relative w-full h-full
                    `,
                    flagClassName: `
                      !w-6 !h-6 rounded-full object-cover
                      border border-gray-100 shadow-sm
                    `,
                    dropdownArrowClassName: `
                      !ml-0 !text-gray-500 !w-4 
                      transition-transform duration-200
                      group-hover:!text-gray-700
                      group-data-[active=true]:rotate-180
                      relative top-0
                    `,
                    dropdownStyleProps: {
                      className: `
                        !mt-2 !left-0 !min-w-[220px]
                        !rounded-xl !shadow-lg !border !border-gray-200
                        !py-2
                      `,
                    }, 
                  }}
                />
              </div>
              <div className="text-base text-gray-700 font-medium h-12 flex items-center px-2">
                {countryCode}
              </div>

              <input
                ref={phoneInputRef}
                type="tel"
                value={userNumber}
                onChange={handleUserNumberChange}
                className="flex-1 bg-transparent focus:outline-none h-12 text-base placeholder:text-gray-400"
                placeholder="Phone number"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 mt-3 bg-purple-500 text-white rounded-full hover:bg-purple-600"
            >
              Continue
            </button>
          </form>

          {/* reCAPTCHA container */}
          <div id="recaptcha-container"></div>

          <div className="text-center mt-4">
            <p>
              Already have an account?{" "}
              <a href="/login" className="text-purple-500">
                Log In
              </a>
            </p>
          </div>
          <div className="flex items-center my-4">
            <hr className="flex-1" />
            <span className="px-4 text-gray-400">or</span>
            <hr className="flex-1" />
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2 border border-gray-300 rounded-full flex items-center justify-center space-x-2 hover:bg-gray-100 transition shadow-sm"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">Continue with Google</span>
            </button>
            <button className="w-full py-2 border border-gray-300 rounded-full flex items-center justify-center space-x-2 hover:bg-gray-100">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/633px-Apple_logo_black.svg.png"
                alt="Apple"
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">Continue with Apple</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            By proceeding, you consent to get calls, WhatsApp, or SMS messages,
            including by automated dialer, from our company and its affiliates
            to the number provided. Text "STOP" to opt out.
          </p>
        </div>
        <div className="hidden md:block">
          <img
            src="/driver/auth/signup-bg.png"
            alt="Signup Background"
            className="object-cover h-full w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default DriverRegister;