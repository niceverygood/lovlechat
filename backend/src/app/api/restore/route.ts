import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const backupData = await req.json();
    
    if (!backupData.backup) {
      return NextResponse.json({ 
        ok: false, 
        error: "백업 데이터가 없습니다." 
      }, { status: 400 });
    }

    const { backup } = backupData;
    let restoredCounts: any = {};

    // 1. character_profiles 복원
    if (backup.character_profiles && backup.character_profiles.length > 0) {
      for (const profile of backup.character_profiles) {
        try {
          await pool.query(`
            INSERT INTO character_profiles (
              id, userId, profileImg, name, age, job, oneLiner, background, 
              personality, habit, likes, dislikes, extraInfos, gender, scope, 
              roomCode, category, tags, attachments, firstScene, firstMessage, 
              backgroundImg, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              userId = VALUES(userId),
              profileImg = VALUES(profileImg),
              name = VALUES(name),
              age = VALUES(age),
              job = VALUES(job),
              oneLiner = VALUES(oneLiner),
              background = VALUES(background),
              personality = VALUES(personality),
              habit = VALUES(habit),
              likes = VALUES(likes),
              dislikes = VALUES(dislikes),
              extraInfos = VALUES(extraInfos),
              gender = VALUES(gender),
              scope = VALUES(scope),
              roomCode = VALUES(roomCode),
              category = VALUES(category),
              tags = VALUES(tags),
              attachments = VALUES(attachments),
              firstScene = VALUES(firstScene),
              firstMessage = VALUES(firstMessage),
              backgroundImg = VALUES(backgroundImg),
              updatedAt = VALUES(updatedAt)
          `, [
            profile.id, profile.userId, profile.profileImg, profile.name, 
            profile.age, profile.job, profile.oneLiner, profile.background,
            profile.personality, profile.habit, profile.likes, profile.dislikes,
            JSON.stringify(profile.extraInfos), profile.gender, profile.scope,
            profile.roomCode, profile.category, JSON.stringify(profile.tags),
            JSON.stringify(profile.attachments), profile.firstScene, 
            profile.firstMessage, profile.backgroundImg, profile.createdAt, 
            profile.updatedAt
          ]);
        } catch (error) {
          console.error("Profile restore error:", error);
        }
      }
      restoredCounts.character_profiles = backup.character_profiles.length;
    }

    // 2. chats 복원
    if (backup.chats && backup.chats.length > 0) {
      for (const chat of backup.chats) {
        try {
          await pool.query(`
            INSERT INTO chats (
              id, personaId, characterId, message, sender, characterName,
              characterProfileImg, characterAge, characterJob, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              message = VALUES(message),
              sender = VALUES(sender),
              characterName = VALUES(characterName),
              characterProfileImg = VALUES(characterProfileImg),
              characterAge = VALUES(characterAge),
              characterJob = VALUES(characterJob)
          `, [
            chat.id, chat.personaId, chat.characterId, chat.message,
            chat.sender, chat.characterName, chat.characterProfileImg,
            chat.characterAge, chat.characterJob, chat.createdAt
          ]);
        } catch (error) {
          console.error("Chat restore error:", error);
        }
      }
      restoredCounts.chats = backup.chats.length;
    }

    // 3. character_favors 복원
    if (backup.character_favors && backup.character_favors.length > 0) {
      for (const favor of backup.character_favors) {
        try {
          await pool.query(`
            INSERT INTO character_favors (
              id, personaId, characterId, favor, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              favor = VALUES(favor),
              updatedAt = VALUES(updatedAt)
          `, [
            favor.id, favor.personaId, favor.characterId, 
            favor.favor, favor.createdAt, favor.updatedAt
          ]);
        } catch (error) {
          console.error("Favor restore error:", error);
        }
      }
      restoredCounts.character_favors = backup.character_favors.length;
    }

    // 4. character_hidden 복원
    if (backup.character_hidden && backup.character_hidden.length > 0) {
      for (const hidden of backup.character_hidden) {
        try {
          await pool.query(`
            INSERT INTO character_hidden (
              id, userId, characterId, createdAt
            ) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              userId = VALUES(userId),
              characterId = VALUES(characterId)
          `, [hidden.id, hidden.userId, hidden.characterId, hidden.createdAt]);
        } catch (error) {
          console.error("Hidden restore error:", error);
        }
      }
      restoredCounts.character_hidden = backup.character_hidden.length;
    }

    // 5. personas 복원
    if (backup.personas && backup.personas.length > 0) {
      for (const persona of backup.personas) {
        try {
          await pool.query(`
            INSERT INTO personas (
              id, userId, name, avatar, gender, age, job, info, habit, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              userId = VALUES(userId),
              name = VALUES(name),
              avatar = VALUES(avatar),
              gender = VALUES(gender),
              age = VALUES(age),
              job = VALUES(job),
              info = VALUES(info),
              habit = VALUES(habit),
              updatedAt = VALUES(updatedAt)
          `, [
            persona.id, persona.userId, persona.name, persona.avatar,
            persona.gender, persona.age, persona.job, persona.info,
            persona.habit, persona.createdAt, persona.updatedAt
          ]);
        } catch (error) {
          console.error("Persona restore error:", error);
        }
      }
      restoredCounts.personas = backup.personas.length;
    }

    // 6. first_dates 복원
    if (backup.first_dates && backup.first_dates.length > 0) {
      for (const firstDate of backup.first_dates) {
        try {
          await pool.query(`
            INSERT INTO first_dates (
              id, personaId, characterId, firstDate
            ) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              firstDate = VALUES(firstDate)
          `, [firstDate.id, firstDate.personaId, firstDate.characterId, firstDate.firstDate]);
        } catch (error) {
          console.error("First date restore error:", error);
        }
      }
      restoredCounts.first_dates = backup.first_dates.length;
    }

    return NextResponse.json({ 
      ok: true, 
      message: "AWS RDS로 데이터 복원 완료",
      restoredCounts: restoredCounts
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error("Restore error:", error);
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