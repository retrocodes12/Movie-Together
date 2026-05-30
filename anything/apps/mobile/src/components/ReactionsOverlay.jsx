/**
 * ReactionsOverlay
 *
 * Flying emoji reactions that float up over the video.
 * Polls /api/reactions every 3s for remote reactions.
 * Exposes a `trigger(emoji)` method via ref for local reactions.
 */
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

const MAX_FLYING = 12;

function FlyingReaction({ emoji, x, onDone }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -220,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(onDone);
  }, []);

  return (
    <Animated.View
      style={[
        styles.flying,
        { left: x, transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
    </Animated.View>
  );
}

const ReactionsOverlay = forwardRef(function ReactionsOverlay(
  { roomId, visible = true },
  ref,
) {
  const [flyingReactions, setFlyingReactions] = useState([]);
  const sinceRef = useRef(new Date().toISOString());
  const pollRef = useRef(null);
  const counterRef = useRef(0);

  const addFlying = useCallback((emoji) => {
    const id = ++counterRef.current;
    const x = 20 + Math.random() * 220;
    setFlyingReactions((prev) => {
      const next = [...prev, { id, emoji, x }];
      return next.slice(-MAX_FLYING);
    });
  }, []);

  // Expose trigger() for the parent emoji bar
  useImperativeHandle(
    ref,
    () => ({
      trigger: (emoji) => addFlying(emoji),
    }),
    [addFlying],
  );

  // Poll for remote reactions
  useEffect(() => {
    if (!roomId || !visible) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/reactions?room_id=${roomId}&since=${encodeURIComponent(sinceRef.current)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.reactions?.length > 0) {
          sinceRef.current = data.server_time;
          data.reactions.forEach((r) => addFlying(r.emoji));
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [roomId, visible, addFlying]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {flyingReactions.map((r) => (
        <FlyingReaction
          key={r.id}
          emoji={r.emoji}
          x={r.x}
          onDone={() =>
            setFlyingReactions((prev) => prev.filter((x) => x.id !== r.id))
          }
        />
      ))}
    </View>
  );
});

export default ReactionsOverlay;

export const REACTION_EMOJIS = ["😂", "😱", "🔥", "❤️", "😭", "👏"];

const styles = StyleSheet.create({
  flying: {
    position: "absolute",
    bottom: 90,
  },
});
