"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Scan,
  Copy,
  Loader2,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";

export interface ScanItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  sizeFormatted: string;
  percent: number;
  fileCount?: number;
  dirCount?: number;
  children?: ScanItem[];
  isLoading?: boolean;
}

interface ScanResult {
  path: string;
  name: string;
  items: ScanItem[];
  totalSize: number;
  totalSizeFormatted: string;
  fileCount: number;
  dirCount: number;
  itemCount: number;
}

interface DiskUsageLazyProps {
  targetPath: string;
  onClose?: () => void;
}

type SortKey = "size" | "name";

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}m ${secs}s`;
}

function getProgressBarColor(percent: number): string {
  if (percent >= 50) return "bg-rose-500";
  if (percent >= 20) return "bg-amber-500";
  if (percent >= 10) return "bg-emerald-500";
  return "bg-blue-500";
}

// Componente para mostrar el análisis del LLM con acciones
interface FolderAnalysisProps {
  item: ScanItem;
  onClose: () => void;
  onDelete?: (path: string) => void;
  onRename?: (path: string, newName: string) => void;
}

function FolderAnalysis({ item, onClose, onDelete, onRename }: FolderAnalysisProps) {
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [newName, setNewName] = useState(item.name);

  useEffect(() => {
    analyzeFolder(item);
  }, [item]);

  const analyzeFolder = async (targetItem: ScanItem) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/analyze-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: targetItem.path,
          name: targetItem.name,
          type: targetItem.type,
          size: targetItem.size,
          fileCount: targetItem.fileCount,
          dirCount: targetItem.dirCount,
        }),
      });

      if (!response.ok) throw new Error("Error en análisis");
      
      const data = await response.json();
      setAnalysis(data.analysis || "No se pudo generar análisis.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (confirm(`¿Estás seguro de que quieres eliminar "${item.name}"?\n\nEsta acción no se puede deshacer.`)) {
      onDelete?.(item.path);
      onClose();
    }
  };

  const handleRename = () => {
    if (newName.trim() && newName !== item.name) {
      onRename?.(item.path, newName.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full max-h-[80vh] overflow-auto">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {item.type === "directory" ? (
              <Folder className="h-5 w-5 text-amber-400" />
            ) : (
              <FileText className="h-5 w-5 text-zinc-400" />
            )}
            <h3 className="text-lg font-semibold text-white truncate">
              {item.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4 text-sm text-zinc-400">
            <span>Tamaño: {item.sizeFormatted}</span>
            {item.fileCount !== undefined && (
              <span>{item.fileCount.toLocaleString()} archivos</span>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-2" />
              <p className="text-zinc-400">Analizando con OpenClaw LLM...</p>
            </div>
          ) : error ? (
            <div className="text-red-400 py-4">{error}</div>
          ) : (
            <div className="text-zinc-200 leading-relaxed whitespace-pre-wrap mb-6">
              {analysis}
            </div>
          )}

          {/* Botones de acción */}
          {!isLoading && !error && (
            <div className="border-t border-zinc-800 pt-4 space-y-3">
              {/* Borrar */}
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg text-red-400 transition-colors"
                >
                  <span>🗑️</span>
                  <span>Borrar {item.type === "directory" ? "carpeta" : "archivo"}</span>
                </button>
              ) : (
                <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-3">
                  <p className="text-sm text-red-300 mb-3">
                    ¿Seguro que quieres eliminar "{item.name}"?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-white text-sm"
                    >
                      Sí, borrar
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Renombrar */}
              {!showRenameInput ? (
                <button
                  onClick={() => setShowRenameInput(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 rounded-lg text-blue-400 transition-colors"
                >
                  <span>✏️</span>
                  <span>Renombrar</span>
                </button>
              ) : (
                <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-3">
                  <p className="text-sm text-blue-300 mb-2">Nuevo nombre:</p>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm mb-3 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRename}
                      className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
                    >
                      Renombrar
                    </button>
                    <button
                      onClick={() => {
                        setShowRenameInput(false);
                        setNewName(item.name);
                      }}
                      className="flex-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TreeRowProps {
  item: ScanItem;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: (path: string) => void;
  totalSize: number;
  onLoadChildren?: (path: string) => void;
  onAnalyze?: (item: ScanItem) => void;
}

function TreeRow({
  item,
  depth,
  isExpanded,
  onToggleExpand,
  totalSize,
  onLoadChildren,
  onAnalyze,
}: TreeRowProps) {
  const isDir = item.type === "directory";
  const hasChildren = isDir && (item.children !== undefined || (item.dirCount && item.dirCount > 0));
  const percent = totalSize > 0 ? (item.size / totalSize) * 100 : 0;

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) {
      if (hasChildren && item.children === undefined && !item.isLoading && onLoadChildren) {
        onLoadChildren(item.path);
      }
      onToggleExpand(item.path);
    }
  };

  const handleRowClick = () => {
    if (onAnalyze) {
      onAnalyze(item);
    }
  };

  return (
    <div className="group">
      <div
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/50 transition-colors cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={handleRowClick}
      >
        {/* Expand/Collapse - solo para directorios con contenido */}
        {isDir && hasChildren ? (
          <button
            type="button"
            onClick={handleExpandClick}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700 shrink-0"
          >
            {item.isLoading ? (
              <Loader2 className="h-3 w-3 text-emerald-500 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Icon */}
        {isDir ? (
          <Folder className="h-4 w-4 text-amber-400 shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
        )}

        {/* Name */}
        <span className="flex-1 min-w-0 truncate text-sm text-zinc-200">
          {item.name}
        </span>

        {/* File/Dir count for directories */}
        {isDir && (item.fileCount !== undefined || item.dirCount !== undefined) && (
          <span className="text-[10px] text-zinc-500 mr-2 hidden sm:block">
            {item.fileCount?.toLocaleString()} files, {item.dirCount?.toLocaleString()} dirs
          </span>
        )}

        {/* Size */}
        <span className="text-xs text-zinc-400 w-20 text-right shrink-0">
          {item.sizeFormatted}
        </span>

        {/* Percent */}
        <span className="text-xs text-zinc-500 w-12 text-right shrink-0">
          {percent.toFixed(1)}%
        </span>

        {/* Progress bar */}
        <div className="w-20 shrink-0">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBarColor(percent)} transition-all duration-300`}
              style={{ width: `${Math.max(percent, 0.5)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Children */}
      {isDir && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <TreeRow
              key={child.path}
              item={child}
              depth={depth + 1}
              isExpanded={false}
              onToggleExpand={onToggleExpand}
              totalSize={totalSize}
              onLoadChildren={onLoadChildren}
              onAnalyze={onAnalyze}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DiskUsageLazy({ targetPath, onClose }: DiskUsageLazyProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [searchTerm, setSearchTerm] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analyzingItem, setAnalyzingItem] = useState<ScanItem | null>(null);

  // Cargar nivel inicial
  useEffect(() => {
    loadLevel(targetPath, true);
  }, [targetPath]);

  // Timer
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const loadLevel = async (pathToScan: string, isRoot: boolean = false) => {
    try {
      const parentSize = scanResult?.totalSize || 0;
      const response = await fetch(
        `/api/scan-level?path=${encodeURIComponent(pathToScan)}&parentSize=${parentSize}`
      );
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Error escaneando");
      }

      const data: ScanResult = await response.json();

      if (isRoot) {
        setScanResult(data);
        setIsLoading(false);
      } else {
        // Agregar children al item correspondiente
        setScanResult((prev) => {
          if (!prev) return prev;
          
          const addChildrenToItem = (items: ScanItem[]): ScanItem[] => {
            return items.map((item) => {
              if (item.path === pathToScan) {
                return { ...item, children: data.items, isLoading: false };
              }
              if (item.children) {
                return { ...item, children: addChildrenToItem(item.children) };
              }
              return item;
            });
          };

          return { ...prev, items: addChildrenToItem(prev.items) };
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setIsLoading(false);
    }
  };

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleLoadChildren = useCallback((path: string) => {
    // Marcar como loading
    setScanResult((prev) => {
      if (!prev) return prev;
      
      const markLoading = (items: ScanItem[]): ScanItem[] => {
        return items.map((item) => {
          if (item.path === path) {
            return { ...item, isLoading: true };
          }
          if (item.children) {
            return { ...item, children: markLoading(item.children) };
          }
          return item;
        });
      };

      return { ...prev, items: markLoading(prev.items) };
    });

    // Cargar
    loadLevel(path, false);
  }, []);

  const handleAnalyze = useCallback((item: ScanItem) => {
    setAnalyzingItem(item);
  }, []);

  const handleDeleteItem = useCallback(async (path: string) => {
    try {
      const response = await fetch("/api/file-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", path }),
      });
      
      if (!response.ok) throw new Error("Error al borrar");
      
      // Recargar el nivel actual
      if (scanResult) {
        loadLevel(scanResult.path, true);
      }
    } catch (err) {
      alert("Error al borrar: " + (err instanceof Error ? err.message : "Error desconocido"));
    }
  }, [scanResult]);

  const handleRenameItem = useCallback(async (path: string, newName: string) => {
    try {
      const response = await fetch("/api/file-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", path, newName }),
      });
      
      if (!response.ok) throw new Error("Error al renombrar");
      
      // Recargar el nivel actual
      if (scanResult) {
        loadLevel(scanResult.path, true);
      }
    } catch (err) {
      alert("Error al renombrar: " + (err instanceof Error ? err.message : "Error desconocido"));
    }
  }, [scanResult]);

  const sortedItems = (() => {
    if (!scanResult) return [];
    let items = [...scanResult.items];
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(searchLower));
    }
    if (sortKey === "size") {
      items.sort((a, b) => b.size - a.size);
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }
    return items;
  })();

  const copyPath = () => {
    navigator.clipboard.writeText(targetPath);
  };

  return (
    <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
            ) : (
              <Scan className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isLoading ? "Escaneando..." : "Análisis de Disco"}
            </h3>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <HardDrive className="h-4 w-4" />
              <span className="font-mono truncate max-w-[300px]">
                {scanResult?.name || targetPath.split(/[\\/]/).pop()}
              </span>
              <button
                onClick={copyPath}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
                title="Copiar path"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 mb-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Tamaño Total</p>
            <p className="text-lg font-semibold text-emerald-400">
              {scanResult?.totalSizeFormatted || "..."}
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Archivos</p>
            <p className="text-lg font-semibold text-white">
              {scanResult?.fileCount.toLocaleString() || "..."}
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Carpetas</p>
            <p className="text-lg font-semibold text-white">
              {scanResult?.dirCount.toLocaleString() || "..."}
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Items en nivel</p>
            <p className="text-lg font-semibold text-white">
              {scanResult?.items.length || "..."}
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Tiempo
            </p>
            <p className="text-lg font-semibold text-white">
              {formatElapsed(elapsedSeconds)}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-200"
          >
            <option value="size">Por tamaño</option>
            <option value="name">Por nombre</option>
          </select>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm text-zinc-200"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/30 border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase">
        <span className="w-5" />
        <span className="w-4" />
        <span className="flex-1">Nombre</span>
        <span className="w-32 text-right hidden sm:block">Contenido</span>
        <span className="w-20 text-right">Tamaño</span>
        <span className="w-12 text-right">%</span>
        <span className="w-20">Uso</span>
      </div>

      {/* Tree */}
      <div className="max-h-[400px] overflow-auto">
        {isLoading && !scanResult ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
            <span>Escaneando nivel 1...</span>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500">
            {searchTerm ? "No se encontraron resultados" : "Directorio vacío"}
          </div>
        ) : (
          sortedItems.map((item) => (
            <TreeRow
              key={item.path}
              item={item}
              depth={0}
              isExpanded={expandedPaths.has(item.path)}
              onToggleExpand={handleToggleExpand}
              totalSize={scanResult?.totalSize || 0}
              onLoadChildren={handleLoadChildren}
              onAnalyze={handleAnalyze}
            />
          ))
        )}
      </div>

      {/* Modal de análisis */}
      {analyzingItem && (
        <FolderAnalysis
          item={analyzingItem}
          onClose={() => setAnalyzingItem(null)}
          onDelete={handleDeleteItem}
          onRename={handleRenameItem}
        />
      )}
    </div>
  );
}
