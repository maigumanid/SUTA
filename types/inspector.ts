export type BsiProfile = {
  uid: string;
  name: string;
  email: string;
  contactNumber: string;
  assignedBarangayId: string;
  assignedBarangay: string;
  role: 'BSI';
};

export type Inspector = BsiProfile;
