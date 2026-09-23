import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useInspection } from '@/context/InspectionContext';
import { saveInspectionLocally } from '@/storage/inspectionStorage';

export default function InspectionSummaryScreen() {
  const { tour } = useLocalSearchParams<{
    tour?: string;
  }>();

  const isTourActive = tour === 'true';

  const {
    draftInspection,
    clearDraftInspection,
  } = useInspection();

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const formatDate = (value?: string) => {
    if (!value) {
      return 'Not recorded';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Not recorded';
    }

    return date.toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const yesNo = (value?: boolean) => {
    if (value === undefined) {
      return 'Not recorded';
    }

    return value ? 'Yes' : 'No';
  };

  const binaryYesNo = (value?: 1 | 0) => {
    if (value === undefined) {
      return 'Not determined';
    }

    return value === 1 ? 'Yes' : 'No';
  };

  const getWaterSource = () => {
    if (!draftInspection) {
      return 'Not recorded';
    }

    const water =
      draftInspection.safeWaterSupply;

    switch (water.waterSourceType) {
      case 'level_1':
        return 'Level I — Point source';

      case 'level_2':
        return 'Level II — Communal faucet system or stand posts';

      case 'level_3':
        return 'Level III — Waterworks system or individual house connection';

      case 'others':
        return water.otherWaterSource
          ? `Others — ${water.otherWaterSource}`
          : 'Others';

      default:
        return 'Not recorded';
    }
  };

  const getSanitationFacility = () => {
    if (!draftInspection) {
      return 'Not recorded';
    }

    const sanitation =
      draftInspection.sanitationFacility;

    if (sanitation.sanitaryFacilityType) {
      switch (
        sanitation.sanitaryFacilityType
      ) {
        case 'septic_tank':
          return 'Pour/Flush connected to septic tank';

        case 'sewer_system':
          return 'Pour/Flush connected to sewer/sewage system';

        case 'vip_or_composting':
          return 'VIP Latrine or Composting Toilet';
      }
    }

    switch (
      sanitation.unsanitaryToiletType
    ) {
      case 3:
        return 'Water sealed connected to open drain';

      case 2:
        return 'Overhung latrine';

      case 1:
        return 'Open pit latrine';

      case 0:
        return 'Without toilet';

      default:
        return 'Not recorded';
    }
  };

  const getDisposalMethod = () => {
    if (!draftInspection) {
      return 'Not recorded';
    }

    const method =
      draftInspection.sanitationFacility
        .excretaDisposalMethod;

    switch (method) {
      case 'onsite_treatment':
        return 'Stored in containment and treated';

      case 'offsite_dislodging':
        return 'Dislodged, transported and treated/disposed off-site';

      case 'sewer_or_offsite_treatment':
        return 'Conveyed through sewer/sewerage and treated off-site';

      default:
        return 'Not recorded';
    }
  };

  const handleSave = async () => {
    console.log('SAVE BUTTON PRESSED');

    if (!draftInspection) {
      console.log('NO DRAFT INSPECTION');

      Alert.alert(
        'No Inspection',
        'There is no inspection available to save.'
      );

      return;
    }

    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage('Saving inspection...');

      console.log(
        'DRAFT INSPECTION:',
        draftInspection
      );

      const saved =
        await saveInspectionLocally(
          draftInspection
        );

      console.log(
        'SAVED INSPECTION:',
        saved
      );

      setSaveMessage(
        'Inspection saved successfully.'
      );

      Alert.alert(
        'Inspection Saved',
        'The inspection was saved successfully on this device.',
        [
          {
            text: 'OK',
            onPress: () => {
              clearDraftInspection();

              router.replace('/sync');
            },
          },
        ],
        {
          cancelable: false,
        }
      );
    } catch (error) {
      console.error(
        'SAVE ERROR:',
        error
      );

      setSaveMessage(
        'Unable to save inspection.'
      );

      Alert.alert(
        'Save Failed',
        'The inspection could not be saved. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!draftInspection) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons
            name="document-text-outline"
            size={40}
            color="#075E5A"
          />
        </View>

        <Text style={styles.emptyTitle}>
          No Inspection Found
        </Text>

        <Text style={styles.emptyText}>
          No inspection data was passed to
          this review page.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const water =
    draftInspection.safeWaterSupply;

  const sanitation =
    draftInspection.sanitationFacility;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          disabled={isSaving}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color="#17211F"
          />
        </Pressable>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            Review Inspection
          </Text>

          <Text style={styles.headerSubtitle}>
            Check the information before saving
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="clipboard-outline"
            size={22}
            color="#075E5A"
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#3D6F82"
          />

          <Text style={styles.infoText}>
            {isTourActive
              ? 'Final step of the guided tour. Review the inspection information below, then confirm and save the inspection.'
              : 'Review the household inspection information below. You can return to the checklist if something needs to be corrected.'}
          </Text>
        </View>

        <Section
          icon="calendar-outline"
          title="Inspection Information"
        >
          <ReviewRow
            label="Inspection Date"
            value={formatDate(
              draftInspection.inspectionDate
            )}
          />

          <ReviewRow
            label="Place ID"
            value={
              draftInspection.placeId ||
              'Not recorded'
            }
            last
          />
        </Section>

        <Section
          icon="water-outline"
          title="Safe Water Supply"
        >
          <ReviewRow
            label="Water Source"
            value={getWaterSource()}
          />

          <ReviewRow
            label="Located Within Premises"
            value={yesNo(
              water.locatedWithinPremises
            )}
          />

          <ReviewRow
            label="Available at Least 12 Hours"
            value={yesNo(
              water.availableAtLeast12Hours
            )}
          />

          <ReviewRow
            label="SMDWS"
            value={binaryYesNo(
              water.smdwsStatus
            )}
            last
          />
        </Section>

        <Section
          icon="flask-outline"
          title="Microbial Testing"
          optional
        >
          {!water.microbialTest.recorded ? (
            <Text style={styles.notRecorded}>
              No microbial test recorded.
            </Text>
          ) : (
            <>
              <ReviewRow
                label="Date Validation Done"
                value={formatDate(
                  water.microbialTest
                    .dateValidationDone
                )}
              />

              <ReviewRow
                label="E. coli Result"
                value={
                  water.microbialTest
                    .eColiResult === 1
                    ? 'Presence of E. coli'
                    : water.microbialTest
                          .eColiResult === 0
                      ? 'Absence of E. coli'
                      : 'Not recorded'
                }
                last
              />
            </>
          )}
        </Section>

        <Section
          icon="beaker-outline"
          title="Arsenic Testing"
          optional
        >
          {!water.arsenicTest.conducted ? (
            <Text style={styles.notRecorded}>
              No arsenic test recorded.
            </Text>
          ) : (
            <>
              <ReviewRow
                label="Date Testing Done"
                value={formatDate(
                  water.arsenicTest
                    .dateTestingDone
                )}
              />

              <ReviewRow
                label="Arsenic Result"
                value={
                  water.arsenicTest
                    .result === 1
                    ? 'Within allowable PNSDW limit'
                    : water.arsenicTest
                          .result === 0
                      ? 'Above allowable PNSDW limit'
                      : 'Not recorded'
                }
                last
              />
            </>
          )}
        </Section>

        <Section
          icon="home-outline"
          title="Sanitation Facility"
        >
          <ReviewRow
            label="Facility Type"
            value={getSanitationFacility()}
          />

          {sanitation.sanitaryFacilityType && (
            <>
              <ReviewRow
                label="Shared with Other Households"
                value={binaryYesNo(
                  sanitation
                    .sharedWithOtherHouseholds
                )}
              />

              <ReviewRow
                label="Basic Sanitation Facility"
                value={binaryYesNo(
                  sanitation
                    .basicSanitationFacility
                )}
              />

              <ReviewRow
                label="Disposal / Treatment"
                value={getDisposalMethod()}
              />
            </>
          )}

          <ReviewRow
            label="SMSS"
            value={binaryYesNo(
              sanitation.smssStatus
            )}
            last
          />
        </Section>

        <Section
          icon="document-text-outline"
          title="Remarks"
          optional
        >
          <Text
            style={
              draftInspection.remarks.trim()
                ? styles.remarksText
                : styles.notRecorded
            }
          >
            {draftInspection.remarks.trim() ||
              'No remarks recorded.'}
          </Text>
        </Section>

        {saveMessage !== '' && (
          <View style={styles.saveStatus}>
            <Ionicons
              name={
                saveMessage.includes(
                  'successfully'
                )
                  ? 'checkmark-circle'
                  : 'information-circle'
              }
              size={20}
              color="#075E5A"
            />

            <Text style={styles.saveStatusText}>
              {saveMessage}
            </Text>
          </View>
        )}

        <Pressable
          disabled={isSaving}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            isSaving &&
              styles.disabledButton,
            pressed &&
              !isSaving &&
              styles.saveButtonPressed,
          ]}
        >
          <Ionicons
            name={
              isSaving
                ? 'hourglass-outline'
                : 'save-outline'
            }
            size={21}
            color="#FFFFFF"
          />

          <Text style={styles.saveButtonText}>
            {isSaving
              ? 'Saving Inspection...'
              : isTourActive
                ? 'Finish Tour & Save Inspection'
                : 'Confirm & Save Inspection'}
          </Text>
        </Pressable>

        <Pressable
          disabled={isSaving}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color="#075E5A"
          />

          <Text style={styles.editButtonText}>
            Back to Edit Checklist
          </Text>
        </Pressable>

        <View style={styles.offlineCard}>
          <Ionicons
            name="cloud-offline-outline"
            size={20}
            color="#786451"
          />

          <Text style={styles.offlineText}>
            This inspection will be stored on
            this device with Pending sync
            status.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({
  icon,
  title,
  optional,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name={icon}
            size={20}
            color="#075E5A"
          />
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            {title}
          </Text>

          {optional && (
            <Text style={styles.optional}>
              Optional
            </Text>
          )}
        </View>
      </View>

      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.reviewRow,
        !last && styles.reviewRowBorder,
      ]}
    >
      <Text style={styles.reviewLabel}>
        {label}
      </Text>

      <Text style={styles.reviewValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F3EE',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#D8DDD9',
    backgroundColor: '#FFFFFF',
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EEF7F5',
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#17211F',
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#5F6B68',
  },

  headerIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#EEF7F5',
  },

  content: {
    padding: 18,
    paddingBottom: 60,
    gap: 16,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#EEF7F5',
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F6B68',
  },

  section: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8DDD9',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E9E6',
  },

  sectionIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#EEF7F5',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#17211F',
  },

  optional: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: '#89918F',
  },

  sectionContent: {
    paddingHorizontal: 14,
  },

  reviewRow: {
    paddingVertical: 13,
  },

  reviewRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E7E9E6',
  },

  reviewLabel: {
    marginBottom: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#89918F',
  },

  reviewValue: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: '#17211F',
  },

  notRecorded: {
    paddingVertical: 15,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#89918F',
  },

  remarksText: {
    paddingVertical: 15,
    fontSize: 13,
    lineHeight: 20,
    color: '#17211F',
  },

  saveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EEF7F5',
  },

  saveStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#075E5A',
  },

  saveButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
    backgroundColor: '#075E5A',
  },

  saveButtonPressed: {
    opacity: 0.7,
  },

  disabledButton: {
    opacity: 0.55,
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  editButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#075E5A',
  },

  offlineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  offlineText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: '#786451',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F4F3EE',
  },

  emptyIcon: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    backgroundColor: '#EEF7F5',
  },

  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '800',
    color: '#17211F',
  },

  emptyText: {
    marginTop: 8,
    marginBottom: 20,
    maxWidth: 300,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: '#5F6B68',
  },

  primaryButton: {
    minWidth: 160,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#075E5A',
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.65,
  },
});
