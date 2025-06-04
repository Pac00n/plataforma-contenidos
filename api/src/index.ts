import dotenv from 'dotenv';
// Cargar variables de entorno al inicio
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Importación de servicios
import { scrapeUrl } from './services/n8nService';
import { generateContent } from './services/openaiService';
import { setupFalClient, generateImage } from './services/falService';

// Modo de ejecución (local o remoto)
const MODE = process.env.APP_MODE || 'local';
const USE_MOCKS = MODE === 'local' || process.env.USE_MOCKS === 'true';
const DEBUG = process.env.DEBUG === 'true';

console.log(`
=========================================
🚀 Iniciando en modo: ${MODE.toUpperCase()}
🔄 Mocks: ${USE_MOCKS ? 'ACTIVADOS' : 'DESACTIVADOS'}
🐛 Debug: ${DEBUG ? 'ACTIVADO' : 'DESACTIVADO'}
=========================================
`);

// Verificar y configurar APIs externas
let servicesStatus = {
  openai: false,
  fal: false,
  n8n: false
};

// Configuración de API keys para OpenAI
try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    servicesStatus.openai = true;
    console.log('✅ OpenAI configurado correctamente');
  } else if (MODE !== 'local') {
    console.warn('⚠️  No hay una clave válida de OpenAI configurada');
  }
} catch (error) {
  console.error('❌ Error al configurar OpenAI:', error);
}

// Configurar cliente de fal.ai
try {
  setupFalClient();
  servicesStatus.fal = !!process.env.FAL_KEY;
  console.log(servicesStatus.fal ? '✅ fal.ai configurado correctamente' : '⚠️  No hay clave de fal.ai configurada');
} catch (error) {
  console.error('❌ Error al configurar fal.ai:', error);
}

// Verificar configuración n8n
servicesStatus.n8n = !!process.env.N8N_MCP_PROD_URL && !process.env.N8N_MCP_PROD_URL.includes('example');
console.log(servicesStatus.n8n ? '✅ n8n configurado correctamente' : '⚠️  No hay URL válida para n8n configurada');

// Crear instancia de Express
const app = express();
const PORT = process.env.PORT || 3001;

// Almacén para eventos de progreso
interface ProgressEvent {
  id: string;
  messages: string[];
  lastUpdated: number;
}

// Almacena las sesiones de progreso para cada ID
const progressEvents = new Map<string, ProgressEvent>();

// Almacena los resultados finales para cada ID de progreso
const results: Record<string, any> = {};

// Función para limpiar eventos antiguos cada cierto tiempo
setInterval(() => {
  const now = Date.now();
  for (const [id, event] of progressEvents.entries()) {
    // Eliminar eventos más antiguos de 5 minutos
    if (now - event.lastUpdated > 5 * 60 * 1000) {
      progressEvents.delete(id);
    }
  }
}, 60 * 1000); // Ejecutar cada minuto

// Directorio para almacenar datos temporales en modo local
const dataDir = path.join(__dirname, '..', 'data');
if (MODE === 'local' && !fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`✅ Directorio de datos creado: ${dataDir}`);
  } catch (error) {
    console.warn(`⚠️ No se pudo crear el directorio de datos: ${error}`);
  }
}

// Middleware de registro para depuración
app.use((req, res, next) => {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
  }
  next();
});

// Middleware para capturar errores no controlados
const errorHandler = (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: MODE === 'local' ? err.message : 'Error interno del servidor' });
};

// Configuración de seguridad
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Configuración de CORS más permisiva para desarrollo
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3333'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}));

// Preflight para CORS
app.options('*', cors());

app.use(express.json({ limit: '10mb' })); // Aumentar límite para peticiones grandes
app.use(express.urlencoded({ extended: true }));

// Rate limiter flexible según entorno
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || (MODE === 'local' ? '1000' : '100'), 10), // Más permisivo en local
  standardHeaders: true,
  skip: (req, res) => MODE === 'local' && req.ip === '::1', // Sin límite para localhost en modo local
});
app.use(limiter);

// Endpoint para conectarse a los eventos de progreso SSE
app.get('/api/progress/:id', (req, res) => {
  const progressId = req.params.id;
  const event = progressEvents.get(progressId);
  
  if (!event) {
    return res.status(404).json({ error: 'Sesión de progreso no encontrada' });
  }
  
  // Configurar la conexión SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Enviar todos los mensajes existentes al conectarse
  res.write(`data: ${JSON.stringify({ messages: event.messages })}\n\n`);
  
  // Mantener conexión abierta
  const interval = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);
  
  // Manejar desconexión
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Función para añadir mensaje de progreso y notificar a clientes conectados
function addProgressMessage(id: string, message: string): string[] {
  let event = progressEvents.get(id);
  
  if (!event) {
    event = {
      id,
      messages: [],
      lastUpdated: Date.now()
    };
    progressEvents.set(id, event);
  }
  
  // Añadir el mensaje al evento
  event.messages.push(message);
  event.lastUpdated = Date.now();
  
  console.log(message); // Mantener también los mensajes en la consola
  
  return event.messages;
}

// Endpoint para reescribir contenido
app.post('/api/rewrite', async (req, res) => {
  const startTime = Date.now();
  const progressId = uuidv4();
  
  try {
    // Extraer URL o datos de la solicitud
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }
    
    // Inicializar la sesión de progreso y devolver el ID inmediatamente
    res.json({ progressId });

    addProgressMessage(progressId, `✈️ Procesando URL: ${url}`);
    
    let scrapedContent;
    let processingErrors = [];
    
    // Paso 1: Obtener contenido de la URL (scraping)
    try {
      addProgressMessage(progressId, '1⃣ Extrayendo contenido...');
      scrapedContent = await scrapeUrl(url, (message) => addProgressMessage(progressId, message));
      addProgressMessage(progressId, '✅ Contenido extraído correctamente');
    } catch (scrapingError: any) {
      addProgressMessage(progressId, `❌ Error al extraer contenido de la URL: ${scrapingError.message}`);
      processingErrors.push({ step: 'scraping', message: scrapingError.message });
      
      if (MODE !== 'local') {
        return res.status(500).json({ 
          error: 'Error al extraer contenido de la URL',
          details: scrapingError.message,
          url
        });
      }
      
      // En modo local, continuamos con datos simulados
      console.log('⚠️ Usando datos simulados para continuar en modo local');
      scrapedContent = {
        title: `Artículo de ejemplo desde ${url}`,
        content: `<h1>Artículo de prueba</h1><p>Este es un contenido simulado para pruebas en modo local.</p>`,
        fullText: `Artículo de prueba\n\nEste es un contenido simulado para pruebas en modo local.`,
        imageUrls: [`https://picsum.photos/800/600?random=${Math.floor(Math.random() * 100)}`],
        metadata: { author: 'Usuario Local', publishedDate: new Date().toISOString() }
      };
    }

    // Paso 2: Generar contenido con OpenAI
    let generatedContent;
    let contentPrompts = {
      system: `Eres un experto en reescritura y adaptación de contenido. 
Tu tarea es reescribir el artículo proporcionado de forma extensa y detallada, y también adaptarlo a diferentes formatos para redes sociales.
Debes mantener la esencia del contenido pero hacerlo completamente original.
Para el artículo principal, crea un contenido extenso y bien desarrollado, con más detalles y ejemplos.`,
      user: `Reescribe y adapta el siguiente contenido para crear un artículo extenso y detallado:
Título: ${scrapedContent.title}
Contenido: ${scrapedContent.fullText}
Categoría: ${scrapedContent.metadata.category || 'General'}
Tags: ${scrapedContent.metadata.tags?.join(', ') || 'N/A'}

El artículo debe ser más extenso y desarrollado que el contenido original, con más detalles y explicaciones.`,
      twitter: `Crea un hilo de Twitter sobre este contenido con un tono conversacional y dinámico. Divide el contenido en 4-6 tweets concisos pero informativos que capturen la atención.`,
      linkedin: `Crea una publicación de LinkedIn profesional y formal sobre este contenido. Incluye una introducción atractiva, 2-3 puntos clave y una llamada a la acción profesional al final.`,
      instagram: `Diseña un guión para un reel de Instagram impactante y visual basado en este contenido. Incluye un hook atractivo, 3-5 slides con textos cortos y sugerencias de imágenes o visuales para cada slide.`
    };
    
    try {
      addProgressMessage(progressId, '2⃣ Generando contenido con OpenAI...');
      addProgressMessage(progressId, 'Generando contenido con OpenAI...');
      addProgressMessage(progressId, 'Llamando a OpenAI API para generar contenido...');
      generatedContent = await generateContent(scrapedContent, contentPrompts);
      addProgressMessage(progressId, '✅ Contenido generado correctamente');
    } catch (aiError: any) {
      addProgressMessage(progressId, `❌ Error al generar contenido con OpenAI: ${aiError.message}`);
      processingErrors.push({ step: 'openai', message: aiError.message });
      
      if (MODE !== 'local') {
        return res.status(500).json({ 
          error: 'Error al generar contenido con OpenAI',
          details: aiError.message,
          original: scrapedContent
        });
      }
      
      // En modo local, usamos contenido simulado
      console.log('⚠️ Usando contenido simulado para continuar en modo local');
      generatedContent = {
        article_html: `<h1>Versión reescrita de ${scrapedContent.title}</h1><p>Este es un contenido reescrito generado localmente para pruebas.</p>`,
        article_text: `Versión reescrita de ${scrapedContent.title}\n\nEste es un contenido reescrito generado localmente para pruebas.`,
        linkedin_post: `¡Nueva publicación! He analizado un artículo interesante sobre ${scrapedContent.title}. #contenido #ejemplo`,
        twitter_post: `Acabo de leer algo interesante sobre ${scrapedContent.title.substring(0, 50)}... 👀 #contenido`,
        instagram_caption: `📖 Reflexiones sobre ${scrapedContent.title}\n\n#contenido #ejemplo #local`,
        image_prompt: `Imagen conceptual relacionada con ${scrapedContent.title}, estilo profesional y colorido`
      };
    }
      
    // Paso 3: Generar imagen con fal.ai
    try {
      addProgressMessage(progressId, `3⃣ Generando imagen con fal.ai: ${generatedContent.image_prompt}`);
      addProgressMessage(progressId, `Generando imagen con fal.ai: "${generatedContent.image_prompt}"`);
      const imageResult = await generateImage(generatedContent.image_prompt, (message) => addProgressMessage(progressId, message));
      addProgressMessage(progressId, `✅ Imagen generada correctamente: ${imageResult.imageUrl}`);
      
      // Añadir URL de la imagen al resultado
      generatedContent.article_html = generatedContent.article_html.replace('</h1>', `</h1><img src="${imageResult.imageUrl}" alt="Imagen generada" class="w-full h-auto rounded-lg my-4" />`);
      generatedContent.image_url = imageResult.imageUrl;
    } catch (imageError: any) {
      addProgressMessage(progressId, `❌ Error al generar imagen con fal.ai: ${imageError.message}`);
      processingErrors.push({ step: 'image', message: imageError.message });
      
      // Usar imagen de prueba en caso de error
      const fallbackImageUrl = `https://picsum.photos/seed/${encodeURIComponent(generatedContent.image_prompt)}/800/600`;
      generatedContent.article_html = generatedContent.article_html.replace('</h1>', `</h1><img src="${fallbackImageUrl}" alt="Imagen de prueba" class="w-full h-auto rounded-lg my-4" />`);
      generatedContent.image_url = fallbackImageUrl;
    }
    
    // Guardar resultado en archivo para modo local (histórico)
    if (MODE === 'local' && fs.existsSync(dataDir)) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(dataDir, `result-${timestamp}.json`);
        fs.writeFileSync(filename, JSON.stringify({
          url,
          scrapedContent,
          generatedContent,
          processingErrors,
          timestamp
        }, null, 2));
        addProgressMessage(progressId, `💾 Resultado guardado en: ${filename}`);
      } catch (fsError) {
        console.warn(`⚠️ No se pudo guardar el resultado local:`, fsError);
      }
    }
    
    // Calcular tiempo de procesamiento
    const processingTime = (Date.now() - startTime) / 1000;
    addProgressMessage(progressId, `
⌛ Tiempo de procesamiento: ${processingTime.toFixed(2)} segundos`);
    
    // Añadir metadatos al resultado
    const result = {
      ...generatedContent,
      meta: {
        prompts: {
          twitter: contentPrompts.twitter,
          linkedin: contentPrompts.linkedin,
          instagram: contentPrompts.instagram
        },
        processingTime,
        url,
        mode: MODE,
        errors: processingErrors.length > 0 ? processingErrors : undefined
      }
    };
    
    // Devolver resultado final al servicio de procesamiento
    // El cliente tendrá que hacer una solicitud adicional para obtener el resultado
    return Promise.resolve();
  } catch (error: any) {
    // Error general no controlado
    const processingTime = (Date.now() - startTime) / 1000;
    addProgressMessage(progressId, `❌ Error general no controlado: ${error.message}`);
    return Promise.resolve();
  }
});

// Endpoint para regenerar contenido con prompts personalizados
app.post('/api/regenerate', async (req, res) => {
  const { progressId: oldProgressId, prompts } = req.body;
  const startTime = Date.now();
  
  if (!oldProgressId || !prompts) {
    return res.status(400).json({ error: 'Se requiere progressId y prompts' });
  }
  
  try {
    // Crear nuevo ID para este proceso de regeneración
    const progressId = uuidv4();
    
    // Inicializar la sesión de progreso y devolver el ID inmediatamente
    res.json({ progressId });
    
    addProgressMessage(progressId, `🔄 Regenerando contenido con prompts personalizados...`);
    
    // Recuperar el resultado anterior para obtener el contenido scrapeado
    const previousEvent = progressEvents.get(oldProgressId);
    
    if (!previousEvent) {
      addProgressMessage(progressId, `❌ No se encontró la sesión original (${oldProgressId})`);
      return;
    }
    
    // Buscar el resultado anterior en los archivos guardados (para modo local)
    let scrapedContent = null;
    let originalUrl = '';
    
    if (fs.existsSync(dataDir)) {
      try {
        const files = fs.readdirSync(dataDir);
        
        for (const file of files) {
          try {
            const fileContent = fs.readFileSync(path.join(dataDir, file), 'utf8');
            const data = JSON.parse(fileContent);
            
            // Verificamos si este archivo contiene datos de la sesión que buscamos
            if (data.progressId === oldProgressId || 
                (data.meta && data.meta.progressId === oldProgressId)) {
              scrapedContent = data.scrapedContent;
              originalUrl = data.url;
              addProgressMessage(progressId, `✅ Encontrados datos originales de scraping`);
              break;
            }
          } catch (e) {
            // Ignorar errores de lectura de archivos individuales
            continue;
          }
        }
      } catch (fsError: any) {
        addProgressMessage(progressId, `⚠️ Error al buscar datos originales: ${fsError.message}`);
      }
    }
    
    if (!scrapedContent) {
      // Si no encontramos los datos en archivos, usar datos simulados
      addProgressMessage(progressId, `⚠️ No se encontraron datos originales, usando datos simulados`);
      scrapedContent = {
        title: `Contenido regenerado`,
        content: `<p>Este es un contenido regenerado simulado.</p>`,
        fullText: `Contenido regenerado simulado.`,
        imageUrls: [],
        metadata: { 
          author: 'Usuario',
          publishedDate: new Date().toISOString()
        }
      };
    }
    
    // Paso 2: Generar contenido con OpenAI usando los prompts personalizados
    let generatedContent;
    
    try {
      addProgressMessage(progressId, '2⃣ Generando contenido con OpenAI y prompts personalizados...');
      
      if (!prompts.system || !prompts.user) {
        addProgressMessage(progressId, '⚠️ Prompts incompletos, usando prompts predeterminados con ajustes');
        // Usar prompts predeterminados con alguna modificación
        prompts.system = prompts.system || `Eres un experto en reescritura y adaptación de contenido personalizado.`;
        prompts.user = prompts.user || `Reescribe de manera única el siguiente contenido: ${scrapedContent.fullText}`;
      }
      
      addProgressMessage(progressId, 'Llamando a OpenAI API para generar contenido...');
      generatedContent = await generateContent(scrapedContent, {
        system: prompts.system,
        user: prompts.user
      });
      
      addProgressMessage(progressId, '✅ Contenido regenerado correctamente');
    } catch (aiError: any) {
      addProgressMessage(progressId, `❌ Error al regenerar contenido con OpenAI: ${aiError.message}`);
      generatedContent = {
        title: scrapedContent.title,
        article: 'Error al regenerar contenido. Por favor intenta de nuevo.',
        article_html: '<p>Error al regenerar contenido. Por favor intenta de nuevo.</p>'
      };
    }
    
    // Paso 3: Generar imagen con fal.ai si hay prompt de imagen
    let imageUrl = null;
    
    if (prompts.image && prompts.image.trim() !== '') {
      try {
        addProgressMessage(progressId, '3⃣ Generando imagen con fal.ai...');
        const imageResult = await generateImage(prompts.image, (message) => {
          addProgressMessage(progressId, message);
        });
        imageUrl = imageResult.imageUrl;
        addProgressMessage(progressId, '✅ Imagen generada correctamente');
      } catch (imageError: any) {
        addProgressMessage(progressId, `❌ Error al generar imagen: ${imageError.message}`);
      }
    }
    
    // Guardar resultado en la memoria
    const result = {
      ...generatedContent,
      image_url: imageUrl,
      image_prompt: prompts.image || '',
      meta: {
        prompts: {
          system: prompts.system,
          user: prompts.user
        },
        processingTime: (Date.now() - startTime) / 1000,
        timestamp: new Date().toISOString(),
        progressId
      }
    };
    
    // Guardar resultado en archivo para modo local
    if (MODE === 'local' && fs.existsSync(dataDir)) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(dataDir, `result-regenerated-${timestamp}.json`);
        fs.writeFileSync(filename, JSON.stringify({
          url: originalUrl || 'regenerated-content',
          scrapedContent,
          generatedContent: result,
          progressId,
          timestamp
        }, null, 2));
        addProgressMessage(progressId, `💾 Resultado guardado en: ${filename}`);
      } catch (fsError) {
        console.warn(`⚠️ No se pudo guardar el resultado local:`, fsError);
      }
    }
    
    // Marcar proceso como finalizado
    addProgressMessage(progressId, '🏁 Proceso de regeneración completado');
    
    // Actualizar resultados en memoria
    results[progressId] = result;
  } catch (error: any) {
    console.error('Error en regeneración:', error);
    // En caso de error, comunicamos al ID original
    addProgressMessage(oldProgressId, `❌ Error general en regeneración: ${error.message}`);
  }
});

// Endpoint para verificar estado del servidor y configuración
// Endpoint para obtener el resultado final
app.get('/api/result/:id', async (req, res) => {
  const progressId = req.params.id;
  const event = progressEvents.get(progressId);
  
  if (!event) {
    return res.status(404).json({ error: 'Sesión de procesamiento no encontrada' });
  }
  
  // Obtener el último resultado guardado
  try {
    const files = fs.readdirSync(dataDir);
    // Ordenar por fecha de creación (más reciente primero)
    files.sort((a, b) => {
      const statA = fs.statSync(path.join(dataDir, a));
      const statB = fs.statSync(path.join(dataDir, b));
      return statB.mtimeMs - statA.mtimeMs;
    });
    
    // Tomar el archivo más reciente
    if (files.length > 0) {
      const latestFile = files[0];
      const content = fs.readFileSync(path.join(dataDir, latestFile), 'utf8');
      const result = JSON.parse(content);
      
      return res.json({
        ...result.generatedContent,
        meta: {
          processingTime: (event.lastUpdated - (event.messages.length > 0 ? Date.now() - 30000 : Date.now())) / 1000,
          progressMessages: event.messages,
          url: result.url,
          mode: MODE
        }
      });
    } else {
      return res.status(404).json({ error: 'No se encontraron resultados' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error al recuperar el resultado' });
  }
});

app.get('/api/health', (req, res) => {
  // Obtener uptime del servidor
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);
  const uptimeSeconds = Math.floor(uptime % 60);
  const uptimeFormatted = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;
  
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    mode: MODE,
    useMocks: USE_MOCKS,
    debug: DEBUG,
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    memoryUsage: process.memoryUsage().rss / (1024 * 1024), // MB
    services: servicesStatus,
    env: {
      n8n: process.env.N8N_MCP_PROD_URL ? process.env.N8N_MCP_PROD_URL !== '' && !process.env.N8N_MCP_PROD_URL.includes('example') ? 'configured' : 'invalid' : 'missing',
      openai: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.startsWith('sk-') ? 'configured' : 'invalid' : 'missing',
      fal: process.env.FAL_KEY ? process.env.FAL_KEY !== '' ? 'configured' : 'invalid' : 'missing'
    }
  });
});

// Punto de acceso para test rápido
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    mode: MODE
  });
});

// Cualquier otra ruta no definida
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint no encontrado', 
    path: req.url, 
    method: req.method,
    availableEndpoints: ["/api/health", "/api/rewrite", "/api/test"]
  });
});

// Registrar el manejador de errores
app.use(errorHandler);

// Iniciar el servidor
try {
  const server = app.listen(PORT, () => {
    console.log(`
🚀 API Server corriendo en: http://localhost:${PORT}
💚 Comprueba el estado en: http://localhost:${PORT}/api/health
📝 Envía peticiones POST a: http://localhost:${PORT}/api/rewrite
`);
  });
  
  // Manejo de cierre graceful
  process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor API...');
    server.close(() => {
      console.log('🔔 Servidor cerrado correctamente');
      process.exit(0);
    });
  });
  
  // Capturar excepciones no controladas
  process.on('uncaughtException', (error) => {
    console.error('❌ Error no controlado:', error);
    // Mantener el servidor en ejecución en local
    if (MODE !== 'local') {
      server.close(() => process.exit(1));
    }
  });
} catch (error) {
  console.error('❌ Error al iniciar el servidor:', error);
  process.exit(1);
}
