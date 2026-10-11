import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useNetwork } from '@/context/NetworkContext';
import type { EvidenceAttachment } from '@/types/householdInspection';
import { createInspectionEvidenceSignedUrl } from '@/services/inspectionRecordService';
import { isLocalEvidenceReadable } from '@/storage/evidenceFileStorage';
import { readInspectionEvidenceStoragePath } from '@/utils/inspectionEvidence';

type EvidencePreviewGalleryProps = {
  evidence: EvidenceAttachment[];
  onRemove?: (attachment: EvidenceAttachment) => void;
  showCount?: boolean;
};

export default function EvidencePreviewGallery({
  evidence,
  onRemove,
  showCount = true,
}: EvidencePreviewGalleryProps) {
  const { isOnline } = useNetwork();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [displayUris, setDisplayUris] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<ReadonlySet<string>>(() => new Set());
  const [resolvedRemotely, setResolvedRemotely] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  useEffect(() => {
    let active = true;
    setDisplayUris({});
    setLoading(new Set(evidence.map((item) => item.id)));
    setResolvedRemotely(new Set());
    setUnavailable(new Set());
    setPreviewId(null);

    void Promise.all(
      evidence.map(async (attachment) => {
        const localUri = attachment.uri.trim();
        const storagePath = readInspectionEvidenceStoragePath(attachment);
        if (
          localUri &&
          !/^https?:\/\//i.test(localUri) &&
          isLocalEvidenceReadable(localUri)
        ) {
          return { id: attachment.id, uri: localUri, remote: false };
        }
        if (/^https?:\/\//i.test(localUri)) {
          // A signed URL supplied by the parent is only an in-memory first
          // attempt. Its stable storage path is used for a fresh URL on error.
          return { id: attachment.id, uri: localUri, remote: false };
        }
        if (storagePath) {
          try {
            return {
              id: attachment.id,
              uri: await createInspectionEvidenceSignedUrl(storagePath),
              remote: true,
            };
          } catch {
            return { id: attachment.id, uri: null, remote: true };
          }
        }
        if (localUri) {
          return { id: attachment.id, uri: localUri, remote: false };
        }
        return { id: attachment.id, uri: null, remote: false };
      })
    ).then((resolved) => {
      if (!active) return;
      setDisplayUris(
        Object.fromEntries(
          resolved.flatMap((item) => item.uri ? [[item.id, item.uri]] : [])
        )
      );
      setResolvedRemotely(
        new Set(resolved.filter((item) => item.remote).map((item) => item.id))
      );
      setUnavailable(
        new Set(resolved.filter((item) => !item.uri).map((item) => item.id))
      );
      setLoading(new Set());
    });

    return () => {
      active = false;
    };
  }, [evidence, isOnline]);

  const handleLoadError = async (attachment: EvidenceAttachment) => {
    const storagePath = readInspectionEvidenceStoragePath(attachment);
    if (storagePath && !resolvedRemotely.has(attachment.id)) {
      try {
        const signedUri = await createInspectionEvidenceSignedUrl(storagePath);
        setDisplayUris((current) => ({ ...current, [attachment.id]: signedUri }));
        setResolvedRemotely((current) => new Set(current).add(attachment.id));
        return;
      } catch {
        // Fall through to the calm unavailable state.
      }
    }

    setUnavailable((current) => new Set(current).add(attachment.id));
    if (previewId === attachment.id) setPreviewId(null);
  };

  if (evidence.length === 0) {
    return null;
  }

  return (
    <>
      {showCount ? (
        <Text style={styles.count}>
          Evidence: {evidence.length}{' '}
          {evidence.length === 1 ? 'photo' : 'photos'}
        </Text>
      ) : null}

      <View style={styles.list}>
        {evidence.map((attachment, index) => (
          <View key={attachment.id} style={styles.thumbnailWrapper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View evidence photo ${index + 1}`}
              disabled={loading.has(attachment.id) || unavailable.has(attachment.id)}
              onPress={() => setPreviewId(attachment.id)}
              style={({ pressed }) => [
                styles.thumbnailButton,
                pressed && styles.pressed,
              ]}
            >
              {loading.has(attachment.id) ? (
                <View style={[styles.thumbnail, styles.unavailable]}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={styles.unavailableText}>Loading photo...</Text>
                </View>
              ) : unavailable.has(attachment.id) ? (
                <View style={[styles.thumbnail, styles.unavailable]}>
                  <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
                  <Text style={styles.unavailableText}>
                    {readInspectionEvidenceStoragePath(attachment)
                      ? isOnline === false
                        ? 'Connect to the internet to view this photo.'
                        : 'Photo could not be loaded.'
                      : 'Photo is not available on this device.'}
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: displayUris[attachment.id] }}
                  contentFit="contain"
                  onError={() => void handleLoadError(attachment)}
                  style={styles.thumbnail}
                />
              )}
              {!loading.has(attachment.id) && !unavailable.has(attachment.id) ? <View style={styles.expandBadge}>
                <Ionicons
                  name="expand-outline"
                  size={15}
                  color={COLORS.white}
                />
              </View> : null}
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
      </View>

      <Modal
        animationType="fade"
        presentationStyle="fullScreen"
        visible={previewId !== null}
        onRequestClose={() => setPreviewId(null)}
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
              onPress={() => setPreviewId(null)}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="close" size={26} color={COLORS.white} />
            </Pressable>
          </View>

          {previewId && displayUris[previewId] ? (
            <Image
              source={{ uri: displayUris[previewId] }}
              contentFit="contain"
              onError={() => {
                setUnavailable((current) => new Set(current).add(previewId));
                setPreviewId(null);
              }}
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
    ...TYPOGRAPHY.tiny,
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  thumbnailButton: {
    position: 'relative',
    width: '100%',
    borderRadius: RADIUS.md,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: '31%',
    minWidth: 88,
    maxWidth: 124,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
  },
  unavailable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  unavailableText: {
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 12,
    color: COLORS.textMuted,
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
    ...TYPOGRAPHY.subheading,
    fontSize: 16,
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
