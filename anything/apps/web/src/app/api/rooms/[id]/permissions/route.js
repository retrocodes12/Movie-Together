/**
 * POST /api/rooms/:id/permissions
 *
 * Allows the host to grant or revoke playback control for a member.
 * Primarily for private rooms, but works for any room.
 *
 * Body: { device_id, target_user_id, action: 'grant' | 'revoke' }
 */
import sql from "@/app/api/utils/sql";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { device_id, target_user_id, action } = body;

    if (!device_id || !target_user_id || !action) {
      return Response.json(
        { error: "device_id, target_user_id, and action are required" },
        { status: 400 },
      );
    }

    if (!["grant", "revoke"].includes(action)) {
      return Response.json(
        { error: "action must be 'grant' or 'revoke'" },
        { status: 400 },
      );
    }

    // Resolve requesting user
    const userRows = await sql`
      SELECT id FROM mt_users WHERE device_id = ${device_id} LIMIT 1
    `;
    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    const requestingUserId = userRows[0].id;

    // Fetch room to verify host
    const roomRows = await sql`
      SELECT id, host_id, is_public FROM mt_rooms WHERE id = ${id} LIMIT 1
    `;
    if (roomRows.length === 0) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }
    const room = roomRows[0];

    if (room.host_id !== requestingUserId) {
      return Response.json(
        { error: "Only the host can grant or revoke playback control" },
        { status: 403 },
      );
    }

    // Verify target is an active member
    const memberRows = await sql`
      SELECT id FROM mt_room_members
      WHERE room_id = ${id} AND user_id = ${target_user_id} AND is_active = true
      LIMIT 1
    `;
    if (memberRows.length === 0) {
      return Response.json(
        { error: "Target user is not an active member of this room" },
        { status: 404 },
      );
    }

    const hasControl = action === "grant";

    await sql`
      UPDATE mt_room_members
      SET has_playback_control = ${hasControl}
      WHERE room_id = ${id} AND user_id = ${target_user_id}
    `;

    // Log event so clients are notified via the sync stream
    await sql`
      INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
      VALUES (
        ${id},
        ${requestingUserId},
        'PERMISSIONS_CHANGED',
        ${JSON.stringify({
          target_user_id: parseInt(target_user_id),
          has_playback_control: hasControl,
          action,
        })}::jsonb
      )
    `;

    return Response.json({
      success: true,
      target_user_id: parseInt(target_user_id),
      has_playback_control: hasControl,
    });
  } catch (error) {
    console.error("POST /api/rooms/[id]/permissions error:", error);
    return Response.json(
      { error: "Failed to update permissions" },
      { status: 500 },
    );
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const rows = await sql`
      SELECT rm.user_id, rm.has_playback_control, u.username, u.display_name
      FROM mt_room_members rm
      JOIN mt_users u ON rm.user_id = u.id
      WHERE rm.room_id = ${id} AND rm.is_active = true AND rm.has_playback_control = true
    `;
    return Response.json({ co_hosts: rows });
  } catch (error) {
    console.error("GET /api/rooms/[id]/permissions error:", error);
    return Response.json(
      { error: "Failed to fetch permissions" },
      { status: 500 },
    );
  }
}
