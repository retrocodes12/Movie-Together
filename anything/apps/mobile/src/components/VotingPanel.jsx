/**
 * VotingPanel
 *
 * Democratic voting overlay for watch rooms.
 * Shows active votes and lets members cast ballots.
 * Polls /api/votes every 5s while open.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import {
  BarChart2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Plus,
  CheckCircle2,
  XCircle,
} from "lucide-react-native";
import { useStore } from "@/store";
import { getTheme, Typography, Radius, Spacing } from "@/utils/theme";

const VOTE_TYPES = [
  { key: "skip_intro", label: "Skip Intro", emoji: "⏭️" },
  { key: "skip_recap", label: "Skip Recap", emoji: "⏩" },
  { key: "resume", label: "Resume Playback", emoji: "▶️" },
  { key: "end_discussion", label: "End Discussion", emoji: "🔕" },
  { key: "change_movie", label: "Change Movie", emoji: "🎬" },
  { key: "custom", label: "Custom Vote", emoji: "🗳️" },
];

function VoteCard({ vote, onVote, myVote, memberCount, C }) {
  const yes = parseInt(vote.yes_count || 0);
  const no = parseInt(vote.no_count || 0);
  const total = parseInt(vote.total_votes || 0);
  const threshold = parseFloat(vote.threshold || 0.5);
  const required = Math.ceil(memberCount * threshold);
  const progress = memberCount > 0 ? yes / memberCount : 0;
  const expiry = new Date(vote.expires_at);
  const secondsLeft = Math.max(0, Math.floor((expiry - Date.now()) / 1000));

  return (
    <View
      style={{
        backgroundColor: C.cardBg,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: C.borderGhost,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: Spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{ ...Typography.label, color: C.foreground, fontSize: 14 }}
          >
            {vote.label}
          </Text>
          <Text
            style={{
              ...Typography.meta,
              color: C.foregroundMuted,
              marginTop: 2,
            }}
          >
            by {vote.creator_name} · needs {required}/{memberCount}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: secondsLeft < 10 ? "#FEF2F2" : C.canvasMuted,
            borderRadius: Radius.full,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Clock
            size={10}
            color={secondsLeft < 10 ? C.red : C.foregroundMuted}
          />
          <Text
            style={{
              fontSize: 11,
              color: secondsLeft < 10 ? C.red : C.foregroundMuted,
              fontFamily: "Inter_500Medium",
            }}
          >
            {secondsLeft}s
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 4,
          backgroundColor: C.borderGhost,
          borderRadius: 2,
          marginBottom: Spacing.sm,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${Math.min(progress * 100, 100)}%`,
            backgroundColor: progress >= threshold ? C.green : C.primary,
            borderRadius: 2,
          }}
        />
      </View>

      <Text
        style={{
          ...Typography.meta,
          color: C.foregroundMuted,
          marginBottom: Spacing.md,
        }}
      >
        {yes} yes · {no} no · {memberCount - total} haven't voted
      </Text>

      {/* Ballot buttons */}
      {!myVote ? (
        <View style={{ flexDirection: "row", gap: Spacing.sm }}>
          <TouchableOpacity
            onPress={() => onVote(vote.id, "yes")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: C.green + "22",
              borderRadius: Radius.sm,
              borderWidth: 1,
              borderColor: C.green,
              paddingVertical: 8,
            }}
          >
            <ThumbsUp size={14} color={C.green} />
            <Text
              style={{
                color: C.green,
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
              }}
            >
              Yes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onVote(vote.id, "no")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: C.red + "22",
              borderRadius: Radius.sm,
              borderWidth: 1,
              borderColor: C.red,
              paddingVertical: 8,
            }}
          >
            <ThumbsDown size={14} color={C.red} />
            <Text
              style={{
                color: C.red,
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
              }}
            >
              No
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: myVote === "yes" ? C.green + "22" : C.red + "22",
            borderRadius: Radius.sm,
            paddingVertical: 8,
          }}
        >
          {myVote === "yes" ? (
            <CheckCircle2 size={14} color={C.green} />
          ) : (
            <XCircle size={14} color={C.red} />
          )}
          <Text
            style={{
              color: myVote === "yes" ? C.green : C.red,
              fontFamily: "Inter_500Medium",
              fontSize: 13,
            }}
          >
            You voted {myVote}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function VotingPanel({ roomId, visible, onClose }) {
  const colorScheme = useStore((s) => s.colorScheme);
  const deviceId = useStore((s) => s.deviceId);
  const C = getTheme(colorScheme);

  const [votes, setVotes] = useState([]);
  const [memberCount, setMemberCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const pollRef = useRef(null);

  const fetchVotes = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(
        `/api/votes?room_id=${roomId}&device_id=${deviceId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setVotes(data.votes || []);
      setMemberCount(data.member_count || 1);
    } catch {}
  }, [roomId, deviceId]);

  useEffect(() => {
    if (!visible) return;
    fetchVotes();
    pollRef.current = setInterval(fetchVotes, 5000);
    return () => clearInterval(pollRef.current);
  }, [visible, fetchVotes]);

  const handleVote = async (voteId, choice) => {
    try {
      await fetch("/api/votes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, vote_id: voteId, choice }),
      });
      fetchVotes();
    } catch {}
  };

  const handleCreateVote = async (voteType, label) => {
    setLoading(true);
    try {
      await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          room_id: roomId,
          vote_type: voteType,
          label,
          duration_s: 30,
        }),
      });
      setShowCreate(false);
      fetchVotes();
    } catch {}
    setLoading(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: C.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: Spacing.xl,
            maxHeight: "75%",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: Spacing.lg,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <BarChart2 size={18} color={C.primary} />
              <Text style={{ ...Typography.cardHeader, color: C.foreground }}>
                Room Votes
              </Text>
              {votes.length > 0 && (
                <View
                  style={{
                    backgroundColor: C.primary,
                    borderRadius: Radius.full,
                    width: 18,
                    height: 18,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 10,
                      fontFamily: "Inter_600SemiBold",
                    }}
                  >
                    {votes.length}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <TouchableOpacity
                onPress={() => setShowCreate(!showCreate)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: C.primarySoft,
                  borderRadius: Radius.sm,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Plus size={14} color={C.primary} />
                <Text
                  style={{
                    color: C.primary,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  New
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Text
                  style={{
                    color: C.foregroundMuted,
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                  }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Create vote picker */}
          {showCreate && (
            <View
              style={{
                backgroundColor: C.canvasMuted,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: C.borderGhost,
                marginBottom: Spacing.lg,
                padding: Spacing.md,
              }}
            >
              <Text
                style={{
                  ...Typography.meta,
                  color: C.foregroundMuted,
                  marginBottom: Spacing.sm,
                }}
              >
                Start a vote:
              </Text>
              {VOTE_TYPES.map((vt) => (
                <TouchableOpacity
                  key={vt.key}
                  onPress={() => handleCreateVote(vt.key, vt.label)}
                  disabled={loading}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.md,
                    paddingVertical: Spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: C.borderGhost,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{vt.emoji}</Text>
                  <Text style={{ ...Typography.label, color: C.foreground }}>
                    {vt.label}
                  </Text>
                  {loading && (
                    <ActivityIndicator
                      size="small"
                      color={C.primary}
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Active votes */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {votes.length === 0 ? (
              <View
                style={{ alignItems: "center", paddingVertical: Spacing.xxl }}
              >
                <BarChart2 size={32} color={C.foregroundMuted} />
                <Text
                  style={{
                    ...Typography.body,
                    color: C.foregroundMuted,
                    marginTop: Spacing.md,
                  }}
                >
                  No active votes
                </Text>
                <Text
                  style={{
                    ...Typography.meta,
                    color: C.foregroundMuted,
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  Tap "New" to start a vote with your room
                </Text>
              </View>
            ) : (
              votes.map((vote) => (
                <VoteCard
                  key={vote.id}
                  vote={vote}
                  onVote={handleVote}
                  myVote={vote.my_vote}
                  memberCount={memberCount}
                  C={C}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
