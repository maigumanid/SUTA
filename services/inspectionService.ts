import { doc, setDoc } from 'firebase/firestore';

import { requireFirebase } from '@/services/firebase';
import {
  InspectionScope,
  StoredInspection,
  updateInspectionSyncStatus,
} from '@/storage/inspectionStorage';

export async function uploadInspection(
  inspection: StoredInspection,
  scope: InspectionScope
) {
  const { db } = requireFirebase();

  try {
    await setDoc(doc(db, 'inspections', inspection.id), {
      ...inspection,
      bsiUid: scope.bsiUid,
      barangayId: scope.barangayId,
      syncStatus: 'synced',
      syncedAt: new Date().toISOString(),
    });
    await updateInspectionSyncStatus(inspection.id, 'synced', scope);
  } catch (error) {
    await updateInspectionSyncStatus(inspection.id, 'failed', scope);
    throw error;
  }
}
