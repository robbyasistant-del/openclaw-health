"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Archive,
  Clock3,
  DatabaseBackup,
  HardDriveDownload,
  ShieldCheck,
  Loader2,
  Play,
  RotateCcw,
  Save,
  AlertTriangle,
} from "lucide-react";

interface Commit {
  hash: string;
  date: string;
  message: string;
}

export default function BackupsPage() {
  const [repoUrl, setRepoUrl] = useState("https://github.com/robbyasistant-del/openclaw-backups");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [recoveringHash, setRecoveringHash] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ success?: boolean; error?: string; agentReply?: string } | null>(null);
  const [recoverResult, setRecoverResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchCommits();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/backups/config");
      const data = await res.json();
      if (data.repoUrl) setRepoUrl(data.repoUrl);
    } catch (err) {
      console.error("[Backups] Error fetching config:", err);
    }
  };

  const saveConfig = async () => {
    try {
      setSavingUrl(true);
      await fetch("/api/backups/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
    } catch (err) {
      console.error("[Backups] Error saving config:", err);
    } finally {
      setSavingUrl(false);
    }
  };

  const fetchCommits = async () => {
    try {
      setLoadingCommits(true);
      const res = await fetch("/api/backups/commits");
      const data = await res.json();
      setCommits(data.commits || []);
    } catch (err) {
      console.error("[Backups] Error fetching commits:", err);
    } finally {
      setLoadingCommits(false);
    }
  };

  const runBackup = async () => {
    try {
      setRunningBackup(true);
      setRunResult(null);
      const res = await fetch("/api/backups/run", { method: "POST" });
      const data = await res.json();
      setRunResult(data);
      await fetchCommits();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRunResult({ success: false, error: message });
    } finally {
      setRunningBackup(false);
    }
  };

  const recover = async (commitHash: string) => {
    const confirmed = window.confirm(
      "⚠️ Recovering will overwrite the current state of the local backup repository with the contents of this commit.\n\nAre you sure you want to continue?"
    );
    if (!confirmed) return;

    try {
      setRecoveringHash(commitHash);
      setRecoverResult(null);
      const res = await fetch("/api/backups/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitHash }),
      });
      const data = await res.json();
      setRecoverResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRecoverResult({ success: false, error: message });
    } finally {
      setRecoveringHash(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-ES");
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Backups</h1>
        <p className="text-zinc-400 mt-1">
          Gestiona copias de seguridad y puntos de restauración de Openclaw Health.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Último backup</CardTitle>
            <Clock3 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {commits.length > 0 ? formatDate(commits[0].date) : "N/A"}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {commits.length > 0 ? commits[0].message : "Sin backups aún"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total backups</CardTitle>
            <Archive className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{commits.length}</div>
            <p className="text-xs text-zinc-500 mt-1">Commits en el repo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Restore points</CardTitle>
            <HardDriveDownload className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{commits.length}</div>
            <p className="text-xs text-zinc-500 mt-1">Disponibles para rollback</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Cobertura</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">Activo</div>
            <p className="text-xs text-zinc-500 mt-1">Agente + archivos de config</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <DatabaseBackup className="h-5 w-5 text-emerald-500" />
            Configuración del repositorio de backups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-400">Repo URL</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                placeholder="https://github.com/usuario/repo-backups"
              />
            </div>
            <button
              type="button"
              onClick={saveConfig}
              disabled={savingUrl}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {savingUrl ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runBackup}
              disabled={runningBackup}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {runningBackup ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {runningBackup ? "Ejecutando backup..." : "Run Backup"}
            </button>
          </div>

          {runResult && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                runResult.success
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/20 bg-red-500/10 text-red-200"
              }`}
            >
              <p className="font-medium">
                {runResult.success ? "Backup completado" : "Error en backup"}
              </p>
              {runResult.error && <p className="mt-1">{runResult.error}</p>}
              {runResult.agentReply && (
                <div className="mt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/80">Respuesta del agente</p>
                  <p className="mt-1 text-emerald-100">{runResult.agentReply}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Historial de backups (commits)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCommits ? (
            <div className="flex items-center gap-2 py-4 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando commits...
            </div>
          ) : commits.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">No hay commits registrados aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2 pr-4 font-medium">Fecha</th>
                    <th className="py-2 pr-4 font-medium">Mensaje</th>
                    <th className="py-2 pr-4 font-medium">Hash</th>
                    <th className="py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {commits.map((commit) => (
                    <tr key={commit.hash} className="text-zinc-300">
                      <td className="py-3 pr-4 whitespace-nowrap">{formatDate(commit.date)}</td>
                      <td className="py-3 pr-4">{commit.message}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-zinc-500">
                        {commit.hash.slice(0, 8)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => recover(commit.hash)}
                          disabled={recoveringHash === commit.hash}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-600/30 disabled:opacity-50"
                        >
                          {recoveringHash === commit.hash ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Recover from this point
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {recoverResult && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                recoverResult.success
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                  : "border-red-500/20 bg-red-500/10 text-red-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    {recoverResult.success ? "Recuperación iniciada" : "Error en recuperación"}
                  </p>
                  {recoverResult.error && <p className="mt-1">{recoverResult.error}</p>}
                  {recoverResult.success && recoverResult.message && (
                    <p className="mt-1 text-amber-100">{recoverResult.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
