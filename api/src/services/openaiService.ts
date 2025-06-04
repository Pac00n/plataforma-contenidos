import OpenAI from 'openai';
import { ScrapingResult } from './n8nService';

// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Interfaz para los resultados generados por OpenAI
 */
export interface GenerationResult {
  article_html: string;
  image_prompt: string;
  linkedin_post: string;
  twitter_thread: string[];
  instagram_reel_script: {
    hook: string;
    slides: {
      subtitle: string;
      visual: string;
      voiceover: string;
    }[];
  };
}

/**
 * Genera contenido reescrito y adaptado para diferentes plataformas
 * @param scrapedContent Contenido extraído del artículo original
 * @returns Objeto con el contenido generado para cada plataforma
 */
export async function generateContent(scrapedContent: ScrapingResult): Promise<GenerationResult> {
  try {
    console.log('Generando contenido con OpenAI...');
    
    // El sistema de function calling permite estructurar la respuesta
    const functionSchema = {
      name: "generate_rewritten_content",
      description: "Reescribe y adapta el contenido para diferentes plataformas",
      parameters: {
        type: "object",
        properties: {
          article_html: {
            type: "string",
            description: "Versión reescrita del artículo en formato HTML"
          },
          image_prompt: {
            type: "string",
            description: "Prompt descriptivo para generar una imagen relacionada con el contenido"
          },
          linkedin_post: {
            type: "string",
            description: "Post para LinkedIn con un enfoque profesional"
          },
          twitter_thread: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Hilo de Twitter (3-5 tweets)"
          },
          instagram_reel_script: {
            type: "object",
            properties: {
              hook: {
                type: "string",
                description: "Gancho inicial para captar la atención (5-10 seg)"
              },
              slides: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    subtitle: {
                      type: "string",
                      description: "Subtítulo de la slide"
                    },
                    visual: {
                      type: "string",
                      description: "Descripción de lo que debería mostrarse visualmente"
                    },
                    voiceover: {
                      type: "string",
                      description: "Texto para la voz en off"
                    }
                  },
                  required: ["subtitle", "visual", "voiceover"]
                },
                description: "Contenido para cada slide del reel (4-6 slides)"
              }
            },
            required: ["hook", "slides"],
            description: "Script para Instagram Reel"
          }
        },
        required: ["article_html", "image_prompt", "linkedin_post", "twitter_thread", "instagram_reel_script"]
      }
    };

    console.log('Llamando a OpenAI API para generar contenido...');
    
    // Verificar si estamos en modo desarrollo sin API key
    if (process.env.NODE_ENV === 'development' && !process.env.OPENAI_API_KEY) {
      console.warn('Usando mock para OpenAI ya que no hay API key configurada');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockResult: GenerationResult = {
        article_html: `<article>
          <h1>${scrapedContent.title} - Versión Reescrita</h1>
          <p>Este es el artículo reescrito basado en el contenido original.</p>
          <p>El contenido ha sido mejorado y optimizado para SEO, manteniendo la esencia del original.</p>
          <h2>Sección principal</h2>
          <p>Aquí desarrollamos las ideas clave del artículo con un enfoque fresco y original.</p>
        </article>`,
        image_prompt: `Imagen profesional mostrando ${scrapedContent.metadata.category || 'concepto'} relacionado con ${scrapedContent.title}, estilo fotográfico moderno`,
        linkedin_post: `¡Gran artículo sobre ${scrapedContent.title}! \n\nReciente investigación demuestra la importancia de este tema.`,
        twitter_thread: [
          `🧵 HILO: ${scrapedContent.title} - Lo más importante en 3 tweets`,
          `1/ Punto clave uno sobre este tema.`,
          `2/ Segunda observación importante.`,
          `3/ Conclusión y llamada a la acción.`
        ],
        instagram_reel_script: {
          hook: `¿Sabías que el 80% de las personas no conoce estos datos?`,
          slides: [
            {
              subtitle: "El problema",
              visual: "Persona confundida",
              voiceover: "La mayoría enfrenta este desafío sin las herramientas adecuadas"
            },
            {
              subtitle: "La solución",
              visual: "Idea innovadora",
              voiceover: "Existe una forma mucho más sencilla de resolver esto"
            }
          ]
        }
      };
      
      return mockResult;
    };
    
    // Implementación real con OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system", 
          content: `Eres un experto en reescritura y adaptación de contenido. 
                    Tu tarea es reescribir el artículo proporcionado y adaptarlo a diferentes formatos para redes sociales.
                    Debes mantener la esencia del contenido pero hacerlo completamente original.
                    Usa un tono profesional para LinkedIn, conversacional para Twitter e impactante para Instagram.`
        },
        {
          role: "user", 
          content: `Reescribe y adapta el siguiente contenido para diferentes plataformas:
                    Título: ${scrapedContent.title}
                    Contenido: ${scrapedContent.fullText}
                    Categoría: ${scrapedContent.metadata.category || 'General'}
                    Tags: ${scrapedContent.metadata.tags?.join(', ') || 'N/A'}`
        }
      ],
      functions: [functionSchema],
      function_call: { name: "generate_rewritten_content" },
      max_tokens: 4000,
    });
    
    if (!completion.choices[0]?.message?.function_call?.arguments) {
      throw new Error('No se recibió una respuesta estructurada de OpenAI');
    }
    
    return JSON.parse(completion.choices[0].message.function_call.arguments);
  } catch (error: unknown) {
    console.error('Error al generar contenido con OpenAI:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`Error en la generación de contenido: ${errorMessage}`);
  }
}
