
import { withTenantTransaction } from '../../database/db.js';
import { AppError } from '../../utils/errors.js';
import { workflowGraphSchema } from './workflows.schema.js';
import { enqueueInAppNotification } from '../notifications/events.js';

export async function startWorkflowRun(
  client,
  context,
  definitionId,
  resourceType,
  resourceId,
  graph
) {
  const parsed = workflowGraphSchema.safeParse(graph);

  if (!parsed.success) {
    throw new AppError(
      422,
      'INVALID_WORKFLOW',
      'The workflow graph is invalid'
    );
  }

  const validatedGraph = parsed.data;
  const start = validatedGraph.nodes.find(
    (node) => node.type === 'start'
  );

  if (!start) {
    throw new AppError(
      422,
      'INVALID_WORKFLOW',
      'The workflow graph has no start node'
    );
  }

  const stage = nextApprovalStage(validatedGraph, [start.id]);

  if (!stage.nodeIds.length) {
    throw new AppError(
      422,
      'INVALID_WORKFLOW',
      'The workflow graph has no approval stage'
    );
  }

  const assignees = validatedGraph.nodes
    .filter(
      (node) =>
        stage.nodeIds.includes(node.id) && !!node.assigneeId
    )
    .map((node) => node.assigneeId);

  if (assignees.length) {
    const validAssignees = await client.query(
      `SELECT id FROM users
       WHERE tenant_id = $1
         AND is_active = true
         AND id = ANY($2::uuid[])`,
      [context.tenantId, assignees]
    );

    if (
      new Set(
        validAssignees.rows.map((row) => row.id.toLowerCase())
      ).size !==
      new Set(assignees.map((id) => id.toLowerCase())).size
    ) {
      throw new AppError(
        422,
        'INVALID_WORKFLOW_ASSIGNEE',
        'An approval node is assigned to a user who is missing or inactive'
      );
    }
  }

  const inserted = await client.query(
    `INSERT INTO workflow_runs
      (tenant_id, definition_id, resource_type, resource_id, status, active_node)
     VALUES ($1, $2, $3, $4, 'RUNNING', $5)
     RETURNING *`,
    [
      context.tenantId,
      definitionId,
      resourceType,
      resourceId,
      JSON.stringify(stage.nodeIds),
    ]
  );

  const run = inserted.rows[0];

  await createStageTasks(
    client,
    context,
    run.id,
    validatedGraph,
    stage.nodeIds
  );

  await audit(client, context, 'workflow_run.started', run.id, {
    definitionId,
    resourceType,
    resourceId,
    activeNodes: stage.nodeIds,
  });

  return run;
}

export async function listWorkflows(context) {
  return withTenantTransaction(
    context.tenantId,
    async (client) => {
      const result = await client.query(
        `SELECT id, name, version, resource_type, graph, is_active,
                created_by, created_at, updated_at
         FROM workflow_definitions
         WHERE tenant_id = $1
         ORDER BY name, version DESC`,
        [context.tenantId]
      );

      return result.rows;
    }
  );
}

export async function getWorkflow(context, id) {
  return withTenantTransaction(
    context.tenantId,
    async (client) => {
      const result = await client.query(
        `SELECT id, name, version, resource_type, graph, is_active,
                created_by, created_at, updated_at
         FROM workflow_definitions
         WHERE tenant_id = $1 AND id = $2`,
        [context.tenantId, id]
      );

      if (!result.rowCount) {
        throw new AppError(
          404,
          'NOT_FOUND',
          'Workflow definition not found'
        );
      }

      return result.rows[0];
    }
  );
}

export async function createWorkflow(context, input) {
  return withTenantTransaction(
    context.tenantId,
    async (client) => {
      try {
        const result = await client.query(
          `INSERT INTO workflow_definitions
            (tenant_id, name, version, resource_type, graph, created_by)
           VALUES ($1, $2, 1, $3, $4::jsonb, $5)
           RETURNING *`,
          [
            context.tenantId,
            input.name,
            input.resourceType,
            JSON.stringify(input.graph),
            context.userId,
          ]
        );

        await audit(
          client,
          context,
          'workflow.created',
          result.rows[0].id,
          { version: 1 }
        );

        return result.rows[0];
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            409,
            'WORKFLOW_VERSION_EXISTS',
            'A workflow with this name already exists'
          );
        }

        throw error;
      }
    }
  );
}

export async function createWorkflowVersion(
  context,
  id,
  input
) {
  return withTenantTransaction(
    context.tenantId,
    async (client) => {
      const current = await client.query(
        `SELECT name, resource_type, graph
         FROM workflow_definitions
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [context.tenantId, id]
      );

      if (!current.rowCount) {
        throw new AppError(
          404,
          'NOT_FOUND',
          'Workflow definition not found'
        );
      }

      const name = input.name ?? current.rows[0].name;

      const version = await client.query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM workflow_definitions
         WHERE tenant_id = $1
           AND name = $2
           AND resource_type = $3`,
        [
          context.tenantId,
          name,
          current.rows[0].resource_type,
        ]
      );

      try {
        const result = await client.query(
          `INSERT INTO workflow_definitions
            (tenant_id, name, version, resource_type, graph, created_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           RETURNING *`,
          [
            context.tenantId,
            name,
            version.rows[0].next_version,
            current.rows[0].resource_type,
            JSON.stringify(
              input.graph ?? current.rows[0].graph
            ),
            context.userId,
          ]
        );

        await audit(
          client,
          context,
          'workflow.version_created',
          result.rows[0].id,
          {
            sourceWorkflowId: id,
            version: result.rows[0].version,
          }
        );

        return result.rows[0];
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            409,
            'WORKFLOW_VERSION_EXISTS',
            'A workflow version with this name already exists'
          );
        }

        throw error;
      }
    }
  );
}

export async function activateWorkflow(context, id) {
  return withTenantTransaction(
    context.tenantId,
    async (client) => {
      const target = await client.query(
        `SELECT id, name, resource_type, graph, is_active
         FROM workflow_definitions
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [context.tenantId, id]
      );

      if (!target.rowCount) {
        throw new AppError(
          404,
          'NOT_FOUND',
          'Workflow definition not found'
        );
      }

      if (
        !Array.isArray(target.rows[0].graph?.nodes) ||
        !target.rows[0].graph.nodes.some(
          (node) => node.type === 'approval'
        )
      ) {
        throw new AppError(
          422,
          'INVALID_WORKFLOW',
          'An active workflow must contain an approval node'
        );
      }

      const deactivated = await client.query(
        `UPDATE workflow_definitions
         SET is_active = false, updated_at = now()
         WHERE tenant_id = $1
           AND resource_type = $2
           AND is_active = true
           AND id <> $3
         RETURNING id`,
        [
          context.tenantId,
          target.rows[0].resource_type,
          id,
        ]
      );

      for (const row of deactivated.rows) {
        await audit(
          client,
          context,
          'workflow.deactivated',
          row.id,
          { replacedByWorkflowId: id }
        );
      }

      const updated = await client.query(
        `UPDATE workflow_definitions
         SET is_active = true, updated_at = now()
         WHERE tenant_id = $1 AND id = $2
         RETURNING *`,
        [context.tenantId, id]
      );

      if (!target.rows[0].is_active) {
        await audit(
          client,
          context,
          'workflow.activated',
          id,
          { name: target.rows[0].name }
        );
      }

      return updated.rows[0];
    }
  );
}

export async function deleteWorkflow(context, id) {
  return withTenantTransaction(
    context.tenantId,
    async (client) => {
      const current = await client.query(
        `SELECT is_active
         FROM workflow_definitions
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [context.tenantId, id]
      );

      if (!current.rowCount) {
        throw new AppError(
          404,
          'NOT_FOUND',
          'Workflow definition not found'
        );
      }

      if (current.rows[0].is_active) {
        throw new AppError(
          409,
          'ACTIVE_WORKFLOW',
          'Deactivate the workflow before deleting it'
        );
      }

      await audit(client, context, 'workflow.deleted', id, {});

      try {
        await client.query(
          `DELETE FROM workflow_definitions
           WHERE tenant_id = $1 AND id = $2`,
          [context.tenantId, id]
        );
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new AppError(
            409,
            'WORKFLOW_IN_USE',
            'A workflow referenced by a run cannot be deleted'
          );
        }

        throw error;
      }
    }
  );
}

export async function listPendingTasks(context, options) {
  return withTenantTransaction(
    context.tenantId,
    async (client) => {
      const values = [
        context.tenantId,
        context.userId,
      ];

      const result = await client.query(
        `SELECT t.*, r.resource_type, r.resource_id, r.active_node,
                d.name AS workflow_name, pr.request_number,
                pr.total_amount, pr.currency, pr.requester_id
         FROM approval_tasks t
         JOIN workflow_runs r
           ON r.tenant_id = t.tenant_id
          AND r.id = t.workflow_run_id
         JOIN workflow_definitions d
           ON d.tenant_id = r.tenant_id
          AND d.id = r.definition_id
         LEFT JOIN purchase_requests pr
           ON pr.tenant_id = r.tenant_id
          AND r.resource_type = 'purchase_request'
          AND pr.id = r.resource_id
         WHERE t.tenant_id = $1
           AND t.status = 'PENDING'
           AND (t.assignee_id IS NULL OR t.assignee_id = $2)
           AND r.status = 'RUNNING'
         ORDER BY t.due_at NULLS LAST, t.created_at, t.id
         LIMIT $3 OFFSET $4`,
        [...values, options.limit, options.offset]
      );

      const count = await client.query(
        `SELECT count(*)::text AS total
         FROM approval_tasks t
         JOIN workflow_runs r
           ON r.tenant_id = t.tenant_id
          AND r.id = t.workflow_run_id
         WHERE t.tenant_id = $1
           AND t.status = 'PENDING'
           AND (t.assignee_id IS NULL OR t.assignee_id = $2)
           AND r.status = 'RUNNING'`,
        values
      );

      return {
        data: result.rows,
        total: Number(count.rows[0].total),
      };
    }
  );
}

export async function actOnTask(context, taskId, input) {
  return withTenantTransaction(
    context.tenantId,
    async (client) => {
      const task = await client.query(
        `SELECT workflow_run_id, node_id, assignee_id, status
         FROM approval_tasks
         WHERE tenant_id = $1 AND id = $2`,
        [context.tenantId, taskId]
      );

      if (!task.rowCount) {
        throw new AppError(
          404,
          'NOT_FOUND',
          'Approval task not found'
        );
      }

      const run = await client.query(
        `SELECT r.status, r.active_node, r.resource_type,
                r.resource_id, d.graph
         FROM workflow_runs r
         JOIN workflow_definitions d
           ON d.tenant_id = r.tenant_id
          AND d.id = r.definition_id
         WHERE r.tenant_id = $1 AND r.id = $2
         FOR UPDATE OF r`,
        [
          context.tenantId,
          task.rows[0].workflow_run_id,
        ]
      );

      if (
        !run.rowCount ||
        run.rows[0].status !== 'RUNNING'
      ) {
        throw new AppError(
          409,
          'INVALID_STATE',
          'The workflow run is no longer active'
        );
      }

      const lockedTask = await client.query(
        `SELECT workflow_run_id, node_id, assignee_id, status
         FROM approval_tasks
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [context.tenantId, taskId]
      );

      if (
        !lockedTask.rowCount ||
        lockedTask.rows[0].status !== 'PENDING'
      ) {
        throw new AppError(
          409,
          'INVALID_STATE',
          'This approval task is no longer pending'
        );
      }

      if (
        lockedTask.rows[0].assignee_id &&
        lockedTask.rows[0].assignee_id !== context.userId
      ) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'This task is assigned to another user'
        );
      }

      const activeNodes = parseActiveNodes(
        run.rows[0].active_node,
        lockedTask.rows[0].node_id
      );

      if (!activeNodes.includes(lockedTask.rows[0].node_id)) {
        throw new AppError(
          409,
          'INVALID_STATE',
          'This task is not part of the active approval stage'
        );
      }

      const graphResult = workflowGraphSchema.safeParse(
        run.rows[0].graph
      );

      if (!graphResult.success) {
        throw new AppError(
          422,
          'INVALID_WORKFLOW',
          'The workflow run has an invalid graph'
        );
      }

      const graph = graphResult.data;

      const taskStatus =
        input.action === 'approve'
          ? 'APPROVED'
          : input.action === 'reject'
            ? 'REJECTED'
            : 'CHANGES_REQUESTED';

      const result = await client.query(
        `UPDATE approval_tasks
         SET status = $3, action = $4, comment = $5,
             acted_at = now(), updated_at = now()
         WHERE tenant_id = $1 AND id = $2 AND status = 'PENDING'
         RETURNING *`,
        [
          context.tenantId,
          taskId,
          taskStatus,
          input.action,
          input.comment ?? null,
        ]
      );

      if (!result.rowCount) {
        throw new AppError(
          409,
          'INVALID_STATE',
          'This approval task is no longer pending'
        );
      }

      let runStatus = run.rows[0].status;
      let requestStatus = null;
      let currentActiveNodes = activeNodes;

      if (
        input.action === 'reject' ||
        input.action === 'request_changes'
      ) {
        const finalRunStatus =
          input.action === 'reject' ? 'REJECTED' : 'CANCELLED';

        requestStatus =
          input.action === 'reject'
            ? 'REJECTED'
            : 'CHANGES_REQUESTED';

        await client.query(
          `UPDATE approval_tasks
           SET status = 'CANCELLED', updated_at = now()
           WHERE tenant_id = $1
             AND workflow_run_id = $2
             AND status = 'PENDING'`,
          [
            context.tenantId,
            task.rows[0].workflow_run_id,
          ]
        );

        await client.query(
          `UPDATE workflow_runs
           SET status = $3, completed_at = now(), updated_at = now()
           WHERE tenant_id = $1 AND id = $2`,
          [
            context.tenantId,
            task.rows[0].workflow_run_id,
            finalRunStatus,
          ]
        );

        runStatus = finalRunStatus;
      } else {
        const remaining = await client.query(
          `SELECT node_id
           FROM approval_tasks
           WHERE tenant_id = $1
             AND workflow_run_id = $2
             AND status = 'PENDING'
             AND node_id = ANY($3::text[])`,
          [
            context.tenantId,
            lockedTask.rows[0].workflow_run_id,
            activeNodes,
          ]
        );

        if (remaining.rowCount) {
          await client.query(
            `UPDATE workflow_runs
             SET active_node = $3, updated_at = now()
             WHERE tenant_id = $1 AND id = $2`,
            [
              context.tenantId,
              lockedTask.rows[0].workflow_run_id,
              JSON.stringify(activeNodes),
            ]
          );
        } else {
          const stage = nextApprovalStage(graph, activeNodes);

          if (stage.nodeIds.length) {
            const assignees = graph.nodes
              .filter(
                (node) =>
                  stage.nodeIds.includes(node.id) &&
                  !!node.assigneeId
              )
              .map((node) => node.assigneeId);

            if (assignees.length) {
              const validAssignees = await client.query(
                `SELECT id FROM users
                 WHERE tenant_id = $1
                   AND is_active = true
                   AND id = ANY($2::uuid[])`,
                [context.tenantId, assignees]
              );

              if (
                new Set(
                  validAssignees.rows.map((row) =>
                    row.id.toLowerCase()
                  )
                ).size !==
                new Set(
                  assignees.map((id) => id.toLowerCase())
                ).size
              ) {
                throw new AppError(
                  422,
                  'INVALID_WORKFLOW_ASSIGNEE',
                  'An approval node is assigned to a user who is missing or inactive'
                );
              }
            }

            await createStageTasks(
              client,
              context,
              lockedTask.rows[0].workflow_run_id,
              graph,
              stage.nodeIds
            );

            currentActiveNodes = stage.nodeIds;

            await client.query(
              `UPDATE workflow_runs
               SET active_node = $3, updated_at = now()
               WHERE tenant_id = $1 AND id = $2`,
              [
                context.tenantId,
                lockedTask.rows[0].workflow_run_id,
                JSON.stringify(currentActiveNodes),
              ]
            );

            await audit(
              client,
              context,
              'workflow_run.stage_started',
              lockedTask.rows[0].workflow_run_id,
              { activeNodes: currentActiveNodes }
            );
          } else {
            if (!stage.reachesEnd) {
              throw new AppError(
                422,
                'INVALID_WORKFLOW',
                'The workflow graph cannot advance to an approval stage or end node'
              );
            }

            runStatus = 'APPROVED';
            requestStatus = 'APPROVED';
            currentActiveNodes = [];

            await client.query(
              `UPDATE workflow_runs
               SET status = 'APPROVED', completed_at = now(),
                   updated_at = now(), active_node = NULL
               WHERE tenant_id = $1 AND id = $2`,
              [
                context.tenantId,
                lockedTask.rows[0].workflow_run_id,
              ]
            );
          }
        }
      }

      if (run.rows[0].resource_type === 'purchase_request') {
        if (requestStatus) {
          const updatedRequest = await client.query(
            `UPDATE purchase_requests
             SET status = $3,
                 approved_at = CASE
                   WHEN $3 = 'APPROVED' THEN now()
                   ELSE approved_at
                 END,
                 updated_at = now()
             WHERE tenant_id = $1
               AND id = $2
               AND workflow_run_id = $4
               AND status = 'IN_APPROVAL'`,
            [
              context.tenantId,
              run.rows[0].resource_id,
              requestStatus,
              lockedTask.rows[0].workflow_run_id,
            ]
          );

          if (!updatedRequest.rowCount) {
            throw new AppError(
              409,
              'INVALID_STATE',
              'The associated purchase request is not in this active approval run'
            );
          }

          const purchaseRequest = await client.query(
            `SELECT requester_id, request_number
             FROM purchase_requests
             WHERE tenant_id = $1 AND id = $2`,
            [
              context.tenantId,
              run.rows[0].resource_id,
            ]
          );

          if (purchaseRequest.rowCount) {
            const requestNumber =
              purchaseRequest.rows[0].request_number;

            const subject =
              requestStatus === 'APPROVED'
                ? `Purchase request ${requestNumber} was approved`
                : requestStatus === 'REJECTED'
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
      }

      await audit(
        client,
        context,
        `approval_task.${input.action}`,
        taskId,
        {
          workflowRunId: lockedTask.rows[0].workflow_run_id,
          nodeId: lockedTask.rows[0].node_id,
          runStatus,
          requestStatus,
          activeNodes: currentActiveNodes,
          comment: input.comment ?? null,
        }
      );

      return {
        task: result.rows[0],
        workflowRunStatus: runStatus,
        purchaseRequestStatus: requestStatus,
        activeNodes: currentActiveNodes,
      };
    }
  );
}

function nextApprovalStage(graph, origins) {
  const byId = new Map(
    graph.nodes.map((node) => [node.id, node])
  );

  const outgoing = new Map();

  for (const edge of graph.edges) {
    const successors = outgoing.get(edge.from) ?? [];
    successors.push(edge.to);
    outgoing.set(edge.from, successors);
  }

  const queue = origins.flatMap(
    (id) => outgoing.get(id) ?? []
  );

  const visited = new Set();
  const approvals = new Set();
  let reachesEnd = false;

  while (queue.length) {
    const id = queue.shift();

    if (visited.has(id)) continue;

    visited.add(id);

    const node = byId.get(id);

    if (!node) {
      throw new AppError(
        422,
        'INVALID_WORKFLOW',
        `Workflow edge references missing node "${id}"`
      );
    }

    if (node.type === 'approval') {
      approvals.add(id);
    } else if (node.type === 'end') {
      reachesEnd = true;
    } else {
      queue.push(...(outgoing.get(id) ?? []));
    }
  }

  return {
    nodeIds: [...approvals],
    reachesEnd,
  };
}

function parseActiveNodes(activeNode, fallbackNodeId) {
  if (activeNode === null) {
    return [fallbackNodeId];
  }

  try {
    const parsed = JSON.parse(activeNode);

    if (
      Array.isArray(parsed) &&
      parsed.every((value) => typeof value === 'string')
    ) {
      return parsed;
    }

    if (typeof parsed === 'string') {
      return [parsed];
    }

    throw new AppError(
      409,
      'INVALID_WORKFLOW_STATE',
      'Workflow run has an invalid active stage'
    );
  } catch (error) {
    if (error instanceof AppError) throw error;

    return [activeNode];
  }
}

async function createStageTasks(
  client,
  context,
  runId,
  graph,
  nodeIds
) {
  const nodes = new Map(
    graph.nodes.map((node) => [node.id, node])
  );

  for (const nodeId of nodeIds) {
    const node = nodes.get(nodeId);

    if (!node || node.type !== 'approval') {
      throw new AppError(
        422,
        'INVALID_WORKFLOW',
        `Active stage references non-approval node "${nodeId}"`
      );
    }

    const task = await client.query(
      `INSERT INTO approval_tasks
        (tenant_id, workflow_run_id, node_id, assignee_id, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING id`,
      [
        context.tenantId,
        runId,
        node.id,
        node.assigneeId ?? null,
      ]
    );

    await audit(
      client,
      context,
      'approval_task.created',
      task.rows[0].id,
      {
        workflowRunId: runId,
        nodeId: node.id,
        assigneeId: node.assigneeId ?? null,
      }
    );

    if (node.assigneeId) {
      const run = await client.query(
        `SELECT resource_type, resource_id
         FROM workflow_runs
         WHERE tenant_id = $1 AND id = $2`,
        [context.tenantId, runId]
      );

      if (run.rowCount) {
        const resource =
          run.rows[0].resource_type === 'purchase_request'
            ? await client.query(
                `SELECT request_number
                 FROM purchase_requests
                 WHERE tenant_id = $1 AND id = $2`,
                [
                  context.tenantId,
                  run.rows[0].resource_id,
                ]
              )
            : undefined;

        const name =
          resource?.rows[0]?.request_number ??
          `${run.rows[0].resource_type} ${run.rows[0].resource_id}`;

        await enqueueInAppNotification(
          client,
          context.tenantId,
          node.assigneeId,
          'approval.task_assigned',
          `Approval required for ${name}`,
          {
            taskId: task.rows[0].id,
            workflowRunId: runId,
            resourceType: run.rows[0].resource_type,
            resourceId: run.rows[0].resource_id,
            nodeId: node.id,
          }
        );
      }
    }
  }
}

function isUniqueViolation(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

function isForeignKeyViolation(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23503'
  );
}

async function audit(
  client,
  context,
  action,
  resourceId,
  metadata = {}
) {
  await client.query(
    `INSERT INTO audit_events
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
