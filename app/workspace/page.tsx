"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Bot, Check, AlertCircle, Loader2, ChevronRight, ChevronDown, Folder, FileText, Scan, Copy, HardDrive, Sparkles } from "lucide-react";
import { DiskUsageLazy } from "@/components/disk-usage-lazy";

interface Agent {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  workspace?: string;
  status: "active" | "inactive" | "error";
  lastActive?: string;
  capabilities?: string[];
}

interface TreeNodeData {
  name: string;
  type: "file" | "directory";
  children?: TreeNodeData[];
}

function TreeNodeItem({
  node,
  depth = 0,
  summaries,
}: {
  node: TreeNodeData;
  depth?: number;
  summaries: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const isDir = node.type === "directory";
  const summary = depth === 0 && isDir ? summaries[node.name] : undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() => isDir && setOpen((v) => !v)}
        className={`flex w-full items-start gap-1 rounded px-1.5 py-1 text-left text-sm text-zinc-300 hover:bg-zinc-800/60 ${
          isDir ? "cursor-pointer" : "cursor-default"
        }`}
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
      >
        {isDir ? (
          <>
            {open ? (
              <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
            ) : (
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
            )}
            <Folder className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          </>
        )}
        <div className="min-w-0">
          <div className="truncate">{node.name}</div>
          {summary && <div className="mt-0.5 text-xs text-zinc-500">{summary}</div>}
        </div>
      </button>
      {isDir && open && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem key={`${node.name}-${child.name}`} node={child} depth={depth + 1} summaries={summaries} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [source, setSource] = useState<"gateway" | "mock" | "openclaw-cli" | null>(null);
  const [tree, setTree] = useState<TreeNodeData[] | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  
  // Scan states
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  
  // Clean workspace states
  const [cleanResult, setCleanResult] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/agents");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.warning || "No se pudo cargar /api/agents");
      }

      if (data.agents) {
        setAgents(data.agents);
      }

      setWarning(data.warning || null);
      setSource(data.source || null);
    } catch (err) {
      setError("Error cargando agentes");
      console.error("[Workspace] Error fetching agents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setTree(null);
    setTreeError(null);
    setSummaries({});
    setExploreOpen(false);
    // Reset scan state
    setScanData(null);
    setScanError(null);
    setScanOpen(false);
    console.log("[Workspace] Agent selected:", agent.id);
  };

  const fetchTree = async (path: string) => {
    try {
      setTreeLoading(true);
      setTreeError(null);
      const res = await fetch(`/api/tree?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error cargando árbol");
      const children = data.children || [];
      setTree(children);

      const topFolders = children
        .filter((node: TreeNodeData) => node.type === "directory")
        .map((node: TreeNodeData) => node.name);

      if (topFolders.length) {
        setSummaryLoading(true);
        const summaryRes = await fetch("/api/explorer-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, folders: topFolders }),
        });
        const summaryData = await summaryRes.json();
        if (summaryRes.ok && summaryData.summaries) {
          setSummaries(summaryData.summaries);
        }
      }
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setTreeLoading(false);
      setSummaryLoading(false);
    }
  };

  const handleExplore = () => {
    if (!selectedAgent?.workspace) return;
    setExploreOpen((v) => !v);
    if (!exploreOpen) {
      fetchTree(selectedAgent.workspace);
    }
  };

  const handleScan = () => {
    if (!selectedAgent?.workspace) return;
    setScanOpen(true);
    setScanError(null);
  };

  const handleCleanWorkspace = async () => {
    if (!selectedAgent?.workspace) return;
    
    setIsCleaning(true);
    setCleanResult(null);
    
    try {
      const response = await fetch("/api/clean-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedAgent.workspace }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Error al limpiar workspace");
      }
      
      // Verificar que tenemos un resultado válido
      const result = data.result || {};
      
      // Formatear resultado
      let output = data.llmSummary || result.summary || "Limpieza completada.";
      
      if (result.moved && result.moved.length > 0) {
        output += "\n\n📁 Archivos movidos:";
        result.moved.forEach((m: string) => {
          output += "\n  ✓ " + m;
        });
      }
      
      if (result.deleted && result.deleted.length > 0) {
        output += "\n\n🗑️ Archivos eliminados:";
        result.deleted.forEach((d: string) => {
          output += "\n  ✓ " + d;
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        output += "\n\n⚠️ Errores:";
        result.errors.forEach((e: string) => {
          output += "\n  ✗ " + e;
        });
      }
      
      setCleanResult(output);
    } catch (err) {
      setCleanResult("Error: " + (err instanceof Error ? err.message : "Error desconocido"));
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500";
      case "inactive":
        return "bg-amber-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-zinc-500";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Workspace</h1>
        <p className="text-zinc-400 mt-1">
          Selecciona un agente de OpenClaw para trabajar
        </p>
      </div>

      {warning && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium text-amber-100">Workspace en modo fallback</p>
              <p className="mt-1 text-amber-200/90">{warning}</p>
              {source && (
                <p className="mt-1 text-xs uppercase tracking-wide text-amber-300/80">
                  source: {source}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!warning && source === "openclaw-cli" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium text-emerald-100">Agentes cargados desde OpenClaw</p>
              <p className="mt-1 text-emerald-200/90">
                Mostrando agentes reales obtenidos vía <code>openclaw agents list --json</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="ml-3 text-zinc-400">Cargando agentes...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 py-8 text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* Grid de Agentes */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className={`cursor-pointer transition-all hover:border-emerald-500/50 ${
                  selectedAgent?.id === agent.id
                    ? "border-emerald-500 ring-2 ring-emerald-500/20"
                    : ""
                }`}
                onClick={() => handleSelectAgent(agent)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center text-lg leading-none">
                        <span>{agent.emoji || "🤖"}</span>
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium text-white">
                          {agent.name}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${getStatusColor(
                              agent.status
                            )}`}
                          />
                          <span className="text-[10px] text-zinc-500 capitalize">
                            {agent.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedAgent?.id === agent.id && (
                      <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.capabilities.slice(0, 3).map((cap) => (
                        <span
                          key={cap}
                          className="px-1.5 py-0.5 text-[10px] rounded-full bg-zinc-800 text-zinc-400"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Panel del Agente Seleccionado */}
          {selectedAgent && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-500" />
                  Agente Seleccionado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl leading-none">
                    <span>{selectedAgent.emoji || "🤖"}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {selectedAgent.name}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {selectedAgent.description || "Sin descripción"}
                    </p>
                  </div>
                </div>

                {selectedAgent.workspace && (
                  <div className="space-y-4">
                    {/* Workspace Path Card - Mejorado */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <HardDrive className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                          Workspace del Agente
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-amber-400 shrink-0" />
                            <p className="font-mono text-sm text-zinc-200 break-all">
                              {selectedAgent.workspace}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500 pl-6">
                            Path absoluto del workspace
                          </p>
                        </div>
                        
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleScan}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-2 text-sm font-medium text-white transition"
                          >
                            <Scan className="h-4 w-4" />
                            <span>Escanear</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Explorador Simple */}
                    {exploreOpen && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                        <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                          <Folder className="h-4 w-4 text-amber-400" />
                          Explorador de Archivos
                        </h4>
                        <div className="rounded border border-zinc-800 bg-zinc-900/50 p-2">
                          {treeLoading && (
                            <div className="flex items-center gap-2 py-2 text-sm text-zinc-400">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Cargando estructura...
                            </div>
                          )}
                          {!treeLoading && summaryLoading && (
                            <div className="flex items-center gap-2 py-2 text-sm text-zinc-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Pidiendo al LLM un resumen de las carpetas...
                            </div>
                          )}
                          {treeError && (
                            <div className="py-2 text-sm text-red-400">
                              {treeError}
                            </div>
                          )}
                          {!treeLoading && !treeError && tree && tree.length > 0 && (
                            <div className="max-h-80 overflow-auto">
                              {tree.map((node) => (
                                <TreeNodeItem key={node.name} node={node} summaries={summaries} />
                              ))}
                            </div>
                          )}
                          {!treeLoading && !treeError && tree && tree.length === 0 && (
                            <p className="py-2 text-sm text-zinc-500">
                              Directorio vacío.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Funcionalidades Ad-hoc LLM */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <span className="text-xs font-medium uppercase tracking-wide text-purple-400">
                          Funcionalidades LLM
                        </span>
                      </div>
                      
                      <div className="flex items-start gap-4">
                        {/* Botón Limpiar Raiz */}
                        <button
                          type="button"
                          onClick={handleCleanWorkspace}
                          disabled={isCleaning}
                          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 px-3 py-2 text-sm font-medium text-white transition shrink-0"
                        >
                          {isCleaning ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Analizando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              <span>Limpiar Raiz</span>
                            </>
                          )}
                        </button>
                        
                        {/* Campo de resultado */}
                        <div className="flex-1 min-h-[40px] rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2">
                          {isCleaning ? (
                            <span className="text-sm text-zinc-500">Consultando al LLM...</span>
                          ) : cleanResult ? (
                            <span className="text-sm text-zinc-300 whitespace-pre-wrap">{cleanResult}</span>
                          ) : (
                            <span className="text-sm text-zinc-600 italic">El resultado del análisis aparecerá aquí</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Disk Usage Lazy - ESCANEO POR NIVELES */}
                    {scanOpen && selectedAgent.workspace && (
                      <DiskUsageLazy 
                        targetPath={selectedAgent.workspace}
                        onClose={() => setScanOpen(false)}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
