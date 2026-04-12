export default function WorkspacePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Workspace</h1>
        <p className="text-zinc-400 mt-1">Gestión de espacios de trabajo</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <p className="text-zinc-500">Módulo en desarrollo</p>
        <p className="text-zinc-600 text-sm mt-2">Aquí se gestionarán los workspaces y proyectos</p>
      </div>
    </div>
  );
}
