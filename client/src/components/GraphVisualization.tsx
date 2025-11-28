import { useMemo, useRef, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";

type GraphNode = {
  id: string;
  label?: string;
  content?: string;
  fx?: number;
  fy?: number;
};

type GraphLink = { source: string; target: string };

export interface GraphVisualizationData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface Props {
  data?: GraphVisualizationData;
  highlightNodeIds?: string[];
  height?: number;
}

/* Get readable label */
const getLabel = (n: GraphNode) =>
  n.label || n.content?.slice(0, 60) || `Node ${n.id}`;

/* Build top-down levels */
const computeLevels = (nodes: GraphNode[], links: GraphLink[]) => {
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  nodes.forEach((n) => {
    indegree.set(n.id, 0);
    adj.set(n.id, []);
  });

  links.forEach((l) => {
    adj.get(l.source)?.push(l.target);
    indegree.set(l.target, (indegree.get(l.target) ?? 0) + 1);
  });

  // start from root nodes (indegree = 0)
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => ({ id: n.id, level: 0 }));
  const levels = new Map<string, number>();

  while (queue.length) {
    const { id, level } = queue.shift()!;
    if (levels.has(id)) continue;
    levels.set(id, level);
    adj.get(id)?.forEach((child) => queue.push({ id: child, level: level + 1 }));
  }

  return levels;
};

export default function GraphVisualization({
  data,
  highlightNodeIds = [],
  height = 500,
}: Props) {
  const fgRef = useRef<ForceGraphMethods | null>(null);

  const processed = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    const { nodes, links } = data;

    const levels = computeLevels(nodes, links);

    const grouped = new Map<number, GraphNode[]>();
    nodes.forEach((n) => {
      const lvl = levels.get(n.id) ?? 0;
      if (!grouped.has(lvl)) grouped.set(lvl, []);
      grouped.get(lvl)!.push(n);
    });

    // layout: top-down, evenly spaced
    const levelGap = 180;
    const nodeGapX = 220;

    const positioned = nodes.map((n) => {
      const lvl = levels.get(n.id) ?? 0;
      const row = grouped.get(lvl)!;
      const index = row.findIndex((r) => r.id === n.id);
      const mid = (row.length - 1) / 2;

      return {
        ...n,
        fx: (index - mid) * nodeGapX,
        fy: lvl * levelGap,
      };
    });

    return { nodes: positioned, links };
  }, [data]);

  const highlight = new Set(highlightNodeIds);

  // Auto-fit
  useEffect(() => {
    if (!fgRef.current || !processed.nodes.length) return;
    setTimeout(() => fgRef.current?.zoomToFit(600, 40), 300);
  }, [processed]);

  if (!processed.nodes.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Graph will appear when relationships are found.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden p-2 shadow">
      <ForceGraph2D
        ref={fgRef}
        graphData={processed}
        height={height}
        backgroundColor="transparent"
        enableNodeDrag={true}
        d3AlphaDecay={1}
        d3VelocityDecay={1}

        linkColor={() => "rgba(120,150,255,0.8)"}
        linkWidth={3}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={0.98}

        nodeRelSize={14}
        nodeColor={(n: any) =>
          highlight.has(n.id) ? "#fde047" : "#60a5fa"
        }

        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={(node: any, ctx, scale) => {
          const label = getLabel(node);
          const fontSize = 14 / scale;
          ctx.font = `600 ${fontSize}px Inter`;

          const textW = ctx.measureText(label).width;
          const padX = 12 / scale;
          const padY = 6 / scale;
          const boxW = textW + padX * 2;
          const boxH = fontSize + padY * 2;

          const x = node.x - boxW / 2;
          const y = node.y - boxH / 2;

          ctx.fillStyle = highlight.has(node.id)
            ? "rgba(253,224,71,0.95)"
            : "rgba(15,23,42,0.9)";

          ctx.beginPath();
          ctx.roundRect(x, y, boxW, boxH, 6 / scale);
          ctx.fill();

          ctx.fillStyle = highlight.has(node.id) ? "#1a1a1a" : "#fff";
          ctx.textBaseline = "middle";
          ctx.fillText(label, node.x - textW / 2, node.y);
        }}
      />
    </div>
  );
}
