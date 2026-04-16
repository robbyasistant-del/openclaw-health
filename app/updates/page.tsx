"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Download, Github, CheckCircle, AlertCircle, Package } from "lucide-react";

interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  lastTouchedAt: string;
  updateAvailable: boolean;
  githubUrl: string;
  error?: string;
}

export default function UpdatesPage() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const fetchVersionInfo = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/updates");
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Error fetching version info");
      }
      
      setVersionInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersionInfo();
  }, []);

  const formatDate = (dateString: string) => {
    if (dateString === "unknown") return "Unknown";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-8 w-8 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Updates</h1>
          <p className="text-zinc-400">Check OpenClaw version and available updates</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400 font-medium">Error</p>
          </div>
          <p className="text-red-300 text-sm mt-1">{error}</p>
          <button
            onClick={fetchVersionInfo}
            className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && versionInfo && (
        <div className="space-y-6">
          {/* Current Version Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Current Version
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="text-zinc-400">Version</span>
                <span className="text-white font-mono text-lg">{versionInfo.currentVersion}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                <span className="text-zinc-400">Last Updated</span>
                <span className="text-zinc-300">{formatDate(versionInfo.lastTouchedAt)}</span>
              </div>
            </div>
          </div>

          {/* Latest Version Card */}
          <div className={`rounded-lg p-6 border ${
            versionInfo.updateAvailable 
              ? "bg-amber-900/20 border-amber-500/30" 
              : "bg-zinc-900 border-zinc-800"
          }`}>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Github className="h-5 w-5 text-emerald-500" />
              Latest Version
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                <span className="text-zinc-400">Latest Available</span>
                <span className="text-white font-mono text-lg">
                  {versionInfo.latestVersion || "Unable to fetch"}
                </span>
              </div>
              
              {versionInfo.updateAvailable && (
                <div className="flex items-center gap-2 py-2 text-amber-400">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Update available!</span>
                </div>
              )}
              
              {!versionInfo.updateAvailable && versionInfo.latestVersion && (
                <div className="flex items-center gap-2 py-2 text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                  <span>Up to date</span>
                </div>
              )}
            </div>
            
            <a
              href={versionInfo.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Download className="h-4 w-4" />
              View on GitHub
            </a>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchVersionInfo}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}