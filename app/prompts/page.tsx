"use client";

import { useState, useEffect } from "react";
import { Play, Loader2, Terminal, FileText } from "lucide-react";

interface Prompt {
  name: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const [promptText, setPromptText] = useState<string>("");
  const [timeout, setTimeout] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Cargar lista de prompts
  useEffect(() => {
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => {
        if (data.prompts) {
          setPrompts(data.prompts);
          if (data.prompts.length > 0) {
            setSelectedPrompt(data.prompts[0].name);
          }
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  // Cargar texto del prompt seleccionado
  useEffect(() => {
    if (!selectedPrompt) return;
    
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => {
        const found = data.prompts?.find((p: Prompt) => p.name === selectedPrompt);
        // Nota: aquí solo mostramos el nombre, el prompt completo se mantiene en backend
        setPromptText(found ? `Prompt: ${found.name}` : "");
      });
  }, [selectedPrompt]);

  const handleExecute = async () => {
    if (!selectedPrompt) return;
    
    setLoading(true);
    setResponse("");
    setError("");

    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptName: selectedPrompt,
          timeout: timeout,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error executing prompt");
      }

      setResponse(data.response || "No response");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Terminal className="h-8 w-8 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Prompts</h1>
          <p className="text-zinc-400">Ejecuta prompts definidos en prompts.md vía OpenClaw Gateway</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Configuración */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-500" />
            Configuración
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Seleccionar Prompt
              </label>
              <select
                value={selectedPrompt}
                onChange={(e) => setSelectedPrompt(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {prompts.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Timeout (segundos)
              </label>
              <input
                type="number"
                min={10}
                max={300}
                value={timeout}
                onChange={(e) => setTimeout(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleExecute}
              disabled={loading || !selectedPrompt}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Ejecutar
                </>
              )}
            </button>
          </div>
        </div>

        {/* Panel de Resultado */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-500" />
            Respuesta
          </h2>

          <div className="relative">
            {loading && (
              <div className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center rounded-lg">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
              </div>
            )}

            <textarea
              readOnly
              value={response}
              placeholder={loading ? "Esperando respuesta del gateway..." : "La respuesta aparecerá aquí"}
              className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-300 font-mono text-sm resize-none focus:outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm font-medium">Error:</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Info del prompt seleccionado */}
      {selectedPrompt && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Prompt seleccionado:</h3>
          <p className="text-emerald-400 font-mono text-sm">{selectedPrompt}</p>
        </div>
      )}
    </div>
  );
}
