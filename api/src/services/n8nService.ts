import fetch from 'node-fetch';

/**
 * Servicio para comunicación con el MCP Server Trigger de n8n
 * Permite enviar URLs para scraping y limpieza de contenido
 */
export interface ScrapingResult {
  title: string;
  content: string;
  fullText: string;
  imageUrls: string[];
  metadata: {
    author?: string;
    publishedDate?: string;
    category?: string;
    tags?: string[];
    wordCount?: number;
  };
}

/**
 * Envía una URL al MCP Server de n8n para extraer su contenido
 * @param url URL del artículo a procesar
 * @returns Resultado del scraping con contenido estructurado
 */
export async function scrapeUrl(url: string): Promise<ScrapingResult> {
  const n8nMcpUrl = process.env.N8N_MCP_PROD_URL;
  
  if (!n8nMcpUrl) {
    throw new Error('URL del MCP Server no configurada en variables de entorno');
  }
  
  try {
    console.log(`Enviando solicitud a n8n MCP Server: ${url}`);
    
    // Si estamos en modo desarrollo y no hay URL real configurada, usar mock
    if (process.env.NODE_ENV === 'development' && (!n8nMcpUrl || n8nMcpUrl.includes('example'))) {
      console.warn('Usando datos de prueba para n8n ya que no hay una URL MCP configurada');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulamos latencia reducida
      
      return {
        title: `Título extraído de ${url}`,
        content: `<h1>Contenido principal</h1><p>Este es el contenido extraído de ${url} mediante el workflow de n8n.</p><p>Aquí habría más párrafos con el contenido limpio y estructurado del artículo.</p>`,
        fullText: `Título extraído de ${url}\n\nEste es el contenido extraído de ${url} mediante el workflow de n8n.\n\nAquí habría más párrafos con el contenido limpio y estructurado del artículo.`,
        imageUrls: [
          'https://picsum.photos/800/600',
          'https://picsum.photos/800/601'
        ],
        metadata: {
          author: 'Autor Ejemplo',
          publishedDate: new Date().toISOString(),
          category: 'Tecnología',
          tags: ['IA', 'Contenido', 'n8n'],
          wordCount: 150
        }
      };
    }
    
    // Implementación real con el workflow n8n
    console.log(`Conectando con n8n MCP Server: ${n8nMcpUrl}`);
    const response = await fetch(n8nMcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      throw new Error(`Error en el servidor n8n: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Respuesta recibida de n8n:', Object.keys(result));
    return result;
  } catch (error: unknown) {
    console.error('Error al comunicarse con el servidor n8n:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`Error al extraer contenido de la URL: ${errorMessage}`);
  }
}
