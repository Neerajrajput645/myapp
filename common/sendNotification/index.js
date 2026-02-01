const { sendNotify } = require("../../controllers/notification")

const sendNotification = async (data, deviceToken) => {
  await sendNotify(data, deviceToken)
}

module.exports = sendNotification;
