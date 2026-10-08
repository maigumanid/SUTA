import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export type ReinspectionCalendarInput = {
  userId: string;
  reinspectionId: string;
  scheduledDate: string;
  placeName: string;
  address?: string;
  barangay?: string;
  originalResult?: string;
  riskLevel?: string;
};

export type ReinspectionCalendarState = {
  dateKey: string;
  outcome: 'created' | 'updated';
  eventId: string;
  calendarId: string;
  recordedAt: string;
};

export type ReinspectionCalendarStatus =
  | 'not_added'
  | 'added'
  | 'updated'
  | 'needs_update';

const stateKey = (userId: string, reinspectionId: string) =>
  `suta_reinspection_calendar:${userId}:${reinspectionId}`;

function dateOnlyParts(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) {
    throw new Error('The scheduled reinspection date is invalid.');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const validation = new Date(Date.UTC(year, month - 1, day));
  if (
    validation.getUTCFullYear() !== year ||
    validation.getUTCMonth() !== month - 1 ||
    validation.getUTCDate() !== day
  ) {
    throw new Error('The scheduled reinspection date is invalid.');
  }
  return { year, month, day };
}

function calendarDateKey(value: string) {
  const { year, month, day } = dateOnlyParts(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getReinspectionAllDayRange(value: string) {
  const { year, month, day } = dateOnlyParts(value);
  // Android calendar providers represent all-day boundaries at UTC midnight.
  // Building from the literal YYYY-MM-DD components prevents local-midnight
  // conversion from moving the event to the preceding UTC date.
  const startDate = new Date(Date.UTC(year, month - 1, day));
  const endDate = new Date(Date.UTC(year, month - 1, day + 1));
  return { startDate, endDate };
}

function eventDetails(input: ReinspectionCalendarInput) {
  const { startDate, endDate } = getReinspectionAllDayRange(input.scheduledDate);
  return {
    title: `SUTA Reinspection - ${input.placeName}`,
    startDate,
    endDate,
    allDay: true,
    timeZone: 'UTC',
    ...(Platform.OS === 'android' ? { endTimeZone: 'UTC' } : {}),
    location: input.address?.trim() || undefined,
    notes: 'Scheduled sanitation reinspection. Open SUTA for the authorized inspection record.',
    alarms: [
      {
        relativeOffset: -1440,
        ...(Platform.OS === 'android'
          ? { method: Calendar.AlarmMethod.DEFAULT }
          : {}),
      },
    ],
  };
}

async function readState(userId: string, reinspectionId: string) {
  const raw = await AsyncStorage.getItem(stateKey(userId, reinspectionId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReinspectionCalendarState>;
    return typeof parsed.dateKey === 'string' &&
      (parsed.outcome === 'created' || parsed.outcome === 'updated') &&
      typeof parsed.eventId === 'string' &&
      typeof parsed.calendarId === 'string' &&
      typeof parsed.recordedAt === 'string'
      ? (parsed as ReinspectionCalendarState)
      : null;
  } catch {
    return null;
  }
}

async function readEvent(eventId: string) {
  try {
    return await Calendar.getEventAsync(eventId);
  } catch {
    return null;
  }
}

async function eventExists(eventId: string) {
  return Boolean(await readEvent(eventId));
}

function eventStartDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

async function requireWritableCalendar() {
  if (Platform.OS === 'web') {
    throw new Error('Calendar reminders are available in the installed Android or iOS app.');
  }
  if (!(await Calendar.isAvailableAsync())) {
    throw new Error('No compatible device calendar is available.');
  }

  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow calendar access in device settings to add this reminder.');
  }

  if (Platform.OS === 'ios') return Calendar.getDefaultCalendarAsync();

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((calendar) => calendar.allowsModifications);
  const selected = writable.find((calendar) => calendar.isPrimary) ?? writable[0];
  if (!selected) throw new Error('No writable device calendar is available.');
  return selected;
}

export async function getReinspectionCalendarState(
  userId: string,
  reinspectionId: string
) {
  return readState(userId, reinspectionId);
}

export async function getReinspectionCalendarStatus(
  input: Pick<ReinspectionCalendarInput, 'userId' | 'reinspectionId' | 'scheduledDate'>
): Promise<{ state: ReinspectionCalendarState | null; status: ReinspectionCalendarStatus }> {
  const state = await readState(input.userId, input.reinspectionId);
  if (!state) return { state: null, status: 'not_added' };
  const event = await readEvent(state.eventId);
  const expectedDateKey = calendarDateKey(input.scheduledDate);
  if (!event) return { state, status: 'needs_update' };
  if (
    state.dateKey !== expectedDateKey ||
    !event.allDay ||
    eventStartDateKey(event.startDate) !== expectedDateKey
  ) {
    return { state, status: 'needs_update' };
  }
  return { state, status: state.outcome === 'updated' ? 'updated' : 'added' };
}

export async function saveReinspectionCalendarEvent(
  input: ReinspectionCalendarInput
): Promise<{ state: ReinspectionCalendarState; status: 'added' | 'updated' }> {
  const previous = await readState(input.userId, input.reinspectionId);
  const details = eventDetails(input);
  const writableCalendar = await requireWritableCalendar();
  let eventId: string;
  let calendarId: string;
  let outcome: ReinspectionCalendarState['outcome'];

  if (previous && (await eventExists(previous.eventId))) {
    await Calendar.updateEventAsync(previous.eventId, details);
    eventId = previous.eventId;
    calendarId = previous.calendarId;
    outcome = 'updated';
  } else {
    calendarId = writableCalendar.id;
    eventId = await Calendar.createEventAsync(writableCalendar.id, details);
    outcome = 'created';
  }

  const state: ReinspectionCalendarState = {
    dateKey: calendarDateKey(input.scheduledDate),
    outcome,
    eventId,
    calendarId,
    recordedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(stateKey(input.userId, input.reinspectionId), JSON.stringify(state));
  return { state, status: outcome === 'created' ? 'added' : 'updated' };
}

export async function removeReinspectionCalendarEvent(
  userId: string,
  reinspectionId: string
) {
  const state = await readState(userId, reinspectionId);
  if (state && (await eventExists(state.eventId))) {
    await Calendar.deleteEventAsync(state.eventId);
  }
  await AsyncStorage.removeItem(stateKey(userId, reinspectionId));
}
