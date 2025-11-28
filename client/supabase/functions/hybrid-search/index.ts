// @ts-expect-error: jsr specifier is resolved by Deno runtime
import { createClient } from "jsr:@supabase/supabase-js@2";

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get(key: string): string | undefined;
  };
};

type NodeMetadata = Record<string, unknown> | null;

type NodeRecord = {
  id: string;
  node_type: string;
  content: string;
  embedding: number[];
  metadata: NodeMetadata;
};

type EdgeRecord = {
  source_node_id: string;
  target_node_id: string;
  weight: number;
};

type VectorResult = {
  nodeId: string;
  nodeType: string;
  content: string;
  vectorScore: number;
};

type GraphResult = {
  nodeId: string;
  sourceNode: string;
  graphScore: number;
  distance: number;
  path: string[];
  pathLabels?: string[];
  matchingSentence?: string;
  matchingWords?: string[];
  nodeType?: string;
  content?: string;
};

type CombinedResult = {
  nodeId: string;
  nodeType?: string;
  content?: string;
  vectorScore: number;
  graphScore: number;
  connections: number;
};

type HybridResult = CombinedResult & {
  hybridScore: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, fileId, vectorWeight, graphWeight, topK } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      // Secret name can't start with SUPABASE_ when using `supabase secrets set`.
      // Read from `SERVICE_ROLE_KEY` which will be set via the CLI.
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // ---------------------------
    // 1. Generate embedding for query
    // ---------------------------
    const queryEmbedding = await localEmbedding(query);

    // ---------------------------
    // 2. Get nodes for this file only
    // ---------------------------
    const { data: nodes } = await supabase
      .from("nodes")
      .select("*")
      .eq("file_id", fileId);

    if (!nodes || nodes.length === 0) {
      throw new Error("No nodes found for this file");
    }

    const typedNodes = nodes as NodeRecord[];
    const nodeLookup = new Map<string, NodeRecord>(
      typedNodes.map((node: NodeRecord) => [node.id, node])
    );

    // ---------------------------
    // 3. VECTOR SEARCH (semantic similarity)
    // ---------------------------
    const vectorResults: VectorResult[] = typedNodes
      .map((node: NodeRecord) => ({
        nodeId: node.id,
        nodeType: node.node_type,
        content: node.content,
        vectorScore: cosine(queryEmbedding, node.embedding),
      }))
      .sort((a: VectorResult, b: VectorResult) => b.vectorScore - a.vectorScore)
      .slice(0, topK);

    // Get only the node IDs from vector results
    const topNodeIds = vectorResults.map((result) => result.nodeId);

    // ---------------------------
    // 4. GRAPH SEARCH (expand neighborhood)
    // ---------------------------
    const { data: edges } = await supabase
      .from("edges")
      .select("*")
      .in("source_node_id", topNodeIds);

    const typedEdges = (edges || []) as EdgeRecord[];

    const edgeNodeIds = new Set<string>();
    typedEdges.forEach((edge) => {
      edgeNodeIds.add(edge.source_node_id);
      edgeNodeIds.add(edge.target_node_id);
    });

    const missingNodeIds = Array.from(edgeNodeIds).filter((id) => !nodeLookup.has(id));
    if (missingNodeIds.length > 0) {
      const { data: extraNodes } = await supabase
        .from("nodes")
        .select("*")
        .in("id", missingNodeIds);

      (extraNodes || []).forEach((node: NodeRecord) => {
        nodeLookup.set(node.id, node);
      });
    }

    const queryTokens = buildQueryTokenSet(query);

    const graphResults: GraphResult[] = typedEdges.map((edge: EdgeRecord) => {
      const path = [edge.source_node_id, edge.target_node_id];
      const pathLabels = path.map((id) => deriveNodeLabel(nodeLookup.get(id)));
      const targetNode = nodeLookup.get(edge.target_node_id);
      const matchingSentence = extractMatchingSentence(targetNode?.content, queryTokens);
      const matchingWords = extractMatchingWords(targetNode?.content, queryTokens);
      return {
        nodeId: edge.target_node_id,
        sourceNode: edge.source_node_id,
        graphScore: edge.weight,
        distance: 1,
        path,
        pathLabels,
        matchingSentence,
        matchingWords,
        nodeType: nodeLookup.get(edge.target_node_id)?.node_type,
        content: nodeLookup.get(edge.target_node_id)?.content,
      };
    });

    // ---------------------------
    // 5. MERGE VECTOR + GRAPH INTO HYBRID
    // ---------------------------
    const combined = new Map<string, CombinedResult>();

    // Add vector results
    for (const v of vectorResults) {
      combined.set(v.nodeId, {
        ...v,
        graphScore: 0,
        connections: 0,
      });
    }

    // Merge graph results
    for (const g of graphResults) {
      const existing = combined.get(g.nodeId);

      if (existing) {
        existing.graphScore = Math.max(existing.graphScore, g.graphScore);
        existing.connections++;
      } else {
        const nodeDetails = nodeLookup.get(g.nodeId);
        combined.set(g.nodeId, {
          nodeId: g.nodeId,
          nodeType: nodeDetails?.node_type,
          content: nodeDetails?.content,
          vectorScore: 0,
          graphScore: g.graphScore,
          connections: 1,
        });
      }
    }

    // Compute hybrid score
    const hybridResults: HybridResult[] = Array.from(combined.values())
      .map((result: CombinedResult): HybridResult => ({
        ...result,
        hybridScore:
          result.vectorScore * vectorWeight + result.graphScore * graphWeight,
      }))
      .sort((a: HybridResult, b: HybridResult) => b.hybridScore - a.hybridScore)
      .slice(0, topK);

    // ---------------------------
    // 6. SEND RESPONSE
    // ---------------------------
    const graphNodes = typedNodes.map((node: NodeRecord) => ({
      id: node.id,
      nodeType: node.node_type,
      content: node.content,
      label: deriveNodeLabel(node),
    }));

    const graphLinks = typedEdges.map((edge: EdgeRecord) => ({
      source: edge.source_node_id,
      target: edge.target_node_id,
      weight: edge.weight,
    }));

    return new Response(
      JSON.stringify({
        vectorResults,
        graphResults,
        hybridResults,
        graphVisualization: {
          nodes: graphNodes,
          links: graphLinks,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// ---------------------------
// Local deterministic embedding generator (no external API)
// Produces a 768-dimension normalized vector derived from the text.
// This allows running the app locally without Lovable or other embedding services.
// ---------------------------
function localEmbedding(text: string): number[] {
  const dim = 768;
  const vec: number[] = new Array(dim);

  // simple FNV-1a-like seeding from text
  let seed = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }

  for (let i = 0; i < dim; i++) {
    let s = (seed ^ (i + 0x9e3779b9)) >>> 0;
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    // map to [-1, 1]
    vec[i] = ((s % 10000) / 10000) * 2 - 1;
  }

  // normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] = vec[i] / norm;

  return vec;
}

// ---------------------------
// COSINE SIMILARITY
// ---------------------------
function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const LABEL_WORD_LIMIT = 3;
const LABEL_CHAR_LIMIT = 40;

function deriveNodeLabel(node?: NodeRecord): string {
  if (!node) return "Unknown";

  const metadataLabel = extractMetadataLabel(node.metadata);
  if (metadataLabel) {
    return metadataLabel;
  }

  const cleanedContent = (node.content ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]/g, " ")
    .trim();

  if (cleanedContent) {
    const words = cleanedContent.split(" ").filter(Boolean);
    const snippet = words
      .slice(0, LABEL_WORD_LIMIT)
      .join(" ");

    if (snippet.length > LABEL_CHAR_LIMIT) {
      return snippet.slice(0, LABEL_CHAR_LIMIT).trim() + "...";
    }

    return snippet || node.id;
  }

  return node.id;
}

function extractMetadataLabel(metadata: NodeMetadata): string | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const preferredKeys = ["label", "title", "name", "keyword", "heading", "topic"];

  for (const key of preferredKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const keywords = metadata["keywords"];
  if (Array.isArray(keywords)) {
    for (const keyword of keywords) {
      if (typeof keyword === "string" && keyword.trim()) {
        return keyword.trim();
      }
    }
  }

  return undefined;
}

function buildQueryTokenSet(query: string): Set<string> {
  const matches = query
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  return new Set(matches ?? []);
}

function extractMatchingSentence(
  content: string | undefined,
  queryTokens: Set<string>
): string | undefined {
  if (!content || queryTokens.size === 0) {
    return undefined;
  }

  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const tokens = sentence.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    if (tokens.some((token) => queryTokens.has(token))) {
      return sentence;
    }
  }

  return sentences[0];
}

function extractMatchingWords(
  content: string | undefined,
  queryTokens: Set<string>
): string[] {
  if (!content || queryTokens.size === 0) {
    return [];
  }

  const tokens = content.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const matches = new Set<string>();

  for (const token of tokens) {
    if (queryTokens.has(token)) {
      matches.add(token);
    }
  }

  return Array.from(matches);
}
