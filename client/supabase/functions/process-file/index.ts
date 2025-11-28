import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, fileName } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      // Secret name can't start with SUPABASE_ when using `supabase secrets set`.
      // Read from `SERVICE_ROLE_KEY` which will be set via the CLI.
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Download file text
    const { data: file } = await supabase
      .storage
      .from("uploads")
      .download(fileName);

    const text = await file.text();

    const chunks = splitIntoChunks(text);  // chunking function

    const embeddings: number[][] = [];
    const nodes = [];

    // ---- GENERATE LOCAL EMBEDDINGS ----
    for (const chunk of chunks) {
      const embedding = await localEmbedding(chunk);
      embeddings.push(embedding);

      const { data: node } = await supabase
        .from("nodes")
        .insert({
          file_id: fileId,
          node_type: "text",
          content: chunk,
          embedding
        })
        .select()
        .single();

      nodes.push(node);
    }

    // ---- CREATE SEMANTIC EDGES USING COSINE SIMILARITY ----
    const edges = [];

    for (let i = 0; i < nodes.length; i++) {
      const scores = [];

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;

        const sim = cosine(embeddings[i], embeddings[j]);
        scores.push({ j, sim });
      }

      const top5 = scores.sort((a, b) => b.sim - a.sim).slice(0, 5);

      for (const t of top5) {
        edges.push({
          source_node_id: nodes[i].id,
          target_node_id: nodes[t.j].id,
          edge_type: "semantic",
          weight: t.sim
        });
      }
    }

    await supabase.from("edges").insert(edges);

    // Update file status
    await supabase.from("files")
      .update({ status: "completed" })
      .eq("id", fileId);

    return new Response(
      JSON.stringify({
        success: true,
        nodesCreated: nodes.length,
        edgesCreated: edges.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// ---- Local deterministic embedding generator (no external API) ----
async function localEmbedding(text: string): Promise<number[]> {
  // synchronous work but keep API async for compatibility
  const dim = 768;
  const vec: number[] = new Array(dim);

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
    vec[i] = ((s % 10000) / 10000) * 2 - 1;
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] = vec[i] / norm;

  return vec;
}

function splitIntoChunks(text: string): string[] {
  return text.match(/(.|\n){1,500}/g) || [];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
