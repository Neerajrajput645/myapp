const mongoose = require("mongoose");
const { Schema } = mongoose;

const operatorDataSchema = new Schema(
    {
        Ezytm_Operator_code: { type: String, required: true  },
        Egpayment_Operator_code: { type: String, required: true  },
        Cyrus_Operator_code: { type: String, required: true  },
        A1_Operator_code: { type: String, required: true  },
        PlanApi_Operator_code: { type: String, required: true  },
        Billhub_Operator_code: { type: String, required: true  },
        Mobikwik_Operator_code: { type: String, required: true  },
        Operator_name: { type: String, required: true  },
        com_name: { type: String, required: true  },
        img_url: { type: String, required: true  },
        status: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("OperatorData", operatorDataSchema);