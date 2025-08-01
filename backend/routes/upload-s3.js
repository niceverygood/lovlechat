const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const multerS3 = require("multer-s3");

require("dotenv").config();

const router = express.Router();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
});

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "파일이 없습니다." });
  }

  res.status(200).json({
    url: req.file.location,
    ok: true,
  });
});
