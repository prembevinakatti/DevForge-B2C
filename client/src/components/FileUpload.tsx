import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  onFileProcessed: (fileId: string | null) => void;
}

const FileUpload = ({ onFileSelect, onFileProcessed }: FileUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      onFileSelect(droppedFile);
    }
  }, [onFileSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      onFileSelect(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus("Uploading file...");

    try {
      // Upload file to storage
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setProcessingStatus("Processing file...");

      // Create file record
      const { data: fileData, error: fileError } = await supabase
        .from("files")
        .insert({
          filename: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          status: "processing",
        })
        .select()
        .single();

      if (fileError) throw fileError;

      setProcessingStatus("Extracting data and generating embeddings...");

      // Call ETL edge function
      const { data: etlData, error: etlError } = await supabase.functions.invoke(
        "process-file",
        {
          body: { fileId: fileData.id, fileName, fileType: file.type },
        }
      );

      if (etlError) throw etlError;

      setProcessingStatus("Complete!");
      onFileProcessed(fileData.id);

      toast({
        title: "Success!",
        description: `Processed ${etlData.nodesCreated} nodes and ${etlData.edgesCreated} relationships`,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process file",
        variant: "destructive",
      });
      setProcessingStatus("");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? "border-primary bg-primary/10 glow-effect"
            : "border-border hover:border-primary/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">Drop your file here</p>
        <p className="text-sm text-muted-foreground mb-4">
          or click to browse
        </p>
        <input
          type="file"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
          accept=".txt,.csv,.json,.pdf,.doc,.docx"
        />
        <label htmlFor="file-upload">
          <Button variant="secondary" className="cursor-pointer" asChild>
            <span>Browse Files</span>
          </Button>
        </label>
      </div>

      {file && (
        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          {!isProcessing && !processingStatus && (
            <Button onClick={handleUpload} className="glow-effect">
              Process File
            </Button>
          )}
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="text-sm font-medium">{processingStatus}</p>
        </div>
      )}

      {processingStatus === "Complete!" && (
        <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/30 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-accent" />
          <p className="text-sm font-medium">File processed successfully!</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
