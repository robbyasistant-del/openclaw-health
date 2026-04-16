"use client";

import { useState, useEffect } from "react";
import { Play, Loader2, Terminal, FileText, Save } from "lucide-react";

interface Prompt {
  name: string;
  prompt: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const [promptText, setPromptText] = useState<string>("");
  const [timeout, setTimeout] = useState<number>(300);
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
    
    fetch(`/api/prompts?name=${encodeURIComponent(selectedPrompt)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.prompt?.prompt) {
          setPromptText(data.prompt.prompt);
        }
      })
      .catch((err) => setError("Error cargando prompt: " + err.message));
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
          promptText: promptText,  // Enviamos el texto editable
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
                Seleccionar Prompt ({prompts.length} disponibles)
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
                max={600}
                value={timeout}
                onChange={(e) => setTimeout(Number(e.target.value))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <p className="text-xs text-zinc-500 mt-1">Por defecto: 300 segundos (5 minutos)</p>
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
            Respuesta del Gateway
          </h2>

          <div className="relative">
            {loading && (
              <div className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center rounded-lg z-10">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
              </div>
            )}

            <textarea
              readOnly
              value={response}
              placeholder={loading ? "Esperando respuesta del gateway..." : "La respuesta aparecerá aquí después de ejecutar"}
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

      {/* Texto del Prompt - EDITABLE */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Save className="h-5 w-5 text-emerald-500" />
            Texto del Prompt (Editable)
          </h3>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-3 py-1 rounded-full">
            Puedes editar antes de ejecutar
          </span>
        </div>
        
        <p className="text-sm text-zinc-400">
          Selecciona un prompt del combobox arriba y edita el texto aquí. Al pulsar &quot;Ejecutar&quot;, se enviará 
          <strong className="text-emerald-400"> exactamente este texto</strong> al gateway.
        </p>

        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Selecciona un prompt arriba para ver su contenido..."
          className="w-full h-96 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-300 font-mono text-sm resize-y focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          spellCheck={false}
        />
        
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{promptText.length} caracteres</span>
          <span>Prompt: {selectedPrompt || "Ninguno seleccionado"}</span>
        </div>
      </div>
    </div>
  );
}
