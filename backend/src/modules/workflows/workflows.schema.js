
import { z } from 'zod';

const uuid = z.string().uuid();

const graphNodeSchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: z.enum(['start', 'approval', 'end']),
  assigneeId: uuid.nullable().optional(),
}).strict();

const graphEdgeSchema = z.object({
  from: z.string().trim().min(1).max(100),
  to: z.string().trim().min(1).max(100),
}).strict();

// Persist graph as { nodes: [{id,type,assigneeId?}], edges: [{from,to}] }.
// A graph has one start, one end, and zero or more approval nodes.
// Edges form a directed acyclic graph (DAG).
export const workflowGraphSchema = z.object({
  nodes: z.array(graphNodeSchema).min(2).max(200),
  edges: z.array(graphEdgeSchema).min(1).max(500),
}).strict().superRefine((graph, ctx) => {
  const ids = new Set();

  for (const [index, node] of graph.nodes.entries()) {
    if (ids.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nodes', index, 'id'],
        message: 'Node IDs must be unique',
      });
    }

    ids.add(node.id);
  }

  if (graph.nodes.filter((node) => node.type === 'start').length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nodes'],
      message: 'A graph must contain exactly one start node',
    });
  }

  if (graph.nodes.filter((node) => node.type === 'end').length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nodes'],
      message: 'A graph must contain exactly one end node',
    });
  }

  const adjacency = new Map();
  const reverseAdjacency = new Map();
  const edgeKeys = new Set();
  const incoming = new Map();

  graph.nodes.forEach((node) => {
    adjacency.set(node.id, []);
    reverseAdjacency.set(node.id, []);
    incoming.set(node.id, 0);
  });

  graph.edges.forEach((edge, index) => {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', index],
        message: 'Edge references an unknown node',
      });
      return;
    }

    if (edge.from === edge.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', index],
        message: 'Self-referencing edges are not allowed',
      });
      return;
    }

    const edgeKey = `${edge.from}\u0000${edge.to}`;

    if (edgeKeys.has(edgeKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', index],
        message: 'Duplicate edges are not allowed',
      });
      return;
    }

    edgeKeys.add(edgeKey);

    adjacency.get(edge.from)?.push(edge.to);
    reverseAdjacency.get(edge.to)?.push(edge.from);

    incoming.set(
      edge.to,
      (incoming.get(edge.to) ?? 0) + 1
    );
  });

  for (const node of graph.nodes) {
    if (
      node.type === 'start' &&
      incoming.get(node.id) !== 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nodes'],
        message: 'The start node cannot have incoming edges',
      });
    }

    if (
      node.type === 'end' &&
      (adjacency.get(node.id)?.length ?? 0) !== 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nodes'],
        message: 'The end node cannot have outgoing edges',
      });
    }
  }

  // Detect cycles using depth-first search.
  const visited = new Set();
  const active = new Set();
  let cycle = false;

  const visit = (id) => {
    if (active.has(id)) {
      cycle = true;
      return;
    }

    if (visited.has(id)) return;

    active.add(id);

    for (const next of adjacency.get(id) ?? []) {
      visit(next);
    }

    active.delete(id);
    visited.add(id);
  };

  for (const node of graph.nodes) {
    visit(node.id);
  }

  if (cycle) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['edges'],
      message: 'Workflow graphs cannot contain cycles',
    });
  }

  // Verify that every node is reachable from the start node.
  const start = graph.nodes.find(
    (node) => node.type === 'start'
  );

  const reachable = new Set();

  if (start) {
    const queue = [start.id];

    while (queue.length) {
      const id = queue.shift();

      if (reachable.has(id)) continue;

      reachable.add(id);

      queue.push(...(adjacency.get(id) ?? []));
    }
  }

  if (reachable.size !== graph.nodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nodes'],
      message: 'Every node must be reachable from the start node',
    });
  }

  // Verify that every node can reach the end node.
  const end = graph.nodes.find(
    (node) => node.type === 'end'
  );

  const canReachEnd = new Set();

  if (end) {
    const queue = [end.id];

    while (queue.length) {
      const id = queue.shift();

      if (canReachEnd.has(id)) continue;

      canReachEnd.add(id);

      queue.push(...(reverseAdjacency.get(id) ?? []));
    }
  }

  if (canReachEnd.size !== graph.nodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nodes'],
      message: 'Every node must lead to the end node',
    });
  }
});

export const workflowIdSchema = z.object({
  id: uuid,
});

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  resourceType: z.string()
    .trim()
    .min(1)
    .max(100)
    .default('purchase_request'),
  graph: workflowGraphSchema,
}).strict();

export const createWorkflowVersionSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  graph: workflowGraphSchema.optional(),
}).strict().refine(
  (value) =>
    value.name !== undefined ||
    value.graph !== undefined,
  {
    message: 'Provide a workflow name or graph to create a new version',
  }
);

export const pendingTasksSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

export const taskIdSchema = z.object({
  taskId: uuid,
});

export const taskActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  comment: z.string().trim().max(4000).optional(),
}).strict();
