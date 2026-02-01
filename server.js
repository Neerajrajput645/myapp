//  ====================== Import all required modules ======================
const path = require("path");
require("dotenv/config");
const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 5000;
const connection = require("./database");
const helmet = require("helmet");
const { Recharge_CallBack_Handler } = require("./controllers/recharge");
const { dashboardApi } = require("./controllers/admin");
const getIpAddress = require("./common/getIpAddress");

// ========================= Connection to Database ==========================
connection();


// ======================== Middlewares ==========================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(cors());
app.use(helmet());
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// =========================  API Routes ==========================
// app.use("/api/txn", require("./routes/txnRoute"));
app.use("/api/auth", require("./routes/authRoute"));
// app.use("/api/admin", require("./routes/adminRoute"));
// app.use("/api/user", require("./routes/userRoute"));
// app.use("/api/wallet", require("./routes/walletRoute"));
// app.use("/api/commission", require("./routes/commission.js"));
// app.all("/api/webhook/callback", Recharge_CallBack_Handler);
// app.use("/api/setting", require("./routes/appSetting"));
// app.use("/api/banner", require("./routes/bannerRoute"));

// app.use("/api/home-banner", require("./routes/homeBanner.js"));
// app.use("/api/pop-image", require("./routes/homePopImage.js"));
// app.use("/api/service", require("./routes/serviceRoute"));
// app.use("/api/affiliate-banner", require("./routes/affiliateBannerRoute"));
// app.use("/api/notification", require("./routes/notificationRoute"));
// app.use("/api/payment", require("./routes/paymentRoutes"));
// app.use("/api/cyrus", require("./routes/index.js"));     // isko aur check karna hai
// app.use("/api/affiliate", require("./routes/affiliateRoute"));
// app.get("/api/dashboard", dashboardApi);





const { tokenVerify } = require("./common/tokenVerify");


const { operatorCircleByPhone,
  planFetch,
  mobileRecharge, } = require("./ctrl/mobileRecharge");

app.get("/v1/api/operator-circle", tokenVerify, operatorCircleByPhone);
app.get("/v1/api/plan", tokenVerify, planFetch);
app.post("/v1/api/recharge", tokenVerify, mobileRecharge);




















app.get("/api", (req, res) => {
  res.send(getIpAddress(req));
});

// error handler
app.use(require("./common/errorHandler"));

app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
