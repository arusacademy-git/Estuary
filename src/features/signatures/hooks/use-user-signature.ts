'use client';
import { useCallback, useEffect, useState } from 'react';
import type { SignatureMimeType, UserSignatureRecord } from '@/domain/signatures/types';
import { fetchUserSignature, removeUserSignature, uploadUserSignature } from '@/data/signatures/signature-api';

const MAX_SIZE = 300 * 1024;
function readAsDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read the signature image.')); reader.onerror = () => reject(new Error('Unable to read the signature image.')); reader.readAsDataURL(file); }); }

export function useUserSignature(userId?: string, organizationId = 'beta-arus-org') {
    const [signature, setSignature] = useState<UserSignatureRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const refresh = useCallback(async () => { if (!userId) { setSignature(null); setIsLoading(false); return; } try { setSignature(await fetchUserSignature(organizationId, userId)); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load the signature.'); } finally { setIsLoading(false); } }, [organizationId, userId]);
    useEffect(() => { void refresh(); }, [refresh]);
    const uploadSignature = useCallback(async (file: File) => {
        if (!userId) throw new Error('User account could not be identified.');
        setIsSaving(true); setError('');
        try {
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Please upload a PNG, JPG or WebP signature image.');
            if (!file.size || file.size > MAX_SIZE) throw new Error('The signature image must be smaller than 300 KB.');
            const saved = await uploadUserSignature({ organizationId, userId, fileName: file.name, mimeType: file.type as SignatureMimeType, fileSize: file.size, dataUrl: await readAsDataUrl(file) });
            setSignature(saved); return saved;
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : 'Unable to save the signature.';
            setError(message); throw caught;
        } finally { setIsSaving(false); }
    }, [organizationId, userId]);
    const removeSignature = useCallback(async () => { if (userId) await removeUserSignature(organizationId, userId); setSignature(null); }, [organizationId, userId]);
    return { signature, isLoading, isSaving, error, refresh, uploadSignature, removeSignature };
}
