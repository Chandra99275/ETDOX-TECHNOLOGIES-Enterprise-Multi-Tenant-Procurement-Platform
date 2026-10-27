
/**
 * RequestContext
 * {
 *   tenantId: string,
 *   userId: string
 * }
 */

/**
 * WorkflowNodeType:
 * 'start' | 'approval' | 'end'
 */

/**
 * WorkflowNode
 * {
 *   id: string,
 *   type: 'start' | 'approval' | 'end',
 *   assigneeId?: string | null
 * }
 */

/**
 * WorkflowEdge
 * {
 *   from: string,
 *   to: string
 * }
 */

/**
 * WorkflowGraph
 * {
 *   nodes: WorkflowNode[],
 *   edges: WorkflowEdge[]
 * }
 */
