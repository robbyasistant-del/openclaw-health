"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Bot, Check, AlertCircle, Loader2 } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "error";
  lastActive?: string;
  capabilities?: string[];
}

export default function WorkspacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/agents");
      const data = await response.json();
      
      if (data.agents) {
        setAgents(data.agents);
      }
    } catch (err) {
      setError("Error cargando agentes");
      console.error("[Workspace] Error fetching agents:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    console.log("[Workspace] Agent selected:", agent.id);
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-white">
                          {agent.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <div
                            className={`h-2 w-2 rounded-full ${getStatusColor(
                              agent.status
                            )}`}
                          />
                          <span className="text-xs text-zinc-500 capitalize">
                            {agent.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedAgent?.id === agent.id && (
                      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-400 line-clamp-2">
                    {agent.description || "Sin descripción"}
                  </p>
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {agent.capabilities.slice(0, 3).map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400"
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
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {selectedAgent.name}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {selectedAgent.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-lg bg-zinc-900/50">
                  <p className="text-sm text-zinc-500">
                    Aquí aparecerá la funcionalidad del workspace específica del agente seleccionado.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
