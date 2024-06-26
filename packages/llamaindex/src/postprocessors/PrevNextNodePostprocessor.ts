import type { NodeWithScore } from "../Node.js";
import { NodeRelationship } from "../Node.js";
import type { BaseDocumentStore } from "../storage/index.js";
import type { BaseNodePostprocessor } from "./types.js";

function getForwardNodes(
  nodeWithScore: NodeWithScore,
  topN: number,
  docstore: BaseDocumentStore,
): Promise<Record<string, NodeWithScore>> {
  return new Promise(async (resolve) => {
    let node = nodeWithScore.node;
    const nodes: Record<string, NodeWithScore> = {
      [node.id_]: nodeWithScore,
    };
    let curCount = 0;

    while (curCount < topN) {
      if (!node.relationships[NodeRelationship.NEXT]) {
        break;
      }

      const nextNodeInfo = node.nextNode;
      if (nextNodeInfo === undefined) {
        break;
      }

      const nextNodeId = nextNodeInfo.nodeId;
      const nextNode = await docstore.getNode(nextNodeId);
      if (nextNode === undefined) {
        break;
      }

      nodes[nextNode.id_] = { node: nextNode };
      node = nextNode;
      curCount += 1;
    }
    resolve(nodes);
  });
}

function getBackwardNodes(
  nodeWithScore: NodeWithScore,
  topN: number,
  docstore: BaseDocumentStore,
): Promise<Record<string, NodeWithScore>> {
  return new Promise(async (resolve) => {
    let node = nodeWithScore.node;
    const nodes: Record<string, NodeWithScore> = {
      [node.id_]: nodeWithScore,
    };
    let curCount = 0;

    while (curCount < topN) {
      const prevNodeInfo = node.prevNode;
      if (prevNodeInfo === undefined) {
        break;
      }

      const prevNodeId = prevNodeInfo.nodeId;
      const prevNode = await docstore.getNode(prevNodeId);
      if (prevNode === undefined) {
        break;
      }

      nodes[prevNode.id_] = { node: prevNode };
      node = prevNode;
      curCount += 1;
    }
    resolve(nodes);
  });
}

interface PrevNextNodePostprocessorOptions {
  docstore: BaseDocumentStore;
  topN: number;
  mode: "previous" | "next" | "both";
}

export class PrevNextNodePostprocessor implements BaseNodePostprocessor {
  private docstore: BaseDocumentStore;
  topN: number = 2;
  private mode: "previous" | "next" | "both";

  constructor({
    docstore,
    topN = 2,
    mode = "next",
  }: PrevNextNodePostprocessorOptions) {
    this.docstore = docstore;
    this.topN = topN;
    this.mode = mode;
  }

  async postprocessNodes(
    nodes: NodeWithScore[],
    _query?: string,
  ): Promise<NodeWithScore[]> {
    const allNodes: Record<string, NodeWithScore> = {};
    for (const node of nodes) {
      allNodes[node.node.id_] = node;

      if (this.mode === "next" || this.mode === "both") {
        const forwardNodes = await getForwardNodes(
          node,
          this.topN,
          this.docstore,
        );
        Object.assign(allNodes, forwardNodes);
      }

      if (this.mode === "previous" || this.mode === "both") {
        const backwardNodes = await getBackwardNodes(
          node,
          this.topN,
          this.docstore,
        );
        Object.assign(allNodes, backwardNodes);
      }
    }

    const allNodes_values = Object.values(allNodes);
    const sortedNodes: NodeWithScore[] = [];

    for (const node of allNodes_values) {
      let nodeInserted = false;

      for (let i = 0; i < sortedNodes.length; i++) {
        const cand = sortedNodes[i];
        const node_id = node.node.id_;
        const prevNodeInfo = cand.node.prevNode;
        const nextNodeInfo = cand.node.nextNode;

        if (prevNodeInfo && node_id === prevNodeInfo.nodeId) {
          nodeInserted = true;
          sortedNodes.splice(i, 0, node);
          break;
        } else if (nextNodeInfo && node_id === nextNodeInfo.nodeId) {
          nodeInserted = true;
          sortedNodes.splice(i + 1, 0, node);
          break;
        }
      }

      if (!nodeInserted) {
        sortedNodes.push(node);
      }
    }

    return sortedNodes;
  }
}
