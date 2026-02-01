const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const Otp = require("../models/otpSchema");
const User = require("../models/userSchema");
const sendSMS = require("../common/sendSMS");
const Wallet = require("../models/walletSchema");
const Service = require("../models/serviceSchema");
const generateOTP = require("../common/generateOtp");
const asyncHandler = require("express-async-handler");
const getIpAddress = require("../common/getIpAddress");
const successHandler = require("../common/successHandler");
const uniqueIdGenerator = require("../common/uniqueIdGenerator");
const print = require("../common/printLog");

// ==================== USER SIGNUP / LOGIN CONTROLLER ====================
const userSignUp = asyncHandler(async (req, res) => {

  const findSIGNUPService = await Service.findOne({ name: "SIGNUP", status: true });
  const findLOGINService = await Service.findOne({ name: "LOGIN", status: true });

  print("signup and login services: ", findSIGNUPService?.status, findLOGINService?.status);

  const {
    firstName,
    lastName,
    phone,
    email,
    referalId,
    otp,
    ResponseStatus,
    deviceToken
  } = req.body || {};

  print("Auth Request Body:", req.body);
  if (!phone) {
    print("Phone number is required but missing");
    res.status(400);
    throw new Error("Phone number is required.");
  }
  // ===== REGISTER FLOW =====
  if (ResponseStatus == 1){
    if (!findSIGNUPService?.status) {
      print("Signup service is disabled");
      res.status(400);
      throw new Error("Registration is Temporarely Closed 😞");
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      print("Email already registered:", email);
      res.status(400);
      throw new Error("Email is already registered.");
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      print("Phone number already registered:", phone);
      res.status(400);
      throw new Error("Phone number is already registered.");
    }

    if (!firstName || !lastName || !email) {
      print("Missing required fields", { firstName, lastName, email });
      res.status(400);
      throw new Error("Please provide all required fields.");
    }

    // Validate referral
    const referalFound = referalId ? await User.findOne({ referalId }) : null;
    if (referalId && referalId?.length !== 0 && !referalFound) {
      print("Invalid referral ID:", referalId);
      res.status(400);
      throw new Error("Invalid referral ID.");
    }
    const createReferId = uniqueIdGenerator("referalId");
    const checkExistReferId = await User.findOne({ referalId: createReferId });

    const newUser = new User({
      firstName,
      lastName,
      email,
      phone: phone?.toString(),
      referBy: referalId,
      referalId: checkExistReferId
        ? uniqueIdGenerator("referalId")
        : createReferId,
      ipAddress: getIpAddress(req) || "0.0.0.0",
      deviceToken
    });
    
    print("Creating new user:", newUser);
    await newUser.save();

    const newWallet = new Wallet({ userId: newUser._id });
    await newWallet.save();
    newUser.wallet = newWallet._id;
    await newUser.save();

    const token = jwt.sign({ _id: newUser._id }, JWT_SECRET);
    print("User registered successfully:", newUser.firstName);
    return successHandler(req, res, {
      message: "Registration Successful",
      ResponseStatus: 2,
      AccessToken: token,
    });
  }

  // ===== OTP / LOGIN FLOW =====
  else {
    // ---- OTP Send Flow ----
    if (!otp) {
      print("OTP send requested for phone:", phone);
      const recentOtp = await Otp.findOne({
        phone,
        created_at: { $gte: new Date(Date.now() - 30000) },
      });

      if (recentOtp) {
        print("OTP request too soon for phone:", phone);
        res.status(400);
        throw new Error("Please wait before requesting a new OTP.");
      }

      await Otp.deleteMany({ phone });
      const generatedOtp = generateOTP({ phone });
      await Otp.create({ phone, otp: generatedOtp, ipAddress: getIpAddress(req) || "0.0.0.0" });
      sendSMS(phone, generatedOtp);

      print("OTP sent to phone:", phone, "OTP:", generatedOtp);
      return successHandler(req, res, {
        Remarks: "OTP Sent Successfully",
        ResponseStatus: 3,
        Otp: generatedOtp,
      });
    }

    // ---- OTP Verify / Login ----
    if (!findLOGINService?.status) {
      print("Login service is disabled");
      res.status(400);
      throw new Error("Login is Temporarely Closed 😞");
    }

    const foundOTP = await Otp.findOne({ phone, otp });
    if (!foundOTP) {
      print("Invalid OTP attempt for phone:", phone);
      res.status(400);
      throw new Error("Invalid OTP provided.");
    }

    // Check OTP expiry (5 mins)
    if (foundOTP.created_at < new Date(Date.now() - 300000)) {
      print("OTP expired for phone:", phone);
      await Otp.deleteOne({ _id: foundOTP._id });
      res.status(400);
      throw new Error("OTP has expired. Please request a new one.");
    }

    await Otp.deleteOne({ _id: foundOTP._id });
    const findUser = await User.findOne({ phone });

    if (findUser) {
      findUser.deviceToken = deviceToken;
      await findUser.save();
    }
    // User login
    if (findUser) {
      if (!findUser.status) {
        print("Deactivated account login attempt for phone:", phone);
        res.status(400);
        throw new Error("Your account has been deactivated. Contact support.");
      }

      const token = jwt.sign({ _id: findUser._id }, JWT_SECRET);
      print("User logged in successfully:", findUser.firstName);
      return successHandler(req, res, {
        message: "Login Successful1",
        ResponseStatus: 2,
        AccessToken: token,
      });
    }

    // Only OTP verified
    print("OTP verified for phone:", phone);
    return successHandler(req, res, {
      Remarks: "OTP Verified Successfully",
      ResponseStatus: 1,
    });
  }
});

// ==================== USER LOGOUT CONTROLLER ====================
const logout = asyncHandler(async (req, res) => {
  const userId = req.data?._id;

  if (userId) {
    const user = await User.findById(userId);

    if (user) {
      user.deviceToken = null;
      await user.save();
      print("User logged out successfully:", user.firstName);
    } else {
      print("Logout called but user not found");
    }
  } else {
    print("Logout called without userId");
  }

  // ✅ ALWAYS return success
  return successHandler(req, res, {
    Remarks: "Logout Successfully",
  });
});


















module.exports = {
  userSignUp,
  logout
};
