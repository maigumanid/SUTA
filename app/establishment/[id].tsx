import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Compatibility redirect for links created before Establishments was renamed
 * to Places. New navigation should use /place/[id].
 */
export default function LegacyEstablishmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <Redirect href={`/place/${id}`} />;
}
