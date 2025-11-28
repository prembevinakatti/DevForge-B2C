# 🚀 DevForge-B2C – Vector + Graph Native Database for Efficient AI Retrieval  

DevForge-B2C is an advanced **AI-driven document intelligence system** that converts unstructured files into a structured **vector + graph knowledge network**.  
Users can upload files, process them through an automated ETL pipeline, and run powerful **hybrid searches** that combine:

- 🔍 **Vector similarity** (semantic meaning)  
- 🕸️ **Graph traversal** (relationships & context)

The result is a highly intelligent system capable of understanding both meaning and structure.

---

## 🌟 Features

### 📁 Smart File Upload & ETL Pipeline  
- Upload `.txt`, `.pdf`, `.csv`, `.json`, `.doc`, `.docx`  
- Extract → Chunk → Embed → Graph Build  
- Automatically creates:
  - Vector embeddings  
  - Graph nodes & edges  
  - Metadata records  

---

### 🧠 Hybrid Vector + Graph Search  
Search blends semantic meaning with structural relationships.

# 📂 Project Structure

📦 DevForge-B2C
 ┣ 📂 client
 ┃ ┣ 📂 public
 ┃ ┣ 📂 src
 ┃ ┃ ┣ App.tsx
 ┃ ┃ ┣ main.tsx
 ┃ ┃ ┣ 📂 components
 ┃ ┃ ┃ ┣ FileUpload.tsx
 ┃ ┃ ┃ ┣ QueryInterface.tsx
 ┃ ┃ ┃ ┣ ResultsDisplay.tsx
 ┃ ┃ ┃ ┣ GraphVisualization.tsx
 ┃ ┃ ┣ 📂 ui (ShadCN UI components)
 ┃ ┃ ┣ 📂 integrations/supabase
 ┣ 📂 supabase
 ┃ ┣ config.toml
 ┃ ┣ 📂 functions
 ┃ ┃ ┣ 📂 process-file      # ETL + vector & graph builder
 ┃ ┃ ┣ 📂 hybrid-search     # Hybrid search engine
 ┗ README.md




---

### 🕸️ Interactive Graph Visualization  
- Tree-like hierarchical layout  
- Clean spacing between nodes  
- Highlights top-matching nodes  
- Draggable & zoomable  
- Extremely user-friendly & readable

---

# 🏗️ Tech Stack

## **Frontend**
- React + TypeScript (Vite)
- Tailwind CSS
- ShadCN UI Components
- React Query
- React Router
- react-force-graph-2d

## **Backend**
- Supabase Edge Functions (Deno)
- Supabase Storage
- Supabase Postgres + pgvector
- Supabase Auth

## **AI**
- Embedding model (OpenAI / OpenRouter)
- Vector search via pgvector
- Graph traversal scoring engine

---


---

# ⚙️ How It Works

## **1️⃣ Upload File → ETL Pipeline**
Edge Function `process-file`:
- Extracts text  
- Chunks data  
- Embeds chunks  
- Creates graph relationships  
- Saves everything to DB  

---

## **2️⃣ Run Hybrid Search**
Edge Function `hybrid-search`:
- Embeds user query  
- Finds vector-similar nodes  
- Finds graph-neighbor nodes  
- Computes hybrid score  
- Returns top results + graph path  

---

## **3️⃣ Graph Visualization**
- Auto-layered layout (tree-like)  
- Clear spacing  
- Clean readable node labels  
- Highlights important nodes  

---

# 🖥️ Local Development

## Clone the Repo
```bash
git clone https://github.com/prembevinakatti/DevForge-B2C.git

cd client
npm install
npm run dev



