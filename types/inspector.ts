export type UserRole = 'bsi' | 'admin';

type BaseProfile = {
  uid: string;
  name: string;
  email: string;
  contactNumber: string;
  assignedBarangayId: string;
  assignedBarangay: string;
  active: boolean;
  mustChangePassword: boolean;
  jurisdictionName?: string;
};

export type BsiProfile = BaseProfile & {
  role: 'bsi';
};

export type AdminProfile = BaseProfile & {
  role: 'admin';
};

export type AppProfile = BsiProfile | AdminProfile;

export type Inspector = BsiProfile;
