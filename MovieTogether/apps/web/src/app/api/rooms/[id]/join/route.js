import sql from "../../../utils/sql.js";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { device_id, invite_code } = body;

    if (!device_id) {
      return Response.json({ error: "device_id required" }, { status: 400 });
    }

    const userRows = await sql`
      SELECT id FROM mt_users WHERE device_id = ${device_id} LIMIT 1
    `;
    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    const userId = userRows[0].id;

    const roomRows = await sql`SELECT * FROM mt_rooms WHERE id = ${id} LIMIT 1`;
    if (roomRows.length === 0) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }
    const room = roomRows[0];

    if (room.status === "ended") {
      return Response.json({ error: "This room has ended" }, { status: 400 });
    }
    let inviteGrant = null;
    if (!room.is_public) {
      const grants = await sql`
        SELECT can_control FROM mt_room_invites
        WHERE room_id = ${id} AND invited_user_id = ${userId}
        LIMIT 1
      `;
      inviteGrant = grants[0] || null;
      if (invite_code !== room.invite_code && !inviteGrant) {
        return Response.json({ error: "Private room invite required" }, { status: 403 });
      }
    }

    const memberCount = await sql`
      SELECT COUNT(*) as cnt FROM mt_room_members
      WHERE room_id = ${id} AND is_active = true
    `;
    if (parseInt(memberCount[0].cnt) >= room.max_members) {
      return Response.json({ error: "Room is full" }, { status: 400 });
    }

    // Upsert membership — mark online immediately
    await sql`
      INSERT INTO mt_room_members (room_id, user_id, is_active, is_online, can_control, last_heartbeat)
      VALUES (${id}, ${userId}, true, true, ${room.host_id === userId || !!inviteGrant?.can_control}, NOW())
      ON CONFLICT (room_id, user_id)
      DO UPDATE SET
        is_active = true,
        is_online = true,
        can_control = mt_room_members.can_control OR EXCLUDED.can_control,
        last_heartbeat = NOW(),
        joined_at = NOW()
    `;

    await sql`
      UPDATE mt_users SET rooms_joined = rooms_joined + 1 WHERE id = ${userId}
    `;

    // Log MEMBER_JOINED event
    await sql`
      INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
      VALUES (${id}, ${userId}, 'MEMBER_JOINED', ${JSON.stringify({ user_id: userId })}::jsonb)
    `;

    // Return full room snapshot
    const members = await sql`
      SELECT rm.joined_at, rm.is_active, rm.last_heartbeat, rm.is_online, rm.can_control,
             u.id as user_id, u.username, u.display_name, u.avatar_url
      FROM mt_room_members rm
      JOIN mt_users u ON rm.user_id = u.id
      WHERE rm.room_id = ${id} AND rm.is_active = true
      ORDER BY rm.joined_at ASC
    `;

    const playback_state = room.playback_state || {
      status: "idle",
      position: 0,
      speed: 1.0,
      content_url: room.stream_url || "",
      updated_at: null,
      updated_by: null,
    };

    return Response.json({
      room: { ...room, members, playback_state },
      success: true,
    });
  } catch (error) {
    console.error("POST /api/rooms/[id]/join error:", error);
    return Response.json({ error: "Failed to join room" }, { status: 500 });
  }
}
