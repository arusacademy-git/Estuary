import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '@/lib/db/prisma';
import type { SignatureMimeType, UserSignatureRecord } from '@/domain/signatures/types';

const MAX_SIZE = 300 * 1024;
const PRIVATE_ROOT = path.resolve(process.cwd(), 'runtime', 'private');
const extensions: Record<SignatureMimeType, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};

export type SaveDatabaseSignatureInput = {
    organizationId: string;
    userId: string;
    fileName: string;
    mimeType: SignatureMimeType;
    fileSize: number;
    dataUrl: string;
};

function safeSegment(value: string) {
    return value.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
}

function resolvePrivateFile(storageKey: string) {
    const filePath = path.resolve(PRIVATE_ROOT, ...storageKey.split('/'));
    if (!filePath.startsWith(`${PRIVATE_ROOT}${path.sep}`)) throw new Error('Invalid private signature path.');
    return filePath;
}

function toRecord(document: { id: string; uploaded_by_id: string | null; original_file_name: string; mime_type: string | null; file_size_bytes: number | null; created_at: Date }): UserSignatureRecord {
    const userId = document.uploaded_by_id;
    if (!userId) throw new Error('The signature document has no owner.');
    return {
        id: document.id,
        documentId: document.id,
        userId,
        fileName: document.original_file_name,
        mimeType: (document.mime_type ?? 'image/png') as SignatureMimeType,
        fileSize: document.file_size_bytes ?? 0,
        imageUrl: `/api/v1/signatures/${encodeURIComponent(document.id)}?userId=${encodeURIComponent(userId)}`,
        isActive: true,
        createdAt: document.created_at.toISOString(),
    };
}

export async function getActiveUserSignatureFromDatabase(organizationId: string, userId: string) {
    const membership = await prisma.userOrgMembership.findUnique({
        where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
        select: { signature_url: true, is_active: true, membership_status: true },
    });
    if (!membership?.signature_url || !membership.is_active || membership.membership_status !== 'ACTIVE') return null;
    const document = await prisma.document.findFirst({
        where: { organization_id: organizationId, uploaded_by_id: userId, document_type: 'SIGNATURE_IMAGE', storage_key: membership.signature_url },
    });
    return document ? toRecord(document) : null;
}

export async function saveUserSignatureInDatabase(input: SaveDatabaseSignatureInput) {
    if (!(input.mimeType in extensions)) throw new Error('Please upload a PNG, JPG or WebP signature image.');
    const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match || match[1] !== input.mimeType) throw new Error('The signature image data is invalid.');
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_SIZE || input.fileSize > MAX_SIZE) throw new Error('The signature image must be smaller than 300 KB.');
    const membership = await prisma.userOrgMembership.findUnique({
        where: { user_id_organization_id: { user_id: input.userId, organization_id: input.organizationId } },
        select: { id: true, is_active: true, membership_status: true },
    });
    if (!membership || !membership.is_active || membership.membership_status !== 'ACTIVE') throw new Error('An active organization membership is required.');

    const fileId = randomUUID();
    const storageKey = `signatures/${safeSegment(input.organizationId)}/${safeSegment(input.userId)}/${fileId}.${extensions[input.mimeType]}`;
    const filePath = resolvePrivateFile(storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes, { flag: 'wx' });

    try {
        const document = await prisma.$transaction(async (tx) => {
            const created = await tx.document.create({
                data: {
                    organization_id: input.organizationId,
                    document_type: 'SIGNATURE_IMAGE',
                    storage_bucket: 'local-private',
                    storage_key: storageKey,
                    original_file_name: input.fileName,
                    mime_type: input.mimeType,
                    file_size_bytes: bytes.length,
                    sha256_hash: createHash('sha256').update(bytes).digest('hex'),
                    uploaded_by_id: input.userId,
                },
            });
            await tx.userOrgMembership.update({
                where: { id: membership.id },
                data: { signature_url: storageKey },
            });
            return created;
        });
        return toRecord(document);
    } catch (error) {
        await unlink(filePath).catch(() => undefined);
        throw error;
    }
}

export async function deactivateUserSignatureInDatabase(organizationId: string, userId: string) {
    await prisma.userOrgMembership.update({
        where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
        data: { signature_url: null },
    });
}

export async function readSignatureDocument(documentId: string, userId: string) {
    const document = await prisma.document.findFirst({
        where: { id: documentId, uploaded_by_id: userId, document_type: 'SIGNATURE_IMAGE' },
    });
    if (!document || document.storage_bucket !== 'local-private') return null;
    return { document, bytes: await readFile(resolvePrivateFile(document.storage_key)) };
}
