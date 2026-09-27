import { doc, setDoc } from 'firebase/firestore';

import { requireFirebase } from '@/services/firebase';
import { ReinspectionRecord } from '@/storage/reinspectionStorage';

export async function uploadReinspection(record: ReinspectionRecord) {
  const { db } = requireFirebase();
  await setDoc(
    doc(db, 'reinspections', record.id),
    {
      ...record,
      syncedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
