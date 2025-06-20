-- MySQL dump 10.13  Distrib 9.3.0, for macos14.7 (x86_64)
--
-- Host: localhost    Database: lovlechat
-- ------------------------------------------------------
-- Server version	9.3.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `character_favors`
--

DROP TABLE IF EXISTS `character_favors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `character_favors` (
  `personaId` varchar(64) NOT NULL,
  `characterId` varchar(64) NOT NULL,
  `favor` int DEFAULT '0',
  PRIMARY KEY (`personaId`,`characterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `character_hidden`
--

DROP TABLE IF EXISTS `character_hidden`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `character_hidden` (
  `userId` varchar(100) NOT NULL,
  `characterId` int NOT NULL,
  `hiddenAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`,`characterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `character_profiles`
--

DROP TABLE IF EXISTS `character_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `character_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `profileImg` longtext,
  `name` varchar(100) NOT NULL,
  `age` int DEFAULT NULL,
  `job` varchar(100) DEFAULT NULL,
  `oneLiner` text,
  `background` text,
  `personality` text,
  `habit` text,
  `likes` text,
  `dislikes` text,
  `extraInfos` json DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `scope` varchar(20) DEFAULT NULL,
  `roomCode` varchar(100) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `userId` varchar(100) DEFAULT NULL,
  `attachments` longtext,
  `firstScene` text,
  `firstMessage` text,
  `backgroundImg` longtext,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `characters`
--

DROP TABLE IF EXISTS `characters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `characters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `age` int DEFAULT NULL,
  `job` varchar(255) DEFAULT NULL,
  `first_scene` text,
  `first_message` text,
  `background_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `chats`
--

DROP TABLE IF EXISTS `chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` varchar(64) DEFAULT NULL,
  `personaId` varchar(64) DEFAULT NULL,
  `characterId` int NOT NULL,
  `message` text NOT NULL,
  `sender` enum('user','ai') NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `characterName` varchar(64) DEFAULT NULL,
  `characterProfileImg` mediumtext,
  `characterAge` int DEFAULT NULL,
  `characterJob` varchar(64) DEFAULT NULL,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=466 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `first_dates`
--

DROP TABLE IF EXISTS `first_dates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `first_dates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `personaId` varchar(255) NOT NULL,
  `characterId` int NOT NULL,
  `firstDate` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_persona_character` (`personaId`,`characterId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `heart_transactions`
--

DROP TABLE IF EXISTS `heart_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `heart_transactions` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '거래 고유 ID',
  `userId` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 ID',
  `amount` int NOT NULL COMMENT '하트 변동량 (+구매, -사용)',
  `type` enum('purchase','chat','daily_bonus','admin','refresh') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '거래 설명',
  `beforeHearts` int NOT NULL COMMENT '거래 전 하트 수',
  `afterHearts` int NOT NULL COMMENT '거래 후 하트 수',
  `relatedId` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '관련 ID (채팅의 경우 personaId_characterId)',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '거래 시각',
  PRIMARY KEY (`id`),
  KEY `idx_userId` (`userId`),
  KEY `idx_type` (`type`),
  KEY `idx_createdAt` (`createdAt`),
  CONSTRAINT `heart_transactions_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='하트 사용/구매 내역';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `imp_uid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '아임포트 결제 고유ID',
  `merchant_uid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '가맹점 주문번호',
  `userId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사용자 ID',
  `amount` int NOT NULL COMMENT '결제 금액',
  `heartCount` int NOT NULL COMMENT '구매한 하트 개수',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'completed' COMMENT '결제 상태',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '결제 시간',
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시간',
  PRIMARY KEY (`id`),
  UNIQUE KEY `imp_uid` (`imp_uid`),
  KEY `idx_user_id` (`userId`),
  KEY `idx_imp_uid` (`imp_uid`),
  KEY `idx_merchant_uid` (`merchant_uid`),
  KEY `idx_created_at` (`createdAt`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='결제 기록 테이블';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `personas`
--

DROP TABLE IF EXISTS `personas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personas` (
  `id` varchar(100) NOT NULL,
  `userId` varchar(100) NOT NULL,
  `name` varchar(50) NOT NULL,
  `avatar` longtext,
  `gender` varchar(20) DEFAULT NULL,
  `age` varchar(15) DEFAULT NULL,
  `job` varchar(50) DEFAULT NULL,
  `info` text,
  `habit` text,
  `personality` text,
  `interests` text,
  `background` text,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `userId` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Firebase 사용자 ID',
  `hearts` int DEFAULT '100' COMMENT '보유 하트 수',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '사용자 이메일',
  `displayName` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '사용자 닉네임',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입 시각',
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
  `lastHeartUpdate` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '마지막 하트 변경 시각',
  PRIMARY KEY (`userId`),
  KEY `idx_hearts` (`hearts`),
  KEY `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 정보 및 하트 관리';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'lovlechat'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-06-20 12:42:31
