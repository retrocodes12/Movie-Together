/**
 * GET  /api/friends?device_id=&status=accepted|pending
 * POST /api/friends  { device_id, target_username, action: send|accept|reject|remove|block }
 */
import sql from "@/app/api/utils/sql";

async function resolveUser(deviceId) {
  const rows =
    await sql`SELECT id, username FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
  return rows[0] || null;
}

async function notify(userId, type, title, body, data = {}) {
  await sql`
    INSERT INTO mt_notifications (user_id, type, title, body, data)
    VALUES (${userId}, ${type}, ${title}, ${body}, ${JSON.stringify(data)}::jsonb)
  `;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("device_id");
    const status = searchParams.get("status") || "accepted";

    if (!deviceId)
      return Response.json({ error: "device_id required" }, { status: 400 });
    const me = await resolveUser(deviceId);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    if (status === "pending") {
      // Incoming pending requests
      const rows = await sql`
        SELECT f.*, u.username, u.display_name, u.avatar_url
        FROM mt_friends f
        JOIN mt_users u ON u.id = f.requester_id
        WHERE f.addressee_id = ${me.id} AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `;
      return Response.json({ requests: rows });
    }

    if (status === "sent") {
      const rows = await sql`
        SELECT f.*, u.username, u.display_name, u.avatar_url
        FROM mt_friends f
        JOIN mt_users u ON u.id = f.addressee_id
        WHERE f.requester_id = ${me.id} AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `;
      return Response.json({ requests: rows });
    }

    // Accepted friends with online/room status
    const rows = await sql`
      SELECT
        CASE WHEN f.requester_id = ${me.id} THEN f.addressee_id ELSE f.requester_id END AS friend_id,
        u.username, u.display_name, u.avatar_url, u.bio,
        f.created_at AS friends_since,
        rm.room_id AS current_room_id,
        r.name AS current_room_name,
        rm.last_heartbeat,
        CASE WHEN rm.last_heartbeat > NOW() - INTERVAL '30 seconds' THEN true ELSE false END AS is_online
      FROM mt_friends f
      JOIN mt_users u ON u.id = CASE WHEN f.requester_id = ${me.id} THEN f.addressee_id ELSE f.requester_id END
      LEFT JOIN mt_room_members rm ON rm.user_id = u.id AND rm.is_active = true AND rm.last_heartbeat > NOW() - INTERVAL '30 seconds'
      LEFT JOIN mt_rooms r ON r.id = rm.room_id AND r.status != 'ended'
      WHERE (f.requester_id = ${me.id} OR f.addressee_id = ${me.id})
        AND f.status = 'accepted'
      ORDER BY is_online DESC, u.display_name ASC
    `;
    return Response.json({ friends: rows });
  } catch (e) {
    console.error("GET /api/friends:", e);
    return Response.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { device_id, target_username, action } = body;

    if (!device_id || !action)
      return Response.json(
        { error: "device_id and action required" },
        { status: 400 },
      );
    const me = await resolveUser(device_id);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    if (action === "send") {
      if (!target_username)
        return Response.json(
          { error: "target_username required" },
          { status: 400 },
        );
      const targetRows =
        await sql`SELECT id, display_name FROM mt_users WHERE username = ${target_username.toLowerCase()} LIMIT 1`;
      if (!targetRows.length)
        return Response.json({ error: "User not found" }, { status: 404 });
      const target = targetRows[0];
      if (target.id === me.id)
        return Response.json({ error: "Cannot add yourself" }, { status: 400 });

      // Check existing
      const existing = await sql`
        SELECT * FROM mt_friends
        WHERE (requester_id = ${me.id} AND addressee_id = ${target.id})
           OR (requester_id = ${target.id} AND addressee_id = ${me.id})
        LIMIT 1
      `;
      if (existing.length > 0) {
        if (existing[0].status === "accepted")
          return Response.json({ error: "Already friends" }, { status: 409 });
        if (existing[0].status === "pending")
          return Response.json(
            { error: "Request already sent" },
            { status: 409 },
          );
        if (existing[0].status === "blocked")
          return Response.json(
            { error: "Cannot send request" },
            { status: 403 },
          );
      }

      await sql`
        INSERT INTO mt_friends (requester_id, addressee_id, status)
        VALUES (${me.id}, ${target.id}, 'pending')
        ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'pending', updated_at = NOW()
      `;

      // Notify target
      const meUser =
        await sql`SELECT display_name FROM mt_users WHERE id = ${me.id} LIMIT 1`;
      await notify(
        target.id,
        "friend_request",
        "New Friend Request",
        `${meUser[0].display_name} wants to be your friend`,
        { from_user_id: me.id, username: me.username },
      );

      return Response.json({ success: true, message: "Friend request sent" });
    }

    if (action === "accept" || action === "reject") {
      const { request_id } = body;
      if (!request_id)
        return Response.json({ error: "request_id required" }, { status: 400 });

      const reqRows =
        await sql`SELECT * FROM mt_friends WHERE id = ${request_id} AND addressee_id = ${me.id} AND status = 'pending' LIMIT 1`;
      if (!reqRows.length)
        return Response.json({ error: "Request not found" }, { status: 404 });

      const newStatus = action === "accept" ? "accepted" : "rejected";
      await sql`UPDATE mt_friends SET status = ${newStatus}, updated_at = NOW() WHERE id = ${request_id}`;

      if (action === "accept") {
        const meUser =
          await sql`SELECT display_name FROM mt_users WHERE id = ${me.id} LIMIT 1`;
        await notify(
          reqRows[0].requester_id,
          "friend_accepted",
          "Friend Request Accepted",
          `${meUser[0].display_name} accepted your friend request`,
          { user_id: me.id },
        );
      }

      return Response.json({ success: true });
    }

    if (action === "remove") {
      const { friend_id } = body;
      if (!friend_id)
        return Response.json({ error: "friend_id required" }, { status: 400 });
      await sql`
        DELETE FROM mt_friends
        WHERE ((requester_id = ${me.id} AND addressee_id = ${friend_id})
            OR (requester_id = ${friend_id} AND addressee_id = ${me.id}))
          AND status = 'accepted'
      `;
      return Response.json({ success: true });
    }

    if (action === "invite_to_room") {
      const { friend_id, room_id } = body;
      if (!friend_id || !room_id)
        return Response.json(
          { error: "friend_id and room_id required" },
          { status: 400 },
        );
      const room =
        await sql`SELECT id, name, invite_code FROM mt_rooms WHERE id = ${room_id} LIMIT 1`;
      if (!room.length)
        return Response.json({ error: "Room not found" }, { status: 404 });
      const meUser =
        await sql`SELECT display_name FROM mt_users WHERE id = ${me.id} LIMIT 1`;
      await notify(
        friend_id,
        "room_invite",
        "Room Invitation",
        `${meUser[0].display_name} invited you to "${room[0].name}"`,
        {
          room_id,
          invite_code: room[0].invite_code,
          room_name: room[0].name,
          from_user_id: me.id,
        },
      );
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("POST /api/friends:", e);
    return Response.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
