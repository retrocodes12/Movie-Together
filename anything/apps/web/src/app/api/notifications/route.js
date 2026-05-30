/**
 * GET  /api/notifications?device_id=&limit=&unread_only=
 * PUT  /api/notifications { device_id, notification_id | mark_all: true }
 * DELETE /api/notifications?device_id=&notification_id=
 */
import sql from "@/app/api/utils/sql";

async function resolveUser(deviceId) {
  const rows =
    await sql`SELECT id FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
  return rows[0] || null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("device_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const unreadOnly = searchParams.get("unread_only") === "true";

    if (!deviceId)
      return Response.json({ error: "device_id required" }, { status: 400 });
    const me = await resolveUser(deviceId);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    const rows = unreadOnly
      ? await sql`
          SELECT * FROM mt_notifications
          WHERE user_id = ${me.id} AND read = false
          ORDER BY created_at DESC LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM mt_notifications
          WHERE user_id = ${me.id}
          ORDER BY created_at DESC LIMIT ${limit}
        `;

    // Safely parse data JSONB field for each notification
    const parsedRows = rows.map((row) => {
      let data = {};
      try {
        if (typeof row.data === "string") {
          data = JSON.parse(row.data);
        } else if (row.data && typeof row.data === "object") {
          data = row.data;
        }
      } catch (e) {
        console.warn(
          "Failed to parse notification data for notification:",
          row.id,
          e?.message,
        );
        data = {};
      }
      return { ...row, data };
    });

    const unreadCount = await sql`
      SELECT COUNT(*) as cnt FROM mt_notifications WHERE user_id = ${me.id} AND read = false
    `;

    return Response.json({
      notifications: parsedRows,
      unread_count: parseInt(unreadCount[0].cnt),
    });
  } catch (e) {
    console.error("GET /api/notifications:", e);
    return Response.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { device_id, notification_id, mark_all } = body;

    if (!device_id)
      return Response.json({ error: "device_id required" }, { status: 400 });
    const me = await resolveUser(device_id);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    if (mark_all) {
      await sql`UPDATE mt_notifications SET read = true WHERE user_id = ${me.id} AND read = false`;
    } else if (notification_id) {
      await sql`UPDATE mt_notifications SET read = true WHERE id = ${notification_id} AND user_id = ${me.id}`;
    } else {
      return Response.json(
        { error: "notification_id or mark_all required" },
        { status: 400 },
      );
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("PUT /api/notifications:", e);
    return Response.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("device_id");
    const notificationId = searchParams.get("notification_id");

    if (!deviceId)
      return Response.json({ error: "device_id required" }, { status: 400 });
    const me = await resolveUser(deviceId);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    if (notificationId) {
      await sql`DELETE FROM mt_notifications WHERE id = ${notificationId} AND user_id = ${me.id}`;
    } else {
      // Clear all read notifications
      await sql`DELETE FROM mt_notifications WHERE user_id = ${me.id} AND read = true`;
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/notifications:", e);
    return Response.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
