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
  article_text?: string;
  image_prompt: string;
  image_url?: string; // URL de la imagen generada
  linkedin_post: string;
  twitter_post?: string;
  twitter_thread?: string[];
  instagram_caption?: string;
  instagram_reel_script?: {
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
 * @param customPrompts Prompts personalizados para la generación (opcional)
 * @returns Objeto con el contenido generado para cada plataforma
 */
export async function generateContent(
  scrapedContent: ScrapingResult, 
  customPrompts?: { 
    system?: string; 
    user?: string; 
    twitter?: string; 
    linkedin?: string; 
    instagram?: string; 
  }
): Promise<GenerationResult> {
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
    const systemPrompt = customPrompts?.system || `Eres un experto en reescritura y adaptación de contenido. 
                Tu tarea es reescribir el artículo proporcionado de forma extensa y detallada, y también adaptarlo a diferentes formatos para redes sociales.
                Debes mantener la esencia del contenido pero hacerlo completamente original.
                Para el artículo principal, crea un contenido extenso y bien desarrollado, con más detalles y ejemplos.`;
                
    const userPrompt = customPrompts?.user || `Reescribe y adapta el siguiente contenido para crear un artículo extenso y detallado:
                Título: ${scrapedContent.title}
                Contenido: ${scrapedContent.fullText}
                Categoría: ${scrapedContent.metadata.category || 'General'}
                Tags: ${scrapedContent.metadata.tags?.join(', ') || 'N/A'}
                
                El artículo debe ser más extenso y desarrollado que el contenido original, con más detalles y explicaciones.`;
    
    // Prompts específicos para cada red social
    const twitterPrompt = customPrompts?.twitter || `Crea un hilo de Twitter sobre este contenido con un tono conversacional y dinámico. Divide el contenido en 4-6 tweets concisos pero informativos que capturen la atención.`;
    
    const linkedinPrompt = customPrompts?.linkedin || `Crea una publicación de LinkedIn profesional y formal sobre este contenido. Incluye una introducción atractiva, 2-3 puntos clave y una llamada a la acción profesional al final.`;
    
    const instagramPrompt = customPrompts?.instagram || `Diseña un guión para un reel de Instagram impactante y visual basado en este contenido. Incluye un hook atractivo, 3-5 slides con textos cortos y sugerencias de imágenes o visuales para cada slide.`;
    
    // Construir los mensajes con todos los prompts
    const messages = [
      {
        role: "system" as const,
        content: systemPrompt
      },
      {
        role: "user" as const, 
        content: userPrompt
      },
      {
        role: "user" as const,
        content: `Para Twitter: ${twitterPrompt}`
      },
      {
        role: "user" as const,
        content: `Para LinkedIn: ${linkedinPrompt}`
      },
      {
        role: "user" as const,
        content: `Para Instagram: ${instagramPrompt}`
      }
    ];
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
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
