-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create files table to track uploaded files
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create nodes table for graph nodes with vector embeddings
CREATE TABLE public.nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(768),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create edges table for graph relationships
CREATE TABLE public.edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create queries table to store search queries and results
CREATE TABLE public.queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_text TEXT NOT NULL,
  query_type TEXT NOT NULL,
  results JSONB,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_nodes_file_id ON public.nodes(file_id);
CREATE INDEX idx_nodes_type ON public.nodes(node_type);
CREATE INDEX idx_edges_source ON public.edges(source_node_id);
CREATE INDEX idx_edges_target ON public.edges(target_node_id);
CREATE INDEX idx_edges_type ON public.edges(edge_type);
CREATE INDEX idx_queries_created ON public.queries(created_at DESC);

-- Create index for vector similarity search
CREATE INDEX idx_nodes_embedding ON public.nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (no authentication required for demo)
CREATE POLICY "Allow public read access to files" ON public.files FOR SELECT USING (true);
CREATE POLICY "Allow public insert to files" ON public.files FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to files" ON public.files FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from files" ON public.files FOR DELETE USING (true);

CREATE POLICY "Allow public read access to nodes" ON public.nodes FOR SELECT USING (true);
CREATE POLICY "Allow public insert to nodes" ON public.nodes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to nodes" ON public.nodes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from nodes" ON public.nodes FOR DELETE USING (true);

CREATE POLICY "Allow public read access to edges" ON public.edges FOR SELECT USING (true);
CREATE POLICY "Allow public insert to edges" ON public.edges FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to edges" ON public.edges FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from edges" ON public.edges FOR DELETE USING (true);

CREATE POLICY "Allow public read access to queries" ON public.queries FOR SELECT USING (true);
CREATE POLICY "Allow public insert to queries" ON public.queries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to queries" ON public.queries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete from queries" ON public.queries FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_files_updated_at
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at
BEFORE UPDATE ON public.nodes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_edges_updated_at
BEFORE UPDATE ON public.edges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Public upload access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "Public update access" ON storage.objects FOR UPDATE USING (bucket_id = 'uploads');
CREATE POLICY "Public delete access" ON storage.objects FOR DELETE USING (bucket_id = 'uploads');