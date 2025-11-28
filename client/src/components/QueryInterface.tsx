import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface QueryInterfaceProps {
  fileId: string | null;
  onSearchResults: (results: any) => void;
}

const QueryInterface = ({ fileId, onSearchResults }: QueryInterfaceProps) => {
  const [query, setQuery] = useState("");
  const [vectorWeight, setVectorWeight] = useState([0.5]);
  const [graphWeight, setGraphWeight] = useState([0.5]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Error",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }

    if (!fileId) {
      toast({
        title: "Error",
        description: "Please upload a file first",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);

    try {
      const startTime = Date.now();

      // Call hybrid search edge function
      const { data, error } = await supabase.functions.invoke("hybrid-search", {
        body: {
          query,
          fileId,
          vectorWeight: vectorWeight[0],
          graphWeight: graphWeight[0],
          topK: 10,
        },
      });

      if (error) throw error;

      const executionTime = Date.now() - startTime;

      // Store query in database
      await supabase.from("queries").insert({
        query_text: query,
        query_type: "hybrid",
        results: data,
        execution_time_ms: executionTime,
      });

      onSearchResults({
        ...data,
        executionTime,
        query,
        vectorWeight: vectorWeight[0],
        graphWeight: graphWeight[0],
      });

      toast({
        title: "Search Complete",
        description: `Found ${data.vectorResults?.length || 0} results in ${executionTime}ms`,
      });
    } catch (error: any) {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: error.message || "Failed to perform search",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="query">Search Query</Label>
        <div className="flex gap-2">
          <Input
            id="query"
            placeholder="Enter your search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button
            onClick={handleSearch}
            disabled={isSearching || !fileId}
            className="glow-effect"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Hybrid Search Weights</h3>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Vector Similarity</Label>
            <span className="text-sm font-mono text-primary">{vectorWeight[0].toFixed(2)}</span>
          </div>
          <Slider
            value={vectorWeight}
            onValueChange={setVectorWeight}
            max={1}
            step={0.1}
            className="py-2"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Graph Proximity</Label>
            <span className="text-sm font-mono text-accent">{graphWeight[0].toFixed(2)}</span>
          </div>
          <Slider
            value={graphWeight}
            onValueChange={setGraphWeight}
            max={1}
            step={0.1}
            className="py-2"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Adjust weights to balance between semantic similarity and graph relationships
        </p>
      </div>
    </div>
  );
};

export default QueryInterface;
