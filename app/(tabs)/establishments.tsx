import { Ionicons } from '@expo/vector-icons';
import {
  type Href,
  router,
  useFocusEffect,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PlaceCard from '@/components/places/PlaceCard';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import EmptyState from '@/components/common/EmptyState';
import CompactFilterPanel from '@/components/common/CompactFilterPanel';
import TourOverlay, {
  TourTarget,
} from '@/components/onboarding/TourOverlay';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/theme';
import {
  Place,
  PLACE_TYPES as SUPPORTED_PLACE_TYPES,
  PlaceType,
} from '@/types/place';
import { usePlaces } from '@/context/PlacesContext';
import { useAuth } from '@/context/AuthContext';

const PLACE_TYPES: ('All' | PlaceType)[] = [
  'All',
  ...SUPPORTED_PLACE_TYPES,
];

export default function EstablishmentsScreen() {
  const { places, isLoading, error, refreshPlaces } = usePlaces();
  const { profile } = useAuth();

  const isTourActive = false;

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] =
    useState<'All' | PlaceType>('All');

  const [tourStep, setTourStep] = useState(0);
  const [tourTarget, setTourTarget] =
    useState<TourTarget | null>(null);

  const [isScreenFocused, setIsScreenFocused] =
    useState(false);

  const [isSearchReady, setIsSearchReady] =
    useState(false);

  const searchRef = useRef<View>(null);
  const categoryRef = useRef<View>(null);
  const listRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      void refreshPlaces();

      return () => {
        setIsScreenFocused(false);
        setTourTarget(null);
      };
    }, [refreshPlaces])
  );

  const tourSteps = [
    {
      title: 'Search Places',
      description:
        'Search for a household or other place by name, representative, or purok.',
      ref: searchRef,
    },
    {
      title: 'Filter by Place Type',
      description:
        'Use these filters to view households, businesses, schools, public facilities, and other places.',
      ref: categoryRef,
    },
    {
      title: 'Place Records',
      description:
        'Tap a household or other place to view its information and inspection records.',
      ref: listRef,
    },
  ];

  useEffect(() => {
    if (
      isTourActive &&
      isScreenFocused &&
      isSearchReady &&
      tourStep === 0 &&
      tourTarget === null
    ) {
      const timer = setTimeout(() => {
        searchRef.current?.measureInWindow((x, y, width, height) => {
          setTourTarget({ x, y, width, height });
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [
    isTourActive,
    isScreenFocused,
    isSearchReady,
    tourStep,
    tourTarget,
  ]);

  const showTourStep = (index: number) => {
    if (!isTourActive) {
      return;
    }

    setTourTarget(null);

    setTimeout(() => {
      tourSteps[index].ref.current?.measureInWindow(
        (x, y, width, height) => {
          setTourTarget({
            x,
            y,
            width,
            height,
          });
        }
      );
    }, 350);
  };

  const nextTourStep = () => {
    if (tourStep < tourSteps.length - 1) {
      const next = tourStep + 1;

      setTourTarget(null);
      setTourStep(next);

      setTimeout(() => {
        showTourStep(next);
      }, 100);
    } else {
      setTourTarget(null);

      setTimeout(() => {
        router.push({
          pathname: '/place/[id]',
          params: {
            id: '1',
            tour: 'true',
          },
        });
      }, 150);
    }
  };

  const previousTourStep = () => {
    if (tourStep === 0) {
      return;
    }

    const previous = tourStep - 1;

    setTourTarget(null);
    setTourStep(previous);

    setTimeout(() => {
      showTourStep(previous);
    }, 100);
  };

  const filteredPlaces = useMemo(() => {
    const query = search.trim().toLowerCase();

    return places.filter((place) => {
      const matchesSearch =
        place.name
          .toLowerCase()
          .includes(query) ||
        place.representativeName
          .toLowerCase()
          .includes(query) ||
        place.purok
          .toLowerCase()
          .includes(query);

      const matchesType =
        selectedType === 'All' ||
        place.placeType === selectedType;

      return matchesSearch && matchesType;
    });
  }, [places, search, selectedType]);

  const renderPlace = ({
    item,
    index,
  }: {
    item: Place;
    index: number;
  }) => {
    if (index === 0) {
      return (
        <View
          ref={listRef}
          collapsable={false}
          style={styles.cardWrapper}
        >
          <PlaceCard
            place={item}
            onPress={() => {
              router.push(`/place/${item.id}`);
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.cardWrapper}>
        <PlaceCard
          place={item}
          onPress={() => {
            router.push(`/place/${item.id}`);
          }}
        />
      </View>
    );
  };

  const skipTour = () => {
    setTourTarget(null);

    router.replace(
      '/(tabs)/establishments'
    );
  };

  return (
    <KeyboardSafeView>
      <View style={styles.screen}>
        <FlatList
        data={filteredPlaces}
        keyExtractor={(item) => item.id}
        renderItem={renderPlace}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>
                  Places
                </Text>

                <Text numberOfLines={2} style={styles.subtitle}>
                  Assigned barangay · {profile?.assignedBarangay ?? 'Not assigned'}
                </Text>
              </View>

              <Pressable
                onPress={() => router.push('/place/new')}
                accessibilityRole="button"
                accessibilityLabel="Add place"
                style={({ pressed }) => [
                  styles.addButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.addButtonText}>Add Place</Text>
              </Pressable>
            </View>

            <View style={styles.directoryTools}>
              <Pressable onPress={() => router.push('/field-planning' as Href)} style={({ pressed }) => [styles.directoryTool, pressed && styles.pressed]}><Ionicons name="navigate-circle-outline" size={20} color={COLORS.primary} /><View style={styles.toolCopy}><Text style={styles.toolTitle}>Field Plan</Text><Text style={styles.toolText}>Coverage and priority queue</Text></View></Pressable>
              <Pressable onPress={() => router.push('/place/import')} style={({ pressed }) => [styles.directoryTool, styles.importTool, pressed && styles.pressed]}><Ionicons name="cloud-upload-outline" size={20} color={COLORS.warningDark} /><View style={styles.toolCopy}><Text style={styles.toolTitle}>Bulk Import</Text><Text style={styles.toolText}>Add a census CSV</Text></View></Pressable>
            </View>

            <View
              ref={searchRef}
              collapsable={false}
              style={styles.searchContainer}
              onLayout={() => {
                setIsSearchReady(true);
              }}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.textSecondary}
              />

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, representative, or purok"
                placeholderTextColor={
                  COLORS.textMuted
                }
                style={styles.searchInput}
                autoCapitalize="none"
              />

              {search.length > 0 && (
                <Pressable
                  onPress={() => setSearch('')}
                  hitSlop={10}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.textMuted}
                  />
                </Pressable>
              )}
            </View>

            <View
              ref={categoryRef}
              collapsable={false}
              style={styles.filterSection}
            >
              <CompactFilterPanel
                activeCount={selectedType === 'All' ? 0 : 1}
                summary={selectedType === 'All' ? 'All place types' : selectedType}
                onClear={() => setSelectedType('All')}
              >
                <Text style={styles.filterLabel}>PLACE TYPE</Text>
                <View style={styles.filterContainer}>
                {PLACE_TYPES.map((type) => {
                  const selected =
                    selectedType === type;

                  return (
                    <Pressable
                      key={type}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setSelectedType(type)
                      }
                      style={({ pressed }) => [
                        styles.filterChip,
                        selected &&
                          styles.filterChipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selected &&
                            styles.filterChipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  );
                })}
                </View>
              </CompactFilterPanel>
            </View>

            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                Place Records
              </Text>

              <Text style={styles.resultsCount}>
                {filteredPlaces.length}{' '}
                {filteredPlaces.length === 1
                  ? 'place'
                  : 'places'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={isLoading ? 'hourglass-outline' : 'business-outline'}
            title={isLoading ? 'Loading places...' : 'No places found'}
            description={error ? 'Places could not be refreshed. Check your connection and data access.' : 'Try changing your search or place type, or register a new place.'}
          />
        }
      />

        <TourOverlay
        visible={
          isTourActive &&
          isScreenFocused &&
          tourTarget !== null
        }
        step={tourStep + 1}
        totalSteps={tourSteps.length}
        title={tourSteps[tourStep].title}
        description={
          tourSteps[tourStep].description
        }
        target={tourTarget}
        onNext={nextTourStep}
        onBack={
          tourStep > 0
            ? previousTourStep
            : undefined
        }
        onSkip={skipTour}
        />
      </View>
    </KeyboardSafeView>
  );
}
  const styles = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
    },

    listContent: {
      width: '100%',
      maxWidth: 700,
      alignSelf: 'center',
      padding: SPACING.lg,
      paddingBottom: 40,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },

    headerCopy: { flex: 1, minWidth: 0 },

    addButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      backgroundColor: COLORS.primary,
    },

    addButtonText: {
      ...TYPOGRAPHY.label,
      color: COLORS.white,
    },
    directoryTools: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    directoryTool: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryLight },
    importTool: { backgroundColor: COLORS.warningSoft, borderColor: '#EBD8A7' },
    toolCopy: { flex: 1 }, toolTitle: { ...TYPOGRAPHY.label, color: COLORS.text }, toolText: { ...TYPOGRAPHY.tiny, color: COLORS.textSecondary, marginTop: 1 },

    title: {
      ...TYPOGRAPHY.display,
      fontSize: 28,
      lineHeight: 38,
      color: COLORS.text,
    },

    subtitle: {
      ...TYPOGRAPHY.bodySmall,
      marginTop: 5,
      color: COLORS.textSecondary,
    },

    searchContainer: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.lg,
    },

    searchInput: {
      flex: 1,
      ...TYPOGRAPHY.bodySmall,
      color: COLORS.text,
      paddingVertical: 12,
    },

    filterSection: {
      marginBottom: SPACING.lg,
    },

    filterLabel: {
      ...TYPOGRAPHY.label,
      color: COLORS.textSecondary,
    },

    filterContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },

    filterChip: {
      minHeight: 36,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 20,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },

    filterChipSelected: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },

    filterChipText: {
      ...TYPOGRAPHY.caption,
      color: COLORS.textSecondary,
    },

    filterChipTextSelected: {
      color: COLORS.surface,
    },

    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },

    resultsTitle: {
      ...TYPOGRAPHY.subheading,
      fontSize: 17,
      color: COLORS.text,
    },

    resultsCount: {
      ...TYPOGRAPHY.caption,
      color: COLORS.textSecondary,
    },

    cardWrapper: {
      marginBottom: SPACING.sm,
    },

    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: SPACING.xl,
    },

    emptyIcon: {
      width: 64,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 32,
      backgroundColor: COLORS.primarySoft,
      marginBottom: SPACING.md,
    },

    emptyTitle: {
      ...TYPOGRAPHY.subheading,
      fontSize: 17,
      color: COLORS.text,
    },

    emptyText: {
      ...TYPOGRAPHY.caption,
      marginTop: 5,
      lineHeight: 19,
      color: COLORS.textSecondary,
      textAlign: 'center',
    },

    pressed: {
      opacity: 0.7,
    },
  });
