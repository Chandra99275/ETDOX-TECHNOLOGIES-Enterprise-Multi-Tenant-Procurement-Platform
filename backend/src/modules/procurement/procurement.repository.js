
import { randomUUID } from "node:crypto";
import { withTenantTransaction } from "../../config/database.js";
import {
  startWorkflowRun,
  actOnTask,
} from "../workflows/workflows.repository.js";

// ============================================================
// CONSTANTS
// ============================================================

const TABLE = "public.purchase_requests";
const APPROVAL_TABLE = "public.approval_tasks";
const DEFAULT_CURRENCY = "USD";
const MAX_PAGE_SIZE = 100;

// ============================================================
// GENERAL HELPERS
// ============================================================

function required(value, field) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    throw new Error(`${field} is required.`);
  }

  return value;
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function normalizeDecision(decision) {
  const value = String(decision || "")
    .trim()
    .toLowerCase();

  if (
    ["approve", "approved", "accept", "accepted"].includes(value)
  ) {
    return "approve";
  }

  if (
    ["reject", "rejected", "decline", "declined"].includes(value)
  ) {
    return "reject";
  }

  throw new Error("Decision must be approve or reject.");
}

function normalizeRequest(row) {
  if (!row) return null;

  const justification = row.justification || "";
  const titleMatch = justification.match(/^Title:\s*(.+)$/m);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    requestNumber: row.request_number,
    requesterId: row.requester_id,
    departmentId: row.department_id,
    department: row.department_id,
    costCenterId: row.cost_center_id,
    preferredSupplierId: row.preferred_supplier_id,
    supplier: row.preferred_supplier_id,
    workflowRunId: row.workflow_run_id,
    requiredByDate: row.required_by_date,
    title: titleMatch?.[1]?.trim() || row.request_number,
    description: justification,
    justification,
    amount: Number(row.total_amount || 0),
    subtotal: Number(row.subtotal || 0),
    taxTotal: Number(row.tax_total || 0),
    totalAmount: Number(row.total_amount || 0),
    currency: String(row.currency || DEFAULT_CURRENCY).trim(),
    status: row.status,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildJustification(title, description) {
  const cleanTitle = String(title || "").trim();
  const cleanDescription = String(description || "").trim();

  if (!cleanTitle && !cleanDescription) return null;
  if (!cleanTitle) return cleanDescription;

  return `Title: ${cleanTitle}\n\n${cleanDescription}`;
}

function parseAmount(value, field = "Amount") {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(
      `${field} must be a valid non-negative number.`
    );
  }

  return amount;
}

function getPage(value, fallback) {
  const number = Number.parseInt(value, 10);

  return Number.isInteger(number) && number > 0
    ? number
    : fallback;
}

function getLimit(value) {
  const number = Number.parseInt(value, 10);

  if (!Number.isInteger(number) || number <= 0) return 20;

  return Math.min(number, MAX_PAGE_SIZE);
}

function assertTenantAndRequest(tenantId, requestId) {
  required(tenantId, "Tenant ID");
  required(requestId, "Request ID");
}

// ============================================================
// WORKFLOW VALIDATION
// ============================================================

function validateApprovalWorkflow(graph) {
  const approvalNodes = Array.isArray(graph?.nodes)
    ? graph.nodes.filter((node) => node.type === "approval")
    : [];

  if (!approvalNodes.length) {
    throw new Error(
      "The active workflow does not contain any approval nodes."
    );
  }

  const missingAssignees = approvalNodes.filter(
    (node) => !isUuid(node.assigneeId)
  );

  if (missingAssignees.length) {
    throw new Error(
      `Every approval node must have a valid assigned user. Missing assignment for: ${missingAssignees
        .map((node) => node.id)
        .join(", ")}.`
    );
  }
}

// ============================================================
// START APPROVAL WORKFLOW
// Must be called inside an existing tenant transaction.
// ============================================================

async function startApprovalWorkflow(
  client,
  tenantId,
  userId,
  request
) {
  const definitionResult = await client.query(
    `
      SELECT id, graph, name
      FROM public.workflow_definitions
      WHERE tenant_id = $1
        AND resource_type = 'purchase_request'
        AND is_active = true
      ORDER BY version DESC, created_at DESC
      LIMIT 1
      FOR SHARE
    `,
    [tenantId]
  );

  const definition = definitionResult.rows[0];

  if (!definition) {
    throw new Error(
      "No active purchase-request approval workflow exists for this tenant. Create and activate a workflow before submitting requests."
    );
  }

  validateApprovalWorkflow(definition.graph);

  const workflowRun = await startWorkflowRun(
    client,
    { tenantId, userId },
    definition.id,
    "purchase_request",
    request.id,
    definition.graph
  );

  const updated = await client.query(
    `
      UPDATE ${TABLE}
      SET
        workflow_run_id = $1,
        status = 'IN_APPROVAL',
        submitted_at = COALESCE(submitted_at, NOW()),
        updated_at = NOW()
      WHERE id = $2
        AND tenant_id = $3
      RETURNING *
    `,
    [workflowRun.id, request.id, tenantId]
  );

  if (!updated.rowCount) {
    throw new Error(
      "Workflow started, but the purchase request could not be updated."
    );
  }

  return updated.rows[0];
}

// ============================================================
// LIST PROCUREMENT REQUESTS
// ============================================================

export async function listRequests({
  tenantId,
  userId,
  page = 1,
  limit = 20,
  status,
  search,
  canViewAll = false,
} = {}) {
  required(tenantId, "Tenant ID");

  if (!canViewAll) {
    required(userId, "User ID");
  }

  const currentPage = getPage(page, 1);
  const pageSize = getLimit(limit);
  const offset = (currentPage - 1) * pageSize;

  return withTenantTransaction(tenantId, async (client) => {
    const conditions = ["pr.tenant_id = $1"];
    const values = [tenantId];

    if (!canViewAll) {
      values.push(userId);
      conditions.push(`pr.requester_id = $${values.length}`);
    }

    if (status) {
      values.push(String(status).trim().toUpperCase());
      conditions.push(`UPPER(pr.status) = $${values.length}`);
    }

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(
        `(pr.request_number ILIKE $${values.length}
          OR COALESCE(pr.justification, '') ILIKE $${values.length})`
      );
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await client.query(
      `
        SELECT COUNT(*)::integer AS total
        FROM ${TABLE} AS pr
        WHERE ${whereClause}
      `,
      values
    );

    const total = countResult.rows[0]?.total || 0;

    const result = await client.query(
      `
        SELECT
          pr.id,
          pr.tenant_id,
          pr.request_number,
          pr.requester_id,
          pr.department_id,
          pr.cost_center_id,
          pr.preferred_supplier_id,
          pr.workflow_run_id,
          pr.required_by_date,
          pr.justification,
          pr.currency,
          pr.subtotal,
          pr.tax_total,
          pr.total_amount,
          pr.status,
          pr.submitted_at,
          pr.approved_at,
          pr.created_at,
          pr.updated_at
        FROM ${TABLE} AS pr
        WHERE ${whereClause}
        ORDER BY pr.created_at DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, pageSize, offset]
    );

    return {
      items: result.rows.map(normalizeRequest),
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });
}

// ============================================================
// FIND REQUEST BY ID
// ============================================================

export async function findRequestById(tenantId, requestId) {
  assertTenantAndRequest(tenantId, requestId);

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT *
        FROM ${TABLE}
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [requestId, tenantId]
    );

    return normalizeRequest(result.rows[0]);
  });
}

// ============================================================
// CREATE PROCUREMENT REQUEST
// ============================================================

export async function createRequest({
  tenantId,
  requesterId,
  title,
  description,
  amount,
  currency = DEFAULT_CURRENCY,
  quantity,
  unitPrice,
  department,
  budgetId,
  supplier,
} = {}) {
  required(tenantId, "Tenant ID");
  required(requesterId, "Requester ID");

  const cleanCurrency = String(currency || DEFAULT_CURRENCY)
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(cleanCurrency)) {
    throw new Error(
      "Currency must be a valid three-letter code."
    );
  }

  let totalAmount;

  if (amount !== undefined && amount !== null) {
    totalAmount = parseAmount(amount);
  } else if (
    quantity !== undefined &&
    unitPrice !== undefined
  ) {
    totalAmount =
      parseAmount(quantity, "Quantity") *
      parseAmount(unitPrice, "Unit price");
  } else {
    throw new Error(
      "Amount or quantity and unit price are required."
    );
  }

  const departmentId =
    department && isUuid(department) ? department : null;

  const costCenterId =
    budgetId && isUuid(budgetId) ? budgetId : null;

  const supplierId =
    supplier && isUuid(supplier) ? supplier : null;

  const justification = buildJustification(
    title,
    description
  );

  const requestId = randomUUID();

  const requestNumber =
    `PR-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        INSERT INTO ${TABLE} (
          id,
          tenant_id,
          request_number,
          requester_id,
          department_id,
          cost_center_id,
          preferred_supplier_id,
          justification,
          currency,
          subtotal,
          tax_total,
          total_amount,
          status,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, 0, $10, 'DRAFT', NOW(), NOW()
        )
        RETURNING *
      `,
      [
        requestId,
        tenantId,
        requestNumber,
        requesterId,
        departmentId,
        costCenterId,
        supplierId,
        justification,
        cleanCurrency,
        totalAmount,
      ]
    );

    return normalizeRequest(result.rows[0]);
  });
}

// ============================================================
// UPDATE PROCUREMENT REQUEST
// ============================================================

export async function updateRequest(
  tenantId,
  requestId,
  userId,
  admin = false,
  changes = {}
) {
  assertTenantAndRequest(tenantId, requestId);
  required(userId, "User ID");

  return withTenantTransaction(tenantId, async (client) => {
    const existingResult = await client.query(
      `
        SELECT *
        FROM ${TABLE}
        WHERE id = $1
          AND tenant_id = $2
        FOR UPDATE
      `,
      [requestId, tenantId]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      throw new Error("Procurement request not found.");
    }

    if (!admin && existing.requester_id !== userId) {
      throw new Error(
        "You cannot update another user's request."
      );
    }

    if (existing.status !== "DRAFT") {
      throw new Error(
        "Only draft procurement requests can be updated."
      );
    }

    const updates = [];
    const values = [];

    function addUpdate(column, value) {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    }

    if (
      changes.title !== undefined ||
      changes.description !== undefined
    ) {
      const current = existing.justification || "";

      const existingTitle =
        current.match(/^Title:\s*(.+)$/m)?.[1]?.trim();

      const nextTitle =
        changes.title !== undefined
          ? changes.title
          : existingTitle;

      const nextDescription =
        changes.description !== undefined
          ? changes.description
          : current
              .replace(/^Title:\s*.+\n*/m, "")
              .trim();

      addUpdate(
        "justification",
        buildJustification(nextTitle, nextDescription)
      );
    }

    if (changes.amount !== undefined) {
      const amount = parseAmount(changes.amount);

      addUpdate("subtotal", amount);
      addUpdate("total_amount", amount);
    }

    if (changes.currency !== undefined) {
      const currency = String(changes.currency)
        .trim()
        .toUpperCase();

      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new Error(
          "Currency must be a valid three-letter code."
        );
      }

      addUpdate("currency", currency);
    }

    if (changes.department !== undefined) {
      if (
        changes.department &&
        !isUuid(changes.department)
      ) {
        throw new Error(
          "Department must be a valid department UUID."
        );
      }

      addUpdate(
        "department_id",
        changes.department || null
      );
    }

    if (changes.budgetId !== undefined) {
      if (
        changes.budgetId &&
        !isUuid(changes.budgetId)
      ) {
        throw new Error(
          "Cost center must be a valid UUID."
        );
      }

      addUpdate(
        "cost_center_id",
        changes.budgetId || null
      );
    }

    if (changes.supplier !== undefined) {
      if (
        changes.supplier &&
        !isUuid(changes.supplier)
      ) {
        throw new Error(
          "Supplier must be a valid supplier UUID."
        );
      }

      addUpdate(
        "preferred_supplier_id",
        changes.supplier || null
      );
    }

    if (changes.requiredByDate !== undefined) {
      addUpdate(
        "required_by_date",
        changes.requiredByDate || null
      );
    }

    if (!updates.length) {
      return normalizeRequest(existing);
    }

    values.push(requestId, tenantId);

    const result = await client.query(
      `
        UPDATE ${TABLE}
        SET ${updates.join(", ")},
            updated_at = NOW()
        WHERE id = $${values.length - 1}
          AND tenant_id = $${values.length}
        RETURNING *
      `,
      values
    );

    return normalizeRequest(result.rows[0]);
  });
}

// ============================================================
// SUBMIT PROCUREMENT REQUEST
// ============================================================

export async function submitRequest(
  tenantId,
  requestId,
  userId,
  isAdmin = false
) {
  assertTenantAndRequest(tenantId, requestId);
  required(userId, "User ID");

  return withTenantTransaction(tenantId, async (client) => {
    const existingResult = await client.query(
      `
        SELECT *
        FROM ${TABLE}
        WHERE id = $1
          AND tenant_id = $2
        FOR UPDATE
      `,
      [requestId, tenantId]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      throw new Error("Procurement request not found.");
    }

    if (!isAdmin && existing.requester_id !== userId) {
      throw new Error(
        "You cannot submit another user's request."
      );
    }

    if (existing.status !== "DRAFT") {
      throw new Error(
        "Only draft procurement requests can be submitted."
      );
    }

    if (Number(existing.total_amount) <= 0) {
      throw new Error(
        "A procurement request must have an amount greater than zero."
      );
    }

    const updated = await startApprovalWorkflow(
      client,
      tenantId,
      userId,
      existing
    );

    return normalizeRequest(updated);
  });
}

// ============================================================
// RECOVER EXISTING SUBMITTED REQUEST
// ============================================================

export async function recoverSubmittedRequest(
  tenantId,
  requestId,
  userId,
  isAdmin = false
) {
  assertTenantAndRequest(tenantId, requestId);
  required(userId, "User ID");

  return withTenantTransaction(tenantId, async (client) => {
    const result = await client.query(
      `
        SELECT *
        FROM ${TABLE}
        WHERE id = $1
          AND tenant_id = $2
        FOR UPDATE
      `,
      [requestId, tenantId]
    );

    const request = result.rows[0];

    if (!request) {
      throw new Error("Procurement request not found.");
    }

    if (!isAdmin && request.requester_id !== userId) {
      throw new Error(
        "You cannot recover another user's request."
      );
    }

    if (request.workflow_run_id) {
      throw new Error(
        "This request already has a workflow run."
      );
    }

    if (request.status !== "SUBMITTED") {
      throw new Error(
        "Only submitted requests without a workflow run can be recovered."
      );
    }

    const updated = await startApprovalWorkflow(
      client,
      tenantId,
      userId,
      request
    );

    return normalizeRequest(updated);
  });
}

// ============================================================
// INTERNAL APPROVAL DECISION
// ============================================================

async function recordApprovalDecision({
  tenantId,
  requestId,
  actorId,
  decision,
  comment,
}) {
  assertTenantAndRequest(tenantId, requestId);
  required(actorId, "Approver ID");

  const action = normalizeDecision(decision);

  // Fetch the request and pending task without holding locks
  // while the workflow engine opens its own transaction.
  const taskId = await withTenantTransaction(
    tenantId,
    async (client) => {
      const requestResult = await client.query(
        `
          SELECT id, status, workflow_run_id
          FROM ${TABLE}
          WHERE id = $1
            AND tenant_id = $2
          LIMIT 1
        `,
        [requestId, tenantId]
      );

      const request = requestResult.rows[0];

      if (!request) {
        throw new Error(
          "Procurement request not found."
        );
      }

      if (!request.workflow_run_id) {
        throw new Error(
          "This request has no workflow run. Recover the submitted request after configuring an active workflow."
        );
      }

      if (request.status !== "IN_APPROVAL") {
        throw new Error(
          `This request is not awaiting approval. Current status: ${request.status}.`
        );
      }

      const taskResult = await client.query(
        `
          SELECT id
          FROM ${APPROVAL_TABLE}
          WHERE tenant_id = $1
            AND workflow_run_id = $2
            AND assignee_id = $3
            AND status = 'PENDING'
          ORDER BY created_at ASC
        `,
        [
          tenantId,
          request.workflow_run_id,
          actorId,
        ]
      );

      if (!taskResult.rowCount) {
        throw new Error(
          "No pending approval task assigned to this user was found for this request."
        );
      }

      if (taskResult.rowCount > 1) {
        throw new Error(
          "Multiple pending approval tasks are assigned to this user for this request. The workflow must be clarified before recording a decision."
        );
      }

      return taskResult.rows[0].id;
    }
  );

  // The workflow engine owns approval task and request updates.
  const workflowResult = await actOnTask(
    { tenantId, userId: actorId },
    taskId,
    {
      action,
      comment: comment || undefined,
    }
  );

  const updatedRequest = await findRequestById(
    tenantId,
    requestId
  );

  return {
    request: updatedRequest,
    approval: {
      id: workflowResult.task.id,
      workflowRunId: workflowResult.task.workflow_run_id,
      nodeId: workflowResult.task.node_id,
      assigneeId: workflowResult.task.assignee_id,
      status: workflowResult.task.status,
      action,
      comment: comment || null,
    },
    workflowRunStatus: workflowResult.workflowRunStatus,
    activeNodes: workflowResult.activeNodes,
  };
}

// ============================================================
// MANAGER DECISION
// ============================================================

export async function recordManagerDecision({
  tenantId,
  requestId,
  actorId,
  decision,
  comment,
}) {
  return recordApprovalDecision({
    tenantId,
    requestId,
    actorId,
    decision,
    comment,
  });
}

// ============================================================
// FINANCE DECISION
// ============================================================

export async function recordFinanceDecision({
  tenantId,
  requestId,
  actorId,
  decision,
  comment,
}) {
  return recordApprovalDecision({
    tenantId,
    requestId,
    actorId,
    decision,
    comment,
  });
}
