
import { withTenantTransaction } from "../../config/database.js";
import { AppError } from "../../utils/errors.js";
import { workflowGraphSchema } from "./workflows.schema.js";
import { enqueueInAppNotification } from "../notifications/events.js";

// ============================================================
// CONSTANTS
// ============================================================

const RESOURCE_PURCHASE_REQUEST = "purchase_request";

const TASK_PENDING = "PENDING";
const TASK_APPROVED = "APPROVED";
const TASK_REJECTED = "REJECTED";
const TASK_CHANGES_REQUESTED = "CHANGES_REQUESTED";

const RUNNING = "RUNNING";
const RUN_APPROVED = "APPROVED";
const RUN_REJECTED = "REJECTED";
const RUN_CANCELLED = "CANCELLED";

// ============================================================
// GENERAL HELPERS
// ============================================================

function requiredContext(context) {
  if (!context?.tenantId || !context?.userId) {
    throw new AppError(
      403,
      "INVALID_CONTEXT",
      "A valid tenant and authenticated user are required."
    );
  }
}

function validateGraph(graph) {
  const parsed = workflowGraphSchema.safeParse(graph);

  if (!parsed.success) {
    throw new AppError(422, "INVALID_WORKFLOW", "The workflow graph is invalid.");
  }

  const validated = parsed.data;

  if (!validated.nodes.some((node) => node.type === "approval")) {
    throw new AppError(
      422,
      "INVALID_WORKFLOW",
      "The workflow must contain at least one approval node."
    );
  }

  return validated;
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

function isForeignKeyViolation(error) {
  return error?.code === "23503";
}

function normalizeAction(action) {
  const normalized = String(action ?? "").trim().toLowerCase();

  if (!["approve", "reject", "request_changes"].includes(normalized)) {
    throw new AppError(
      422,
      "INVALID_APPROVAL_ACTION",
      "Decision must be approve, reject, or request_changes."
    );
  }

  return normalized;
}

function parseActiveNodes(activeNode, fallbackNodeId) {
  if (Array.isArray(activeNode)) {
    if (
      activeNode.length &&
      activeNode.every((value) => typeof value === "string")
    ) {
      return activeNode;
    }

    throw new AppError(
      409,
      "INVALID_WORKFLOW_STATE",
      "Workflow run has an invalid active stage."
    );
  }

  if (activeNode === null || activeNode === undefined) {
    return fallbackNodeId ? [fallbackNodeId] : [];
  }

  if (typeof activeNode !== "string") {
    throw new AppError(
      409,
      "INVALID_WORKFLOW_STATE",
      "Workflow run has an invalid active stage."
    );
  }

  try {
    const parsed = JSON.parse(activeNode);

    if (
      Array.isArray(parsed) &&
      parsed.every((value) => typeof value === "string")
    ) {
      return parsed;
    }

    if (typeof parsed === "string") return [parsed];

    throw new AppError(
      409,
      "INVALID_WORKFLOW_STATE",
      "Workflow run has an invalid active stage."
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    return [activeNode];
  }
}

// ============================================================
// WORKFLOW GRAPH TRAVERSAL
// ============================================================

function nextApprovalStage(graph, origins) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map();

  for (const edge of graph.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) {
      throw new AppError(
        422,
        "INVALID_WORKFLOW",
        `Workflow edge references an invalid node: ${edge.from} -> ${edge.to}`
      );
    }

    const successors = outgoing.get(edge.from) ?? [];
    successors.push(edge.to);
    outgoing.set(edge.from, successors);
  }

  const queue = origins.flatMap((id) => outgoing.get(id) ?? []);
  const visited = new Set();
  const approvals = new Set();
  let reachesEnd = false;

  while (queue.length > 0) {
    const id = queue.shift();

    if (visited.has(id)) continue;
    visited.add(id);

    const node = byId.get(id);

    if (!node) {
      throw new AppError(
        422,
        "INVALID_WORKFLOW",
        `Workflow node "${id}" does not exist.`
      );
    }

    if (node.type === "approval") {
      approvals.add(id);
      continue;
    }

    if (node.type === "end") {
      reachesEnd = true;
      continue;
    }

    queue.push(...(outgoing.get(id) ?? []));
  }

  return {
    nodeIds: [...approvals],
    reachesEnd,
  };
}

// ============================================================
// APPROVAL ASSIGNEE VALIDATION
// ============================================================

async function validateStageAssignees(client, tenantId, graph, nodeIds) {
  if (!tenantId) {
    throw new AppError(403, "INVALID_TENANT", "Tenant context is missing.");
  }

  const approvalNodes = nodeIds.map((nodeId) =>
    graph.nodes.find((node) => node.id === nodeId)
  );

  if (approvalNodes.some((node) => !node || node.type !== "approval")) {
    throw new AppError(
      422,
      "INVALID_WORKFLOW_NODE",
      "The next approval stage contains an invalid approval node."
    );
  }

  const missingNodes = approvalNodes.filter((node) => !node.assigneeId);

  if (missingNodes.length) {
    throw new AppError(
      422,
      "MISSING_WORKFLOW_ASSIGNEE",
      `Missing assignee for: ${missingNodes.map((node) => node.id).join(", ")}`
    );
  }

  const uniqueAssignees = [
    ...new Set(
      approvalNodes.map((node) =>
        String(node.assigneeId).trim().toLowerCase()
      )
    ),
  ];

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const malformedIds = uniqueAssignees.filter((id) => !uuidRegex.test(id));

  if (malformedIds.length) {
    throw new AppError(
      422,
      "INVALID_WORKFLOW_ASSIGNEE",
      `Invalid assignee UUID: ${malformedIds.join(", ")}`
    );
  }

  // IMPORTANT:
  // app_current_tenant_id() reads app.tenant_id.
  // Set the correct transaction-local PostgreSQL setting.
  await client.query(
    `SELECT set_config('app.tenant_id', $1, true)`,
    [String(tenantId)]
  );

  // Verify tenant context used by RLS.
  const tenantCheck = await client.query(
    `SELECT app_current_tenant_id()::text AS tenant_id`
  );

  const databaseTenantId = tenantCheck.rows[0]?.tenant_id;

  if (
    !databaseTenantId ||
    String(databaseTenantId).toLowerCase() !==
      String(tenantId).toLowerCase()
  ) {
    throw new AppError(
      403,
      "TENANT_CONTEXT_MISMATCH",
      `Database tenant context mismatch. Expected ${tenantId}, received ${databaseTenantId ?? "NULL"}.`
    );
  }

  // Read assignees under the verified tenant context.
  const result = await client.query(
    `SELECT id, tenant_id, is_active
     FROM public.users
     WHERE id = ANY($1::uuid[])`,
    [uniqueAssignees]
  );

  const usersById = new Map(
    result.rows.map((user) => [String(user.id).toLowerCase(), user])
  );

  const invalidAssignees = [];

  for (const node of approvalNodes) {
    const assigneeId = String(node.assigneeId).trim().toLowerCase();
    const user = usersById.get(assigneeId);

    if (!user) {
      invalidAssignees.push(
        `${node.id}: ${assigneeId} not found or hidden by RLS`
      );
      continue;
    }

    if (
      String(user.tenant_id).toLowerCase() !==
      String(tenantId).toLowerCase()
    ) {
      invalidAssignees.push(
        `${node.id}: ${assigneeId} belongs to another tenant`
      );
      continue;
    }

    if (user.is_active !== true) {
      invalidAssignees.push(`${node.id}: ${assigneeId} is inactive`);
    }
  }

  if (invalidAssignees.length) {
    throw new AppError(
      422,
      "INVALID_WORKFLOW_ASSIGNEE",
      `Approval assignee validation failed: ${invalidAssignees.join("; ")}`
    );
  }

  return true;
}

// ============================================================
// AUDIT
// ============================================================

async function audit(client, context, action, resourceId, metadata = {}) {
  await client.query(
    `INSERT INTO public.audit_events
      (tenant_id, actor_type, actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'USER', $2, $3, 'workflow', $4, $5::jsonb)`,
    [
      context.tenantId,
      context.userId,
      action,
      resourceId,
      JSON.stringify(metadata),
    ]
  );
}

// ============================================================
// CREATE APPROVAL TASKS
// ============================================================

async function createStageTasks(client, context, runId, graph, nodeIds) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));

  const run = await client.query(
    `SELECT resource_type, resource_id
     FROM public.workflow_runs
     WHERE tenant_id = $1 AND id = $2`,
    [context.tenantId, runId]
  );

  if (!run.rowCount) {
    throw new AppError(
      404,
      "WORKFLOW_RUN_NOT_FOUND",
      "Workflow run not found while creating approval tasks."
    );
  }

  let resourceName = `${run.rows[0].resource_type} ${run.rows[0].resource_id}`;

  if (run.rows[0].resource_type === RESOURCE_PURCHASE_REQUEST) {
    const request = await client.query(
      `SELECT request_number
       FROM public.purchase_requests
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, run.rows[0].resource_id]
    );

    if (request.rowCount) {
      resourceName = request.rows[0].request_number;
    }
  }

  for (const nodeId of nodeIds) {
    const node = nodes.get(nodeId);

    if (!node || node.type !== "approval" || !node.assigneeId) {
      throw new AppError(
        422,
        "INVALID_WORKFLOW",
        `Invalid approval node or missing assignee: "${nodeId}".`
      );
    }

    const task = await client.query(
      `INSERT INTO public.approval_tasks
        (tenant_id, workflow_run_id, node_id, assignee_id, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [context.tenantId, runId, node.id, node.assigneeId, TASK_PENDING]
    );

    const taskId = task.rows[0].id;

    await audit(client, context, "approval_task.created", taskId, {
      workflowRunId: runId,
      nodeId: node.id,
      assigneeId: node.assigneeId,
    });

    await enqueueInAppNotification(
      client,
      context.tenantId,
      node.assigneeId,
      "approval.task_assigned",
      `Approval required for ${resourceName}`,
      {
        taskId,
        workflowRunId: runId,
        resourceType: run.rows[0].resource_type,
        resourceId: run.rows[0].resource_id,
        nodeId: node.id,
      }
    );
  }
}

// ============================================================
// START WORKFLOW RUN
// ============================================================

export async function startWorkflowRun(
  client,
  context,
  definitionId,
  resourceType,
  resourceId,
  graph
) {
  requiredContext(context);
  const validatedGraph = validateGraph(graph);

  const start = validatedGraph.nodes.find((node) => node.type === "start");

  if (!start) {
    throw new AppError(
      422,
      "INVALID_WORKFLOW",
      "The workflow graph has no start node."
    );
  }

  const stage = nextApprovalStage(validatedGraph, [start.id]);

  if (!stage.nodeIds.length) {
    throw new AppError(
      422,
      "INVALID_WORKFLOW",
      "The workflow graph has no approval stage."
    );
  }

  await validateStageAssignees(
    client,
    context.tenantId,
    validatedGraph,
    stage.nodeIds
  );

  const inserted = await client.query(
    `INSERT INTO public.workflow_runs
      (tenant_id, definition_id, resource_type, resource_id, status, active_node)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      context.tenantId,
      definitionId,
      resourceType,
      resourceId,
      RUNNING,
      JSON.stringify(stage.nodeIds),
    ]
  );

  const run = inserted.rows[0];

  await createStageTasks(client, context, run.id, validatedGraph, stage.nodeIds);

  await audit(client, context, "workflow_run.started", run.id, {
    definitionId,
    resourceType,
    resourceId,
    activeNodes: stage.nodeIds,
  });

  return run;
}

// ============================================================
// LIST WORKFLOWS
// ============================================================

export async function listWorkflows(context) {
  requiredContext(context);

  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, tenant_id, name, version, resource_type, graph,
              is_active, created_by, created_at, updated_at
       FROM public.workflow_definitions
       WHERE tenant_id = $1
       ORDER BY name, version DESC`,
      [context.tenantId]
    );

    return result.rows;
  });
}

// ============================================================
// GET WORKFLOW
// ============================================================

export async function getWorkflow(context, id) {
  requiredContext(context);

  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT id, tenant_id, name, version, resource_type, graph,
              is_active, created_by, created_at, updated_at
       FROM public.workflow_definitions
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, id]
    );

    if (!result.rowCount) {
      throw new AppError(404, "NOT_FOUND", "Workflow definition not found.");
    }

    return result.rows[0];
  });
}

// ============================================================
// CREATE WORKFLOW
// ============================================================

export async function createWorkflow(context, input) {
  requiredContext(context);
  const graph = validateGraph(input.graph);

  return withTenantTransaction(context.tenantId, async (client) => {
    try {
      const result = await client.query(
        `INSERT INTO public.workflow_definitions
          (tenant_id, name, version, resource_type, graph, is_active, created_by)
         VALUES ($1, $2, 1, $3, $4::jsonb, false, $5)
         RETURNING *`,
        [
          context.tenantId,
          input.name,
          input.resourceType,
          JSON.stringify(graph),
          context.userId,
        ]
      );

      await audit(client, context, "workflow.created", result.rows[0].id, {
        version: 1,
      });

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          "WORKFLOW_VERSION_EXISTS",
          "A workflow with this name already exists."
        );
      }

      throw error;
    }
  });
}

// ============================================================
// CREATE WORKFLOW VERSION
// ============================================================

export async function createWorkflowVersion(context, id, input) {
  requiredContext(context);

  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT name, resource_type, graph
       FROM public.workflow_definitions
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!current.rowCount) {
      throw new AppError(404, "NOT_FOUND", "Workflow definition not found.");
    }

    const name = input.name ?? current.rows[0].name;
    const graph = validateGraph(input.graph ?? current.rows[0].graph);

    const version = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM public.workflow_definitions
       WHERE tenant_id = $1 AND name = $2 AND resource_type = $3`,
      [context.tenantId, name, current.rows[0].resource_type]
    );

    try {
      const result = await client.query(
        `INSERT INTO public.workflow_definitions
          (tenant_id, name, version, resource_type, graph, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, false, $6)
         RETURNING *`,
        [
          context.tenantId,
          name,
          version.rows[0].next_version,
          current.rows[0].resource_type,
          JSON.stringify(graph),
          context.userId,
        ]
      );

      await audit(client, context, "workflow.version_created", result.rows[0].id, {
        sourceWorkflowId: id,
        version: result.rows[0].version,
      });

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          409,
          "WORKFLOW_VERSION_EXISTS",
          "A workflow version with this name already exists."
        );
      }

      throw error;
    }
  });
}

// ============================================================
// ACTIVATE WORKFLOW
// ============================================================

export async function activateWorkflow(context, id) {
  requiredContext(context);

  return withTenantTransaction(context.tenantId, async (client) => {
    const target = await client.query(
      `SELECT id, name, resource_type, graph, is_active
       FROM public.workflow_definitions
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!target.rowCount) {
      throw new AppError(404, "NOT_FOUND", "Workflow definition not found.");
    }

    const graph = validateGraph(target.rows[0].graph);

    const approvalNodes = graph.nodes
      .filter((node) => node.type === "approval")
      .map((node) => node.id);

    await validateStageAssignees(
      client,
      context.tenantId,
      graph,
      approvalNodes
    );

    await client.query(
      `UPDATE public.workflow_definitions
       SET is_active = false, updated_at = now()
       WHERE tenant_id = $1 AND resource_type = $2
         AND is_active = true AND id <> $3`,
      [context.tenantId, target.rows[0].resource_type, id]
    );

    const updated = await client.query(
      `UPDATE public.workflow_definitions
       SET is_active = true, updated_at = now()
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [context.tenantId, id]
    );

    if (!target.rows[0].is_active) {
      await audit(client, context, "workflow.activated", id, {
        name: target.rows[0].name,
      });
    }

    return updated.rows[0];
  });
}

// ============================================================
// DELETE WORKFLOW
// ============================================================

export async function deleteWorkflow(context, id) {
  requiredContext(context);

  return withTenantTransaction(context.tenantId, async (client) => {
    const current = await client.query(
      `SELECT is_active
       FROM public.workflow_definitions
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, id]
    );

    if (!current.rowCount) {
      throw new AppError(404, "NOT_FOUND", "Workflow definition not found.");
    }

    if (current.rows[0].is_active) {
      throw new AppError(
        409,
        "ACTIVE_WORKFLOW",
        "Deactivate the workflow before deleting it."
      );
    }

    await audit(client, context, "workflow.deleted", id, {});

    try {
      await client.query(
        `DELETE FROM public.workflow_definitions
         WHERE tenant_id = $1 AND id = $2`,
        [context.tenantId, id]
      );
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new AppError(
          409,
          "WORKFLOW_IN_USE",
          "A workflow referenced by a run cannot be deleted."
        );
      }

      throw error;
    }
  });
}

// ============================================================
// LIST PENDING APPROVAL TASKS
// ============================================================

export async function listPendingTasks(context, options = {}) {
  requiredContext(context);

  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = Math.max(Number(options.offset) || 0, 0);

  return withTenantTransaction(context.tenantId, async (client) => {
    const result = await client.query(
      `SELECT
         t.*,
         r.resource_type,
         r.resource_id,
         r.active_node,
         d.name AS workflow_name,
         pr.request_number,
         pr.total_amount,
         pr.currency,
         pr.requester_id
       FROM public.approval_tasks t
       JOIN public.workflow_runs r
         ON r.tenant_id = t.tenant_id AND r.id = t.workflow_run_id
       JOIN public.workflow_definitions d
         ON d.tenant_id = r.tenant_id AND d.id = r.definition_id
       LEFT JOIN public.purchase_requests pr
         ON pr.tenant_id = r.tenant_id
        AND r.resource_type = 'purchase_request'
        AND pr.id = r.resource_id
       WHERE t.tenant_id = $1
         AND t.status = $3
         AND t.assignee_id = $2
         AND r.status = $4
       ORDER BY t.due_at NULLS LAST, t.created_at, t.id
       LIMIT $5 OFFSET $6`,
      [context.tenantId, context.userId, TASK_PENDING, RUNNING, limit, offset]
    );

    const count = await client.query(
      `SELECT COUNT(*)::text AS total
       FROM public.approval_tasks t
       JOIN public.workflow_runs r
         ON r.tenant_id = t.tenant_id AND r.id = t.workflow_run_id
       WHERE t.tenant_id = $1
         AND t.status = $3
         AND t.assignee_id = $2
         AND r.status = $4`,
      [context.tenantId, context.userId, TASK_PENDING, RUNNING]
    );

    return {
      data: result.rows,
      total: Number(count.rows[0].total),
    };
  });
}

// ============================================================
// APPROVE / REJECT / REQUEST CHANGES
// ============================================================

export async function actOnTask(context, taskId, input = {}) {
  requiredContext(context);

  const action = normalizeAction(input.action ?? input.decision);

  const comment =
    typeof input.comment === "string" ? input.comment.trim() || null : null;

  return withTenantTransaction(context.tenantId, async (client) => {
    const initialTask = await client.query(
      `SELECT workflow_run_id
       FROM public.approval_tasks
       WHERE tenant_id = $1 AND id = $2`,
      [context.tenantId, taskId]
    );

    if (!initialTask.rowCount) {
      throw new AppError(404, "NOT_FOUND", "Approval task not found.");
    }

    const runId = initialTask.rows[0].workflow_run_id;

    const run = await client.query(
      `SELECT
         r.status,
         r.active_node,
         r.resource_type,
         r.resource_id,
         d.graph
       FROM public.workflow_runs r
       JOIN public.workflow_definitions d
         ON d.tenant_id = r.tenant_id AND d.id = r.definition_id
       WHERE r.tenant_id = $1 AND r.id = $2
       FOR UPDATE OF r`,
      [context.tenantId, runId]
    );

    if (!run.rowCount || run.rows[0].status !== RUNNING) {
      throw new AppError(
        409,
        "INVALID_STATE",
        "The workflow run is no longer active."
      );
    }

    const lockedTask = await client.query(
      `SELECT workflow_run_id, node_id, assignee_id, status
       FROM public.approval_tasks
       WHERE tenant_id = $1 AND id = $2
       FOR UPDATE`,
      [context.tenantId, taskId]
    );

    if (!lockedTask.rowCount || lockedTask.rows[0].status !== TASK_PENDING) {
      throw new AppError(
        409,
        "INVALID_STATE",
        "This approval task is no longer pending."
      );
    }

    const taskRow = lockedTask.rows[0];

    if (
      !taskRow.assignee_id ||
      String(taskRow.assignee_id).toLowerCase() !==
        String(context.userId).toLowerCase()
    ) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "This task is not assigned to the authenticated user."
      );
    }

    const activeNodes = parseActiveNodes(
      run.rows[0].active_node,
      taskRow.node_id
    );

    if (!activeNodes.includes(taskRow.node_id)) {
      throw new AppError(
        409,
        "INVALID_STATE",
        "This task is not part of the active approval stage."
      );
    }

    const graph = validateGraph(run.rows[0].graph);

    const taskStatus =
      action === "approve"
        ? TASK_APPROVED
        : action === "reject"
          ? TASK_REJECTED
          : TASK_CHANGES_REQUESTED;

    const updatedTask = await client.query(
      `UPDATE public.approval_tasks
       SET status = $3,
           action = $4,
           comment = $5,
           acted_at = now(),
           updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status = $6
       RETURNING *`,
      [context.tenantId, taskId, taskStatus, action, comment, TASK_PENDING]
    );

    if (!updatedTask.rowCount) {
      throw new AppError(
        409,
        "INVALID_STATE",
        "This approval task is no longer pending."
      );
    }

    let runStatus = RUNNING;
    let requestStatus = null;
    let currentActiveNodes = activeNodes;

    // REJECT / REQUEST CHANGES
    if (action === "reject" || action === "request_changes") {
      const finalRunStatus =
        action === "reject" ? RUN_REJECTED : RUN_CANCELLED;

      requestStatus =
        action === "reject" ? "REJECTED" : "CHANGES_REQUESTED";

      await client.query(
        `UPDATE public.approval_tasks
         SET status = 'CANCELLED', updated_at = now()
         WHERE tenant_id = $1 AND workflow_run_id = $2 AND status = $3`,
        [context.tenantId, runId, TASK_PENDING]
      );

      await client.query(
        `UPDATE public.workflow_runs
         SET status = $3, completed_at = now(), active_node = NULL, updated_at = now()
         WHERE tenant_id = $1 AND id = $2`,
        [context.tenantId, runId, finalRunStatus]
      );

      runStatus = finalRunStatus;
      currentActiveNodes = [];
    }

    // APPROVE
    else if (action === "approve") {
      const remaining = await client.query(
        `SELECT node_id
         FROM public.approval_tasks
         WHERE tenant_id = $1
           AND workflow_run_id = $2
           AND status = $3
           AND node_id = ANY($4::text[])`,
        [context.tenantId, runId, TASK_PENDING, activeNodes]
      );

      if (remaining.rowCount > 0) {
        await client.query(
          `UPDATE public.workflow_runs
           SET active_node = $3, updated_at = now()
           WHERE tenant_id = $1 AND id = $2`,
          [context.tenantId, runId, JSON.stringify(activeNodes)]
        );
      } else {
        const stage = nextApprovalStage(graph, activeNodes);

        if (stage.nodeIds.length > 0) {
          await validateStageAssignees(
            client,
            context.tenantId,
            graph,
            stage.nodeIds
          );

          await createStageTasks(
            client,
            context,
            runId,
            graph,
            stage.nodeIds
          );

          currentActiveNodes = stage.nodeIds;

          await client.query(
            `UPDATE public.workflow_runs
             SET active_node = $3, updated_at = now()
             WHERE tenant_id = $1 AND id = $2`,
            [context.tenantId, runId, JSON.stringify(currentActiveNodes)]
          );

          await audit(client, context, "workflow_run.stage_started", runId, {
            activeNodes: currentActiveNodes,
            previousNodes: activeNodes,
          });
        } else {
          if (!stage.reachesEnd) {
            throw new AppError(
              422,
              "INVALID_WORKFLOW",
              "The workflow graph cannot advance to an approval stage or end node."
            );
          }

          runStatus = RUN_APPROVED;
          requestStatus = "APPROVED";
          currentActiveNodes = [];

          await client.query(
            `UPDATE public.workflow_runs
             SET status = $3,
                 completed_at = now(),
                 active_node = NULL,
                 updated_at = now()
             WHERE tenant_id = $1 AND id = $2`,
            [context.tenantId, runId, RUN_APPROVED]
          );
        }
      }
    }

    // UPDATE PURCHASE REQUEST WHEN WORKFLOW IS FINISHED
    if (
      run.rows[0].resource_type === RESOURCE_PURCHASE_REQUEST &&
      requestStatus
    ) {
      const updatedRequest = await client.query(
        `UPDATE public.purchase_requests
         SET status = $3,
             approved_at = CASE WHEN $3 = 'APPROVED' THEN now() ELSE approved_at END,
             updated_at = now()
         WHERE tenant_id = $1
           AND id = $2
           AND workflow_run_id = $4
           AND status = 'IN_APPROVAL'`,
        [
          context.tenantId,
          run.rows[0].resource_id,
          requestStatus,
          runId,
        ]
      );

      if (!updatedRequest.rowCount) {
        throw new AppError(
          409,
          "INVALID_STATE",
          "The associated purchase request is not in this active approval run."
        );
      }

      const purchaseRequest = await client.query(
        `SELECT requester_id, request_number
         FROM public.purchase_requests
         WHERE tenant_id = $1 AND id = $2`,
        [context.tenantId, run.rows[0].resource_id]
      );

      if (purchaseRequest.rowCount) {
        const requestNumber = purchaseRequest.rows[0].request_number;

        const subject =
          requestStatus === "APPROVED"
            ? `Purchase request ${requestNumber} was approved`
            : requestStatus === "REJECTED"
              ? `Purchase request ${requestNumber} was rejected`
              : `Changes were requested for purchase request ${requestNumber}`;

        await enqueueInAppNotification(
          client,
          context.tenantId,
          purchaseRequest.rows[0].requester_id,
          `purchase_request.${requestStatus.toLowerCase()}`,
          subject,
          {
            purchaseRequestId: run.rows[0].resource_id,
            requestNumber,
            status: requestStatus,
          }
        );
      }
    }

    // AUDIT DECISION
    await audit(client, context, `approval_task.${action}`, taskId, {
      workflowRunId: runId,
      nodeId: taskRow.node_id,
      runStatus,
      requestStatus,
      activeNodes: currentActiveNodes,
      comment,
    });

    return {
      success: true,
      message:
        action === "approve"
          ? requestStatus === "APPROVED"
            ? "Purchase request approved successfully."
            : "Approval successful. Workflow moved to the next stage."
          : action === "reject"
            ? "Purchase request rejected successfully."
            : "Changes requested successfully.",
      task: updatedTask.rows[0],
      workflowRunStatus: runStatus,
      purchaseRequestStatus: requestStatus,
      activeNodes: currentActiveNodes,
    };
  });
}
