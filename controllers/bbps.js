const axios = require("axios");
const asyncHandler = require("express-async-handler");
const Commission = require("../models/newModels/commission");
const Txn = require("../models/txnSchema");
const User = require("../models/userSchema");
const bbps = require("../models/service/bbps");
const Wallet = require("../models/walletSchema");
const Service = require("../models/serviceSchema");
const successHandler = require("../common/successHandler");
const Notification = require("../models/notificationSchema");
const sendNotification = require("../common/sendNotification");
const getIpAddress = require("../common/getIpAddress");
const CryptoJS = require("crypto-js");
const { paywithWallet, handleRefund, handleCashback } = require("./payment");
const Users = require("../models/userSchema");
const { saveLog } = require("../common/logger");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
const print = require("../common/printLog");
const logger = require("../utils/logger");


const GAS_NOT_ALLOWED_OPERATORS = [
  1127,
  1132,
  1141,
  1152,
  1153,
  1188,
  1154,
  1162,
  1186,
  1182,
  1189,
  1198,
  1199,
  1190,
  1192,
  1208,
  1218,
  1220,
  1226,
  1227,
  1228,
  1233,
  1234,
  1209,
  1198,
  1187
  // add more unwanted operator codes here
];



const bbpsOperatorList = asyncHandler(async (req, res) => {
  print("bbpsOperatorList Request Received");
  try {
    const { serviceId } = req.query;

    if (!serviceId) {
      print("bbpsOperatorList Error: Missing serviceId");
      logger.error("bbpsOperatorList Error: Missing serviceId");
      throw new Error("Please provide serviceId");
    }

    // Step 1: Find the service
    const service = await Service.findById(serviceId);
    if (!service) {
      print("bbpsOperatorList Error: Service not found for ID", serviceId);
      logger.error("bbpsOperatorList Error: Service not found for ID", { serviceId });
      throw new Error("Service not found");
    }

    print("bbpsOperatorList: Found service", service.name);
    logger.info("bbpsOperatorList: Found service", { serviceName: service.name });
    // Step 2: Fetch all operators
    const response = await axios.get("https://api.techember.in/app/bbps-operators.php");
    if (response.data.status !== "success" || !Array.isArray(response.data.data)) {
      throw new Error("Invalid operator data format from API");
    }

    const allOperators = response.data.data;

    // Step 3: Match our service to BBPS category
    const findBillhubCategory = BBPS_CATEGORY_ARRAY.find(
      (a) => a.bbps_category.toLowerCase() === service.name.toLowerCase()
    );

    if (!findBillhubCategory) {
      print("bbpsOperatorList Error: No BBPS category found for service", service.name);
      logger.error("bbpsOperatorList Error: No BBPS category found for service", { serviceName: service.name });
      throw new Error(`No BBPS category found for ${service.name}`);
    }

    // Step 4: Filter operators by matched category
    const filteredOperators = allOperators.find(
      (op) => op.categoryId.toLowerCase() === findBillhubCategory.billhub_category.toLowerCase()
    );

    if (!filteredOperators || !filteredOperators.providerRoot) {
      print("bbpsOperatorList Error: No operators found for service", service.name);
      logger.error("bbpsOperatorList Error: No operators found for service", { serviceName: service.name });
      throw new Error(`No operators found for ${service.name}`);
    }

    // Step 5: Format provider list
    let DATA_ARRAY = [];

    if (service.name.toLowerCase() !== "fastag") {
      filteredOperators.providerRoot.forEach((item) => {
        if (item?.billers?.length) {
          const biller = item.billers[0];
          DATA_ARRAY.push({
            categoryId: filteredOperators.categoryId,
            op_id: biller.op,
            operator_name: item.name,
            regex: biller.fields?.[0]?.regex || "",
            displayname: biller.fields?.[0]?.name || "",
            icon: biller.icon || "",
            ad: "",
          });
        }
      });
    } else {
      // Fastag structure
      filteredOperators.providerRoot.forEach((item) => {
        if (Array.isArray(item.providers)) {
          item.providers.forEach((provider) => {
            const biller = item.billers?.[0];
            DATA_ARRAY.push({
              categoryId: filteredOperators.categoryId,
              op_id: biller?.op || "",
              operator_name: provider.operator_name,
              regex: provider.regex,
              displayname: provider.name,
              icon: provider.icon || "",
              ad: provider.ad1 || "",
            });
          });
        }
      });
    }

    // ------------------------------------------------------
    // ⭐ NEW: GAS Operator Blacklist Filtering
    // ------------------------------------------------------
    if (service.name.toLowerCase() === "gas") {
      DATA_ARRAY = DATA_ARRAY.filter(
        (op) => !GAS_NOT_ALLOWED_OPERATORS.includes(op.op_id)
      );
    }
    // ------------------------------------------------------

    // Step 6: Return the result
    print("bbpsOperatorList: Successfully fetched operators for service", service.name);
    logger.info("bbpsOperatorList: Successfully fetched operators for service", { serviceName: service.name, operatorCount: DATA_ARRAY.length });
    return successHandler(req, res, {
      Remarks: "Operator list fetched successfully",
      Data: DATA_ARRAY,
    });
  } catch (error) {
    print("bbpsOperatorList Error:", error.message);
    logger.error("bbpsOperatorList Error:", { message: error.message });
    throw new Error(error.message || "Error fetching BBPS operator list");
  }
});


const bbpsBillFetch = asyncHandler(async (req, res) => {
  print("BBPS Bill Fetch Request Received");
  logger.info("BBPS Bill Fetch Request Received", { body: req.body });
  try {
    const { number, operator, ad1, ad, cn } = req.body;
    print("BBPS Bill Fetch Request Body:", req.body);
    logger.info("BBPS Bill Fetch Request Body:", { body: req.body });

    if (!number || !operator) {
      print("BBPS Bill Fetch Error: Number and operator are required");
      logger.error("BBPS Bill Fetch Error: Number and operator are required");
      return errorHandler(req, res, "Number and operator are required", 400);
    }

    // Construct URL with optional params only if present
    let url = `https://api.techember.in/app/bbps-bill-fetch.php`

    const bodyData = {
      number,
      operator,
    };
    if (ad1) bodyData.ad1 = ad1;
    if (ad) bodyData.ad = ad;
    if (cn) bodyData.cn = cn;
    print("BBPS Bill Fetch Request URL:", url, "Body:", bodyData);
    logger.info("BBPS Bill Fetch Request URL and Body", { url, body: bodyData });

    const response = await axios.post(url, bodyData);
    print("BBPS Bill Fetch Response:", response.data);
    logger.info("BBPS Bill Fetch Response:", { data: response.data });

    return successHandler(req, res, {
      Remarks: response.data.message || "Bill info fetched successfully",
      Data: response.data,
    });
  } catch (error) {
    print("BBPS Bill Fetch Error:", error.message || error.response?.data);
    if (error.response?.data?.message === "Unable to get bill details from biller") {
      logger.error("BBPS Bill Fetch Error: Wrong Number or Operator", { error: error.response?.data });
      throw new Error("Wrong Number or Operator");
    }
    logger.error("BBPS Bill Fetch Error:", { message: error.message || error.response?.data });
    throw new Error(error.response?.data?.message || "Error fetching BBPS bill details");
  }
});


const bbpsBillRecharge = asyncHandler(async (req, res) => {
  print("BBPS Bill Recharge Request Received");
  logger.info("BBPS Bill Recharge Request Received", { body: req.body });
  try {
    const { _id, deviceToken } = req.data;
    // Dont Send TXN ID Fronend
    const { number, operatorCode, amount, serviceId, mPin, operatorName, operatorCategory, billDetails, ord } = req.body;
    const { type } = req.query;
    const TxnAmount = Number(amount);
    const ipAddress = getIpAddress(req);
    if (!serviceId) {
      print("BBPS Bill Recharge Error: Missing serviceId");
      logger.error("BBPS Bill Recharge Error: Missing serviceId");
      return res.status(400).json({
        Error: true,
        Success: true,
        ResponseStatus: 0,
        message: "Please provide required fields"
      });
    }
    const findService = await Service.findOne({ _id: serviceId });
    // Check if service is active
    if (!findService?.status) {
      print("Service is temporarily down:", findService ? findService.name : "Service");
      logger.error("Service is temporarily down:", { serviceName: findService ? findService.name : "Service" });
      return res.status(400).json({
        ResponseStatus: 0,
        Success: false,
        Error: true,
        message: `${findService ? findService.name : "Service"
          } is Temporarily Down`,
      });

    }
   
    const FindUser = await Users.findOne({ _id });
    if (!FindUser?.bbps) {
      print("BBPS Bill Recharge Error: Service unavailable for user");
      logger.error("BBPS Bill Recharge Error: Service unavailable for user", { userId: _id });
      return res.status(400).json({
        Error: true,
        Success: false,
        ResponseStatus: 0,
        message: `This service is Temporarily Down`,
      });
    }

    // Amount validation
    if (TxnAmount <= 0) {
      print("BBPS Bill Recharge Error: Amount should be positive");
      logger.error("BBPS Bill Recharge Error: Amount should be positive", { amount: TxnAmount });
      return res.status(400).json({
        Error: true,
        Success: false,
        ResponseStatus: 0,
        message: `Amount should be positive.`,
      });
    }
    const walletFound = await Wallet.findOne({ userId: _id });
    const transactionId = ord;

    if (type === "wallet") {
      const decryptMpin = CryptoJS.AES.decrypt(
        req.data.mPin,
        CRYPTO_SECRET
      ).toString(CryptoJS.enc.Utf8);
      if (mPin.toString() !== decryptMpin) {
        print("Wrong MPIN")
        logger.error("Wrong MPIN", { userId: _id });
        return res.status(400).json({
          Error: true,
          Success: false,
          ResponseStatus: 0,
          message: `Please enter a valid mPin.`
        });
      }
      
      if (walletFound.balance < TxnAmount) {
        print("Insufficient balance")
        logger.info("Insufficient balance", { userId: _id, walletBalance: walletFound.balance, requiredAmount: TxnAmount });
        return res.status(400).json({
          Error: true,
          Success: false,
          ResponseStatus: 0,
          message: `Insufficient balance.`,
        });
      }
    }
    // Wallet Deduction Start -------------------

    let res1 = {
      ResponseStatus: 1
    };
    if (type === "wallet") {
      const body = {
        orderId: transactionId,
        txnAmount: TxnAmount,
        txnId: transactionId,
        serviceId,
        mPin,
        userId: _id,
        ipAddress,
      };
      
      res1 = await paywithWallet({ body });
    }
    console.log("step-13 ", res1)
    // Wallet Deduction End --------------------------
    if (res1.ResponseStatus === 1) {
      console.log("step-14")
      const newService = new bbps({
        userId: FindUser._id,
        number,
        operator: operatorName,
        operatorName: operatorCategory,
        circle: null,
        amount: TxnAmount,
        serviceId: findService._id,
        transactionId,
        status: "PENDING",
        operatorRef: 0,
        apiTransID: 0,
        ipAddress,
      });
      console.log("step-15", newService);
      await newService.save();
      try {
        console.log("step-16")
        const payload = {
          operator: {
            name: operatorName,
            category: operatorCategory,
            operator_id: operatorCode,
          },
          token: process.env.BILLHUB_TOKEN,
          order_id: transactionId,
          type: operatorCategory,
          amount: TxnAmount,
          number: number,
          op_code: operatorCode,
          // op_uid: operatorCode,
          // circle:"Google Play",
          bill_details: billDetails,
          additional_params: req.body.ad
            ? {
              ad1: req.body.ad,
            }
            : {},
        };

        console.log("BBPS Bill Payment Payload:", payload);
        console.log("step-2", req.body)
        // console.log("request body data ->", payload);
        // const URL = `https://api.billhub.in/reseller/bbps/payment/`;

        const URL = `https://api.techember.in/app/recharges/bill-payment.php`;

        await saveLog(
          `BILL_PAYMENT`,
          URL,
          payload, // or full request payload
          null,
          `Bill Payment Request Initiated for TxnID: ${transactionId}`
        );
        console.log("payload ->", payload);

        const response = await axios.post(URL, payload);
        // const response = {
        //   data: {
        //     status: 'success',
        //     order_id: '1762671148848568',
        //     margin: '0.8250',
        //     margin_percentage: '0.1283',
        //     operator_ref_id: null
        //   }
        // }
        console.log("response ->", response.data);
        await saveLog(
          `BILL_PAYMENT`,
          URL,
          payload, // or full request payload
          response.data,
          `Bill Payment Response Status : ${response.data.status} for TxnID: ${transactionId}`
        );
        if (!response.data) {
          successHandler(req, res, {
            message: `Your ${findService.name} is Pending`,
            Data: { status: "PENDING" },
          });
        }

        newService.status = response.data.status?.toLowerCase();
        newService.operatorRef = response.data.operator_ref_id || 0;
        newService.apiTransID = response.data.order_id || 0;
        await newService.save();
        const status = response.data.status?.toLowerCase();
        if (status == "failed") {
          // Start Refund-------------------------------------------------
          await handleRefund(
            FindUser,
            TxnAmount,
            transactionId,
            ipAddress,
            walletFound
          );
          // End Refund ------------------------------------------------------------------
          return res.status(400).json({
            Error: true,
            Success: false,
            ResponseStatus: 0,
            message: `Recharge Failed, Please Try Again`,
          });
        }
        if (status === "success" && findService.percent > 0) {
          console.log("Cashback Process Started", operatorCategory);

          const cashback = await Commission.findOne({
            status: true,
            name: { $regex: `^${operatorCategory}$`, $options: "i" }
          });

          console.log("cashback ->", cashback);

          if (!cashback) {
            console.log("No cashback commission found. Skipping cashback.");
          } else {
            let cashbackAmount = 0;

            const findValue = cashback?.commission || 0;
            console.log("Commission Value ->", findValue, "Symbol ->", cashback.symbol);

            // ✅ SYMBOL BASED CASHBACK LOGIC
            if (cashback.symbol === "%") {
              cashbackAmount = (TxnAmount / 100) * findValue;
              cashbackAmount = parseFloat(cashbackAmount.toFixed(2));
              console.log("Percentage Cashback Applied ->", cashbackAmount);
            }
            else if (cashback.symbol === "₹") {
              cashbackAmount = parseFloat(findValue.toFixed(2));
              console.log("Flat Cashback Applied ->", cashbackAmount);
            }
            else {
              cashbackAmount = 0;
              console.log("Invalid cashback symbol. Cashback skipped.");
            }

            // ✅ Credit cashback only if valid amount
            if (cashbackAmount > 0) {
              await handleCashback(
                FindUser,
                cashbackAmount,
                transactionId,
                ipAddress,
                walletFound
              );
            } else {
              console.log("Cashback amount is 0. Nothing credited.");
            }
          }
        }

        const notification = {
          title: `${findService.name} Payment is ${status}`,
          body: `Your ₹${TxnAmount} ${findService.name} is ${status}`,
        };
        const newNotification = new Notification({
          ...notification,
          recipient: _id,
        });
        await newNotification.save();
        if (deviceToken) {
          sendNotification(notification, deviceToken);
        }

        // sendEmail(req.data, "SERVICE_RECEIPT", {
        //   ...newService,
        //   operatorName: operator.name,
        //   serviceName: findService.name,
        // });
        //   const value = {
        //     operatorName: findOperator?.Operator_name,
        //     serviceName: "Mobile Recharge",
        //     TransID: transactionId,
        //     currentDate: new Date(), // Get the current date
        //     number: number,
        //     amount: amount,
        //     operatorRef: rechargeRe.data.operator_ref_id,
        //   };
        //   const doc = createHtmlToPdf(req.data, value);
        //   newService.receipt = doc;
        //   await newService.save();
        // Success response
        function capitalize(word) {
          if (!word) return ""; // अगर स्ट्रिंग खाली हो
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        successHandler(req, res, {
          message: `Your ${findService.name} is ${status}`,
          Data: {
            status: capitalize(status),
            transactionId: newService.transactionId,
            operator_ref_id: response.data.operator_ref_id,
          },
        });
      } catch (error) {
        console.log("error ->", error.response.data);
        newService.status = "error";
        await newService.save();
        return res.status(400).json({
          Error: true,
          Success: false,
          ResponseStatus: 0,
          message: error.message,
        });
      }
    }
  } catch (error) {
    console.log(error.response.error, "error");
  }
});


const googlePlayPayment = asyncHandler(async (req, res) => {
  // console.log("ds")
  try {
    const { _id, deviceToken } = req.data;
    // Dont Send TXN ID Fronend
    const { number, amount, mPin, ord } = req.body;
    console.log("BILL_PAYMENT req body ->", req.body);
    const { type } = req.query;
    const operatorCode = "google_play";
    const operatorId = 'google_play';
    const circle = 'Google Play';
    const operatorCategory = 'redeem-code';
    const serviceId = "661061ecda6832bf278254e1";
    const operatorName = 'Google Play';
    const transactionId = ord;
    const TxnAmount = Number(amount);
    const ipAddress = getIpAddress(req);
    if (!serviceId) {
      res.status(400).json({
        ResponseStatus: 0,
        message: `Please provide required fields.`,
      }); return;
    }
    const findService = await Service.findOne({ _id: serviceId });
    // Check if service is active
    if (!findService?.status) {
      res.status(400).json({
        ResponseStatus: 0,
        message: `${findService ? findService.name : "Service"
          } is Temporarily Down`,
      });
      return;
    }
    const FindUser = await Users.findOne({ _id });
    if (!FindUser?.bbps) {
      res.status(400).json({
        ResponseStatus: 0,
        message: `This service is Temporarily Down`,
      });
      return;
    }

    // Amount validation
    if (TxnAmount <= 0) {
      res.status(400).json({
        ResponseStatus: 0,
        message: `Amount should be positive.`,
      });
      return; // Exit the function
    }
    const walletFound = await Wallet.findOne({ userId: _id });

    if (type === "wallet") {

      // Decrypt and validate mPin
      const decryptMpin = CryptoJS.AES.decrypt(
        req.data.mPin,
        CRYPTO_SECRET
      ).toString(CryptoJS.enc.Utf8);
      if (mPin.toString() !== decryptMpin) {
        res.status(400).json({
          ResponseStatus: 0,
          message: `Please enter a valid mPin.`,
        });
        return; // Exit the function
      }

      if (walletFound.balance < TxnAmount) {
        res.status(400).json({
          ResponseStatus: 0,
          message: `Insufficient balance.`,
        });
        return; // Exit the function
      }
    }
    // Wallet Deduction Start -------------------
    const body = {
      orderId: transactionId,
      txnAmount: TxnAmount,
      txnId: transactionId,
      serviceId,
      mPin,
      userId: _id,
      ipAddress,
    };
    console.log("step-2")
    const res = {
      ResponseStatus: 1
    }
    if (type === "wallet") {
      res1 = await paywithWallet({ body });
    }
    // Wallet Deduction End --------------------------
    if (res1.ResponseStatus === 1) {
      const newService = new bbps({
        userId: FindUser._id,
        number,
        operator: operatorName,
        operatorName: operatorCategory,
        circle: circle,
        amount: TxnAmount,
        serviceId: findService._id,
        transactionId,
        status: "PENDING",
        operatorRef: 0,
        apiTransID: 0,
        ipAddress,
      });
      await newService.save();
      try {
        const payload = {

          token: process.env.BILLHUB_TOKEN,
          order_id: transactionId,
          type: operatorCategory,
          amount: TxnAmount,
          number: number,
          op_uid: operatorCode,
          circle: circle,
          additional_params: req.body.ad1
            ? {
              ad1: req.body.ad1,
            }
            : {},
        };
        console.log("request body data ->", payload);
        const URL = `https://api.techember.in/app/recharges/main.php`;

        await saveLog(
          `BILL_PAYMENT`,
          URL,
          payload, // or full request payload
          null,
          `Google Play Payment Request Initiated for TxnID: ${transactionId}`
        );

        const response = await axios.post(URL, payload);
        // const response = {
        //   data: {
        //     status: 'success',
        //     order_id: '3903399703',
        //     margin: '0.4000',
        //     margin_percentage: '2.0000',
        //     operator_ref_id: '6FSVYD0T8Z4HRFLX'
        //   }
        // }
        console.log("response ->", response.data);
        await saveLog(
          `BILL_PAYMENT`,
          URL,
          payload, // or full request payload
          response.data,
          `Bill Payment Response Status : ${response.data.status} for TxnID: ${transactionId}`
        );
        console.log("step-2")
        if (!response.data) {
          successHandler(req, res, {
            Remarks: `Your ${findService.name} is Pending`,
            Data: { status: "PENDING" },
          });
        }

        newService.status = response.data.status?.toLowerCase();
        newService.operatorRef = response.data.operator_ref_id || 0;
        newService.apiTransID = response.data.order_id || 0;
        await newService.save();
        const status = response.data.status?.toLowerCase();
        console.log("step-3");
        if (status == "failed") {
          console.log("step-4");
          // Start Refund-------------------------------------------------
          await handleRefund(
            FindUser,
            TxnAmount,
            transactionId,
            ipAddress,
            walletFound
          );
          console.log("step-5");
          // End Refund ------------------------------------------------------------------
          res.status(400).json({
            ResponseStatus: 0,
            message: `Recharge Failed, Please Try Again`,
            data: response.data
          });
          return;
        }
        if (status == "success" && findService.percent > 0) {
          console.log("Cashback Process Started", operatorCategory);
          const cashback = await Commission.findOne({
            name: "Google Play",
            status: true
          });
          console.log("cashback ->", cashback);
          const findPercent = cashback?.commission || 0;
          console.log("findPercent ->", findPercent);
          const cashbackPercent = (TxnAmount / 100) * findPercent;
          console.log("cashbackPercent ->", cashbackPercent);

          await handleCashback(
            FindUser,
            cashbackPercent,
            transactionId,
            ipAddress,
            walletFound
          );
        }

        const notification = {
          title: `${findService.name} Payment is ${status}`,
          body: `Your ₹${TxnAmount} ${findService.name} is ${status}`,
        };
        const newNotification = new Notification({
          ...notification,
          recipient: _id,
        });
        await newNotification.save();
        if (deviceToken) {
          sendNotification(notification, deviceToken);
        }

        // Success response
        function capitalize(word) {
          if (!word) return ""; // अगर स्ट्रिंग खाली हो
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        successHandler(req, res, {
          Remarks: `Your ${findService.name} is ${status}`,
          Data: {
            status: capitalize(status),
            transactionId: newService.transactionId,
            operator_ref_id: response.data.operator_ref_id,
          },
        });
      } catch (error) {
        console.log("error ->", error.response.data);
        newService.status = "error";
        await newService.save();
        res.status(400).json({
          ResponseStatus: 0,
          message: error?.response?.data?.message || "Payment Failed, Please Try Again",
        });
        return;
      }
    }
  } catch (error) {
    res.status(400);
    throw new Error(error?.message || "Something went wrong, Please Try Again");

  }
});


// ======================= Google Play Payment =======================
const googlePlayRecharge = asyncHandler(async (req, res) => {
  print("Google Play Payment Request Received");
  let walletDebited = false;
  let transactionId;

  try {
    const { _id, deviceToken, mPin: encryptedPin } = req.data;
    const ipAddress = getIpAddress(req);
    let { number, amount, mPin, ord } = req.body;
    const { type } = req.query;

    const serviceId = "661061ecda6832bf278254e1";
    const operatorName = "Google Play";
    const operatorCode = "google_play";
    const operatorCategory = "redeem-code";
    const circle = "Google Play";

    const TxnAmount = Number(amount);
    transactionId = ord || genTxnId();

    print("Request Body:", req.body);
    logger.info(`Google Play Payment request for user ${_id}`, { body: req.body });

    // ---------------- Fetch Service & User ----------------
    const [service, user, wallet] = await Promise.all([
      Service.findById(serviceId),
      Users.findById(_id),
      Wallet.findOne({ userId: _id })
    ]);

    if (!service?.status) throw new Error(`${service?.name || "Service"} is temporarily down`);
    if (!user?.bbps) throw new Error("This service is temporarily unavailable for your account");

    // ---------------- Validate Amount ----------------
    if (TxnAmount <= 0) throw new Error("Amount should be positive");

    // ---------------- Wallet Payment ----------------
    if (type === "wallet") {
      if (!encryptedPin) throw new Error("Please set an mPin");

      const decryptedPin = CryptoJS.AES.decrypt(encryptedPin, CRYPTO_SECRET).toString(CryptoJS.enc.Utf8);
      if (mPin?.toString() !== decryptedPin) throw new Error("Invalid mPin entered");

      if (!wallet || wallet.balance < TxnAmount) throw new Error("Insufficient wallet balance");

      const payRes = await paywithWallet({
        body: {
          orderId: transactionId,
          txnAmount: TxnAmount,
          txnId: transactionId,
          serviceId,
          mPin,
          userId: _id,
          ipAddress
        }
      });

      if (payRes?.ResponseStatus !== 1) throw new Error("Wallet debit failed");
      walletDebited = true;
    }

    // ---------------- Record Transaction ----------------
    const newPayment = await bbps.create({
      userId: _id,
      number,
      operator: operatorName,
      operatorName: operatorCategory,
      circle,
      amount: TxnAmount,
      serviceId,
      transactionId,
      status: "PENDING",
      operatorRef: 0,
      apiTransID: 0,
      ipAddress
    });

    // ---------------- Prepare API Request ----------------
    const payload = {
      token: process.env.BILLHUB_TOKEN,
      order_id: transactionId,
      type: operatorCategory,
      amount: TxnAmount,
      number,
      op_uid: operatorCode,
      circle,
      additional_params: req.body.ad1 ? { ad1: req.body.ad1 } : {}
    };

    const URL = "https://api.techember.in/app/recharges/main.php";
    await saveLog("BILL_PAYMENT", URL, payload, null, `Google Play Payment Request Initiated for TxnID: ${transactionId}`);

    const response = await axios.post(URL, payload);
    const resData = response.data || {};
    const status = resData.status?.toLowerCase() || "unknown";

    await saveLog("BILL_PAYMENT", URL, payload, resData, `Response Status: ${status} for TxnID: ${transactionId}`);

    // ---------------- Update Transaction ----------------
    newPayment.status = status;
    newPayment.operatorRef = resData.operator_ref_id || 0;
    newPayment.apiTransID = resData.order_id || 0;
    await newPayment.save();

    // ---------------- Refund if Failed ----------------
    if (["failed", "error", "failure"].includes(status)) {
      if (walletDebited) await handleRefund(user, TxnAmount, transactionId, ipAddress, wallet);
      throw new Error(resData.message || "Payment Failed, Please Try Again");
    }

    // ---------------- Cashback ----------------
    if (status === "success") {
      const commission = await Commission.findOne({ name: operatorName, status: true });
      if (commission && wallet) {
        let cashback = 0;
        if (commission.symbol === "%") cashback = (TxnAmount * commission.commission) / 100;
        else if (commission.symbol === "₹") cashback = commission.commission;

        if (cashback > 0) {
          await handleCashback(user, parseFloat(cashback.toFixed(2)), transactionId, ipAddress, wallet);
        }
      }
    }

    // ---------------- Notifications ----------------
    const notification = {
      title: `${service.name} Payment ${capitalize(status)}`,
      body: `Your ₹${TxnAmount} ${service.name} is ${capitalize(status)}`
    };
    await Notification.create({ ...notification, recipient: _id });
    if (deviceToken) sendNotification(notification, deviceToken);

    // ---------------- Success Response ----------------
    return successHandler(req, res, {
      Remarks: `Your ${service.name} is ${capitalize(status)}`,
      Data: {
        status: capitalize(status),
        transactionId: newPayment.transactionId,
        operator_ref_id: resData.operator_ref_id
      }
    });

  } catch (error) {
    print("Google Play Payment Error:", error.message);
    logger.error("Google Play Payment Error:", { error });

    // Refund if wallet was debited
    if (walletDebited) {
      try {
        await handleRefund(req.data, Number(req.body.amount), transactionId, getIpAddress(req), await Wallet.findOne({ userId: req.data._id }));
        print("Refund processed due to error");
      } catch (refundErr) {
        logger.error("Refund Error:", { refundErr });
      }
    }

    return res.status(400).json({
      Error: true,
      Status: false,
      ResponseStatus: 0,
      StatusCode: "Ex400",
      Remarks: error?.message || "Payment Failed, Please Try Again"
    });
  }
});

// ---------------- Helper ----------------
function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}



// create refund payment bill
const createRefundBillPayment = asyncHandler(async (req, res) => {
  // Requested , Refunded
  const { _id } = req.data;
  const { billId } = req.body;

  if (!billId) {
    res.status(400);
    throw new Error("Please fill all fields");
  }
  const findBill = await bbps.findOne({ _id: billId, userId: _id });

  if (!findBill) {
    res.status(400);
    throw new Error("Please enter valid bill id.");
  }

  if (findBill?.status === "Refunded") {
    res.status(400);
    throw new Error("Already refunded.");
  } else {
    if (findBill) {
      await bbps.updateOne({ _id: billId }, { status: "Requested" });
      successHandler(req, res, { Remarks: "Refund issued success" });
    } else {
      res.status(400);
      throw new Error("Please enter valid bill id.");
    }
  }
});

// get bill refund request
const getRefundBillRequest = asyncHandler(async (req, res) => {
  const list = await bbps.find({ status: "Requested" });
  successHandler(req, res, { Remarks: "All refund requests.", Data: list });
});

// ----------- If bill fail when initiate refund by admin ------------ //
const handleFailedPayments = asyncHandler(async (req, res) => {
  const { billId } = req.body;
  if (!billId) {
    res.status(400);
    throw new Error("Please fill all fields");
  }
  const findBill = await bbps.findOne({ _id: billId });

  if (findBill.status === "Refunded") {
    res.status(400);
    throw new Error("Already refunded.");
  } else {
    if (findBill) {
      const findTxn = await Txn.findOne({
        txnId: findBill.transactionId,
        userId: findBill.userId,
      });
      const userFound = await User.findById(findBill.userId);
      const findService = await Service.findById(findTxn?.serviceId);
      const percent =
        (findTxn.txnAmount / 100) *
        (findTxn.isUsePrime ? 25 : findService.percent);

      // update wallet
      await Wallet.updateOne(
        { userId: findBill.userId },
        {
          $inc: {
            balance: findTxn.txnAmount - percent,
            goPoints: findTxn.isUsePrime ? 0 : percent,
            primePoints: findTxn.isUsePrime ? percent : 0,
          },
        }
      );

      // Push notification
      const notification = {
        title: "Bill Refund",
        body: `Your bill refund ${findTxn.txnAmount} rupay is refunded into wallet.`,
      };
      // save notification
      const newNotification = new Notification({
        ...notification,
        recipient: findBill.userId,
      });
      await newNotification.save();
      userFound.deviceToken &&
        sendNotification(notification, userFound.deviceToken);

      // ----------- Create Txn History ------------- //
      const subtractBalance = new Txn({
        userId: userFound._id,
        recipientId: userFound._id,
        txnName: "Bill Refund",
        txnDesc: "Your bill refund issued.",
        txnAmount: findTxn.txnAmount,
        txnType: "credit",
        txnStatus: "TXN_SUCCESS",
        txnResource: "Wallet",
        txnId: Math.floor(Math.random() * Date.now()) + "refund",
        orderId: Math.floor(Math.random() * Date.now()) + "refund",
        ipAddress: getIpAddress(req),
      });
      await subtractBalance.save(); // wallet balance history
      const subtractGoPoints = new Txn({
        userId: userFound._id,
        recipientId: userFound._id,
        txnName: "Bill Refund",
        txnDesc: "Your bill refund issued.",
        txnType: "credit",
        txnStatus: "TXN_SUCCESS",
        txnResource: findTxn.isUsePrime ? "PrimePoints" : "GoPoints",
        txnId: Math.floor(Math.random() * Date.now()) + "refund",
        orderId: Math.floor(Math.random() * Date.now()) + "refund",
        txnAmount: percent,
        ipAddress: getIpAddress(req),
      });
      await subtractGoPoints.save(); // go points history

      await bbps.updateOne({ _id: billId }, { status: "Refunded" });
      successHandler(req, res, { Remarks: "Refund issued success" });
    } else {
      res.status(400);
      throw new Error("Please enter valid bill id.");
    }
  }
});

const BBPS_CATEGORY_ARRAY = [
  {
    billhub_category: "postpaid",
    bbps_category: "Postpaid",
  },
  {
    billhub_category: "electricity",
    bbps_category: "Electricity",
  },
  {
    billhub_category: "fasTag",
    bbps_category: "Fastag",
  },
  {
    billhub_category: "lpgBooking",
    bbps_category: "LPG",
  },
  {
    billhub_category: "hospitals",
    bbps_category: "Hospital Bills",
  },
  {
    billhub_category: "creditcardpay",
    bbps_category: "Credit Card",
  },
  {
    billhub_category: "subscription",
    bbps_category: "Subscription",
  },
  {
    billhub_category: "landline",
    bbps_category: "Landline",
  },
  {
    billhub_category: "housing",
    bbps_category: "Housing",
  },
  {
    billhub_category: "insurance",
    bbps_category: "Insurance",
  },
  {
    billhub_category: "Education",
    bbps_category: "Education Fee",
  },
  {
    billhub_category: "muncipality",
    bbps_category: "Municipality",
  },
  {
    billhub_category: "water",
    bbps_category: "Water",
  },
  {
    billhub_category: "gas",
    bbps_category: "Gas",
  },
  {
    billhub_category: "cable",
    bbps_category: "Cable",
  },
  {
    billhub_category: "emipayments",
    bbps_category: "EMI",
  },
  {
    billhub_category: "broadband",
    bbps_category: "Broadband",
  },
  {
    billhub_category: "clubs",
    bbps_category: "Club Assoc",
  },
];

module.exports = {
  createRefundBillPayment,
  getRefundBillRequest,
  handleFailedPayments,
  googlePlayPayment,
  bbpsOperatorList,
  bbpsBillFetch,
  bbpsBillRecharge,
};
