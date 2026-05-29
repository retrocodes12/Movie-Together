/**
 * GET /api/users/search?q=&device_id=&limit=
 * Search for users by username or display name.
 */
import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const deviceId = searchParams.get("device_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    if (!q || q.length < 2) return Response.json({ users: [] });

    let meId = null;
    if (deviceId) {
      const meRows =
        await sql`SELECT id FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
      if (meRows.length) meId = meRows[0].id;
    }

    const rows = await sql`
      SELECT id, username, display_name, avatar_url, bio
      FROM mt_users
      WHERE (LOWER(username) LIKE ${"%" + q + "%"} OR LOWER(display_name) LIKE ${"%" + q + "%"})
        ${meId ? sql`AND id != ${meId}` : sql``}
      ORDER BY
        CASE WHEN LOWER(username) = ${q} THEN 0 ELSE 1 END,
        LOWER(display_name) ASC
      LIMIT ${limit}
    `;

    return Response.json({ users: rows });
  } catch (e) {
    console.error("GET /api/users/search:", e);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
