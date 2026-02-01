const mongoose = require("mongoose");
const { Schema } = mongoose;

const circleList = new Schema(
    {
        cyrus_circlecode: { type: String, required: true  },
        egpayment_circlecode: { type: String, required: true  },
        ezytm_circlecode: { type: String, required: true  },
        a1_circlecode: { type: String, required: true  },
        planapi_circlecode: { type: String, required: true  },
        Mobikwik_circlecode: { type: String, required: true  },
        circlename: { type: String, required: true  },
    },

    { timestamps: true }
);
module.exports = mongoose.model("CircleList", circleList);