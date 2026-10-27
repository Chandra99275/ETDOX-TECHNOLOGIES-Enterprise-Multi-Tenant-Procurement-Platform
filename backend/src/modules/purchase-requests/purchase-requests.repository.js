
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';
import { startWorkflowRun } from '../workflows/workflows.repository.js';

async function appendAudit(client, context, action, requestId, metadata = {}) {
  await client.query(
    `INSERT INTO audit_events (
       tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata
     )
     VALUES ($1, 'USER', $2, $3, 'purchase_request', $4, $5::jsonb)`,
    [
      context.tenantId,
      context.userId,
      action,
      requestId,
      JSON.stringify(metadata),
    ]
  );
}

async function replaceItems(client, tenantId, requestId, items) {
  await client.query(
    `DELETE FROM purchase_request_items
     WHERE tenant_id = $1 AND purchase_request_id = $2`,
    [tenantId, requestId]
  );

  for (const [index, item] of items.entries()) {
    await client.query(
      `INSERT INTO purchase_request_items
         (tenant_id, purchase_request_id, line_number, description, quantity,
          unit_price, tax_rate, category, line_total)
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         round($5::numeric * $6::numeric * (1 + $7::numeric / 100), 4)
       )`,
      [
        tenantId,
        requestId,
        index + 1,
        item.description,
        item.quantity,
        item.unitPrice,
        item.taxRate,
        item.category ?? null,
      ]
    );
  }
}

async function recalculateTotals(client, tenantId, requestId) {
  await client.query(
    `UPDATE purchase_requests pr
     SET subtotal = totals.subtotal,
         tax_total = totals.tax_total,
         total_amount = totals.subtotal + totals.tax_total,
         updated_at = now()
     FROM (
       SELECT
         COALESCE(sum(quantity * unit_price), 0)::numeric(15,4) AS subtotal,
         COALESCE(sum(quantity * unit_price * tax_rate / 100), 0)::numeric(15,4) AS tax_total
       FROM purchase_request_items
       WHERE tenant_id = $1 AND purchase_request_id = $2
     ) totals
     WHERE pr.tenant_id = $1 AND pr.id = $2`,
    [tenantId, requestId]
  );
}

export async function createPurchaseRequest(context, data, requestNumber) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const supplier = data.preferredSupplierId
      ? await client.query(
          'SELECT 1 FROM suppliers WHERE tenant_id = $1 AND id = $2',
          [context.tenantId, data.preferredSupplierId]
        )
      : undefined;

    if (supplier && !supplier.rowCount) {
      throw new AppError(
        400,
        'INVALID_SUPPLIER',
        'The preferred supplier does not exist in this organization'
      );
    }

    const department = data.departmentId
      ? await client.query(
          'SELECT 1 FROM departments WHERE tenant_id = $1 AND id = $2',
          [context.tenantId, data.departmentId]
        )
      : undefined;

    if (department && !department.rowCount) {
      throw new AppError(
        400,
        'INVALID_DEPARTMENT',
        'The department does not exist in this organization'
      );
    }

    const costCenter = data.costCenterId
      ? await client.query(
          'SELECT 1 FROM cost_centers WHERE tenant_id = $1 AND id = $2',
          [context.tenantId, data.costCenterId]
        )
      : undefined;

    if (costCenter && !costCenter.rowCount) {
      throw new AppError(
        400,
        'INVALID_COST_CENTER',
        'The cost center does not exist in this organization'
      );
    }

    const tenantInfo = await client.query(
      'SELECT base_currency FROM tenants WHERE id = $1',
      [context.tenantId]
    );

    const inserted = await client.query(
      `INSERT INTO purchase_requests
         (tenant_id, request_number, requester_id, department_id, cost_center_id,
          preferred_supplier_id, required_by_date, justification, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, upper($9))
       RETURNING id`,
      [
        context.tenantId,
        requestNumber,
        context.userId,
        data.departmentId ?? null,
        data.costCenterId ?? null,
        data.preferredSupplierId ?? null,
        data.requiredByDate ?? null,
        data.justification ?? null,
        data.currency ?? tenantInfo.rows[0]?.base_currency ?? 'USD',
      ]
    );

    const id = inserted.rows[0].id;

    await replaceItems(client, context.tenantId, id, data.items);
    await recalculateTotals(client, context.tenantId, id);
    await appendAudit(client, context, 'purchase_request.created', id, {
      status: 'DRAFT',
    });

    return readPurchaseRequest(client, context.tenantId, id);
  });
}

async function readPurchaseRequest(client, tenantId, id) {
  const result = await client.query(
    `SELECT pr.*,
       COALESCE(jsonb_agg(jsonb_build_object(
         'id', pri.id,
         'description', pri.description,
         'quantity', pri.quantity,
         'unitPrice', pri.unit_price,
         'taxRate', pri.tax_rate,
         'category', pri.category,
         'lineTotal', pri.line_total
       ) ORDER BY pri.created_at, pri.id)
       FILTER (WHERE pri.id IS NOT NULL), '[]'::jsonb) AS items
     FROM purchase_requests pr
     LEFT JOIN purchase_request_items pri
       ON pri.purchase_request_id = pr.id
       AND pri.tenant_id = pr.tenant_id
     WHERE pr.tenant_id = $1 AND pr.id = $2
     GROUP BY pr.id`,
    [tenantId, id]
  );

  if (!result.rowCount) {
    throw new AppError(404, 'NOT_FOUND', 'Purchase request not found');
  }

  return result.rows[0];
}

export async function getPurchaseRequest(context, id, includeAll) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const visible = await client.query(
      `SELECT 1
       FROM purchase_requests
       WHERE tenant_id = $1 AND id = $2
         AND ($3::boolean OR requester_id = $4)`,
      [context.tenantId, id, includeAll, context.userId]
    );

    if (!visible.rowCount) {
      throw new AppError(404, 'NOT_FOUND', 'Purchase request not found');
    }

    return readPurchaseRequest(client, context.tenantId, id);
  });
}

export async function listPurchaseRequests(context, options) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT pr.id, pr.request_number, pr.requester_id, pr.currency,
              pr.total_amount, pr.status, pr.required_by_date,
              pr.created_at, pr.updated_at
       FROM purchase_requests pr
       WHERE pr.tenant_id = $1
         AND ($2::text IS NULL OR pr.status = $2)
         AND ($3::boolean OR pr.requester_id = $4)
       ORDER BY pr.created_at DESC, pr.id DESC
       LIMIT $5 OFFSET $6`,
      [
        context.tenantId,
        options.status ?? null,
        options.includeAll,
        context.userId,
        options.limit,
        options.offset,
      ]
    );

    const count = await client.query(
      `SELECT count(*)::text AS total
       FROM purchase_requests pr
       WHERE pr.tenant_id = $1
         AND ($2::text IS NULL OR pr.status = $2)
         AND ($3::boolean OR pr.requester_id = $4)`,
      [
        context.tenantId,
        options.status ?? null,
        options.includeAll,
        context.userId,
      ]
    );

    return {
      data: result.rows,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: Number(count.rows[0].total),
      },
    };
  });
}

export async function updatePurchaseRequest(context, id, data, canManage) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT requester_id, status
       FROM purchase_requests
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (
      !current.rowCount ||
      (current.rows[0].requester_id !== context.userId && !canManage)
    ) {
      throw new AppError(404, 'NOT_FOUND', 'Purchase request not found');
    }

    if (
      current.rows[0].status !== 'DRAFT' &&
      current.rows[0].status !== 'CHANGES_REQUESTED'
    ) {
      throw new AppError(
        409,
        'INVALID_STATE',
        'Only draft requests or requests returned for changes can be edited'
      );
    }

    if (data.preferredSupplierId) {
      const exists = await client.query(
        'SELECT 1 FROM suppliers WHERE tenant_id = $1 AND id = $2',
        [context.tenantId, data.preferredSupplierId]
      );

      if (!exists.rowCount) {
        throw new AppError(
          400,
          'INVALID_SUPPLIER',
          'The preferred supplier does not exist in this organization'
        );
      }
    }

    if (data.departmentId) {
      const exists = await client.query(
        'SELECT 1 FROM departments WHERE tenant_id = $1 AND id = $2',
        [context.tenantId, data.departmentId]
      );

      if (!exists.rowCount) {
        throw new AppError(
          400,
          'INVALID_DEPARTMENT',
          'The department does not exist in this organization'
        );
      }
    }

    if (data.costCenterId) {
      const exists = await client.query(
        'SELECT 1 FROM cost_centers WHERE tenant_id = $1 AND id = $2',
        [context.tenantId, data.costCenterId]
      );

      if (!exists.rowCount) {
        throw new AppError(
          400,
          'INVALID_COST_CENTER',
          'The cost center does not exist in this organization'
        );
      }
    }

    await client.query(
      `UPDATE purchase_requests SET
         department_id = COALESCE($3, department_id),
         cost_center_id = COALESCE($4, cost_center_id),
         preferred_supplier_id = COALESCE($5, preferred_supplier_id),
         required_by_date = COALESCE($6::date, required_by_date),
         justification = COALESCE($7, justification),
         currency = COALESCE(upper($8), currency),
         updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [
        context.tenantId,
        id,
        data.departmentId ?? null,
        data.costCenterId ?? null,
        data.preferredSupplierId ?? null,
        data.requiredByDate ?? null,
        data.justification ?? null,
        data.currency ?? null,
      ]
    );

    if (data.items) {
      await replaceItems(client, context.tenantId, id, data.items);
      await recalculateTotals(client, context.tenantId, id);
    }

    await appendAudit(client, context, 'purchase_request.updated', id, {
      fields: Object.keys(data),
    });

    return readPurchaseRequest(client, context.tenantId, id);
  });
}

export async function submitPurchaseRequest(context, id) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT requester_id, status, total_amount
       FROM purchase_requests
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (
      !current.rowCount ||
      current.rows[0].requester_id !== context.userId
    ) {
      throw new AppError(404, 'NOT_FOUND', 'Purchase request not found');
    }

    if (
      current.rows[0].status !== 'DRAFT' &&
      current.rows[0].status !== 'CHANGES_REQUESTED'
    ) {
      throw new AppError(
        409,
        'INVALID_STATE',
        'Only draft or returned requests can be submitted'
      );
    }

    if (/^0(?:\.0+)?$/.test(current.rows[0].total_amount)) {
      throw new AppError(
        422,
        'INVALID_REQUEST',
        'Purchase request total must be greater than zero'
      );
    }

    const workflow = await client.query(
      `SELECT id, version, graph
       FROM workflow_definitions
       WHERE tenant_id = $1 AND is_active = true
         AND resource_type = 'purchase_request'
       ORDER BY version DESC
       LIMIT 1`,
      [context.tenantId]
    );

    if (!workflow.rowCount) {
      throw new AppError(
        422,
        'WORKFLOW_NOT_CONFIGURED',
        'Configure and activate an approval workflow before submitting requests'
      );
    }

    const run = await startWorkflowRun(
      client,
      context,
      workflow.rows[0].id,
      'purchase_request',
      id,
      workflow.rows[0].graph
    );

    await client.query(
      `UPDATE purchase_requests
       SET status = 'IN_APPROVAL', workflow_run_id = $3,
           submitted_at = now(), updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, id, run.id]
    );

    await appendAudit(client, context, 'purchase_request.submitted', id, {
      workflowRunId: run.id,
      workflowVersion: workflow.rows[0].version,
    });

    return readPurchaseRequest(client, context.tenantId, id);
  });
}

export async function cancelPurchaseRequest(context, id, canManage) {
  return withTenantTransaction(context.tenantId, async (client) => {
    const request = await client.query(
      `SELECT requester_id, status, workflow_run_id
       FROM purchase_requests
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (
      !request.rowCount ||
      (request.rows[0].requester_id !== context.userId && !canManage)
    ) {
      throw new AppError(404, 'NOT_FOUND', 'Purchase request not found');
    }

    if (
      ![
        'DRAFT',
        'SUBMITTED',
        'IN_APPROVAL',
        'CHANGES_REQUESTED',
      ].includes(request.rows[0].status)
    ) {
      throw new AppError(
        409,
        'INVALID_STATE',
        'This purchase request can no longer be cancelled'
      );
    }

    if (request.rows[0].workflow_run_id) {
      await client.query(
        `UPDATE approval_tasks
         SET status = 'CANCELLED', updated_at = now()
         WHERE tenant_id = $1 AND workflow_run_id = $2
           AND status = 'PENDING'`,
        [context.tenantId, request.rows[0].workflow_run_id]
      );

      await client.query(
        `UPDATE workflow_runs
         SET status = 'CANCELLED', completed_at = now(), updated_at = now()
         WHERE tenant_id = $1 AND id = $2 AND status = 'RUNNING'`,
        [context.tenantId, request.rows[0].workflow_run_id]
      );
    }

    await client.query(
      `UPDATE purchase_requests
       SET status = 'CANCELLED', updated_at = now()
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, id]
    );

    await appendAudit(client, context, 'purchase_request.cancelled', id);

    return readPurchaseRequest(client, context.tenantId, id);
  });
}

export function newRequestNumber() {
  return `PR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuid()
    .slice(0, 8)
    .toUpperCase()}`;
}
