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

    // If host leaves, end the room
    const roomRows = await sql`
      SELECT host_id FROM mt_rooms WHERE id = ${id} LIMIT 1
    `;
    if (roomRows.length > 0 && roomRows[0].host_id === userId) {
      await sql`UPDATE mt_rooms SET status = 'ended' WHERE id = ${id}`;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("POST /api/rooms/[id]/leave error:", error);
    return Response.json({ error: "Failed to leave room" }, { status: 500 });
  }
}
