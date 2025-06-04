import { fal } from '@fal-ai/client';

/**
 * Interfaz para los resultados de la generación de imágenes
 */
export interface ImageGenerationResult {
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
}

/**
 * Configura el cliente de fal.ai con las credenciales
 */
export function setupFalClient() {
  // Configura las credenciales de fal.ai
  if (!process.env.FAL_KEY) {
    console.warn('FAL_KEY no está configurada. La generación de imágenes no funcionará.');
    return;
  }
  
  fal.config({
    credentials: process.env.FAL_KEY,
  });
}

/**
 * Ejecuta un endpoint de fal.ai utilizando el helper `fal.run`
 * @param endpoint El endpoint de fal.ai a ejecutar
 * @param input Los parámetros de entrada para el endpoint
 * @returns La respuesta del endpoint
 */
export async function runFal(endpoint: string, input: Record<string, any>) {
  console.log(`Ejecutando fal.ai endpoint ${endpoint} con input:`, input);
  try {
    // Intentar primero con fal.run que es más directo
    const result = await fal.run(endpoint, { input });
    console.log(`Respuesta de fal.run para ${endpoint}:`, result);
    return result;
  } catch (error) {
    console.warn(`Error con fal.run, intentando con fal.subscribe: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    // Si fal.run falla, intentar con fal.subscribe como fallback
    const result = await fal.subscribe(endpoint, { input, logs: true });
    console.log(`Respuesta de fal.subscribe para ${endpoint}:`, result);
    return result.data; // fal.subscribe devuelve { data, requestId }, necesitamos solo data
  }
}

/**
 * Genera una imagen utilizando fal.ai basada en un prompt
 * @param prompt El prompt descriptivo para generar la imagen
 * @param onProgress Callback opcional para reportar progreso
 * @returns Resultado de la generación con la URL de la imagen
 */
export async function generateImage(prompt: string, onProgress?: (message: string) => void): Promise<ImageGenerationResult> {
  try {
    // Verificar si tenemos la clave API configurada
    if (!process.env.FAL_KEY || process.env.FAL_KEY.trim() === '') {
      console.warn('FAL_KEY no está configurada o está vacía, usando imagen aleatoria de muestra');
      if (onProgress) onProgress('FAL_KEY no está configurada, usando imagen de prueba');
      
      // Fallback a imagen aleatoria si no hay API key
      const seed = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const mockResult: ImageGenerationResult = {
        imageUrl: `https://picsum.photos/seed/${seed}/800/600`,
        prompt: prompt,
        width: 800,
        height: 600
      };
      
      return mockResult;
    }
    
    console.log(`Generando imagen con fal.ai: "${prompt}"`);
    if (onProgress) onProgress(`Iniciando generación de imagen con prompt: "${prompt.substring(0, 30)}..."`);

    // Configurar el cliente fal.ai
    setupFalClient();
    if (onProgress) onProgress('Cliente fal.ai configurado correctamente');
    
    if (onProgress) onProgress('Enviando solicitud a fal.ai para generar imagen...');

    try {
      // Intentar con el modelo FLUX [dev] original que puede tener mejor compatibilidad
      // https://fal.ai/models/fal-ai/flux/dev
      // Usar directamente fal.subscribe para tener más control sobre la respuesta
      const subscribeResponse = await fal.subscribe('fal-ai/flux/dev', {
        input: {
          prompt: prompt,
          // Parámetros básicos que deberían funcionar con este modelo
          image_size: "landscape_16_9", // Usando un valor válido del enum ImageSize
          num_inference_steps: 30,
          guidance_scale: 7.5
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs && update.logs.length > 0) {
            update.logs.map((log) => log.message).forEach(msg => {
              console.log(`[fal.ai progress] ${msg}`);
              if (onProgress) onProgress(`Progreso: ${msg}`);
            });
          }
        },
      });
      
      // Extraer el resultado de la respuesta de subscribe
      const result = subscribeResponse.data;

      if (onProgress) onProgress('Respuesta recibida de fal.ai');
      
      // Depurar la respuesta completa para ver su estructura
      console.log('Respuesta completa de fal.ai:', JSON.stringify(result, null, 2));
      
      // Extraer la imagen de la respuesta
      const resultData = result as any;
      
      // Verificar la estructura de la respuesta y extraer la URL de la imagen
      let imageUrl = null;
      
      // Intentar diferentes estructuras de respuesta posibles
      if (resultData && resultData.images && Array.isArray(resultData.images) && resultData.images.length > 0) {
        // Estructura esperada para flux-1/dev
        imageUrl = resultData.images[0].url;
        console.log('URL de imagen encontrada en images[0].url:', imageUrl);
      } else if (resultData && resultData.image) {
        // Estructura alternativa
        imageUrl = resultData.image;
        console.log('URL de imagen encontrada en image:', imageUrl);
      } else if (resultData && typeof resultData === 'string' && resultData.startsWith('http')) {
        // Si la respuesta es directamente una URL
        imageUrl = resultData;
        console.log('La respuesta es directamente una URL:', imageUrl);
      } else {
        // Depurar la estructura completa para entender qué estamos recibiendo
        console.log('Estructura de respuesta desconocida:', typeof resultData, Object.keys(resultData || {}));
        throw new Error('No se pudo determinar la URL de la imagen en la respuesta');
      }
      
      if (!imageUrl) {
        throw new Error('No se encontró URL de imagen en la respuesta');
      }

      // Dimensiones fijas para FLUX.1 [dev]
      const width = 1024;
      const height = 768;

      if (onProgress) onProgress('Imagen generada correctamente con fal.ai');
      console.log('Imagen generada correctamente:', imageUrl);
      
      return {
        imageUrl,
        prompt,
        width,
        height
      };
    } catch (falError) {
      console.error('Error al llamar a fal.ai API:', falError);
      if (onProgress) onProgress(`Error al generar imagen con fal.ai: ${falError instanceof Error ? falError.message : 'Error desconocido'}`);
      
      // Generar una semilla consistente basada en el prompt
      const seed = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Fallback a imagen de prueba de Lorem Picsum
      if (onProgress) onProgress('Usando imagen de prueba como alternativa');
      return {
        imageUrl: `https://picsum.photos/seed/${seed}/800/600`,
        prompt: prompt,
        width: 800,
        height: 600
      };
    }
  } catch (error: unknown) {
    console.error('Error al generar imagen con fal.ai:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`Error en la generación de imagen: ${errorMessage}`);
  }
}
