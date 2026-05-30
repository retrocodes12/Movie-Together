import sql from "@/app/api/utils/sql";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { device_id } = body;

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

    await sql`
      UPDATE mt_room_members SET is_active = false
      WHERE room_id = ${id} AND user_id = ${userId}
    `;

    // Clear playback control if the leaving member had it
    await sql`
      UPDATE mt_room_members SET has_playback_control = false
      WHERE room_id = ${id} AND user_id = ${userId}
    `;

    // Check if the leaving user was the host
    const roomRows = await sql`
      SELECT host_id FROM mt_rooms WHERE id = ${id} LIMIT 1
    `;
    if (roomRows.length === 0) {
      return Response.json({ success: true });
    }

    const isHost = roomRows[0].host_id === userId;

    if (isHost) {
      // Try to migrate host to another active online member
      const nextHostRows = await sql`
        SELECT rm.user_id
        FROM mt_room_members rm
        WHERE rm.room_id = ${id}
          AND rm.user_id != ${userId}
          AND rm.is_active = true
          AND rm.last_heartbeat > NOW() - INTERVAL '30 seconds'
        ORDER BY rm.joined_at ASC
        LIMIT 1
      `;

      if (nextHostRows.length > 0) {
        // Migrate host to the next member
        const newHostId = nextHostRows[0].user_id;
        await sql`
          UPDATE mt_rooms
          SET host_id = ${newHostId}, previous_host_id = ${userId}, updated_at = NOW()
          WHERE id = ${id}
        `;
        // Log a host-change event so clients pick it up via sync
        await sql`
          INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
          VALUES (${id}, ${newHostId}, 'HOST_CHANGED',
            ${JSON.stringify({ new_host_id: newHostId, previous_host_id: userId })}::jsonb)
        `;
      } else {
        // No other active members — check for any active member (offline but still in room)
        const anyMemberRows = await sql`
          SELECT rm.user_id
          FROM mt_room_members rm
          WHERE rm.room_id = ${id}
            AND rm.user_id != ${userId}
            AND rm.is_active = true
          ORDER BY rm.joined_at ASC
          LIMIT 1
        `;

        if (anyMemberRows.length > 0) {
          // Migrate to any remaining member even if offline
          const newHostId = anyMemberRows[0].user_id;
          await sql`
            UPDATE mt_rooms
            SET host_id = ${newHostId}, previous_host_id = ${userId}, updated_at = NOW()
            WHERE id = ${id}
          `;
          await sql`
            INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
            VALUES (${id}, ${newHostId}, 'HOST_CHANGED',
              ${JSON.stringify({ new_host_id: newHostId, previous_host_id: userId })}::jsonb)
          `;
        } else {
          // Room is empty — end it
          await sql`UPDATE mt_rooms SET status = 'ended' WHERE id = ${id}`;
        }
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("POST /api/rooms/[id]/leave error:", error);
    return Response.json({ error: "Failed to leave room" }, { status: 500 });
  }
}
