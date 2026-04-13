import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Archive, Clock3, DatabaseBackup, HardDriveDownload, ShieldCheck } from "lucide-react";

const backupSources = [
  {
    name: "Gateway config",
    description: "Snapshots de configuración y secretos no exportables del gateway.",
    cadence: "Diario · 02:00",
    retention: "14 días",
    status: "Activo",
  },
  {
    name: "Workspace health DB",
    description: "Base de datos SQLite y estado operativo del portal Openclaw Health.",
    cadence: "Cada 6 horas",
    retention: "7 días",
    status: "Pendiente",
  },
  {
    name: "Session exports",
    description: "Exportaciones de sesiones críticas para auditoría y recuperación.",
    cadence: "Semanal · Domingo",
    retention: "30 días",
    status: "Diseño",
  },
];

export default function BackupsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Backups</h1>
        <p className="text-zinc-400 mt-1">
          Visión general de copias, retención y puntos de restauración de Openclaw Health.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Último backup</CardTitle>
            <Clock3 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">Hoy · 02:14</div>
            <p className="text-xs text-zinc-500 mt-1">Gateway config snapshot</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Retención media</CardTitle>
            <Archive className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">17 días</div>
            <p className="text-xs text-zinc-500 mt-1">Entre snapshots y exports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Restore points</CardTitle>
            <HardDriveDownload className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">8</div>
            <p className="text-xs text-zinc-500 mt-1">Disponibles para rollback</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Cobertura</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">Parcial</div>
            <p className="text-xs text-zinc-500 mt-1">Falta automatizar workspace DB</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <DatabaseBackup className="h-5 w-5 text-emerald-500" />
            Plan de backups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {backupSources.map((backup) => (
              <div
                key={backup.name}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">{backup.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{backup.description}</p>
                  </div>
                  <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    {backup.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-zinc-400 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <p className="text-zinc-500">Cadencia</p>
                    <p className="mt-1 text-white">{backup.cadence}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Retención</p>
                    <p className="mt-1 text-white">{backup.retention}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Acción recomendada</p>
                    <p className="mt-1 text-white">Validar restauración trimestral</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
