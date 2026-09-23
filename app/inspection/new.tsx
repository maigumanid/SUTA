import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { Place } from '@/types/place';

const SAMPLE_PLACES: Place[] = [
  {
    id: '1',
    name: 'Dela Cruz Household',
    representativeName: 'Juan Dela Cruz',
    address: 'Purok 1',
    purok: 'Purok 1',
    placeType: 'Household / Residence',
    status: 'Not Inspected',
    riskLevel: 'Low',
  },
  {
    id: '2',
    name: 'Santos Household',
    representativeName: 'Maria Santos',
    address: 'Purok 2',
    purok: 'Purok 2',
    placeType: 'Household / Residence',
    status: 'For Reinspection',
    riskLevel: 'High',
    lastInspectionDate: 'September 10, 2026',
  },
  {
    id: '3',
    name: 'Sample Food House',
    representativeName: 'Pedro Reyes',
    address: 'Purok 3',
    purok: 'Purok 3',
    placeType: 'Food Establishment',
    status: 'Compliant',
    riskLevel: 'Low',
    lastInspectionDate: 'September 15, 2026',
  },
];

export default function NewInspectionScreen() {
  const { placeId, tour } = useLocalSearchParams<{
    placeId?: string;
    tour?: string;
  }>();

  const place = SAMPLE_PLACES.find(
    (item) => item.id === placeId
  );

  if (!place) {
    return (
      <View style={styles.notFound}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={COLORS.textMuted}
        />

        <Text style={styles.notFoundTitle}>
          No place selected
        </Text>

        <Text style={styles.notFoundText}>
          Select a household or other place before starting an inspection.
        </Text>

        <AppButton
          title="Go to Places"
          onPress={() =>
            router.replace('/(tabs)/establishments')
          }
        />
      </View>
    );
  }

  const isHousehold =
    place.placeType === 'Household / Residence';

  const startChecklist = () => {
    router.push(
      `/inspection/checklist?placeId=${place.id}${
        tour === 'true' ? '&tour=true' : ''
      }`
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={COLORS.text}
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>
            New Inspection
          </Text>

          <Text style={styles.headerSubtitle}>
            Confirm the inspection details
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Ionicons
              name="clipboard-outline"
              size={24}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>
              Sanitary Inspection
            </Text>

            <Text style={styles.noticeText}>
              Review the selected place before proceeding to the inspection checklist.
            </Text>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            Selected Place
          </Text>

          <View style={styles.placeCard}>
            <View style={styles.placeHeader}>
              <View style={styles.placeIcon}>
                <Ionicons
                  name={
                    isHousehold
                      ? 'home-outline'
                      : 'business-outline'
                  }
                  size={26}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.placeHeaderContent}>
                <Text style={styles.placeName}>
                  {place.name}
                </Text>

                <Text style={styles.placeType}>
                  {place.placeType}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <InfoRow
              icon="person-outline"
              label={
                isHousehold
                  ? 'Household Head / Representative'
                  : 'Owner / Representative'
              }
              value={place.representativeName}
            />

            <InfoRow
              icon="location-outline"
              label="Purok"
              value={place.purok}
            />
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            Before You Begin
          </Text>

          <View style={styles.reminderCard}>
            <ReminderItem
              icon="checkmark-circle-outline"
              text="Confirm that you are inspecting the correct household or place."
            />

            <ReminderItem
              icon="people-outline"
              text="Coordinate with the household head, owner, or representative before inspection."
            />

            <ReminderItem
              icon="camera-outline"
              text="Photo evidence can be added when violations are found."
            />

            <ReminderItem
              icon="cloud-offline-outline"
              text="Inspection records will later support offline saving and synchronization."
            />
          </View>
        </View>

        <AppButton
          title="Begin Inspection Checklist"
          onPress={startChecklist}
        />

        <Text style={styles.developmentNote}>
          Inspection records are using sample data during development.
        </Text>
      </ScrollView>
    </View>
  );
}

type InfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function InfoRow({
  icon,
  label,
  value,
}: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Ionicons
        name={icon}
        size={19}
        color={COLORS.primary}
      />

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

type ReminderItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
};

function ReminderItem({
  icon,
  text,
}: ReminderItemProps) {
  return (
    <View style={styles.reminderItem}>
      <Ionicons
        name={icon}
        size={20}
        color={COLORS.primary}
      />

      <Text style={styles.reminderText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.lg,
  },

  notice: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },

  noticeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  noticeText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  sectionTitle: {
    marginBottom: SPACING.sm,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  placeCard: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  placeIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  placeHeaderContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  placeType: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  divider: {
    height: 1,
    marginVertical: SPACING.md,
    backgroundColor: COLORS.divider,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  infoValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  reminderCard: {
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  reminderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },

  reminderText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  developmentNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },

  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },

  notFoundText: {
    maxWidth: 300,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.7,
  },
});
