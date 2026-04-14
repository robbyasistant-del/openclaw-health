"use client";

import { useState, useMemo } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Scan,
  Check,
  Copy,
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

export interface ScanData {
  path: string;
  name: string;
  totalSize: number;
  totalSizeFormatted: string;
  itemCount: number;
  items: ScanItem[];
  scanTimeMs?: number;
}

interface DiskUsageAnalyzerProps {
  data: ScanData;
  onSelect?: (selectedPaths: string[]) => void;
}

type SortKey = "size" | "name";

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
}

function TreeRow({
  item,
  depth,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
}: TreeRowProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isDir = item.type === "directory";

  return (
    <div className="group">
      <div
        className={`flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/50 transition-colors cursor-pointer ${
          isSelected ? "bg-zinc-800/80" : ""
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => onToggleSelect(item.path)}
      >
        {/* Expand/Collapse button for directories */}
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
        <span className="text-xs text-zinc-400 w-24 text-right shrink-0">
          {item.sizeFormatted}
        </span>

        {/* Percent */}
        <span className="text-xs text-zinc-500 w-12 text-right shrink-0">
          {item.percent}%
        </span>

        {/* Progress bar */}
        <div className="w-24 shrink-0">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBarColor(item.percent)} transition-all duration-300`}
              style={{ width: `${Math.max(item.percent, 1)}%` }}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DiskUsageAnalyzer({ data, onSelect }: DiskUsageAnalyzerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [searchTerm, setSearchTerm] = useState("");

  const sortedItems = useMemo(() => {
    let items = [...data.items];
    
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
  }, [data.items, sortKey, searchTerm]);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      
      if (onSelect) {
        onSelect(Array.from(next));
      }
      
      return next;
    });
  };

  const selectAll = () => {
    const allPaths = new Set<string>();
    const collectPaths = (items: ScanItem[]) => {
      for (const item of items) {
        allPaths.add(item.path);
        if (item.children) {
          collectPaths(item.children);
        }
      }
    };
    collectPaths(data.items);
    setSelectedPaths(allPaths);
    if (onSelect) {
      onSelect(Array.from(allPaths));
    }
  };

  const deselectAll = () => {
    setSelectedPaths(new Set());
    if (onSelect) {
      onSelect([]);
    }
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    const collectPaths = (items: ScanItem[]) => {
      for (const item of items) {
        if (item.type === "directory" && item.children?.length) {
          allPaths.add(item.path);
          collectPaths(item.children);
        }
      }
    };
    collectPaths(data.items);
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set());
  };

  const copyPath = () => {
    navigator.clipboard.writeText(data.path);
  };

  return (
    <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Scan className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Análisis de Uso de Disco
            </h3>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <HardDrive className="h-4 w-4" />
              <span className="font-mono">{data.name}</span>
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Tamaño Total</p>
            <p className="text-lg font-semibold text-white">{data.totalSizeFormatted}</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Items</p>
            <p className="text-lg font-semibold text-white">{data.itemCount.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500 uppercase">Tiempo de Escaneo</p>
            <p className="text-lg font-semibold text-white">
              {data.scanTimeMs ? `${data.scanTimeMs}ms` : "-"}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar archivos o carpetas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="size">Ordenar por tamaño</option>
            <option value="name">Ordenar por nombre</option>
          </select>

          {/* Expand/Collapse */}
          <button
            onClick={expandAll}
            className="px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            Expandir todo
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            Colapsar todo
          </button>

          {/* Select */}
          <button
            onClick={selectAll}
            className="px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            Seleccionar todo
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            Deseleccionar
          </button>
        </div>

        {/* Selected count */}
        {selectedPaths.size > 0 && (
          <div className="mt-2 text-sm text-emerald-400">
            {selectedPaths.size} item(s) seleccionado(s)
          </div>
        )}
      </div>

      {/* Table Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/30 border-b border-zinc-800 text-xs font-medium text-zinc-500 uppercase">
        <span className="w-5" /> {/* Expand placeholder */}
        <span className="w-4" /> {/* Checkbox placeholder */}
        <span className="w-4" /> {/* Icon placeholder */}
        <span className="flex-1">Nombre</span>
        <span className="w-24 text-right">Tamaño</span>
        <span className="w-12 text-right">%</span>
        <span className="w-24">Uso</span>
      </div>

      {/* Tree Content */}
      <div className="max-h-[500px] overflow-auto">
        {sortedItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500">
            {searchTerm ? "No se encontraron resultados" : "El directorio está vacío"}
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
            />
          ))
        )}
      </div>
    </div>
  );
}
