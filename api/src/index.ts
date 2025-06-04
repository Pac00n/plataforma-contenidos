import dotenv from 'dotenv';
// Cargar variables de entorno al inicio
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

// Endpoint para reescribir contenido
app.post('/api/rewrite', async (req, res) => {
  const startTime = Date.now();
  try {
    // Extraer URL o datos de la solicitud
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }

    console.log(`
✈️ Procesando URL: ${url}`);
    
    let scrapedContent;
    let processingErrors = [];
    
    // Paso 1: Obtener contenido de la URL (scraping)
    try {
      console.log('1⃣ Extrayendo contenido...');
      scrapedContent = await scrapeUrl(url);
      console.log('✅ Contenido extraído correctamente');
    } catch (scrapingError: any) {
      console.error('❌ Error al extraer contenido:', scrapingError.message);
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
    try {
      console.log('2⃣ Generando contenido con OpenAI...');
      generatedContent = await generateContent(scrapedContent);
      console.log('✅ Contenido generado correctamente');
    } catch (aiError: any) {
      console.error('❌ Error al generar contenido con OpenAI:', aiError.message);
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
      console.log('3⃣ Generando imagen con fal.ai:', generatedContent.image_prompt);
      const imageResult = await generateImage(generatedContent.image_prompt);
      console.log('✅ Imagen generada correctamente:', imageResult.imageUrl);
      
      // Añadir URL de la imagen al resultado
      generatedContent.article_html = generatedContent.article_html.replace('</h1>', `</h1><img src="${imageResult.imageUrl}" alt="Imagen generada" class="w-full h-auto rounded-lg my-4" />`);
      generatedContent.image_url = imageResult.imageUrl;
    } catch (imageError: any) {
      console.warn('⚠️ Error al generar imagen, continuando sin ella:', imageError.message);
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
        console.log(`💾 Resultado guardado en: ${filename}`);
      } catch (fsError) {
        console.warn(`⚠️ No se pudo guardar el resultado local:`, fsError);
      }
    }
    
    // Calcular tiempo de procesamiento
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`
⌛ Tiempo de procesamiento: ${processingTime.toFixed(2)} segundos`);
    
    // Añadir metadatos al resultado
    const result = {
      ...generatedContent,
      meta: {
        processingTime,
        url,
        mode: MODE,
        errors: processingErrors.length > 0 ? processingErrors : undefined
      }
    };
    
    // Devolver resultado final
    return res.json(result);
  } catch (error: any) {
    // Error general no controlado
    const processingTime = (Date.now() - startTime) / 1000;
    console.error('❌ Error general no controlado:', error.message);
    return res.status(500).json({ 
      error: error.message || 'Error interno del servidor',
      processingTime,
      timestamp: new Date().toISOString(),
      mode: MODE
    });
  }
});

// Endpoint para verificar estado del servidor y configuración
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
