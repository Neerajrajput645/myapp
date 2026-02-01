const CircleList = require("../models/circleList");
const Service = require("../models/serviceSchema");
const Wallet = require("../models/walletSchema");
// const sendNotification = require("../common/sendNotification");
const getIpAddress = require("../common/getIpAddress");
const normalizedMobileNumber = require("../common/mobileNumberValidation");
const logger = require("../utils/logger");
const print = require("../common/printLog");
const successHandler = require("../common/successHandler");
const mobileTypeCheck = require("../mobileTypeCheck.json");
const asyncHandler = require("express-async-handler");
const axios = require("axios");
// const express = require("express");
// const fs = require("fs");
// const path = require("path");
// const moment = require("moment");
// const User = require("../models/userSchema");
// const BBPS = require("../models/service/bbps");
// const DTH = require("../models/service/dthSchema");
const Recharge = require("../models/service/rechargeSchema");
// const Notification = require("../models/notificationSchema");
// const Commission = require("../models/newModels/commission");
const Transaction = require("../models/txnSchema");
const CryptoJS = require("crypto-js");
const OperatorData = require("../models/operatorData");
// const rechargeApiProviderSchema = require("../models/service/rechargeApiProviderSchema");
// const {
//     All_Recharge_Operator_List,
//     All_Recharge_Circle_List,
//     All_DTH_Recharge_Operator_List,
// } = require("../utils/MockData");
const {
    paywithWallet,
    handleRefund,
    handleCashback,
    handleDisputeRefund,
} = require("../controllers/payment");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
// const nodemailer = require("nodemailer");
const Users = require("../models/userSchema");
// const RechargeOperator = require("../models/service/rechargeOperatorSchema");
// const rechargeOperatorSchema = require("../../models/service/rechargeOperatorSchema");
// const { saveLog } = require("../common/logger");
// const {
//     // MobikwikCheckSumGenerate,
//     parseXMLToJSON,
// } = require("../../common/PayuHashGenerate");
// const crypto = require("crypto");


// =================== Mobile Recharge Operator & Circle Fetch ===================
const operatorCircleByPhone = asyncHandler(async (req, res) => {
    console.log("------------------Mobile operator details fetch ----------------");
    const { phone } = req.query;
    print(`${phone} - Fetching operator & circle`);
    if (!phone) {
        print(`${phone} - Phone number not found in request`);
        res.status(400);
        throw new Error("Phone number is required");
    }
    let response = await axios.get(
        `http://planapi.in/api/Mobile/OperatorFetchNew?ApiUserID=${process.env.PLAN_API_USER_ID}&ApiPassword=${process.env.PLAN_API_PASSWORD}&Mobileno=${phone}`
    );
    if (response.data.ERROR == 1) {
        print(`${phone} - Operator & Circle Fetch Failed: ${response.data.Message}`);
        logger.error(`${phone} - Operator & Circle Fetch Failed: ${response.data.Message} \nRow Response: ${JSON.stringify(response.data)}`);
        res.status(400);
        throw new Error(response.data.Message);
    }
    if (response.data.STATUS == 3) {
        print(`${phone} - Operator & Circle Fetch Failed: ${response.data.Message}`);
        logger.error(`${phone} - Operator & Circle Fetch Failed: ${response.data.Message} \nRow Response: ${JSON.stringify(response.data)}`);
        res.status(400);
        throw new Error(response.data.Message);
    } else {
        const operatorTypeFilter = mobileTypeCheck
            .filter(a => a.op_code === response.data.op_code)
            .map(a => a.type);
        response.data.operatorType = operatorTypeFilter.length > 0 ? operatorTypeFilter[0] : "N/A";
        response.data.Mobile = normalizedMobileNumber(response.data.Mobile);
        print(`${phone} - Operator & Circle Fetch Success`);
        print("------------------Mobile operator details fetch end ----------------");
        successHandler(req, res, {
            Remarks: "Operator & Circle Fetch Success",
            Data: response.data,
        });
    }
});

// ============================== Mobile Recharge ================================
const planFetch = asyncHandler(async (req, res) => {
    try {
        print("------------------- Mobile Plans Fetch start -------------------");
        const MobileNumber = normalizedMobileNumber(req.query?.MobileNumber);
        const { Operator_Code: operatorCode, Circle_Code: circleCode } = req.query;
        print(`${MobileNumber} - planFetch called with`, { MobileNumber, operatorCode, circleCode });
        // find operator & circle
        const [findOp, findCir] = await Promise.all([
            OperatorData.findOne({ PlanApi_Operator_code: operatorCode }),
            CircleList.findOne({ planapi_circlecode: circleCode })
        ]);
        if (!findCir || !findOp) {
            print(`${MobileNumber} - Invalid Operator or Circle`, { operatorCode, circleCode });
            res.status(400);
            throw new Error("Invalid Operator or Circle");
        }
        const plans = await axios.get(
            `http://planapi.in/api/Mobile/Operatorplan?
      apimember_id=${process.env.PLAN_API_USER_ID}&
      api_password=${process.env.PLAN_API_PASSWORD}&
      cricle=${findCir.planapi_circlecode}&
      operatorcode=${findOp.PlanApi_Operator_code}`
        );

        // if error
        if (plans.data.STATUS != 0) {
            print(MobileNumber + " - Error fetching plans", { response: plans.data });
            logger.error(MobileNumber + " - Error fetching plans: " + (plans.data?.MESSAGE || "Errors in Plan Fetching"), { response: plans.data });
            res.status(400);
            throw new Error(plans.data?.MESSAGE || "Errors in Plan Fetching");
        }

        const flattenRDATA = (data) => {
            let result = [];
            for (let key in data) {
                if (Array.isArray(data[key])) {
                    result = result.concat(data[key]);
                }
            }
            return result;
        };

        const flattenedArray = flattenRDATA(plans?.data.RDATA);

        if (["Airtel", "VI"].includes(findOp.Operator_name)) {
            // Fetch ROFFER data
            const rofferResponse = await axios.get(
                `http://planapi.in/api/Mobile/RofferCheck?
        apimember_id=${process.env.PLAN_API_USER_ID}&
        api_password=${process.env.PLAN_API_PASSWORD}&
        operator_code=${findOp.PlanApi_Operator_code}&
        mobile_no=${MobileNumber}`
            );

            const rofferData = rofferResponse.data.RDATA.map((roffer) => ({
                Type: "roffer",
                rs: parseInt(roffer.price, 10),
                validity: "N/A",
                desc: `${roffer.logdesc} | ${roffer.ofrtext}`,
            }));

            // Create a map for ROFFER data based on 'rs' (price)
            const rofferMap = new Map(
                rofferData.map((roffer) => [roffer.rs, roffer])
            );

            // Replace overlapping plans and combine unique ROFFER plans
            const mergedPlans = flattenedArray.map((plan) =>
                rofferMap.has(plan.rs) ? rofferMap.get(plan.rs) : plan
            );

            rofferData.forEach((roffer) => {
                if (!mergedPlans.some((plan) => plan.rs === roffer.rs)) {
                    mergedPlans.push(roffer); // Add unique ROFFER plans
                }
            });

            print(MobileNumber + " - Plans fetched and merged successfully", { totalPlans: mergedPlans.length });
            // success respond
            print("------------------- Mobile Plans Fetch end -------------------");
            successHandler(req, res, {
                Remarks: "All plans",
                image: findOp.img,
                Data: mergedPlans,
            });
        } else {
            print(MobileNumber + " - Plans fetched successfully", { totalPlans: flattenedArray.length });

            print("------------------- Mobile Plans Fetch end -------------------");
            successHandler(req, res, {
                Remarks: "All plans",
                image: findOp.img,
                Data: flattenedArray,

            });
        }

    }
    catch (error) {
        print("Error in planFetch:", error.message);
        logger.error("Error in planFetch: " + (error.message || JSON.stringify(error)));
        res.status(500);
        throw new Error(error.message || "Unable to fetch mobile plans");
    }
});

// ----------------------- Recharge API Call ----------------------
async function callRechargeAPI(findOp, findCir, number, amount, txnId, isPrepaid) {
    if (findOp.api_provider === "Billhub") {
        return axios.post("https://api.techember.in/app/recharges/main.php", {
            token: process.env.BILLHUB_TOKEN,
            number,
            op_uid: findOp.Billhub_Operator_code,
            amount,
            order_id: txnId,
            type: isPrepaid ? "prepaid" : "postpaid",
            circle: findCir.planapi_circlecode,
        });
    }

    if (findOp.api_provider === "eztym") {
        return axios.get("https://api.roboticexchange.in/Robotics/webservice/GetMobileRecharge", {
            params: {
                Apimember_id: process.env.EZYTM_API_MEMBER_ID,
                Api_password: process.env.EZYTM_API_PASSWORD,
                Mobile_no: number,
                Operator_code: findOp.Ezytm_Operator_code,
                Amount: amount,
                Member_request_txnid: txnId,
                Circle: findCir.Ezytm_Circle_code,
            },
            timeout: 30000,
        });
    }

    throw new Error("Unsupported API Provider");
}


// ----------------------- Process API Response ----------------------
function processApiResponse(provider, response) {
    const data = response?.data || {};
    let status = "unknown";
    let operatorRef = 0;

    if (provider === "eztym") {
        status = { 1: "success", 2: "pending", 3: "failed" }[data.STATUS] || "unknown";
        operatorRef = data.OPTRANSID || 0;
    } else if (provider === "Billhub") {
        status = data.status?.toLowerCase() || "unknown";
        operatorRef = data.operator_ref_id || 0;
    }

    return { status, operatorRef, raw: data };
}


// ----------------------- Safe Refund Handler ----------------------
async function safeRefund({ walletDebited, paymentVerified, rechargeDoc, transactionId }) {
    try {
        if (walletDebited) {
            print("Refunding wallet for txn:", transactionId);
            await refundWallet(transactionId);
        }

        if (paymentVerified) {
            print("Marking UPI refund required for txn:", transactionId);
            await markUpiRefundRequired(transactionId);
        }

        if (rechargeDoc) {
            rechargeDoc.status = "refund";
            await rechargeDoc.save();
        }
    } catch (err) {
        logger.error("REFUND_FAILED", { transactionId, error: err.message });
    }
}


// ======================= New Mobile Recharge =======================
const mobileRecharge = asyncHandler(async (req, res) => {
    print("---- Mobile Recharge Start ----");

    let walletDebited = false;
    let paymentVerified = false;
    let transactionId;
    let rechargeDoc;

    try {
        const { _id, deviceToken, mPin: encryptedPin, firstName } = req.data;
        const { number, amount: txnAmount, operator, circle, type, mPin, isPrepaid } = req.query;
        const amount = Number(txnAmount);
        const ipAddress = getIpAddress(req);
        transactionId = req.query?.ord || req.body?.ord || genTxnId();

        if (!number || !amount || amount <= 0 || !operator || !circle)
            throw new Error("Invalid request parameters");

        const [service, user, wallet] = await Promise.all([
            Service.findOne({ name: "Recharge" }),
            Users.findById(_id),
            Wallet.findOne({ userId: _id }),
        ]);

        if (!service?.status || !user?.status || !user?.recharge)
            throw new Error("Recharge service unavailable");

        const [findOp, findCir] = await Promise.all([
            OperatorData.findOne({ PlanApi_Operator_code: operator }),
            CircleList.findOne({ planapi_circlecode: circle })
        ]);

        if (!findOp || !findCir)
            throw new Error("Invalid Operator or Circle");

        /* ---------------- PAYMENT SECTION ---------------- */

        if (type === "wallet") {
            print(number, "- Wallet payment flow");

            if (!wallet || wallet.balance < amount)
                throw new Error("Insufficient wallet balance");

            const decrypted = CryptoJS.AES.decrypt(encryptedPin, CRYPTO_SECRET).toString(CryptoJS.enc.Utf8);
            if (mPin?.toString() !== decrypted)
                throw new Error("Wrong mPin");

            const payRes = await paywithWallet({
                body: { orderId: transactionId, txnAmount: amount, txnId: transactionId, serviceId: service._id, userId: _id, ipAddress }
            });

            if (payRes?.ResponseStatus !== 1)
                throw new Error("Wallet debit failed");

            walletDebited = true;
        }

        else if (type === "upi") {
            print(number, "- UPI payment verification flow");

            const txn = await Transaction.findOne({ transactionId, status: "success", amount, userId: _id });
            if (!txn) throw new Error("Invalid or unpaid transaction");

            paymentVerified = true;
        }

        /* ---------------- CREATE RECHARGE ENTRY ---------------- */

        rechargeDoc = await Recharge.create({
            userId: _id,
            number,
            operator: findOp.PlanApi_Operator_code,
            circle: findCir.planapi_circlecode,
            amount,
            transactionId,
            status: "initiated",
            ipAddress,
            provider: findOp.api_provider,
            isPrepaid: parseBoolean(isPrepaid),
        });

        /* ---------------- CALL RECHARGE API ---------------- */

        const apiResponse = await callRechargeAPI(findOp, findCir, number, amount, transactionId, isPrepaid);
        const { status, operatorRef, raw } = processApiResponse(findOp.api_provider, apiResponse);

        rechargeDoc.status = status;
        rechargeDoc.operatorRef = operatorRef;
        rechargeDoc.rawResponse = raw;
        await rechargeDoc.save();

        logger.info("RECHARGE_API_LOG", { apiResponse: raw, status, transactionId });

        /* ---------------- HANDLE STATUS ---------------- */

        if (status === "pending") {
            return successHandler(req, res, { Remarks: "Recharge Pending", Data: { status: "PENDING" } });
        }

        if (status === "failed") {
            await safeRefund({ walletDebited, paymentVerified, user, wallet, amount, transactionId, ipAddress });
            return successHandler(req, res, { ResponseStatus: 0, Remarks: "Recharge Failed & Refunded" });
        }

        /* ---------------- CASHBACK ---------------- */
        await processCashback(user, findOp, amount, transactionId, ipAddress);

        /* ---------------- NOTIFICATION ---------------- */
        await sendRechargeNotification(user._id, deviceToken, amount, status);

        return successHandler(req, res, {
            Remarks: `Recharge ${status}`,
            Data: { status: capitalize(status), transactionId, operator_ref_id: operatorRef }
        });

    } catch (error) {
        print("Recharge Error:", error.message);

        logger.error("MOBILE_RECHARGE_ERROR", { error: error.message, transactionId });

        await safeRefund({ walletDebited, paymentVerified, rechargeDoc, transactionId });

        return errorHandler(req, res, error);
    }
});


module.exports = {
    operatorCircleByPhone,
    planFetch,
    mobileRecharge,
};