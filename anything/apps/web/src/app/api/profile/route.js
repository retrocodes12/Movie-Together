import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("device_id");

    if (!deviceId) {
      return Response.json({ error: "device_id required" }, { status: 400 });
    }

    const rows = await sql`
      SELECT * FROM mt_users WHERE device_id = ${deviceId} LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ user: null }, { status: 200 });
    }

    return Response.json({ user: rows[0] });
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return Response.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { device_id, username, display_name, avatar_url, bio } = body;

    if (!device_id || !username || !display_name) {
      return Response.json(
        { error: "device_id, username, and display_name are required" },
        { status: 400 },
      );
    }

    // Check username taken
    const existing = await sql`
      SELECT id FROM mt_users WHERE username = ${username.toLowerCase()} LIMIT 1
    `;
    if (existing.length > 0) {
      return Response.json(
        { error: "Username already taken" },
        { status: 409 },
      );
    }

    const rows = await sql`
      INSERT INTO mt_users (device_id, username, display_name, avatar_url, bio)
      VALUES (${device_id}, ${username.toLowerCase()}, ${display_name}, ${avatar_url || null}, ${bio || ""})
      RETURNING *
    `;

    return Response.json({ user: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/profile error:", error);
    return Response.json(
      { error: "Failed to create profile" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { device_id, display_name, avatar_url, bio } = body;

    if (!device_id) {
      return Response.json({ error: "device_id required" }, { status: 400 });
    }

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      setClauses.push(`display_name = $${paramCount++}`);
      values.push(display_name);
    }
    if (avatar_url !== undefined) {
      setClauses.push(`avatar_url = $${paramCount++}`);
      values.push(avatar_url);
    }
    if (bio !== undefined) {
      setClauses.push(`bio = $${paramCount++}`);
      values.push(bio);
    }

    if (setClauses.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(device_id);
    const query = `UPDATE mt_users SET ${setClauses.join(", ")} WHERE device_id = $${paramCount} RETURNING *`;
    const rows = await sql(query, values);

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ user: rows[0] });
  } catch (error) {
    console.error("PUT /api/profile error:", error);
    return Response.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
