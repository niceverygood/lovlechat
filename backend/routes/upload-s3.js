require("dotenv").config();

const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const multerS3 = require("multer-s3");

const router = express.Router();

// ✅ AWS S3 설정 (v2 방식)
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_S3_BUCKET_NAME;

// ✅ multer + multer-s3 설정
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE, // 자동 content-type 설정
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/\s+/g, "_"); // 공백 제거
      const finalName = `${timestamp}-${sanitizedName}`;
      console.log("🖼 업로드할 파일 이름:", finalName);
      cb(null, finalName);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 🔒 최대 5MB 제한
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("이미지 파일만 업로드 가능합니다."));
    }
    cb(null, true);
  },
});

// ✅ 업로드 엔드포인트
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      console.log("❌ multer가 파일을 수신하지 못함");
      return res.status(400).json({ ok: false, message: "파일이 없습니다." });
    }

    console.log("✅ multer가 파일 수신 성공:", req.file);

    return res.status(200).json({
      ok: true,
      url: req.file.location, // S3에 업로드된 파일의 public URL
    });
  } catch (err) {
    console.error("❌ 업로드 중 오류 발생:", err);
    return res.status(500).json({
      ok: false,
      error: "업로드 실패",
      details: err.message,
    });
  }
});

module.exports = router;
