const router = require("express").Router();
const { tokenVerify
  // , adminTokenVerify
 } = require("../common/tokenVerify");
const {
  planFetch,
  rechargeRequest,
  fetchDthPlans,
  // rechargeHistory,
  dthRequest,
  // handleFailedRecharge,
  // rechargeHistoryByAdmin,
  // dthHistoryByAdmin,
  operatorCircleByPhone,
  // Recharge_Status_Verify,
  fetchDthOperator,
  // Recharge_All_Status_Verify,
  fetchDthOperators,
  lastRecharge,
  getCircleAndOperators,
} = require("../controllers/recharge");

const {
  // billPayment,
  // billPaymentHistory,
  // createRefundBillPayment,
  // getRefundBillRequest,
  // handleFailedPayments,
  // bbpsHistory,
  googlePlayPayment,
  bbpsOperatorList,
  bbpsBillFetch,
  bbpsBillRecharge,
} = require("../controllers/bbps");

router.get("/plan_fetch", tokenVerify, planFetch);
router.get("/last-recharge", tokenVerify, lastRecharge);
router.get("/dth_request", tokenVerify, dthRequest);
// router.get("/dth_history", tokenVerify, dthHistory);
router.get("/fetch_dth_plans", tokenVerify, fetchDthPlans);

router.get("/fetch_dth_operator", tokenVerify, fetchDthOperator); // operator details like name code etc
router.get("/fetch_dth_operators", fetchDthOperators); // all dth operators list

// router.get("/commission_list", tokenVerify, commission);
router.get("/get_circle_operators", tokenVerify, getCircleAndOperators); // get all mobile operators and circles
router.get("/recharge_request", tokenVerify, rechargeRequest);
// router.get("/recharge_status_verify", adminTokenVerify, Recharge_Status_Verify); 
// router.get("/recharge_all_status_verify",adminTokenVerify,Recharge_All_Status_Verify);
// router.get("/recharge_history", tokenVerify, rechargeHistory);
router.get("/operator_by_phone", tokenVerify, operatorCircleByPhone);
// router.get("/admin/dth_history", adminTokenVerify, dthHistoryByAdmin);
// router.post("/admin/recharge_history",adminTokenVerify,rechargeHistoryByAdmin);
// router.post("/accept_recharge_refund_request",adminTokenVerify,handleFailedRecharge);

// bbps
// router.post("/admin/bbps-history", bbpsHistory);
// router.post("/bbps/bill-payment", tokenVerify, billPayment);
router.post("/bbps/new-bill-payment", tokenVerify, bbpsBillRecharge);
router.post("/bbps/google-play", tokenVerify, googlePlayPayment);
// router.get("/bbps/bill-history", tokenVerify, billPaymentHistory);
// router.post("/bbps/bill-create-refund", tokenVerify, createRefundBillPayment);
// router.get("/bbps/bill-refund-request", adminTokenVerify, getRefundBillRequest);
// router.post("/bbps/bill-refund-manage", adminTokenVerify, handleFailedPayments);
router.get("/bbps/operator-list", tokenVerify, bbpsOperatorList);
router.post("/bbps/new-bill-fetch", tokenVerify, bbpsBillFetch);

module.exports = router;
