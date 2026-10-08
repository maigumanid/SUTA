import type { ReinspectionStatus } from '@/storage/reinspectionStorage';

export function isReinspectionOverdue(
  scheduledDate: string,
  status: ReinspectionStatus
) {
  if (status === 'completed') return false;

  const due = new Date(scheduledDate);
  if (Number.isNaN(due.getTime())) return false;

  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}
