/**
 * GET  /api/watchhistory?device_id=&limit=
 * POST /api/watchhistory { device_id, room_id, movie_key, movie_title, movie_genre, movie_year, watch_duration, completed }
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

    if (!deviceId)
      return Response.json({ error: "device_id required" }, { status: 400 });
    const me = await resolveUser(deviceId);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    const rows = await sql`
      SELECT wh.*,
        (SELECT AVG(r.rating)::numeric(4,2) FROM mt_reviews r WHERE r.movie_key = wh.movie_key) as avg_rating,
        (SELECT r.rating FROM mt_reviews r WHERE r.movie_key = wh.movie_key AND r.user_id = ${me.id} LIMIT 1) as my_rating
      FROM mt_watch_history wh
      WHERE wh.user_id = ${me.id}
      ORDER BY wh.watched_at DESC
      LIMIT ${limit}
    `;

    // Stats
    const stats = await sql`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(DISTINCT movie_key) as unique_movies,
        COALESCE(SUM(watch_duration), 0) as total_seconds,
        COUNT(*) FILTER (WHERE completed = true) as completed_count
      FROM mt_watch_history
      WHERE user_id = ${me.id}
    `;

    return Response.json({ history: rows, stats: stats[0] });
  } catch (e) {
    console.error("GET /api/watchhistory:", e);
    return Response.json(
      { error: "Failed to fetch watch history" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      device_id,
      room_id,
      movie_key,
      movie_title,
      movie_genre = "",
      movie_year,
      watch_duration = 0,
      completed = false,
    } = body;

    if (!device_id || !movie_key || !movie_title)
      return Response.json(
        { error: "device_id, movie_key, movie_title required" },
        { status: 400 },
      );

    const me = await resolveUser(device_id);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    // Get co-watchers if room_id provided
    let watchedWith = [];
    if (room_id) {
      const members = await sql`
        SELECT rm.user_id FROM mt_room_members rm
        WHERE rm.room_id = ${room_id} AND rm.is_active = true AND rm.user_id != ${me.id}
      `;
      watchedWith = members.map((m) => m.user_id);
    }

    const rows = await sql`
      INSERT INTO mt_watch_history (user_id, room_id, movie_key, movie_title, movie_genre, movie_year, watched_with, watch_duration, completed)
      VALUES (${me.id}, ${room_id || null}, ${movie_key}, ${movie_title}, ${movie_genre}, ${movie_year || null},
              ${JSON.stringify(watchedWith)}::jsonb, ${watch_duration}, ${completed})
      RETURNING *
    `;

    return Response.json({ entry: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("POST /api/watchhistory:", e);
    return Response.json(
      { error: "Failed to log watch history" },
      { status: 500 },
    );
  }
}
