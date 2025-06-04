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
    
    // Implementación real con fal.ai
    const result = await fal.run('fal-ai/fast-sdxl', {
      input: {
        prompt: prompt,
        negative_prompt: 'low quality, bad anatomy, worst quality, low resolution',
        num_inference_steps: 30,
        // Los parámetros de tamaño se manejan en la API
      },
    });
    
    // Tipar correctamente la respuesta del modelo
    type FastSDXLResult = {
      images: Array<{url: string}>,
      seed: number
    };
    
    const typedResult = result as unknown as FastSDXLResult;
    
    if (!typedResult.images?.[0]?.url) {
      throw new Error('No se generó ninguna imagen');
    }
    
    return {
      imageUrl: typedResult.images[0].url,
      prompt: prompt,
      width: 800,  // Tamaño predeterminado
      height: 600  // Tamaño predeterminado
    };
  } catch (error: unknown) {
    console.error('Error al generar imagen con fal.ai:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`Error en la generación de imagen: ${errorMessage}`);
  }
}
