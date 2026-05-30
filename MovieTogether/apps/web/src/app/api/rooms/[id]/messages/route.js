import sql from "../../../utils/sql.js";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const after = searchParams.get("after"); // message id for pagination

    let rows;
    if (after) {
      rows = await sql`
        SELECT m.id, m.message, m.created_at,
          u.username, u.display_name, u.avatar_url, u.id as user_id
        FROM mt_messages m
        JOIN mt_users u ON m.user_id = u.id
        WHERE m.room_id = ${id} AND m.id > ${after}
        ORDER BY m.created_at ASC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT m.id, m.message, m.created_at,
          u.username, u.display_name, u.avatar_url, u.id as user_id
        FROM mt_messages m
        JOIN mt_users u ON m.user_id = u.id
        WHERE m.room_id = ${id}
        ORDER BY m.created_at ASC
        LIMIT ${limit}
      `;
    }

    return Response.json({ messages: rows });
  } catch (error) {
    console.error("GET /api/rooms/[id]/messages error:", error);
    return Response.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { device_id, message } = body;

    if (!device_id || !message?.trim()) {
      return Response.json(
        { error: "device_id and message required" },
        { status: 400 },
      );
    }

    const userRows = await sql`
      SELECT id, username, display_name, avatar_url FROM mt_users
      WHERE device_id = ${device_id} LIMIT 1
    `;
    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    const user = userRows[0];

    // Verify user is in room
    const memberRows = await sql`
      SELECT id FROM mt_room_members
      WHERE room_id = ${id} AND user_id = ${user.id} AND is_active = true
      LIMIT 1
    `;
    if (memberRows.length === 0) {
      return Response.json(
        { error: "You are not in this room" },
        { status: 403 },
      );
    }

    const msgRows = await sql`
      INSERT INTO mt_messages (room_id, user_id, message)
      VALUES (${id}, ${user.id}, ${message.trim()})
      RETURNING id, message, created_at
    `;

    return Response.json(
      {
        message: {
          ...msgRows[0],
          user_id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/rooms/[id]/messages error:", error);
    return Response.json({ error: "Failed to send message" }, { status: 500 });
  }
}
