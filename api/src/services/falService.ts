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
 * Ejecuta un endpoint de fal.ai utilizando el helper `fal.subscribe`
 */
export async function runFal(endpoint: string, input: Record<string, any>) {
  return fal.subscribe(endpoint, { input, logs: true });
}

/**
 * Genera una imagen utilizando fal.ai basada en un prompt
 * @param prompt El prompt descriptivo para generar la imagen
 * @returns Resultado de la generación con la URL de la imagen
 */
export async function generateImage(prompt: string): Promise<ImageGenerationResult> {
  try {
    if (!process.env.FAL_KEY) {
      console.warn('FAL_KEY no está configurada, usando imagen aleatoria de muestra');
      
      // Fallback a imagen aleatoria si no hay API key
      const mockResult: ImageGenerationResult = {
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(prompt.substring(0, 10))}/800/600`,
        prompt: prompt,
        width: 800,
        height: 600
      };
      
      return mockResult;
    }
    
    console.log(`Generando imagen con fal.ai: "${prompt}"`);

    try {
      // Configurar el cliente si no se ha hecho antes
      setupFalClient();

      // Verificación adicional de la API key
      if (!process.env.FAL_KEY || process.env.FAL_KEY.trim() === '') {
        throw new Error('FAL_KEY no está configurada o está vacía');
      }

      const imageSize = '1024x768';

      // Llamar al modelo FLUX.1 dev con streaming
      const { data } = await runFal('fal-ai/flux/dev', {
        prompt,
        image_size: imageSize
      });

      console.log('Respuesta de fal.ai recibida:', JSON.stringify(data));

      const images = (data as any).images as any[];
      if (!images || images.length === 0) {
        throw new Error('No se generó ninguna imagen en la respuesta de fal.ai');
      }

      const url = images[0].url || images[0];
      const [width, height] = imageSize.split('x').map(n => parseInt(n, 10));

      console.log('Imagen generada correctamente con fal.ai');
      return {
        imageUrl: url,
        prompt,
        width,
        height
      };
    } catch (falError) {
      console.warn('Error al llamar a fal.ai API, usando imagen de prueba:', falError);
      
      // Generar una semilla consistente basada en el prompt para obtener siempre la misma imagen
      const seed = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Fallback a imagen de prueba
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
