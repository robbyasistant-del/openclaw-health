"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Download, Github, CheckCircle, AlertCircle, Package, Sparkles, Play, AlertTriangle } from "lucide-react";

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
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisContent, setAnalysisContent] = useState<string>("");
  const [recommendedVersion, setRecommendedVersion] = useState<string>("");
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeResult, setExecuteResult] = useState<string>("");

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

  const analyzeUpdates = async () => {
    if (!versionInfo) return;
    
    setAnalysisLoading(true);
    setAnalysisContent("");
    setRecommendedVersion("");
    setError("");
    
    try {
      const promptText = `Analyze OpenClaw versions between installed version ${versionInfo.currentVersion} and latest version ${versionInfo.latestVersion} from https://github.com/openclaw/openclaw/releases`;
      
      console.log("Starting analysis...");
      
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptName: "UPDATE OPENCLAW",
          promptText: promptText,
          timeout: 300,
        }),
      });
      
      console.log("Response received:", response.status);
      
      const data = await response.json();
      console.log("Data received:", data);
      
      if (!response.ok) {
        throw new Error(data.error || "Error analyzing updates");
      }
      
      const content = data.response || "No analysis available";
      console.log("Content length:", content.length);
      
      setAnalysisContent(content);
      
      // Extract recommended version from analysis
      const versionMatch = content.match(/Recommended update to:\s*(v?\d{4}\.\d{1,2}\.\d{1,2})/i);
      if (versionMatch) {
        setRecommendedVersion(versionMatch[1]);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      console.log("Setting analysis loading to false");
      setAnalysisLoading(false);
    }
  };
    } finally {
      setAnalysisLoading(false);
    }
  };

  const executeUpdate = async () => {
    if (!recommendedVersion || !versionInfo) return;
    
    const confirmed = window.confirm(
      `⚠️ CRITICAL WARNING: You are about to execute OpenClaw update to version ${recommendedVersion}.\n\n` +
      `This will:\n` +
      `• STOP the OpenClaw Gateway (you will be temporarily disconnected)\n` +
      `• Update the OpenClaw package via npm\n` +
      `• RESTART the gateway service (requires manual reconnection)\n\n` +
      `Current version: ${versionInfo.currentVersion}\n` +
      `Target version: ${recommendedVersion}\n\n` +
      `⚠️ After the gateway restarts, you may need to reconnect manually.\n\n` +
      `Are you sure you want to proceed?`
    );
    
    if (!confirmed) return;
    
    setExecuteLoading(true);
    setExecuteResult("");
    setError("");
    
    try {
      // Note: 120s timeout - gateway restart will disconnect the agent
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptName: "EXECUTE UPDATE OPENCLAW",
          promptText: `Execute the OpenClaw update to version ${recommendedVersion}`,
          timeout: 120,
        }),
      });
      
      // If we get here, the gateway might have already restarted
      // The response might fail due to disconnection
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Connection lost - gateway may be restarting" }));
        throw new Error(errorData.error || "Update in progress or connection lost");
      }
      
      const data = await response.json();
      setExecuteResult(data.response || "Update executed. Gateway may be restarting - check status in a few seconds.");
      
    } catch (err) {
      // Connection error is expected if gateway restarted
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("fetch") || errorMsg.includes("connection") || errorMsg.includes("timeout")) {
        setExecuteResult("⚠️ Update command sent. The gateway may be restarting.\n\nPlease wait 10-15 seconds and check:\n1. Gateway status on port 18789\n2. OpenClaw version with 'openclaw --version'\n3. Reconnect to this interface if needed");
      } else {
        setError(errorMsg);
      }
    } finally {
      setExecuteLoading(false);
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

  // Parse markdown-style content to HTML
  const parseContent = (content: string) => {
    if (!content) return "";
    
    return content
      // Convert headers
      .replace(/### (.*)/g, '<h3 class="text-lg font-semibold text-emerald-400 mt-6 mb-3">$1</h3>')
      .replace(/## (.*)/g, '<h2 class="text-xl font-bold text-white mt-8 mb-4">$1</h2>')
      // Convert bold
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-400">$1</strong>')
      // Convert italic
      .replace(/\*(.*?)\*/g, '<em class="text-zinc-300">$1</em>')
      // Convert bullet points
      .replace(/^- (.*)/gm, '<li class="ml-4 text-zinc-300 mb-1">$1</li>')
      // Convert numbered lists
      .replace(/^(\d+)\. (.*)/gm, '<li class="ml-4 text-zinc-300 mb-1"><span class="text-emerald-500">$1.</span> $2</li>')
      // Convert newlines to breaks (except within lists)
      .replace(/\n/g, '<br/>');
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

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={fetchVersionInfo}
              disabled={loading}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            
            {versionInfo.updateAvailable && (
              <button
                onClick={analyzeUpdates}
                disabled={analysisLoading}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Sparkles className={`h-4 w-4 ${analysisLoading ? "animate-spin" : ""}`} />
                {analysisLoading ? "Analyzing..." : "Analyze Updates"}
              </button>
            )}
          </div>

          {/* Execute Update Section - Only show after analysis */}
          {analysisContent && !analysisLoading && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Execute Update
              </h3>
              
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex-1 w-full">
                  <label className="block text-sm text-zinc-400 mb-1">Target Version</label>
                  <input
                    type="text"
                    value={recommendedVersion}
                    onChange={(e) => setRecommendedVersion(e.target.value)}
                    placeholder="Version to update to (e.g., v2026.4.14)"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                
                <button
                  onClick={executeUpdate}
                  disabled={executeLoading || !recommendedVersion}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:bg-zinc-700 text-white px-6 py-3 rounded-lg transition-colors font-medium mt-5 sm:mt-0"
                >
                  <Play className={`h-4 w-4 ${executeLoading ? "animate-spin" : ""}`} />
                  {executeLoading ? "Executing..." : "Execute Update"}
                </button>
              </div>
              
              <p className="text-zinc-500 text-sm mt-3">
                ⚠️ This will update OpenClaw, all skills/plugins, and restart the gateway service.
              </p>
            </div>
          )}

          {/* Analysis Results */}
          {analysisLoading && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-emerald-500 animate-spin" />
                <span className="text-white font-medium">Analyzing version differences...</span>
              </div>
              <p className="text-zinc-400 text-sm">This may take a few minutes as we research release notes, GitHub issues, Reddit discussions, and community feedback.</p>
              <p className="text-zinc-500 text-xs mt-2">Timeout: 5 minutes</p>
            </div>
          )}

          {analysisContent && !analysisLoading && (
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-emerald-500" />
                  Version Analysis Report
                </h2>
                {recommendedVersion && (
                  <span className="text-sm text-emerald-400 bg-emerald-900/30 px-3 py-1 rounded-full">
                    Recommended: {recommendedVersion}
                  </span>
                )}
              </div>
              
              <div 
                className="prose prose-invert max-w-none text-zinc-300"
                dangerouslySetInnerHTML={{ __html: parseContent(analysisContent) }}
              />
            </div>
          )}

          {!analysisLoading && !analysisContent && error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400">Analysis failed: {error}</p>
            </div>
          )}

          {/* Execute Result */}
          {executeResult && (
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                Update Execution Result
              </h2>
              <pre className="bg-zinc-950 rounded-lg p-4 text-zinc-300 font-mono text-sm whitespace-pre-wrap">
                {executeResult}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
