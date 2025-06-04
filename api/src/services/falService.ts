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
    
    try {
      // Configurar el cliente si no se ha hecho antes
      setupFalClient();
      
      // Implementación real con fal.ai - modelo actualizado con parámetros óptimos
      console.log('Llamando a fal.ai API con prompt:', prompt);
      
      // Verificación adicional de la API key
      if (!process.env.FAL_KEY || process.env.FAL_KEY.trim() === '') {
        throw new Error('FAL_KEY no está configurada o está vacía');
      }
      
      // Mejorar el prompt para obtener mejores resultados
      const enhancedPrompt = `${prompt}, high quality, detailed, professional photography, editorial style, 4k, HD`;
      
      // Usar modelo más estable con mejor configuración
      const result = await fal.run('fal-ai/stable-diffusion-xl-instantaneous', {
        input: {
          prompt: enhancedPrompt,
          negative_prompt: "blurry, bad quality, distorted, deformed, ugly, poor composition",
          height: 768,
          width: 768,
          disable_safety_checker: false,
          guidance_scale: 7.5,
          seed: Math.floor(Math.random() * 1000000)
        }
      });
      
      console.log('Respuesta de fal.ai recibida:', JSON.stringify(result));
      
      // Tipar correctamente la respuesta del modelo
      type FalResult = {
        images: string[],
        // Otros campos posibles
        seed?: number,
        nsfw_content_detected?: boolean
      };
      
      const typedResult = result as unknown as FalResult;
      
      if (!typedResult.images || typedResult.images.length === 0) {
        throw new Error('No se generó ninguna imagen en la respuesta de fal.ai');
      }
      
      console.log('Imagen generada correctamente con fal.ai');
      return {
        imageUrl: typedResult.images[0], // La URL ahora es directamente el string en el array
        prompt: prompt,
        width: 768,  // Actualizado al tamaño usado en la API
        height: 768  // Actualizado al tamaño usado en la API
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
