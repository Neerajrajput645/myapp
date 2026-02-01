const fs = require("fs");

const deletePreviousImage = (filePath) => {
  fs.unlink(filePath, function (_) {
    console.log("File deleted!");
  });
};

module.exports = deletePreviousImage;
