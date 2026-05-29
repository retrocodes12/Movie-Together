/**
 * GET  /api/reactions?room_id=&since=<iso>
 * POST /api/reactions { device_id, room_id, emoji, playback_position }
 */
import sql from "@/app/api/utils/sql";

const ALLOWED_EMOJIS = ["😂", "😱", "🔥", "❤️", "😭", "👏"];
const RATE_LIMIT_WINDOW = 3; // seconds between reactions per user per room

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("room_id");
    const since = searchParams.get("since");
    if (!roomId)
      return Response.json({ error: "room_id required" }, { status: 400 });

    const sinceTs = since ? new Date(since) : new Date(Date.now() - 10000);

    const rows = await sql`
      SELECT r.*, u.display_name, u.avatar_url
      FROM mt_reactions r
      JOIN mt_users u ON u.id = r.user_id
      WHERE r.room_id = ${roomId}
        AND r.created_at > ${sinceTs.toISOString()}::timestamptz
      ORDER BY r.created_at ASC
      LIMIT 100
    `;
    return Response.json({
      reactions: rows,
      server_time: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/reactions:", e);
    return Response.json(
      { error: "Failed to fetch reactions" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { device_id, room_id, emoji, playback_position = 0 } = body;

    if (!device_id || !room_id || !emoji)
      return Response.json(
        { error: "device_id, room_id, emoji required" },
        { status: 400 },
      );

    if (!ALLOWED_EMOJIS.includes(emoji))
      return Response.json({ error: "Invalid emoji" }, { status: 400 });

    const userRows =
      await sql`SELECT id FROM mt_users WHERE device_id = ${device_id} LIMIT 1`;
    if (!userRows.length)
      return Response.json({ error: "User not found" }, { status: 404 });
    const userId = userRows[0].id;

    // Rate limit — use timestamp cutoff instead of INTERVAL interpolation
    const rateLimitCutoff = new Date(
      Date.now() - RATE_LIMIT_WINDOW * 1000,
    ).toISOString();
    const recent = await sql`
      SELECT id FROM mt_reactions
      WHERE room_id = ${room_id} AND user_id = ${userId}
        AND created_at > ${rateLimitCutoff}::timestamptz
      LIMIT 1
    `;
    if (recent.length > 0)
      return Response.json(
        { error: "Too many reactions, slow down" },
        { status: 429 },
      );

    // Room must be active
    const roomRows =
      await sql`SELECT id, status FROM mt_rooms WHERE id = ${room_id} LIMIT 1`;
    if (!roomRows.length || roomRows[0].status === "ended")
      return Response.json(
        { error: "Room not found or ended" },
        { status: 404 },
      );

    const rows = await sql`
      INSERT INTO mt_reactions (room_id, user_id, emoji, playback_position)
      VALUES (${room_id}, ${userId}, ${emoji}, ${playback_position})
      RETURNING *
    `;

    return Response.json({ reaction: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("POST /api/reactions:", e);
    return Response.json({ error: "Failed to send reaction" }, { status: 500 });
  }
}
