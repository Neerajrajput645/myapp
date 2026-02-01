const mongoose = require("mongoose");

// Validate Mongoose ID
const validMongooseId = (res, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid mongoose Id");
  } else {
    return id;
  }
};

module.exports = validMongooseId;
