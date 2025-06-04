import dotenv from 'dotenv';
// Cargar variables de entorno al inicio
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';

// Importación de servicios
import { scrapeUrl } from './services/n8nService';
import { generateContent } from './services/openaiService';
import { setupFalClient, generateImage } from './services/falService';

// Verificar variables de entorno críticas
if (!process.env.OPENAI_API_KEY) {
  console.error('¡ERROR! No se encontró la variable de entorno OPENAI_API_KEY');
  console.error('Por favor, verifica que el archivo .env existe y contiene la clave');
}

// Configuración de API keys para OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configurar cliente de fal.ai
setupFalClient();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de seguridad
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Configuración de CORS más permisiva para desarrollo
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}));

// Preflight para CORS
app.options('*', cors());

app.use(express.json());

// Rate limiter para evitar abusos
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
});
app.use(limiter);

// Endpoint para reescribir contenido
app.post('/api/rewrite', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }

    console.log(`Procesando URL: ${url}`);

    // Paso 1: Obtener contenido de la URL usando n8n MCP Server
    try {
      const scrapedContent = await scrapeUrl(url);
      console.log('Contenido extraído correctamente');

      // Paso 2: Generar contenido reescrito usando OpenAI
      const generatedContent = await generateContent(scrapedContent);
      console.log('Contenido generado correctamente');
      
      // Paso 3: Generar imagen usando fal.ai
      try {
        const imageResult = await generateImage(generatedContent.image_prompt);
        console.log('Imagen generada correctamente:', imageResult.imageUrl);
        
        // Añadir URL de la imagen al resultado
        generatedContent.article_html = generatedContent.article_html.replace('</h1>', `</h1><img src="${imageResult.imageUrl}" alt="Imagen generada" class="w-full h-auto rounded-lg my-4" />`);
      } catch (imageError: any) {
        console.warn('Error al generar imagen, continuando sin ella:', imageError.message);
      }
      
      // Paso 4: Devolver el resultado
      return res.json(generatedContent);
      
    } catch (error: any) {
      console.error('Error en el procesamiento de contenido:', error);
      return res.status(500).json({ 
        error: error.message || 'Error al procesar el contenido',
        url
      });
    }
  } catch (error: any) {
    console.error('Error procesando la solicitud:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// Endpoint para verificar estado del servidor
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      n8n: process.env.N8N_MCP_PROD_URL ? 'configured' : 'missing',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      fal: process.env.FAL_KEY ? 'configured' : 'missing'
    }
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});
