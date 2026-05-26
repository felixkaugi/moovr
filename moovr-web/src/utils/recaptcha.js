import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../firebase";

let recaptchaVerifier = null;

/**
 * Returns a stable, singleton instance of RecaptchaVerifier.
 * This prevents "Multiple reCAPTCHA initializations" and "unstable lifecycle" errors.
 */
export const getStableRecaptchaVerifier = async () => {
  if (typeof window === "undefined") return null;

  // 1. Return existing instance if it already exists
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  // 2. Initialize ONLY once
  try {
    const container = document.getElementById("recaptcha-container");
    if (!container) {
      console.error("Critical: recaptcha-container not found in DOM.");
      return null;
    }

    recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: (response) => {
        console.log("reCAPTCHA solved successfully");
      },
      "expired-callback": () => {
        console.log("reCAPTCHA expired");
      }
    });

    // Explicitly render to catch initialization errors early
    await recaptchaVerifier.render();

    console.log("Stable Singleton reCAPTCHA initialized and rendered");
    return recaptchaVerifier;
  } catch (error) {
    console.error("Failed to initialize stable reCAPTCHA:", error);
    return null;
  }
};
