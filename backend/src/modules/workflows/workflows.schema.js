
import { z } from "zod";

// ============================================================
// COMMON SCHEMAS
// ============================================================

const uuid = z.string().uuid();

const graphNodeSchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: z.enum(["start", "approval", "end"]),
  assigneeId: uuid.nullable().optional(),
}).strict();

const graphEdgeSchema = z.object({
  from: z.string().trim().min(1).max(100),
  to: z.string().trim().min(1).max(100),
}).strict();

// ============================================================
// WORKFLOW GRAPH SCHEMA
//
// Graph format:
//
// {
//   nodes: [
//     { id: "start", type: "start" },
//     { id: "manager", type: "approval", assigneeId: "UUID" },
//     { id: "finance", type: "approval", assigneeId: "UUID" },
//     { id: "end", type: "end" }
//   ],
//   edges: [
//     { from: "start", to: "manager" },
//     { from: "manager", to: "finance" },
//     { from: "finance", to: "end" }
//   ]
// }
//
// Supports sequential and parallel approval stages.
// ============================================================

export const workflowGraphSchema = z.object({
  nodes: z.array(graphNodeSchema).min(2).max(200),
  edges: z.array(graphEdgeSchema).min(1).max(500),
}).strict().superRefine((graph, ctx) => {
  const nodeMap = new Map();
  const nodeIds = new Set();

  // ----------------------------------------------------------
  // NODE VALIDATION
  // ----------------------------------------------------------

  graph.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes", index, "id"],
        message: "Node IDs must be unique",
      });

      return;
    }

    nodeIds.add(node.id);
    nodeMap.set(node.id, node);
  });

  const startNodes = graph.nodes.filter(
    (node) => node.type === "start"
  );

  const endNodes = graph.nodes.filter(
    (node) => node.type === "end"
  );

  const approvalNodes = graph.nodes.filter(
    (node) => node.type === "approval"
  );

  if (startNodes.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nodes"],
      message: "A workflow must contain exactly one start node",
    });
  }

  if (endNodes.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nodes"],
      message: "A workflow must contain exactly one end node",
    });
  }

  if (approvalNodes.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nodes"],
      message: "A workflow must contain at least one approval node",
    });
  }

  // ----------------------------------------------------------
  // GRAPH STRUCTURES
  // ----------------------------------------------------------

  const adjacency = new Map();
  const reverseAdjacency = new Map();
  const incoming = new Map();
  const edgeKeys = new Set();

  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
    reverseAdjacency.set(node.id, []);
    incoming.set(node.id, 0);
  }

  // ----------------------------------------------------------
  // EDGE VALIDATION
  // ----------------------------------------------------------

  graph.edges.forEach((edge, index) => {
    if (
      !nodeIds.has(edge.from) ||
      !nodeIds.has(edge.to)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index],
        message: "Edge references an unknown node",
      });

      return;
    }

    if (edge.from === edge.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index],
        message: "Self-referencing edges are not allowed",
      });

      return;
    }

    const edgeKey = `${edge.from}\u0000${edge.to}`;

    if (edgeKeys.has(edgeKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index],
        message: "Duplicate edges are not allowed",
      });

      return;
    }

    edgeKeys.add(edgeKey);

    adjacency.get(edge.from).push(edge.to);
    reverseAdjacency.get(edge.to).push(edge.from);

    incoming.set(
      edge.to,
      incoming.get(edge.to) + 1
    );
  });

  // ----------------------------------------------------------
  // START AND END NODE RULES
  // ----------------------------------------------------------

  for (const node of graph.nodes) {
    if (
      node.type === "start" &&
      incoming.get(node.id) !== 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes"],
        message: "The start node cannot have incoming edges",
      });
    }

    if (
      node.type === "end" &&
      adjacency.get(node.id).length !== 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes"],
        message: "The end node cannot have outgoing edges",
      });
    }

    if (
      node.type === "start" &&
      node.assigneeId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes"],
        message: "The start node cannot have an assignee",
      });
    }

    if (
      node.type === "end" &&
      node.assigneeId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes"],
        message: "The end node cannot have an assignee",
      });
    }
  }

  // ----------------------------------------------------------
  // CYCLE DETECTION
  // Kahn's algorithm avoids recursive stack overflow.
  // ----------------------------------------------------------

  const inDegree = new Map(incoming);
  const queue = [];

  for (const node of graph.nodes) {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  }

  let processedCount = 0;
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex++];

    processedCount++;

    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = inDegree.get(next) - 1;

      inDegree.set(next, nextDegree);

      if (nextDegree === 0) {
        queue.push(next);
      }
    }
  }

  if (processedCount !== graph.nodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["edges"],
      message: "Workflow graphs cannot contain cycles",
    });
  }

  // ----------------------------------------------------------
  // REACHABILITY FROM START
  // ----------------------------------------------------------

  const start = startNodes[0];
  const reachable = new Set();

  if (start) {
    const queue = [start.id];
    let index = 0;

    while (index < queue.length) {
      const current = queue[index++];

      if (reachable.has(current)) {
        continue;
      }

      reachable.add(current);

      for (const next of adjacency.get(current) ?? []) {
        queue.push(next);
      }
    }
  }

  if (reachable.size !== graph.nodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nodes"],
      message: "Every node must be reachable from the start node",
    });
  }

  // ----------------------------------------------------------
  // REVERSE REACHABILITY TO END
  // ----------------------------------------------------------

  const end = endNodes[0];
  const canReachEnd = new Set();

  if (end) {
    const queue = [end.id];
    let index = 0;

    while (index < queue.length) {
      const current = queue[index++];

      if (canReachEnd.has(current)) {
        continue;
      }

      canReachEnd.add(current);

      for (
        const previous of reverseAdjacency.get(current) ?? []
      ) {
        queue.push(previous);
      }
    }
  }

  if (canReachEnd.size !== graph.nodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nodes"],
      message: "Every node must lead to the end node",
    });
  }

  // ----------------------------------------------------------
  // APPROVAL NODE VALIDATION
  // ----------------------------------------------------------

  for (const [index, node] of graph.nodes.entries()) {
    if (
      node.type === "approval" &&
      node.assigneeId !== undefined &&
      node.assigneeId !== null &&
      !uuid.safeParse(node.assigneeId).success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes", index, "assigneeId"],
        message: "Approval assignee must be a valid UUID",
      });
    }
  }
});

// ============================================================
// WORKFLOW ID
// ============================================================

export const workflowIdSchema = z.object({
  id: uuid,
});

// ============================================================
// CREATE WORKFLOW
// ============================================================

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(200),

  resourceType: z.string()
    .trim()
    .min(1)
    .max(100)
    .default("purchase_request"),

  graph: workflowGraphSchema,
}).strict();

// ============================================================
// CREATE WORKFLOW VERSION
// ============================================================

export const createWorkflowVersionSchema = z.object({
  name: z.string()
    .trim()
    .min(1)
    .max(200)
    .optional(),

  graph: workflowGraphSchema.optional(),
}).strict().refine(
  (value) =>
    value.name !== undefined ||
    value.graph !== undefined,
  {
    message:
      "Provide a workflow name or graph to create a new version",
  }
);

// ============================================================
// PENDING APPROVAL TASKS
// ============================================================

export const pendingTasksSchema = z.object({
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(50),

  offset: z.coerce.number()
    .int()
    .min(0)
    .max(100000)
    .default(0),
}).strict();

// ============================================================
// APPROVAL TASK ID
// ============================================================

export const taskIdSchema = z.object({
  taskId: uuid,
});

// ============================================================
// APPROVAL TASK ACTION
// ============================================================

export const taskActionSchema = z.object({
  action: z.enum([
    "approve",
    "reject",
    "request_changes",
  ]),

  comment: z.string()
    .trim()
    .max(4000)
    .optional(),
}).strict();
