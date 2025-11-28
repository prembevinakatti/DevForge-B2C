import { useState } from "react";
import { Upload, Search, Database, GitBranch } from "lucide-react";
import { Card } from "@/components/ui/card";
import FileUpload from "@/components/FileUpload";
import QueryInterface from "@/components/QueryInterface";
import ResultsDisplay from "@/components/ResultsDisplay";

const Index = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any>(null);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 relative">
          <div className="absolute inset-0 gradient-glow opacity-50 pointer-events-none" />
          <h1 className="text-5xl font-bold gradient-text relative z-10">
            Vector + Graph Database
          </h1>
          <p className="text-xl text-muted-foreground relative z-10">
            Hybrid AI Retrieval System with Semantic Search & Graph Relationships
          </p>
          
          {/* Feature Pills */}
          <div className="flex items-center justify-center gap-6 mt-6 relative z-10">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-primary/30">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">Vector Storage</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-accent/30">
              <GitBranch className="w-4 h-4 text-accent" />
              <span className="text-sm text-foreground">Graph Relations</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-primary/30">
              <Search className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">Hybrid Search</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <Card className="p-6 card-shadow border-border/50 bg-card/50 backdrop-blur">
            <div className="flex items-center gap-3 mb-6">
              <Upload className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Upload Data</h2>
            </div>
            <FileUpload 
              onFileSelect={setUploadedFile}
              onFileProcessed={setFileId}
            />
          </Card>

          {/* Query Section */}
          <Card className="p-6 card-shadow border-border/50 bg-card/50 backdrop-blur">
            <div className="flex items-center gap-3 mb-6">
              <Search className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold">Query Database</h2>
            </div>
            <QueryInterface 
              fileId={fileId}
              onSearchResults={setSearchResults}
            />
          </Card>
        </div>

        {/* Results Section */}
        {searchResults && (
          <ResultsDisplay results={searchResults} />
        )}
      </div>
    </div>
  );
};

export default Index;
