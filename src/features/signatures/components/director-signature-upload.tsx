'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './director-signature.module.css';

import { useUserSignature } from '../hooks/use-user-signature';

type DirectorSignatureUploadProps = {
  directorId: string;
  directorName: string;
};

function formatFileSize(size: number) {
  return `${Math.ceil(size / 1024)} KB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function DirectorSignatureUpload({
  directorId,
  directorName,
}: DirectorSignatureUploadProps) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [localError, setLocalError] =
    useState('');

  const [savedMessage, setSavedMessage] =
    useState('');

  const {
    signature,
    isLoading,
    isSaving,
    error,
    uploadSignature,
    removeSignature,
  } = useUserSignature(directorId);

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ''),
    [selectedFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(file);
    setSavedMessage('');
    setLocalError('');
  }

  async function handleSave() {
    if (!selectedFile) {
      setLocalError(
        'Please select a signature image.',
      );

      return;
    }

    setLocalError('');
    setSavedMessage('');

    try {
      await uploadSignature(selectedFile);

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setSavedMessage(
        'Director signature saved successfully.',
      );
    } catch {
      // The hook exposes the error message.
    }
  }

  function handleRemove() {
    const confirmed = window.confirm(
      'Remove the active signature? Previously approved vouchers will retain their historical signature reference.',
    );

    if (!confirmed) {
      return;
    }

    removeSignature();
    setSelectedFile(null);
    setSavedMessage(
      'The active signature was removed.',
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  if (isLoading) {
    return (
      <section className={styles.signaturePanel}>
        Loading signature settings…
      </section>
    );
  }

  const displayedImage =
  previewUrl || signature?.imageUrl;

  return (
    <section className={styles.signaturePanel}>
      <header className={styles.signatureHeader}>
        <div>
          <p>Approval signature</p>
          <h1>My Signature</h1>

          <span>
            This signature will be applied when{' '}
            {directorName} approves Payment Vouchers.
          </span>
        </div>

        <span
          className={
            signature
              ? styles.signatureAvailable
              : styles.signatureMissing
          }
        >
          {signature
            ? 'Signature available'
            : 'Signature required'}
        </span>
      </header>

      {(localError || error) && (
        <div
          className={styles.signatureError}
          role="alert"
        >
          {localError || error}
        </div>
      )}

      {savedMessage && (
        <div
          className={styles.signatureSuccess}
          role="status"
        >
          {savedMessage}
        </div>
      )}

      <div className={styles.signatureLayout}>
        <div className={styles.signaturePreview}>
          <span>Signature preview</span>

          <div className={styles.signatureCanvas}>
            {displayedImage ? (
              <img
                src={displayedImage}
                alt={`${directorName} signature`}
              />
            ) : (
              <div
                className={
                  styles.signaturePlaceholder
                }
              >
                <strong>No signature uploaded</strong>

                <p>
                  A transparent PNG image provides the
                  cleanest result.
                </p>
              </div>
            )}
          </div>

          {signature && !selectedFile && (
            <dl className={styles.signatureMetadata}>
              <div>
                <dt>File</dt>
                <dd>{signature.fileName}</dd>
              </div>

              <div>
                <dt>Size</dt>
                <dd>
                  {formatFileSize(
                    signature.fileSize,
                  )}
                </dd>
              </div>

              <div>
                <dt>Uploaded</dt>
                <dd>
                  {formatDate(
                    signature.createdAt,
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <div className={styles.signatureControls}>
          <div>
            <h2>
              {signature
                ? 'Replace signature'
                : 'Upload signature'}
            </h2>

            <p>
              Upload PNG, JPG or WebP. Maximum file
              size is 300 KB.
            </p>
          </div>

          <label className={styles.signatureFileField}>
            <span>Select signature image</span>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelection}
            />
          </label>

          {selectedFile && (
            <div className={styles.selectedFile}>
              <div>
                <strong>{selectedFile.name}</strong>

                <span>
                  {formatFileSize(
                    selectedFile.size,
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);

                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Remove selection
              </button>
            </div>
          )}

          <button
            className={styles.saveSignatureButton}
            type="button"
            disabled={
              !selectedFile || isSaving
            }
            onClick={handleSave}
          >
            {isSaving
              ? 'Saving signature…'
              : signature
                ? 'Save replacement'
                : 'Save signature'}
          </button>

          {signature && (
            <button
              className={
                styles.removeSignatureButton
              }
              type="button"
              disabled={isSaving}
              onClick={handleRemove}
            >
              Remove active signature
            </button>
          )}

          <aside className={styles.signatureNotice}>
            <strong>Beta storage</strong>

            <p>
              The image is stored in this browser for
              dummy testing. Production should upload
              it to protected object storage.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}