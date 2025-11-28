import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, GitBranch, Zap, Clock } from "lucide-react";
import GraphVisualization, { GraphVisualizationData } from "./GraphVisualization";

/* -------------------------------
      TYPES
--------------------------------*/
type HybridResult = {
  nodeId: string;
  nodeType?: string;
  content?: string;
  vectorScore?: number;
  graphScore?: number;
  hybridScore?: number;
  connections?: number;
};

type VectorResult = {
  nodeId: string;
  nodeType?: string;
  content?: string;
  similarity?: number;
  vectorScore?: number;
};

type GraphResult = {
  nodeId: string;
  nodeType?: string;
  content?: string;
  distance?: number;
  path?: string[];
  pathLabels?: string[];
  matchingSentence?: string;
  matchingWords?: string[];
};

interface ResultsDisplayProps {
  results: {
    vectorResults?: VectorResult[];
    graphResults?: GraphResult[];
    hybridResults?: HybridResult[];
    executionTime?: number;
    query?: string;
    vectorWeight?: number;
    graphWeight?: number;
    graphVisualization?: GraphVisualizationData;
  };
}

const safeLabel = (text?: string | null, fallback?: string) => {
  if (!text || text.trim() === "") return fallback ?? "Untitled Node";
  return text;
};

const formatScore = (value: number | null | undefined) =>
  typeof value === "number" && !Number.isNaN(value) ? value.toFixed(3) : "N/A";

/* ---------------------------------------------------
      MAIN COMPONENT
----------------------------------------------------*/
const ResultsDisplay = ({ results }: ResultsDisplayProps) => {
  const {
    vectorResults,
    graphResults,
    hybridResults,
    executionTime,
    query,
    vectorWeight = 0.5,
    graphWeight = 0.5,
    graphVisualization,
  } = results;

  /* ------------------------------------------
      NORMALIZATION (ensures scores always show)
  -------------------------------------------*/
  const normalizedVectorResults = useMemo(() => {
    return (
      vectorResults?.map((v) => ({
        ...v,
        similarity: v.similarity ?? v.vectorScore ?? 0,
        content: safeLabel(v.content, `Node ${v.nodeId}`),
      })) || []
    );
  }, [vectorResults]);

  const normalizedHybridResults = useMemo(() => {
    return (
      hybridResults?.map((h) => {
        const vScore = h.vectorScore ?? (h as any).similarity ?? 0;
        const gScore = h.graphScore ?? 0;

        return {
          ...h,
          content: safeLabel(h.content, `Node ${h.nodeId}`),
          vectorScore: vScore,
          graphScore: gScore,
          hybridScore: h.hybridScore ?? vScore * vectorWeight + gScore * graphWeight,
        };
      }) || []
    );
  }, [hybridResults, vectorWeight, graphWeight]);

  /* ------------------------------------------
      GRAPH NODES FIX
      (ensures graph always displays text)
  -------------------------------------------*/
  const graphNodeLookup = useMemo(() => {
    if (!graphVisualization?.nodes?.length)
      return new Map<string, GraphVisualizationData["nodes"][number]>();

    return new Map(graphVisualization.nodes.map((node) => [node.id, node]));
  }, [graphVisualization]);

  const derivedGraphData = useMemo(() => {
    if (!graphResults?.length) return graphVisualization;

    const nodesMap = new Map<string, GraphVisualizationData["nodes"][number]>();
    const links: GraphVisualizationData["links"] = [];

    graphResults.forEach((result, resultIdx) => {
      if (!result.path || result.path.length < 2) return;

      result.path.forEach((nodeId, idx) => {
        if (!nodesMap.has(nodeId)) {
          const graphNode = graphNodeLookup.get(nodeId);

          const resolvedLabel =
            result.pathLabels?.[idx] ??
            graphNode?.label ??
            graphNode?.content ??
            result.matchingSentence ??
            result.content ??
            `Node ${nodeId}`;

          nodesMap.set(nodeId, {
            id: nodeId,
            label: resolvedLabel,
            content: graphNode?.content ?? result.content ?? resolvedLabel,
            fx: idx * 140,
            fy: resultIdx * 90,
          });
        }

        if (idx < result.path.length - 1) {
          links.push({
            source: result.path[idx],
            target: result.path[idx + 1],
            weight: 1,
          });
        }
      });
    });

    return { nodes: Array.from(nodesMap.values()), links };
  }, [graphResults, graphVisualization, graphNodeLookup]);

  const highlightedNodeIds = useMemo(() => {
    const firstPath = graphResults?.find((r) => r.path?.length)?.path ?? [];
    const hybridTop = normalizedHybridResults?.slice(0, 3).map((r) => r.nodeId) ?? [];

    return Array.from(new Set([...(firstPath || []), ...hybridTop]));
  }, [graphResults, normalizedHybridResults]);

  /* ------------------------------------------
      UI RENDER
  -------------------------------------------*/
  return (
    <Card className="p-6 bg-card/50 border-border/40 backdrop-blur">
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              Search Results
            </h2>
            <p className="text-sm text-muted-foreground">Query: "{query}"</p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-accent" />
            <span className="font-mono">{executionTime}ms</span>
          </div>
        </div>

        {/* WEIGHTS */}
        <div className="flex gap-4">
          <Badge variant="outline" className="text-primary border-primary/50">
            Vector: {(vectorWeight * 100).toFixed(0)}%
          </Badge>
          <Badge variant="outline" className="text-accent border-accent/50">
            Graph: {(graphWeight * 100).toFixed(0)}%
          </Badge>
        </div>

        {/* TABS */}
        <Tabs defaultValue="hybrid">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="hybrid">
              <Zap className="w-4 h-4" /> Hybrid
            </TabsTrigger>
            <TabsTrigger value="vector">
              <Database className="w-4 h-4" /> Vector
            </TabsTrigger>
            <TabsTrigger value="graph">
              <GitBranch className="w-4 h-4" /> Graph
            </TabsTrigger>
          </TabsList>

          {/* HYBRID RESULTS */}
          <TabsContent value="hybrid" className="mt-6 space-y-4">
            {normalizedHybridResults.map((result, index) => (
              <Card
                key={index}
                className="p-4 bg-secondary/50 border-primary/30 hover:border-primary/60 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline">{result.nodeType}</Badge>
                  <Badge className="bg-primary/20 text-primary">
                    Score: {formatScore(result.hybridScore)}
                  </Badge>
                </div>

                <p className="text-sm">{result.content}</p>

                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>Vector: {formatScore(result.vectorScore)}</span>
                  <span>Graph: {formatScore(result.graphScore)}</span>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* VECTOR RESULTS */}
          <TabsContent value="vector" className="mt-6 space-y-4">
            {normalizedVectorResults.map((result, index) => (
              <Card
                key={index}
                className="p-4 bg-secondary/50 border-primary/30 hover:border-primary/60 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline">{result.nodeType}</Badge>
                  <Badge className="bg-primary/20 text-primary">
                    Similarity: {formatScore(result.similarity)}
                  </Badge>
                </div>
                <p className="text-sm">{result.content}</p>
              </Card>
            ))}
          </TabsContent>

          {/* GRAPH RESULTS */}
          <TabsContent value="graph" className="mt-6 space-y-6">
            <GraphVisualization
              data={derivedGraphData}
              highlightNodeIds={highlightedNodeIds}
            />

            {graphResults?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {graphResults.map((result, index) => (
                  <Card
                    key={index}
                    className="p-4 bg-secondary/50 border-accent/30 hover:border-accent/60 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline">{result.nodeType}</Badge>
                      <Badge className="bg-accent/20 text-accent">
                        Distance: {result.distance}
                      </Badge>
                    </div>

                    <p className="text-sm">{safeLabel(result.content, result.nodeId)}</p>

                    {result.pathLabels?.length ? (
                      <p className="text-xs text-muted-foreground mt-3">
                        Path: {result.pathLabels.join(" → ")}
                      </p>
                    ) : result.path ? (
                      <p className="text-xs text-muted-foreground mt-3">
                        Path: {result.path.join(" → ")}
                      </p>
                    ) : null}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-4 border-dashed border-accent/30 text-muted-foreground">
                Graph search results will appear once connections form.
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};

export default ResultsDisplay;
