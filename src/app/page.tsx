"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "ai/react"; 
import { Upload, FileText, CheckCircle, Loader2, Send, Plus, Trash2 } from "lucide-react";

// Manual Type Definition to avoid import errors
interface Message {
  id: string;
  content: string;
  role: "function" | "system" | "user" | "assistant" | "data" | "tool";
}

type LogEntry = {
  message: string;
  type: "info" | "success" | "error";
  timestamp: string;
};

export default function Home() {
  // --- STATE ---
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    onError: (error: Error) => addLog(`Error: ${error.message}`, "error"),
    onFinish: () => addLog("Response finished.", "success"),
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // --- HELPER: LOGGING ---
  const addLog = (message: string, type: "info" | "success" | "error" = "info") => {
    setLogs((prev) => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  // --- ACTIONS ---
  
  // 1. Select Files
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => {
        const combined = [...prev, ...newFiles];
        // Automatically select the newest file if none is selected
        if (activeFileIndex === null) setActiveFileIndex(combined.length - 1);
        return combined;
      });
      addLog(`Added ${newFiles.length} file(s) to queue.`, "info");
    }
  };

  // 2. Remove File
  const removeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Stop click from selecting the file
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (activeFileIndex === index) setActiveFileIndex(null);
    if (activeFileIndex && activeFileIndex > index) setActiveFileIndex(activeFileIndex - 1);
  };

  // 3. Upload Batch
  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    addLog("Starting batch upload...", "info");

    // Loop through files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      // CRITICAL: Only wipe DB for the very first file in the list
      // Subsequent files should just 'append' to the index
      const shouldWipe = (i === 0); 
      
      try {
        addLog(`Processing ${file.name}...`, "info");
        const res = await fetch(`/api/ingest?wipe=${shouldWipe}`, {
            method: "POST",
            body: formData,
        });

        if (res.ok) {
          addLog(`✓ Indexed: ${file.name}`, "success");
        } else {
          addLog(`✗ Failed: ${file.name}`, "error");
        }
      } catch (error: any) {
        addLog(`Error uploading ${file.name}: ${error.message}`, "error");
      }
    }
    setIsUploading(false);
    addLog("Batch processing complete!", "success");
  };

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create URL for the active file
  const activeFileUrl = activeFileIndex !== null && files[activeFileIndex] 
    ? URL.createObjectURL(files[activeFileIndex]) 
    : null;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      
      {/* --- LEFT PANEL: PDF Gallery & Logs --- */}
      <div className="w-1/2 flex flex-col border-r border-gray-800 bg-black">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center shadow-md z-10">
          <h2 className="font-bold text-lg flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-blue-500" />
            RAG Chat
          </h2>
          <div className="flex gap-2">
            <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-md text-sm transition flex items-center gap-2 border border-gray-700 text-gray-300">
              <Plus className="w-4 h-4" />
              <span>Add PDFs</span>
              <input type="file" multiple accept=".pdf" className="hidden" onChange={handleFileSelect} />
            </label>
            {files.length > 0 && (
              <button 
                onClick={handleUpload}
                disabled={isUploading}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition flex items-center gap-2 shadow-lg ${
                  isUploading 
                    ? "bg-gray-800 text-gray-400 cursor-not-allowed" 
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {isUploading ? "Indexing..." : "Upload All"}
              </button>
            )}
          </div>
        </div>

        {/* Main Stage (Active PDF Viewer) */}
        <div className="flex-1 bg-gray-800 relative overflow-hidden flex flex-col">
          {activeFileUrl ? (
            <iframe src={activeFileUrl} className="w-full h-full border-none" title="PDF Viewer" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
              <div className="bg-gray-900 p-6 rounded-full border border-gray-800">
                <FileText className="w-16 h-16 opacity-50 text-blue-400" />
              </div>
              <p className="text-sm font-medium">Select a file from the list below to preview</p>
            </div>
          )}
        </div>

        {/* File Gallery Strip (Horizontal Scroll) */}
        {files.length > 0 && (
          <div className="h-20 bg-gray-900 border-t border-gray-800 flex items-center px-4 gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
            {files.map((file, idx) => (
              <div 
                key={idx}
                onClick={() => setActiveFileIndex(idx)}
                className={`
                  group relative flex flex-col justify-center min-w-[140px] h-14 px-3 rounded-lg border cursor-pointer transition-all select-none
                  ${activeFileIndex === idx 
                    ? "bg-blue-900/30 border-blue-500/50" 
                    : "bg-gray-800 border-gray-700 hover:border-gray-500"}
                `}
              >
                {/* File Name */}
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 ${activeFileIndex === idx ? "text-blue-400" : "text-gray-500"}`} />
                  <span className={`text-xs font-medium truncate w-24 ${activeFileIndex === idx ? "text-blue-100" : "text-gray-400"}`}>
                    {file.name}
                  </span>
                </div>
                
                {/* Delete Button (Hover Only) */}
                <button 
                  onClick={(e) => removeFile(idx, e)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Logs Panel */}
        <div className="h-32 bg-black border-t border-gray-800 p-3 overflow-y-auto font-mono text-[10px] leading-tight text-gray-400">
          <div className="text-gray-600 mb-2 uppercase tracking-widest font-bold text-[9px]">System Activity</div>
          {logs.length === 0 && <span className="text-gray-800 italic">Waiting for input...</span>}
          {logs.slice().reverse().map((log, i) => ( // Reverse to show newest first
            <div key={i} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-blue-300'}`}>
              <span className="opacity-30 mr-2">[{log.timestamp}]</span> 
              {log.message}
            </div>
          ))}
        </div>
      </div>

      {/* --- RIGHT PANEL: Chat --- */}
      <div className="w-1/2 flex flex-col bg-gray-900 border-l border-gray-800">
        <div className="p-4 border-b border-gray-800 bg-gray-900 shadow-sm">
          <h1 className="font-bold text-lg text-white">AI Assistant</h1>
          <p className="text-xs text-gray-500">Context aware answering based on your documents</p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-gray-600 mt-20 flex flex-col items-center gap-3">
              <div className="bg-gray-800 p-4 rounded-full">
                <Send className="w-8 h-8 opacity-50" />
              </div>
              <p>Upload documents and start asking questions.</p>
            </div>
          )}
          
          {messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                  m.role === "user" 
                    ? "bg-blue-600 text-white rounded-br-sm" 
                    : "bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700"
                }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1.5 ${
                  m.role === "user" ? "text-blue-200" : "text-gray-500"
                }`}>
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                {m.content}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-5 py-4 border border-gray-700 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-sm text-gray-400 font-medium">Analyzing documents...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 bg-gray-900">
          <div className="relative group">
            <input
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-500 transition-all placeholder-gray-600 shadow-inner"
              value={input}
              placeholder="Ask a question about your files..."
              onChange={handleInputChange}
              disabled={isLoading}
              autoFocus
              suppressHydrationWarning
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()} 
              className="absolute right-3 top-3 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed group-focus-within:bg-blue-500"
              suppressHydrationWarning
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}