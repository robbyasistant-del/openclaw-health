# OpenClaw Gateway Integration Reference

## Método de Referencia: Ejecución de Prompts

Este documento describe el patrón estándar para llamar al Gateway de OpenClaw desde cualquier parte del portal OpenClaw Health.

---

## Endpoint Base

```
POST http://localhost:4005/api/prompts
```

## Parámetros de Entrada

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `promptName` | string | Sí | Nombre del prompt definido en `prompts.md` |
| `promptText` | string | No | Texto personalizado (si se omite, se usa el del promptName) |
| `timeout` | number | No | Timeout en segundos (default: 300) |

## Parámetros de Salida

```json
{
  "success": true,
  "promptName": "nombre_del_prompt",
  "response": "respuesta_del_gateway",
  "duration": "45.23s"
}
```

---

## Configuración Requerida

### 1. Variables de Entorno (.env.local)

```env
OPENCLAW_GATEWAY_TOKEN=<token_del_gateway>
OPENCLAW_GATEWAY_URL=http://localhost:18789
```

### 2. Implementación Backend (app/api/prompts/route.ts)

El endpoint ya está implementado y utiliza:
- **Endpoint del Gateway**: `POST http://localhost:18789/v1/chat/completions`
- **Formato**: OpenAI-compatible (messages array)
- **Autenticación**: Bearer token desde `process.env.OPENCLAW_GATEWAY_TOKEN`

### 3. Patrón de Llamada desde Frontend

```typescript
const executePrompt = async (promptName: string, timeout: number = 300) => {
  const response = await fetch("/api/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promptName, timeout }),
  });
  
  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
  
  return await response.json();
};
```

---

## Prompts Disponibles (prompts.md)

1. **CLEAN WORKSPACE ROOT** - Limpieza de raíz del workspace
2. **FOLDER_PURPOSE** - Análisis de propósito de carpetas
3. **EXPLORER_FOLDER_PURPOSE_V1** - Explorador de carpetas
4. **BACKUP_V1** - Gestión de backups

---

## Ejemplos de Uso

### Ejemplo 1: Llamada desde un Componente React

```typescript
const handleAnalyzeFolder = async () => {
  setLoading(true);
  try {
    const result = await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptName: "FOLDER_PURPOSE",
        timeout: 300
      }),
    });
    
    const data = await result.json();
    setResponse(data.response);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    setLoading(false);
  }
};
```

### Ejemplo 2: Llamada desde otro Endpoint API

```typescript
// En app/api/otro-endpoint/route.ts
export async function POST(request: Request) {
  // ... lógica previa ...
  
  const promptResponse = await fetch("http://localhost:4005/api/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      promptName: "CLEAN WORKSPACE ROOT",
      timeout: 300
    }),
  });
  
  const result = await promptResponse.json();
  
  // ... usar result.response ...
}
```

---

## Notas Importantes

1. **Timeout**: El Gateway puede tardar tiempo en responder. Usar mínimo 300s (5 minutos) por defecto.

2. **Error Handling**: Siempre manejar errores de timeout y mostrar feedback al usuario.

3. **No Hardcodear Token**: El token debe venir de `process.env.OPENCLAW_GATEWAY_TOKEN`, nunca hardcodeado.

4. **Formato de Prompts**: Los prompts deben estar definidos en `prompts.md` en la raíz del proyecto.

5. **Puerto del Gateway**: El Gateway de OpenClaw corre en `localhost:18789` (no confundir con el puerto 4005 de la app).

---

## Troubleshooting

### Error 401 Unauthorized
- Verificar que `OPENCLAW_GATEWAY_TOKEN` esté correctamente configurado en `.env.local`
- Verificar que el token coincida con el de la configuración del Gateway

### Error 500 Gateway Error
- Verificar que el Gateway de OpenClaw esté corriendo: `openclaw gateway status`
- Verificar conectividad: `curl http://localhost:18789/v1/chat/completions`

### Timeout
- Aumentar el timeout en la llamada (máximo 600s recomendado)
- Verificar que el prompt no sea excesivamente largo

---

## Archivos Relacionados

- `app/api/prompts/route.ts` - Endpoint API
- `app/prompts/page.tsx` - Página de prueba/UI
- `prompts.md` - Definición de prompts
- `.env.local` - Variables de entorno
- `components/layout/Sidebar.tsx` - Menú de navegación

---

**Última actualización**: 2026-04-16
**Versión**: 1.0
**Autor**: OpenClaw Agent
