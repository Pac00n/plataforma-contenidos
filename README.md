# Plataforma Y

Sistema de reescritura y generación de contenidos utilizando OpenAI Responses API, n8n (MCP) y fal.ai para generación de imágenes.

## Arquitectura

| Capa                          | Tecnologías                                                      | Responsabilidad                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**                  | Next.js / React 18, TypeScript, Tailwind CSS, SWR para streaming | UI (campo URL, progreso en tiempo real, pestañas "Artículo", "LinkedIn", "X/Twitter", "Reel IG"), manejo de sesión y subida de claves API                      |
| **Backend**                   | Node 18 + Express                                                | 1) Orquestar llamadas a **OpenAI Responses API** y a **fal.ai** · 2) Enviar contexto a un **servidor MCP** via la URL del **nodo _MCP Server Trigger_** de n8n |
| **Automatización & scraping** | n8n (self-host u On-Prem) con nodos HTTP Request ➜ Readability   | Extraer y limpiar el artículo fuente                                                                                                                           |

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
   git clone https://github.com/Pac00n/plataforma-contenidos.git
   cd plataforma-contenidos
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

   Esto iniciará:

   - Frontend en http://localhost:3000
   - API en http://localhost:3001

5. **Verificar la instalación:**
   - Frontend: `curl -I http://localhost:3000` debe devolver código 200
   - API: `curl -I http://localhost:3001/api/health` debe devolver código 200

## Funcionalidades

- **Reescritura de contenido:** Ingrese una URL y obtenga versiones reescritas para diferentes formatos.
- **Generación de imágenes:** Automáticamente genera imágenes relevantes con fal.ai.
- **Múltiples formatos:** Artículo HTML, publicación de LinkedIn, hilos de Twitter y guiones para Reels de Instagram.

## Cambios Recientes

### Actualización 04/06/2025

- Se ajustó el archivo `turbo.json` para usar la clave correcta `pipeline` en lugar de `tasks`, lo que permite que Turborepo reconozca correctamente la sección de tareas.
- El script de desarrollo de Next.js se cambió a `next dev -p 3000` para no colisionar con la API que ocupa el puerto 3001.
- Se implementó la integración real con OpenAI, fal.ai y n8n MCP Server, reemplazando los datos de prueba.
- Se mejoró el manejo de errores y la estructura del código en todos los servicios.

### Actualización 05/06/2025

- Migración al modelo `fal-ai/flux/dev` utilizando `fal.subscribe` para obtener las imágenes vía streaming.
- Se añadió la función `runFal` en `falService` para centralizar las llamadas a fal.ai.
- La interfaz ahora muestra un paso intermedio para revisar y editar los prompts de cada plataforma antes de generar el contenido.

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
