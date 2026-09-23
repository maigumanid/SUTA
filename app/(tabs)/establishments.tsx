import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PlaceCard from '@/components/places/PlaceCard';
import TourOverlay, {
  TourTarget,
} from '@/components/onboarding/TourOverlay';
import {
  COLORS,
  RADIUS,
  SPACING,
} from '@/constants/theme';
import {
  Place,
  PlaceType,
} from '@/types/place';

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
    lastInspectionDate: '2026-09-10',
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
    lastInspectionDate: '2026-09-15',
  },
  {
    id: '4',
    name: 'Barangay Elementary School',
    representativeName: 'Ana Cruz',
    address: 'Purok 4',
    purok: 'Purok 4',
    placeType: 'School',
    status: 'Not Inspected',
    riskLevel: 'Medium',
  },
  {
    id: '5',
    name: 'Barangay Covered Court',
    representativeName: 'Barangay Representative',
    address: 'Purok 5',
    purok: 'Purok 5',
    placeType: 'Public Facility',
    status: 'For Reinspection',
    riskLevel: 'Medium',
    lastInspectionDate: '2026-09-18',
  },
  {
    id: '6',
    name: 'San Roque Chapel',
    representativeName: 'Community Representative',
    address: 'Purok 6',
    purok: 'Purok 6',
    placeType: 'Church',
    status: 'Not Inspected',
    riskLevel: 'Low',
  },
];

const PLACE_TYPES: Array<'All' | PlaceType> = [
  'All',
  'Household / Residence',
  'Food Establishment',
  'Retail Establishment',
  'School',
  'Public Facility',
  'Church',
  'Other Facility',
];

export default function EstablishmentsScreen() {

  const { tour } = useLocalSearchParams<{
    tour?: string;
  }>();

  const isTourActive = tour === 'true';

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

      return () => {
        setIsScreenFocused(false);
        setTourTarget(null);
      };
    }, [])
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
        'Use these filters to view households, establishments, schools, public facilities, and other places.',
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
        showTourStep(0);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [
    isTourActive,
    isScreenFocused,
    isSearchReady,
    tourStep,
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

    return SAMPLE_PLACES.filter((place) => {
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
  }, [search, selectedType]);

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
    <View style={styles.screen}>
      <FlatList
        data={filteredPlaces}
        keyExtractor={(item) => item.id}
        renderItem={renderPlace}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>
                  Places
                </Text>

                <Text style={styles.subtitle}>
                  Households and other places in your assigned barangay
                </Text>
              </View>
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
              <Text style={styles.filterLabel}>
                Place Type
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.filterContainer
                }
              >
                {PLACE_TYPES.map((type) => {
                  const selected =
                    selectedType === type;

                  return (
                    <Pressable
                      key={type}
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
              </ScrollView>
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
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="search-outline"
                size={32}
                color={COLORS.textMuted}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No places found
            </Text>

            <Text style={styles.emptyText}>
              Try changing your search or place type.
            </Text>
          </View>
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
  );
}
  const styles = StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: COLORS.background,
    },

    listContent: {
      padding: SPACING.lg,
      paddingBottom: 40,
    },

    header: {
      marginBottom: SPACING.lg,
    },

    title: {
      fontSize: 28,
      fontWeight: '700',
      color: COLORS.text,
    },

    subtitle: {
      marginTop: 5,
      fontSize: 14,
      lineHeight: 20,
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
      fontSize: 14,
      color: COLORS.text,
      paddingVertical: 12,
    },

    filterSection: {
      marginBottom: SPACING.lg,
    },

    filterLabel: {
      marginBottom: SPACING.sm,
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.text,
    },

    filterContainer: {
      gap: SPACING.sm,
      paddingRight: SPACING.lg,
    },

    filterChip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 20,
      backgroundColor: COLORS.surface,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },

    filterChipSelected: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },

    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
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
      fontSize: 17,
      fontWeight: '700',
      color: COLORS.text,
    },

    resultsCount: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },

    cardWrapper: {
      marginBottom: SPACING.md,
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
      fontSize: 17,
      fontWeight: '700',
      color: COLORS.text,
    },

    emptyText: {
      marginTop: 5,
      fontSize: 13,
      lineHeight: 19,
      color: COLORS.textSecondary,
      textAlign: 'center',
    },

    pressed: {
      opacity: 0.7,
    },
  });
