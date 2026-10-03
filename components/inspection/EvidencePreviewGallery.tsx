import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import type { EvidenceAttachment } from '@/types/householdInspection';

type EvidencePreviewGalleryProps = {
  evidence: EvidenceAttachment[];
  onRemove?: (attachment: EvidenceAttachment) => void;
};

export default function EvidencePreviewGallery({
  evidence,
  onRemove,
}: EvidencePreviewGalleryProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  if (evidence.length === 0) {
    return null;
  }

  return (
    <>
      <Text style={styles.count}>
        Evidence: {evidence.length}{' '}
        {evidence.length === 1 ? 'photo' : 'photos'}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {evidence.map((attachment, index) => (
          <View key={attachment.id} style={styles.thumbnailWrapper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View evidence photo ${index + 1}`}
              onPress={() => setPreviewUri(attachment.uri)}
              style={({ pressed }) => [
                styles.thumbnailButton,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={{ uri: attachment.uri }}
                resizeMode="cover"
                style={styles.thumbnail}
              />
              <View style={styles.expandBadge}>
                <Ionicons
                  name="expand-outline"
                  size={15}
                  color={COLORS.white}
                />
              </View>
            </Pressable>

            {onRemove ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove evidence photo ${index + 1}`}
                hitSlop={6}
                onPress={() => onRemove(attachment)}
                style={({ pressed }) => [
                  styles.removeBadge,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="close"
                  size={17}
                  color={COLORS.white}
                />
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <Modal
        animationType="fade"
        presentationStyle="fullScreen"
        visible={previewUri !== null}
        onRequestClose={() => setPreviewUri(null)}
      >
        <SafeAreaView
          edges={['top', 'right', 'bottom', 'left']}
          style={styles.previewScreen}
        >
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Evidence Photo</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close evidence preview"
              hitSlop={8}
              onPress={() => setPreviewUri(null)}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={26} color={COLORS.white} />
            </Pressable>
          </View>

          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              resizeMode="contain"
              style={styles.previewImage}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  count: {
    marginTop: SPACING.sm,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  list: {
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  thumbnailButton: {
    position: 'relative',
    borderRadius: RADIUS.md,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 104,
    height: 104,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
  },
  expandBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.overlay,
  },
  removeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.violation,
  },
  previewScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
});
