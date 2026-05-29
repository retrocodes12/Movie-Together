import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ExternalLink, X } from "lucide-react-native";
import { getTheme, Radius, Spacing, Typography } from "@/utils/theme";

export default function ContentSearch({ visible, onClose }) {
  const C = getTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <View
          style={{
            padding: Spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: C.borderGhost,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ ...Typography.cardHeader, color: C.foreground }}>Nuvio content picker</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color={C.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.lg }}>
          <View
            style={{
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: C.borderGhost,
              backgroundColor: C.cardBg,
              padding: Spacing.xl,
              gap: Spacing.md,
            }}
          >
            <ExternalLink size={26} color={C.primary} />
            <Text style={{ ...Typography.cardHeader, color: C.foreground }}>Use Nuvio for discovery and streams</Text>
            <Text style={{ ...Typography.body, color: C.foregroundMuted, lineHeight: 22 }}>
              The custom mobile Stremio picker was removed. Watch Together now extends the Nuvio web app directly:
              browse content, select a Nuvio stream, then create or join a synchronized room from the Nuvio player.
            </Text>
          </View>

          <Text style={{ ...Typography.meta, color: C.foregroundMuted, lineHeight: 20 }}>
            This mobile shell stays focused on room/social surfaces. Content discovery, metadata, addon support,
            stream retrieval, playback, and subtitles belong to Nuvio.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
