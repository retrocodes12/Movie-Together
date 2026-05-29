import sql from "@/app/api/utils/sql";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const inviteCode = searchParams.get("invite_code");

    // Search by invite code
    if (inviteCode) {
      const rows = await sql`
        SELECT 
          r.*,
          u.username as host_username,
          u.display_name as host_display_name,
          COUNT(DISTINCT rm.user_id) FILTER (WHERE rm.is_active = true) as member_count
        FROM mt_rooms r
        LEFT JOIN mt_users u ON r.host_id = u.id
        LEFT JOIN mt_room_members rm ON r.id = rm.room_id
        WHERE r.invite_code = ${inviteCode.toUpperCase()}
        GROUP BY r.id, u.username, u.display_name
        LIMIT 1
      `;
      return Response.json({ rooms: rows });
    }

    const rows = await sql`
      SELECT 
        r.*,
        u.username as host_username,
        u.display_name as host_display_name,
        COUNT(DISTINCT rm.user_id) FILTER (WHERE rm.is_active = true) as member_count
      FROM mt_rooms r
      LEFT JOIN mt_users u ON r.host_id = u.id
      LEFT JOIN mt_room_members rm ON r.id = rm.room_id
      WHERE r.is_public = true AND r.status != 'ended'
      GROUP BY r.id, u.username, u.display_name
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return Response.json({ rooms: rows });
  } catch (error) {
    console.error("GET /api/rooms error:", error);
    return Response.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      device_id,
      name,
      movie_title,
      movie_description,
      movie_genre,
      movie_year,
      movie_poster_url,
      stream_url,
      max_members,
      is_public,
    } = body;

    if (!device_id || !name || !movie_title) {
      return Response.json(
        { error: "device_id, name, and movie_title are required" },
        { status: 400 },
      );
    }

    // Get user
    const userRows = await sql`
      SELECT id FROM mt_users WHERE device_id = ${device_id} LIMIT 1
    `;
    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    const userId = userRows[0].id;

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await sql`
        SELECT id FROM mt_rooms WHERE invite_code = ${inviteCode} LIMIT 1
      `;
      if (existing.length === 0) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    const roomRows = await sql`
      INSERT INTO mt_rooms (
        name, host_id, movie_title, movie_description, movie_genre,
        movie_year, movie_poster_url, stream_url, invite_code,
        max_members, is_public, status
      ) VALUES (
        ${name}, ${userId}, ${movie_title}, ${movie_description || ""},
        ${movie_genre || ""}, ${movie_year || null}, ${movie_poster_url || null},
        ${stream_url || ""}, ${inviteCode}, ${max_members || 10},
        ${is_public !== false}, 'waiting'
      ) RETURNING *
    `;

    const room = roomRows[0];

    // Auto-join host
    await sql`
      INSERT INTO mt_room_members (room_id, user_id, is_active)
      VALUES (${room.id}, ${userId}, true)
      ON CONFLICT (room_id, user_id) DO UPDATE SET is_active = true
    `;

    // Increment hosted count
    await sql`
      UPDATE mt_users SET rooms_hosted = rooms_hosted + 1 WHERE id = ${userId}
    `;

    return Response.json({ room }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rooms error:", error);
    return Response.json({ error: "Failed to create room" }, { status: 500 });
  }
}
