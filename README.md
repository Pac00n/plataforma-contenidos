# Plataforma Y

Sistema de reescritura y generación de contenidos utilizando OpenAI Responses API, n8n (MCP) y fal.ai para generación de imágenes.

## Arquitectura

| Capa                          | Tecnologías                                                       | Responsabilidad                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**                  | Next.js / React 18, TypeScript, Tailwind CSS, SWR para streaming  | UI (campo URL, progreso en tiempo real, pestañas "Artículo", "LinkedIn", "X/Twitter", "Reel IG"), manejo de sesión y subida de claves API                         |
| **Backend**                   | Node 18 + Express                                                 | 1) Orquestar llamadas a **OpenAI Responses API** y a **fal.ai** · 2) Enviar contexto a un **servidor MCP** via la URL del **nodo *MCP Server Trigger*** de n8n    |
| **Automatización & scraping** | n8n (self-host u On-Prem) con nodos HTTP Request ➜ Readability    | Extraer y limpiar el artículo fuente                                                                                                                              |

## Estructura del Proyecto

```
plataforma-y/
├── web/                   # Frontend (Next.js)
│   ├── src/               # Código fuente
│   │   ├── app/           # App Router de Next.js
│   │   ├── components/    # Componentes React
│   │   └── styles/        # Estilos CSS
├── api/                   # Backend (Node + Express)
│   ├── src/               # Código fuente
│   │   └── index.ts       # Punto de entrada de la API
├── packages/              # Paquetes compartidos (futuros)
└── turbo.json             # Configuración de Turborepo
```

## Configuración del Entorno

1. **Clonar el repositorio:**
   ```
   git clone <repo-url>
   cd plataforma-y
   ```

2. **Instalar dependencias:**
   ```
   npm install
   ```

3. **Configurar variables de entorno:**
   - Copiar el archivo `.env.example` a `.env` en la carpeta `api/`
   - Añadir las claves de API necesarias:
     - `OPENAI_API_KEY`: Clave de API de OpenAI
     - `FAL_KEY`: Clave de API de fal.ai
     - `N8N_MCP_PROD_URL`: URL del servidor MCP de n8n

4. **Iniciar el desarrollo:**
   ```
   npm run dev
   ```

## Funcionalidades

- **Reescritura de contenido:** Ingrese una URL y obtenga versiones reescritas para diferentes formatos.
- **Generación de imágenes:** Automáticamente genera imágenes relevantes con fal.ai.
- **Múltiples formatos:** Artículo HTML, publicación de LinkedIn, hilos de Twitter y guiones para Reels de Instagram.

## Roadmap

- [x] Sprint 0: Esqueleto inicial del proyecto
- [x] Sprint 1: Conexión OpenAI Responses (implementación inicial)
  - [x] Estructura de servicios modulares
  - [x] Integración básica con OpenAI
  - [ ] Implementación de streaming
- [x] Sprint 2: Workflow n8n con MCP Trigger (mock iniciales)
  - [x] Servicio n8nService para comunicación
  - [x] Pruebas con datos simulados
  - [ ] Workflow real en n8n
- [x] Sprint 3: Integración fal.ai para imágenes (servicios funcionales)
  - [x] Cliente configurado
  - [x] Llamada de generación de imágenes
  - [ ] Implementación de prompt engineering para imágenes
- [ ] Sprint 4: Renderizado final (HTML + redes)
- [ ] Sprint 5: Seguridad y métricas
- [ ] Sprint 6: Tests y documentación
