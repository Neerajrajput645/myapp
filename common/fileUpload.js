const fs = require("fs");
const path = require("path");
const multer = require("multer");

/* -------------------- FILE FILTER -------------------- */
const fileFilter = (_, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    "image/svg+xml",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file format, only jpg, png & webp files are allowed."));
  }
};

/* -------------------- HELPERS -------------------- */
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const createStorage = (folder) =>
  multer.diskStorage({
    destination: function (_, __, cb) {
      const destination = path.join("uploads", folder);
      ensureDirExists(destination);
      cb(null, destination);
    },
    filename: function (_, file, cb) {
      const safeName = file.originalname.replace(/\s+/g, "-");
      cb(null, `${Date.now()}-${safeName}`);
    },
  });

const createUploader = (folder) =>
  multer({
    storage: createStorage(folder),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter,
  });

/* -------------------- UPLOADERS -------------------- */
const serviceUpload = createUploader("services");
const bannerUploads = createUploader("banners");
const affiliateBannerUploads = createUploader("affiliateBanners");
const affiliateImage = createUploader("affiliate");
const commissionImages = createUploader("commissions");
const homeBannerImages = createUploader("homeBanners");
const notificationImage = createUploader("notification");

/* -------------------- EXPORTS -------------------- */
module.exports = {
  serviceUpload,
  bannerUploads,
  affiliateBannerUploads,
  affiliateImage,
  commissionImages,
  homeBannerImages,
  notificationImage,
};
