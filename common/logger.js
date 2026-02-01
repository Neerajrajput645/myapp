const winston = require("winston");
const fs = require('fs');
const path = require('path');

const errorLogger = new winston.Logger({
  level: "error",
  transports: [
    new winston.transports.File({
      filename: "error.log",
      format: winston.format.combine(
        winston.format.timestamp(), // Add a timestamp to the log
        winston.format.printf(({ timestamp, level, message }) => {
          // Format the log entry with timestamp and message
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
    }),
  ],
});

const successLogger = new winston.Logger({
  level: "info",
  transports: [
    new winston.transports.File({
      filename: "success.log",
      format: winston.format.combine(
        winston.format.timestamp(), // Add a timestamp to the log
        winston.format.printf(({ timestamp, level, message }) => {
          // Format the log entry with timestamp and message
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
    }),
  ],
});


const saveLog = (
  apiName,
  url,
  requestBody,
  responseBody,
  additionalInfo = {}
) => {
  const logEntry = {
    LogTime: new Date().toISOString(),
    API_Name: apiName,
    API_Endpoint: url,
    Request_Data: requestBody,
    Response_Data: responseBody,
    Additional_Info: additionalInfo,
  };

  // Create /logs directory if not exists
  const logDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  // File name will be based on API name
  const logFilePath = path.join(
    logDir,
    `${apiName.replace(/\s+/g, "_")}_logs.json`
  );

  // Read existing logs if any
  let existingLogs = [];
  if (fs.existsSync(logFilePath)) {
    try {
      existingLogs = JSON.parse(fs.readFileSync(logFilePath));
    } catch (err) {
      console.error(`Error parsing log file: ${logFilePath}`, err);
    }
  }

  // Append new entry and save
  existingLogs.push(logEntry);
  fs.writeFileSync(logFilePath, JSON.stringify(existingLogs, null, 2));
};

module.exports = { errorLogger, successLogger, saveLog };
