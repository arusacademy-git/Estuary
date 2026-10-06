export type SignatureMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp';

export type UserSignatureRecord = {
  id: string;
  documentId: string;
  userId: string;
  fileName: string;
  mimeType: SignatureMimeType;
  fileSize: number;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  deactivatedAt?: string;
};

export type SaveUserSignatureInput = {
  organizationId: string;
  userId: string;
  fileName: string;
  mimeType: SignatureMimeType;
  fileSize: number;
  dataUrl: string;
};

/* Backward-compatible types used by the existing Payment Voucher files. */
export type DirectorSignatureMimeType = SignatureMimeType;
export type DirectorSignatureRecord = Omit<UserSignatureRecord, 'userId'> & {
  directorId: string;
};
export type SaveDirectorSignatureInput = Omit<SaveUserSignatureInput, 'userId' | 'organizationId'> & {
  directorId: string;
};
