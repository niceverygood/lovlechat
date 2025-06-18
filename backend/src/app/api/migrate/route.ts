import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // 1. 캐릭터 프로필 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS character_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255),
        profileImg TEXT,
        name VARCHAR(255) NOT NULL,
        age VARCHAR(10),
        job VARCHAR(255),
        oneLiner TEXT,
        background TEXT,
        personality TEXT,
        habit TEXT,
        likes TEXT,
        dislikes TEXT,
        extraInfos JSON,
        gender VARCHAR(20),
        scope VARCHAR(50),
        roomCode VARCHAR(100),
        category VARCHAR(100),
        tags JSON,
        attachments JSON,
        firstScene TEXT,
        firstMessage TEXT,
        backgroundImg TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_userId (userId),
        INDEX idx_category (category)
      )
    `);

    // 2. 채팅 메시지 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        personaId VARCHAR(255) NOT NULL,
        characterId INT NOT NULL,
        message TEXT NOT NULL,
        sender ENUM('user', 'ai') NOT NULL,
        characterName VARCHAR(255),
        characterProfileImg TEXT,
        characterAge VARCHAR(10),
        characterJob VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_persona_character (personaId, characterId),
        INDEX idx_createdAt (createdAt)
      )
    `);

    // 3. 캐릭터 호감도 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS character_favors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        personaId VARCHAR(255) NOT NULL,
        characterId INT NOT NULL,
        favor INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_persona_character (personaId, characterId)
      )
    `);

    // 4. 캐릭터 숨김 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS character_hidden (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        characterId INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_character (userId, characterId)
      )
    `);

    // 5. 페르소나 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS personas (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar TEXT,
        gender VARCHAR(20),
        age VARCHAR(10),
        job VARCHAR(255),
        info TEXT,
        habit TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_userId (userId)
      )
    `);

    // 6. 첫 데이트 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS first_dates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        personaId VARCHAR(255) NOT NULL,
        characterId INT NOT NULL,
        firstDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_persona_character (personaId, characterId)
      )
    `);

    // 기본 샘플 데이터 삽입
    await pool.query(`
      INSERT IGNORE INTO character_profiles (
        name, age, job, oneLiner, background, personality, 
        profileImg, backgroundImg, firstScene, firstMessage, category
      ) VALUES 
      (
        '아이유', '30', '가수', 
        '안녕하세요! 아이유입니다.', 
        '대한민국의 대표 싱어송라이터', 
        '친근하고 따뜻한 성격',
        '/imgdefault.jpg', '/imgdefault.jpg',
        '카페에서 만난 아이유', 
        '안녕하세요! 오늘 하루는 어떠셨나요?',
        '연예인'
      ),
      (
        '김태연', '35', '가수',
        '소녀시대 태연입니다!',
        '소녀시대의 리더이자 솔로 아티스트',
        '장난스럽고 에너지 넘치는 성격',
        '/imgdefault.jpg', '/imgdefault.jpg',
        '연습실에서 만난 태연',
        '안녕! 오늘도 열심히 해보자!',
        '연예인'
      )
    `);

    return NextResponse.json({ 
      ok: true, 
      message: "AWS RDS 테이블 생성 및 초기 데이터 삽입 완료" 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: String(error) 
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 