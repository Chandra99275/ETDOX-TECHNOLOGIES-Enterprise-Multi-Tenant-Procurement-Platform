
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';

export async function listRequestAttachments(context, requestId, canReadAll) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const request = await client.query(
      `SELECT 1
       FROM purchase_requests
       WHERE tenant_id = $1 AND id = $2
         AND ($3::boolean OR requester_id = $4)`,
      [context.tenantId, requestId, canReadAll, context.userId]
    );

    if (!request.rowCount) {
      throw new AppError(
        404,
        'PURCHASE_REQUEST_NOT_FOUND',
        'Purchase request not found'
      );
    }

    const result = await client.query(
      `SELECT id, purchase_request_id, file_name, storage_key, content_type,
              byte_size, uploaded_by, created_at
       FROM purchase_request_attachments
       WHERE tenant_id = $1 AND purchase_request_id = $2
       ORDER BY created_at, id`,
      [context.tenantId, requestId]
    );

    return result.rows;
  });
}

export async function createRequestAttachment(
  context,
  requestId,
  input,
  canManageAny
) {
  assertStorageKey(context.tenantId, input.storageKey);

  return withTenantTransaction(context.tenantId, async (client) => {
    const request = await client.query(
      `SELECT requester_id, status
       FROM purchase_requests
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, requestId]
    );

    if (!request.rowCount) {
      throw new AppError(
        404,
        'PURCHASE_REQUEST_NOT_FOUND',
        'Purchase request not found'
      );
    }

    if (
      request.rows[0].requester_id !== context.userId &&
      !canManageAny
    ) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'You can only attach files to your own purchase requests'
      );
    }

    if (
      !['DRAFT', 'CHANGES_REQUESTED'].includes(
        request.rows[0].status
      )
    ) {
      throw new AppError(
        409,
        'INVALID_STATE',
        'Attachments can only be added to draft or returned requests'
      );
    }

    const result = await client.query(
      `INSERT INTO purchase_request_attachments
         (tenant_id, purchase_request_id, file_name, storage_key,
          content_type, byte_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, purchase_request_id, file_name, storage_key,
                 content_type, byte_size, uploaded_by, created_at`,
      [
        context.tenantId,
        requestId,
        input.fileName,
        input.storageKey,
        input.contentType ?? null,
        input.byteSize ?? null,
        context.userId,
      ]
    );

    await audit(
      client,
      context,
      'purchase_request.attachment_added',
      result.rows[0].id,
      'purchase_request_attachment',
      { purchaseRequestId: requestId }
    );

    return result.rows[0];
  });
}

export async function deleteRequestAttachment(
  context,
  requestId,
  attachmentId,
  canManageAny
) {
  await withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `DELETE FROM purchase_request_attachments a
       USING purchase_requests pr
       WHERE a.tenant_id = $1
         AND a.purchase_request_id = $2
         AND a.id = $3
         AND pr.tenant_id = a.tenant_id
         AND pr.id = a.purchase_request_id
         AND ($4::boolean OR pr.requester_id = $5)
         AND pr.status IN ('DRAFT', 'CHANGES_REQUESTED')
       RETURNING pr.requester_id, pr.status`,
      [
        context.tenantId,
        requestId,
        attachmentId,
        canManageAny,
        context.userId,
      ]
    );

    if (!result.rowCount) {
      throw new AppError(
        404,
        'NOT_FOUND_OR_LOCKED',
        'Attachment was not found or cannot be deleted'
      );
    }

    await audit(
      client,
      context,
      'purchase_request.attachment_removed',
      attachmentId,
      'purchase_request_attachment',
      { purchaseRequestId: requestId }
    );
  });
}

export async function listSupplierDocuments(context, supplierId) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const supplier = await client.query(
      'SELECT 1 FROM suppliers WHERE tenant_id = $1 AND id = $2',
      [context.tenantId, supplierId]
    );

    if (!supplier.rowCount) {
      throw new AppError(
        404,
        'SUPPLIER_NOT_FOUND',
        'Supplier not found'
      );
    }

    const result = await client.query(
      `SELECT id, supplier_id, document_type, file_name, storage_key,
              content_type, byte_size, expires_on, uploaded_by, created_at
       FROM supplier_documents
       WHERE tenant_id = $1 AND supplier_id = $2
       ORDER BY created_at DESC, id DESC`,
      [context.tenantId, supplierId]
    );

    return result.rows;
  });
}

export async function createSupplierDocument(
  context,
  supplierId,
  input
) {
  assertStorageKey(context.tenantId, input.storageKey);

  return withTenantTransaction(context.tenantId, async (client) => {
    const supplier = await client.query(
      `SELECT 1
       FROM suppliers
       WHERE tenant_id = $1
         AND id = $2
         AND status <> 'ARCHIVED'`,
      [context.tenantId, supplierId]
    );

    if (!supplier.rowCount) {
      throw new AppError(
        404,
        'SUPPLIER_NOT_FOUND',
        'Supplier not found or archived'
      );
    }

    const result = await client.query(
      `INSERT INTO supplier_documents
         (tenant_id, supplier_id, document_type, file_name, storage_key,
          content_type, byte_size, expires_on, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, supplier_id, document_type, file_name, storage_key,
                 content_type, byte_size, expires_on, uploaded_by, created_at`,
      [
        context.tenantId,
        supplierId,
        input.documentType,
        input.fileName,
        input.storageKey,
        input.contentType ?? null,
        input.byteSize ?? null,
        input.expiresOn ?? null,
        context.userId,
      ]
    );

    await audit(
      client,
      context,
      'supplier.document_added',
      result.rows[0].id,
      'supplier_document',
      { supplierId, documentType: input.documentType }
    );

    return result.rows[0];
  });
}

export async function deleteSupplierDocument(
  context,
  supplierId,
  documentId
) {
  await withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `DELETE FROM supplier_documents
       WHERE tenant_id = $1 AND supplier_id = $2 AND id = $3
       RETURNING id`,
      [context.tenantId, supplierId, documentId]
    );

    if (!result.rowCount) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Supplier document not found'
      );
    }

    await audit(
      client,
      context,
      'supplier.document_removed',
      documentId,
      'supplier_document',
      { supplierId }
    );
  });
}

function assertStorageKey(tenantId, key) {
  if (!key.startsWith(`tenants/${tenantId}/`)) {
    throw new AppError(
      400,
      'INVALID_STORAGE_KEY',
      'Storage key must be scoped to the current organization'
    );
  }
}

async function audit(
  client,
  context,
  action,
  resourceId,
  resourceType,
  metadata
) {
  await client.query(
    `INSERT INTO audit_events
       (tenant_id, actor_type, actor_id, action, resource_type,
        resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, $4, $5, $6::jsonb)`,
    [
      context.tenantId,
      context.userId,
      action,
      resourceType,
      resourceId,
      JSON.stringify(metadata),
    ]
  );
}
