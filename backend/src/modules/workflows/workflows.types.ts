export interface RequestContext {
  tenantId: string;
  userId: string;
}

export type WorkflowNodeType = 'start' | 'approval' | 'end';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  assigneeId?: string | null;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
