/**
 * GET  /api/votes?room_id=&device_id=
 * POST /api/votes { device_id, room_id, vote_type, label, threshold, duration_s, payload }
 * PUT  /api/votes { device_id, vote_id, choice: yes|no }  — cast ballot
 */
import sql from "@/app/api/utils/sql";

async function resolveUser(deviceId) {
  const rows =
    await sql`SELECT id FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
  return rows[0] || null;
}

async function resolveAndExecuteVote(voteId, roomId) {
  const voteRows =
    await sql`SELECT * FROM mt_votes WHERE id = ${voteId} LIMIT 1`;
  if (!voteRows.length || voteRows[0].resolved) return null;
  const vote = voteRows[0];

  const memberCount = await sql`
    SELECT COUNT(*) as cnt FROM mt_room_members
    WHERE room_id = ${roomId} AND is_active = true
      AND last_heartbeat > NOW() - INTERVAL '30 seconds'
  `;
  const total = parseInt(memberCount[0].cnt) || 1;

  const ballots =
    await sql`SELECT choice FROM mt_vote_ballots WHERE vote_id = ${voteId}`;
  const yesCount = ballots.filter((b) => b.choice === "yes").length;
  const ratio = yesCount / total;

  const passed = ratio >= vote.threshold;
  const result = passed
    ? "passed"
    : new Date() > new Date(vote.expires_at)
      ? "failed"
      : null;

  if (result) {
    await sql`UPDATE mt_votes SET resolved = true, result = ${result} WHERE id = ${voteId}`;

    if (passed) {
      await executeVoteAction(vote, roomId);
    }
  }
  return result;
}

async function executeVoteAction(vote, roomId) {
  const payload = vote.payload || {};
  switch (vote.vote_type) {
    case "skip_intro":
    case "skip_recap": {
      const skipTo = payload.skip_to || 0;
      await sql`
        UPDATE mt_rooms SET
          playback_state = playback_state || ${JSON.stringify({ position: skipTo, updated_at: new Date().toISOString() })}::jsonb,
          updated_at = NOW()
        WHERE id = ${roomId}
      `;
      break;
    }
    case "resume": {
      await sql`
        UPDATE mt_rooms SET
          status = 'playing',
          playback_state = playback_state || '{"status":"playing"}'::jsonb,
          updated_at = NOW()
        WHERE id = ${roomId}
      `;
      break;
    }
    case "end_discussion": {
      await sql`
        UPDATE mt_discussions SET status = 'ended', ended_at = NOW()
        WHERE room_id = ${roomId} AND status = 'active'
      `;
      await sql`
        UPDATE mt_rooms SET
          status = 'playing',
          playback_state = playback_state || '{"status":"playing"}'::jsonb,
          updated_at = NOW()
        WHERE id = ${roomId}
      `;
      break;
    }
  }
  // Log event
  await sql`
    INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
    VALUES (${roomId}, NULL, 'VOTE_EXECUTED',
            ${JSON.stringify({ vote_type: vote.vote_type, vote_id: vote.id })}::jsonb)
  `;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("room_id");
    const deviceId = searchParams.get("device_id");

    if (!roomId)
      return Response.json({ error: "room_id required" }, { status: 400 });

    let me = null;
    if (deviceId) {
      const userRows =
        await sql`SELECT id FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
      if (userRows.length) me = userRows[0];
    }

    // Auto-expire unresolved votes
    await sql`
      UPDATE mt_votes SET resolved = true, result = 'expired'
      WHERE room_id = ${roomId} AND resolved = false AND expires_at < NOW()
    `;

    const votes = await sql`
      SELECT v.*,
        u.display_name as creator_name,
        (SELECT COUNT(*) FROM mt_vote_ballots WHERE vote_id = v.id AND choice = 'yes') as yes_count,
        (SELECT COUNT(*) FROM mt_vote_ballots WHERE vote_id = v.id AND choice = 'no') as no_count,
        (SELECT COUNT(*) FROM mt_vote_ballots WHERE vote_id = v.id) as total_votes
      FROM mt_votes v
      LEFT JOIN mt_users u ON u.id = v.created_by
      WHERE v.room_id = ${roomId} AND v.resolved = false
      ORDER BY v.created_at DESC
      LIMIT 10
    `;

    // Attach my ballot
    let myBallots = {};
    if (me && votes.length) {
      const voteIds = votes.map((v) => v.id);
      const ballots = await sql`
        SELECT vote_id, choice FROM mt_vote_ballots
        WHERE vote_id = ANY(${voteIds}::int[]) AND user_id = ${me.id}
      `;
      ballots.forEach((b) => {
        myBallots[b.vote_id] = b.choice;
      });
    }

    const memberCount = await sql`
      SELECT COUNT(*) as cnt FROM mt_room_members
      WHERE room_id = ${roomId} AND is_active = true
        AND last_heartbeat > NOW() - INTERVAL '30 seconds'
    `;

    return Response.json({
      votes: votes.map((v) => ({ ...v, my_vote: myBallots[v.id] || null })),
      member_count: parseInt(memberCount[0].cnt),
    });
  } catch (e) {
    console.error("GET /api/votes:", e);
    return Response.json({ error: "Failed to fetch votes" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      device_id,
      room_id,
      vote_type,
      label,
      threshold = 0.5,
      duration_s = 30,
      payload = {},
    } = body;

    if (!device_id || !room_id || !vote_type || !label)
      return Response.json(
        { error: "device_id, room_id, vote_type, label required" },
        { status: 400 },
      );

    const VALID_TYPES = [
      "skip_intro",
      "skip_recap",
      "change_movie",
      "change_episode",
      "resume",
      "end_discussion",
      "custom",
    ];
    if (!VALID_TYPES.includes(vote_type))
      return Response.json(
        { error: `vote_type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 },
      );

    const me = await resolveUser(device_id);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    // Must be room member
    const member = await sql`
      SELECT id FROM mt_room_members WHERE room_id = ${room_id} AND user_id = ${me.id} AND is_active = true LIMIT 1
    `;
    if (!member.length)
      return Response.json(
        { error: "Not a member of this room" },
        { status: 403 },
      );

    // Only one active vote per type per room
    const existing = await sql`
      SELECT id FROM mt_votes WHERE room_id = ${room_id} AND vote_type = ${vote_type} AND resolved = false LIMIT 1
    `;
    if (existing.length)
      return Response.json(
        { error: "A vote of this type is already active" },
        { status: 409 },
      );

    const expiresAt = new Date(Date.now() + duration_s * 1000).toISOString();
    const rows = await sql`
      INSERT INTO mt_votes (room_id, created_by, vote_type, label, threshold, expires_at, payload)
      VALUES (${room_id}, ${me.id}, ${vote_type}, ${label}, ${threshold}, ${expiresAt}::timestamptz, ${JSON.stringify(payload)}::jsonb)
      RETURNING *
    `;

    // Auto-cast yes for creator
    await sql`
      INSERT INTO mt_vote_ballots (vote_id, user_id, choice) VALUES (${rows[0].id}, ${me.id}, 'yes')
      ON CONFLICT DO NOTHING
    `;

    // Notify room via event log
    await sql`
      INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
      VALUES (${room_id}, ${me.id}, 'VOTE_STARTED', ${JSON.stringify({ vote_id: rows[0].id, vote_type, label })}::jsonb)
    `;

    return Response.json({ vote: rows[0] }, { status: 201 });
  } catch (e) {
    console.error("POST /api/votes:", e);
    return Response.json({ error: "Failed to create vote" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { device_id, vote_id, choice } = body;

    if (!device_id || !vote_id || !["yes", "no"].includes(choice))
      return Response.json(
        { error: "device_id, vote_id, choice (yes|no) required" },
        { status: 400 },
      );

    const me = await resolveUser(device_id);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    const voteRows =
      await sql`SELECT * FROM mt_votes WHERE id = ${vote_id} AND resolved = false AND expires_at > NOW() LIMIT 1`;
    if (!voteRows.length)
      return Response.json(
        { error: "Vote not found or expired" },
        { status: 404 },
      );
    const vote = voteRows[0];

    // Must be room member
    const member = await sql`
      SELECT id FROM mt_room_members WHERE room_id = ${vote.room_id} AND user_id = ${me.id} AND is_active = true LIMIT 1
    `;
    if (!member.length)
      return Response.json({ error: "Not a member" }, { status: 403 });

    await sql`
      INSERT INTO mt_vote_ballots (vote_id, user_id, choice) VALUES (${vote_id}, ${me.id}, ${choice})
      ON CONFLICT (vote_id, user_id) DO UPDATE SET choice = EXCLUDED.choice
    `;

    // Check if vote should resolve
    const result = await resolveAndExecuteVote(vote_id, vote.room_id);

    return Response.json({ success: true, resolved: !!result, result });
  } catch (e) {
    console.error("PUT /api/votes:", e);
    return Response.json({ error: "Failed to cast ballot" }, { status: 500 });
  }
}
