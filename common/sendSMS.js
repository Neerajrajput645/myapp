const axios = require("axios");

const sendSMS = async (phoneNumber, message) => {
  try {
    const response = await axios.post(
      `https://sms.renflair.in/V1.php?API=${process.env.RENFLAIR_KEY}&PHONE=${phoneNumber}&OTP=${message}`
    );
    const responseData = response.data;
    return responseData;
  } catch (error) {
    throw error;
  }
};

module.exports = sendSMS;
