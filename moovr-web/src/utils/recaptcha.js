/**
 * OBSOLETE: This file is no longer used. 
 * reCAPTCHA logic has been moved to src/firebase.js via the sendOtp helper
 * to prevent instance fragmentation and auth/argument-error.
 */
export const getStableRecaptchaVerifier = async () => {
  console.warn("getStableRecaptchaVerifier is obsolete. Use sendOtp from src/firebase.js instead.");
  return null;
};
