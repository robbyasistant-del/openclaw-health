"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Scan,
  Check,
  Copy,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";

export interface ScanItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  sizeFormatted: string;
  percent: number;
  children?: ScanItem[];
}

export interface ScanProgress {
  path: string;
  name: string;
  totalSize: number;
  totalSizeFormatted: string;
  itemCount: number;
  fileCount: number;
  dirCount: number;
  items: ScanItem[];
  elapsedMs: number;
  isComplete: boolean;
  isScanning: boolean;
  truncated?: boolean;
  totalItemsFound?: number;
  error?: string;
}

interface DiskUsageStreamProps {
  targetPath: string;
  onClose?: () => void;
}

type SortKey = "size" | "name";

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getProgressBarColor(percent: number): string {
  if (percent >= 50) return "bg-rose-500";
  if (percent >= 20) return "bg-amber-500";
  if (percent >= 10) return "bg-emerald-500";
  return "bg-blue-500";
}

interface TreeRowProps {
  item: ScanItem;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (path: string) => void;
  onToggleSelect: (path: string) => void;
  totalSize: number;
}

function TreeRow({
  item,
  depth,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  totalSize,
}: TreeRowProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isDir = item.type === "directory";
  const percent = totalSize > 0 ? (item.size / totalSize) * 100 : 0;

  return (
    <div className="group">
      <div
        className={`flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/50 transition-colors cursor-pointer ${
          isSelected ? "bg-zinc-800/80" : ""
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => onToggleSelect(item.path)}
      >
        {/* Expand/Collapse */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(item.path);
          }}
          className={`w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700 ${
            hasChildren ? "visible" : "invisible"
          }`}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Checkbox */}
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? "bg-emerald-500 border-emerald-500"
              : "border-zinc-600 hover:border-zinc-500"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(item.path);
          }}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>

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
              isSelected={false}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              totalSize={totalSize}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DiskUsageStream({ targetPath, onClose }: DiskUsageStreamProps) {
  const [scanData, setScanData] = useState<ScanProgress>({
    path: targetPath,
    name: targetPath.split(/[\\/]/).pop() || "",
    totalSize: 0,
    totalSizeFormatted: "0 B",
    itemCount: 0,
    fileCount: 0,
    dirCount: 0,
    items: [],
    elapsedMs: 0,
    isComplete: false,
    isScanning: true,
  });
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Conectar al stream SSE
  useEffect(() => {
    const encodedPath = encodeURIComponent(targetPath);
    const eventSource = new EventSource(`/api/scan-stream?path=${encodedPath}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "start":
            setScanData((prev) => ({
              ...prev,
              isScanning: true,
              isComplete: false,
            }));
            break;

          case "progress":
            setScanData((prev) => ({
              ...prev,
              totalSize: data.totalSize,
              totalSizeFormatted: data.totalSizeFormatted,
              fileCount: data.fileCount,
              dirCount: data.dirCount,
              itemCount: data.fileCount + data.dirCount,
              elapsedMs: data.elapsedMs,
            }));
            break;

          case "item":
            setScanData((prev) => {
              const newItems = [...prev.items, data.item];
              // Mantener ordenado por tamaño
              newItems.sort((a, b) => b.size - a.size);
              return { ...prev, items: newItems };
            });
            break;

          case "complete":
            setScanData({
              path: data.path,
              name: data.name,
              totalSize: data.totalSize,
              totalSizeFormatted: data.totalSizeFormatted,
              itemCount: data.itemCount,
              fileCount: data.fileCount,
              dirCount: data.dirCount,
              items: data.items,
              elapsedMs: data.elapsedMs,
              isComplete: true,
              isScanning: false,
              truncated: data.truncated,
              totalItemsFound: data.totalItemsFound,
            });
            eventSource.close();
            break;

          case "error":
            setError(data.error);
            setScanData((prev) => ({ ...prev, isScanning: false }));
            eventSource.close();
            break;
        }
      } catch (e) {
        console.error("Error parsing SSE data:", e);
      }
    };

    eventSource.onerror = () => {
      setError("Error de conexión con el stream de escaneo");
      setScanData((prev) => ({ ...prev, isScanning: false }));
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [targetPath]);

  // Actualizar tiempo transcurrido cada segundo mientras escanea
  useEffect(() => {
    if (!scanData.isScanning || scanData.isComplete) return;

    const interval = setInterval(() => {
      setScanData((prev) => ({
        ...prev,
        elapsedMs: Date.now() - (Date.now() - prev.elapsedMs), // Aproximación
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [scanData.isScanning, scanData.isComplete]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const sortedItems = (() => {
    let items = [...scanData.items];
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          (item.children?.some((child) =>
            child.name.toLowerCase().includes(searchLower)
          ))
      );
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
            {scanData.isScanning ? (
              <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
            ) : (
              <Scan className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {scanData.isScanning ? "Escaneando..." : "Escaneo Completo"}
            </h3>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <HardDrive className="h-4 w-4" />
              <span className="font-mono truncate max-w-[300px]">{scanData.name}</span>
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

        {/* Stats Grid - EN TIEMPO REAL */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Tamaño Total</p>
            <p className="text-lg font-semibold text-emerald-400">
              {scanData.totalSizeFormatted}
            </p>
            <p className="text-[10px] text-zinc-600">
              {scanData.totalSize.toLocaleString()} bytes
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Archivos</p>
            <p className="text-lg font-semibold text-white">
              {scanData.fileCount.toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-600">contados</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Carpetas</p>
            <p className="text-lg font-semibold text-white">
              {scanData.dirCount.toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-600">encontradas</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Tiempo
            </p>
            <p className="text-lg font-semibold text-white">
              {formatElapsed(scanData.elapsedMs)}
            </p>
            <p className="text-[10px] text-zinc-600">
              {scanData.isScanning ? "escaneando..." : "completado"}
            </p>
          </div>
        </div>

        {/* Warning si está truncado */}
        {scanData.truncated && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 mb-3">
            <p className="text-xs text-amber-400">
              ⚠️ Mostrando los {scanData.items.length} items más grandes de {scanData.totalItemsFound?.toLocaleString()} totales encontrados.
            </p>
          </div>
        )}

        {/* Progress bar visual */}
        {scanData.isScanning && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Progreso del escaneo</span>
              <span>{scanData.itemCount.toLocaleString()} items encontrados</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 animate-pulse"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Buscar archivos o carpetas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="size">Ordenar por tamaño</option>
            <option value="name">Ordenar por nombre</option>
          </select>

          <button
            onClick={() => setExpandedPaths(new Set())}
            className="px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            Colapsar todo
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded-lg text-sm text-zinc-200 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>

        {selectedPaths.size > 0 && (
          <div className="mt-2 text-sm text-emerald-400">
            {selectedPaths.size} item(s) seleccionado(s)
          </div>
        )}
      </div>

      {/* Table Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/30 border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase">
        <span className="w-5" />
        <span className="w-4" />
        <span className="w-4" />
        <span className="flex-1">Nombre</span>
        <span className="w-20 text-right">Tamaño</span>
        <span className="w-12 text-right">%</span>
        <span className="w-20">Uso</span>
      </div>

      {/* Tree Content - ACTUALIZA EN TIEMPO REAL */}
      <div className="max-h-[400px] overflow-auto">
        {sortedItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500">
            {scanData.isScanning ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <span>Buscando archivos...</span>
              </div>
            ) : searchTerm ? (
              "No se encontraron resultados"
            ) : (
              "El directorio está vacío"
            )}
          </div>
        ) : (
          sortedItems.map((item) => (
            <TreeRow
              key={item.path}
              item={item}
              depth={0}
              isExpanded={expandedPaths.has(item.path)}
              isSelected={selectedPaths.has(item.path)}
              onToggleExpand={toggleExpand}
              onToggleSelect={toggleSelect}
              totalSize={scanData.totalSize}
            />
          ))
        )}
      </div>
    </div>
  );
}
