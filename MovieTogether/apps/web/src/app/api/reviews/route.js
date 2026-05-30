/**
 * GET  /api/reviews?movie_key=&device_id=&friend_ids=
 * POST /api/reviews { device_id, movie_key, movie_title, rating, review_text, spoiler }
 * PUT  /api/reviews { device_id, review_id, rating, review_text, spoiler }
 * DELETE /api/reviews?device_id=&review_id=
 */
import sql from "../utils/sql.js";

async function resolveUser(deviceId) {
  const rows =
    await sql`SELECT id FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
  return rows[0] || null;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const movieKey = searchParams.get("movie_key");
    const deviceId = searchParams.get("device_id");

    let me = null;
    if (deviceId) me = await resolveUser(deviceId);

    if (movieKey) {
      const rows = await sql`
        SELECT r.*, u.username, u.display_name, u.avatar_url
        FROM mt_reviews r
        JOIN mt_users u ON u.id = r.user_id
        WHERE r.movie_key = ${movieKey}
        ORDER BY r.updated_at DESC
        LIMIT 50
      `;

      const avgRows = await sql`
        SELECT AVG(rating)::numeric(4,2) as avg_rating, COUNT(*) as review_count
        FROM mt_reviews WHERE movie_key = ${movieKey} AND rating IS NOT NULL
      `;

      const myReview = me ? rows.find((r) => r.user_id === me.id) : null;

      return Response.json({
        reviews: rows,
        stats: avgRows[0],
        my_review: myReview || null,
      });
    }

    if (me) {
      const rows = await sql`
        SELECT r.*, u.username, u.display_name, u.avatar_url
        FROM mt_reviews r
        JOIN mt_users u ON u.id = r.user_id
        WHERE r.user_id = ${me.id}
        ORDER BY r.updated_at DESC
        LIMIT 50
      `;
      return Response.json({ reviews: rows });
    }

    return Response.json(
      { error: "movie_key or device_id required" },
      { status: 400 },
    );
  } catch (e) {
    console.error("GET /api/reviews:", e);
    return Response.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      device_id,
      movie_key,
      movie_title,
      rating,
      review_text = "",
      spoiler = false,
    } = body;

    if (!device_id || !movie_key || !movie_title)
      return Response.json(
        { error: "device_id, movie_key, movie_title required" },
        { status: 400 },
      );

    if (rating !== undefined && (rating < 1 || rating > 10))
      return Response.json({ error: "rating must be 1–10" }, { status: 400 });

    if (review_text.length > 2000)
      return Response.json(
        { error: "Review too long (max 2000 chars)" },
        { status: 400 },
      );

    const me = await resolveUser(device_id);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    const rows = await sql`
      INSERT INTO mt_reviews (user_id, movie_key, movie_title, rating, review_text, spoiler)
      VALUES (${me.id}, ${movie_key}, ${movie_title}, ${rating || null}, ${review_text}, ${spoiler})
      ON CONFLICT (user_id, movie_key) DO UPDATE
        SET rating = EXCLUDED.rating,
            review_text = EXCLUDED.review_text,
            spoiler = EXCLUDED.spoiler,
            movie_title = EXCLUDED.movie_title,
            updated_at = NOW()
      RETURNING *
    `;
    return Response.json({ review: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("POST /api/reviews:", e);
    return Response.json({ error: "Failed to save review" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("device_id");
    const reviewId = searchParams.get("review_id");

    if (!deviceId || !reviewId)
      return Response.json(
        { error: "device_id and review_id required" },
        { status: 400 },
      );
    const me = await resolveUser(deviceId);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    const result =
      await sql`DELETE FROM mt_reviews WHERE id = ${reviewId} AND user_id = ${me.id} RETURNING id`;
    if (!result.length)
      return Response.json({ error: "Review not found" }, { status: 404 });

    return Response.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/reviews:", e);
    return Response.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
