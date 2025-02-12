// Import necessary packages
const express = require('express');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase/firebaseAdminKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://usmia-e7166-default-rtdb.firebaseio.com", // Replace with your Firebase DB URL
});

// Initialize Express app and middleware
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Firebase Database Reference
const db = admin.database();

/////////// JWT secret key (Change to something more secure)
const JWT_SECRET = process.env.JWT_SECRET; // Make sure to keep this secret

// OTP Store for password reset (temporary storage)
const otpStore = {};

// Email Transporter Setup for OTPs
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utility functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
}

function validateEmail(email) {
  const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return re.test(String(email).toLowerCase());
}











// Check if email exists
app.post("/check-email", async (req, res) => {
    const { email } = req.body;
  
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }
  
    try {
      const usersRef = db.ref("users");
      const snapshot = await usersRef.orderByChild("email").equalTo(email.toLowerCase()).once("value");
  
      return res.json({
        success: snapshot.exists(),
        message: snapshot.exists() ? "Email already exists..." : "Email not found...",
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Error checking email", error: error.message });
    }
  });

  

  // Send OTP for signup
  app.post("/send-otp-signup", async (req, res) => {
    const { email } = req.body;
  
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }
  
    try {
      const usersRef = db.ref("users");
      const snapshot = await usersRef.orderByChild("email").equalTo(email.toLowerCase()).once("value");
  
      if (snapshot.exists()) {
        return res.status(400).json({ success: false, message: "Email not found" });
      }
  
      const otp = generateOTP();
      otpStore[email.toLowerCase()] = { otp, timestamp: Date.now() };
  
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP code is: ${otp}. It is valid for 5 minutes.`,
      });
  
      return res.json({ success: true, message: "OTP sent successfully!" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Failed to send OTP", error: error.message });
    }
  });




  // Send OTP for password recovery
app.post("/send-otp", async (req, res) => {
    const { email } = req.body;
  
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }
  
    try {
      const usersRef = db.ref("users");
      const snapshot = await usersRef.orderByChild("email").equalTo(email.toLowerCase()).once("value");
  
      if (!snapshot.exists()) {
        return res.status(400).json({ success: false, message: "Email not found" });
      }
  
      const otp = generateOTP();
      otpStore[email.toLowerCase()] = { otp, timestamp: Date.now() };
  
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP code is: ${otp}. It is valid for 5 minutes.`,
      });
  
      return res.json({ success: true, message: "OTP sent successfully!" });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Failed to send OTP", error: error.message });
    }
  });

  




  // Verify OTP
app.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
  
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }
  
    const otpData = otpStore[email.toLowerCase()];
    if (!otpData) {
      return res.status(404).json({ success: false, message: "OTP not found" });
    }
  
    if (Date.now() - otpData.timestamp > 5 * 60 * 1000) {
      delete otpStore[email.toLowerCase()];
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }
  
    if (String(otpData.otp) === otp.trim()) {
      delete otpStore[email.toLowerCase()];
      return res.json({ success: true, message: "OTP verified successfully!" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  });

  

  // Signup
app.post("/signup", async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
  
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
  
    try {
      const usersRef = db.ref("users");
      const snapshot = await usersRef.orderByChild("email").equalTo(email.toLowerCase()).once("value");
  
      if (snapshot.exists()) {
        return res.status(400).json({ success: false, message: "Email already exists" });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUserRef = usersRef.push();
      await newUserRef.set({
        firstName,
        lastName,
        email: email.toLowerCase(),
        password: hashedPassword,
      });
  
      res.json({ success: true, message: "User signed up successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error signing up user", error: error.message });
    }
  });

  




  /*/ Login
app.post("/verify-login", async (req, res) => {
    const { email, password } = req.body;
  
    try {
      const snapshot = await db.ref("users").orderByChild("email").equalTo(email).once("value");
  
      if (!snapshot.exists()) {
        return res.status(400).json({ message: "Invalid login credentials!" });
      }
  
      let userKey = Object.keys(snapshot.val())[0];
      const user = snapshot.val()[userKey];
  
      const isPasswordValid = await bcrypt.compare(password, user.password);
  
      if (isPasswordValid) {
        res.json({ message: "Login successful!" });
      } else {
        res.status(400).json({ message: "Invalid login credentials!" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error logging in", error: error.message });
    }
  });*/




// Login verification endpoint
app.post("/verify-login", async (req, res) => {
  const { email, password } = req.body;

  console.log("Received login request for email:", email); // Log the incoming request

  try {
      // Check if a user exists with the provided email
      const snapshot = await db.ref("users").orderByChild("email").equalTo(email).once("value");

      if (!snapshot.exists()) {
          console.log(`No user found with email: ${email}`);
          return res.status(400).json({ message: "Invalid login credentials!" });
      }

      let userKey = Object.keys(snapshot.val())[0];
      const user = snapshot.val()[userKey];

      console.log(`User found: ${user.email}. Verifying password...`);

      // Compare the provided password with the hashed password in the database
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (isPasswordValid) {
          console.log(`Password for user ${user.email} is valid.`);

          // Generate a JWT token if the password is correct
          const token = jwt.sign(
              { userId: userKey, email: user.email }, // Payload (user info)
              JWT_SECRET, // Secret key
              { expiresIn: '1m' } // Token expiration (1 hour)
          );

          // Store the token in the user's record in the database
          await db.ref(`users/${userKey}`).update({
              token: token
          });

          console.log(`Login successful for email: ${user.email}. Token generated and stored.`);

          // Send the token in the response
          res.json({ message: "Login successful!", token: token });
      } else {
          console.log(`Invalid password attempt for email: ${email}`);
          res.status(400).json({ message: "Invalid login credentials!" });
      }
  } catch (error) {
      console.error("Error logging in:", error.message); // Log the error
      res.status(500).json({ message: "Error logging in", error: error.message });
  }
});









/*/ Token verification endpoint
app.post("/verify-token", async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: "Invalid token format" });
  }

  try {
      // Validate JWT token using Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Optionally, check if the user exists in Firebase (e.g., "users" node in Realtime Database)
      const userSnapshot = await db.ref("users").child(decodedToken.uid).once("value");

      if (userSnapshot.exists()) {
          // Token is valid and user exists
          res.json({ message: "OK", user: decodedToken });
      } else {
          // User does not exist in the database
          res.status(404).json({ message: "User not found." });
      }
  } catch (error) {
      console.error("Error verifying token:", error);
      res.status(500).json({
          message: "Error verifying token",
          error: error.message,
          stack: error.stack // This gives more detailed error information
      });
  }
});*/

// Verify token route
app.post('/verify-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token is required." });
  }

  // Check if the token exists in the 'users' node of the Realtime Database
  db.ref('users').orderByChild('token').equalTo(token).once('value')
    .then(snapshot => {
      if (snapshot.exists()) {
        // Token found in the database
        console.log('Token verified successfully');
        res.json({ message: "OK" });
      } else {
        // Token not found
        console.log('Token not found');
        res.status(401).json({ message: "Invalid or expired token." });
      }
    })
    .catch(error => {
      // Handle error during the database query
      console.error('Error verifying token in database:', error);
      res.status(500).json({ message: "Error verifying token in database." });
    });
});








  // Reset Password
app.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;
  
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: "Email and new password are required" });
    }
  
    try {
      const snapshot = await db.ref("users").orderByChild("email").equalTo(email).once("value");
  
      if (!snapshot.exists()) {
        return res.status(400).json({ message: "Email not found!" });
      }
  
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      let userKey = Object.keys(snapshot.val())[0];
      await db.ref(`users/${userKey}`).update({ password: hashedPassword });
  
      res.json({ message: "Password reset successful!" });
    } catch (error) {
      res.status(500).json({ message: "Error resetting password", error: error.message });
    }
  });

  


  const PORT = 3000; // Set the port to 3000
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  