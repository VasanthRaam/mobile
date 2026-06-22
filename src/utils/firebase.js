import { Platform } from 'react-native';
import axios from 'axios';

// Your Firebase Web API Key (can be configured in Firebase Console -> Project Settings)
const FIREBASE_API_KEY = "AIzaSyDIgMB0T_XIBDIy6dPei6G52kk9by5WJpU";

/**
 * Sends a verification code (SMS) to the given phone number using Firebase Auth REST API.
 * For testing, please register the phone number and verification code in your Firebase Console
 * under Authentication -> Users -> Phone numbers for testing.
 * 
 * @param {string} phoneNumber Format: +[CountryCode][Number] (e.g., +919876543210)
 * @returns {Promise<string>} The sessionInfo required to verify the OTP.
 */
export const sendFirebaseOTP = async (phoneNumber) => {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${FIREBASE_API_KEY}`;
    const response = await axios.post(url, {
      phoneNumber,
      // For real native applications, a recaptchaToken can be fetched using RecaptchaVerifier
      // or SafetyNet/Play Integrity. For testing and registered test numbers, this is not required.
      recaptchaToken: ""
    });
    return response.data.sessionInfo;
  } catch (error) {
    console.error('[Firebase OTP Send Error]:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Failed to send SMS verification code.');
  }
};

/**
 * Verifies the SMS code with Firebase and returns the Firebase ID Token.
 * 
 * @param {string} sessionInfo The sessionInfo returned by sendFirebaseOTP.
 * @param {string} code The 6-digit SMS verification code.
 * @returns {Promise<string>} The Firebase ID Token (idToken).
 */
export const verifyFirebaseOTP = async (sessionInfo, code) => {
  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`;
    const response = await axios.post(url, {
      sessionInfo,
      code
    });
    return response.data.idToken;
  } catch (error) {
    console.error('[Firebase OTP Verify Error]:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Invalid or expired verification code.');
  }
};
