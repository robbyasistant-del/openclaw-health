import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Activity, Heart, Shield, Users } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Bienvenido a Openclaw Health</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Health Score
            </CardTitle>
            <Heart className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">85%</div>
            <p className="text-xs text-zinc-500 mt-1">+2% desde ayer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Checkups
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">12</div>
            <p className="text-xs text-zinc-500 mt-1">Este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Workspaces
            </CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">3</div>
            <p className="text-xs text-zinc-500 mt-1">Activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Security
            </CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">OK</div>
            <p className="text-xs text-zinc-500 mt-1">Sin alertas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Estado del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
              <span className="text-zinc-300">Base de datos SQLite</span>
              <span className="text-emerald-400 text-sm ml-auto">Conectada</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
              <span className="text-zinc-300">API Backend</span>
              <span className="text-emerald-400 text-sm ml-auto">Operativa</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
              <span className="text-zinc-300">Frontend Next.js</span>
              <span className="text-emerald-400 text-sm ml-auto">OK</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
