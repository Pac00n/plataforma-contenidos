"use client";

import { useState, useEffect } from 'react';
import useSWR from 'swr';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('article');
  const [result, setResult] = useState<any>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const [twitterPrompt, setTwitterPrompt] = useState('');
  const [linkedinPrompt, setLinkedinPrompt] = useState('');
  const [instagramPrompt, setInstagramPrompt] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  // Conectarse al SSE cuando progressId cambia
  useEffect(() => {
    if (progressId) {
      connectToSSE(progressId);
      return () => {
        // Limpiar al desmontar
        if (eventSource) {
          eventSource.close();
        }
      };
    }
  }, [progressId]);
  
  // Establecer los prompts cuando se reciben resultados
  useEffect(() => {
    if (result && result.meta?.prompts) {
      setTwitterPrompt(result.meta.prompts.twitter || '');
      setLinkedinPrompt(result.meta.prompts.linkedin || '');
      setInstagramPrompt(result.meta.prompts.instagram || '');
      setImagePrompt(result.image_prompt || '');
    }
  }, [result]);

  // Función para conectarse al SSE y recibir mensajes de progreso
  const connectToSSE = (id: string) => {
    // Cerrar conexión previa si existe
    if (eventSource) {
      eventSource.close();
    }
    
    console.log(`Conectando al SSE con ID: ${id}`);
    const newEventSource = new EventSource(`http://localhost:3001/api/progress/${id}`);
    
    newEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.messages && Array.isArray(data.messages)) {
          setProgressMessages(data.messages);
        }
      } catch (error) {
        console.error('Error al procesar mensaje SSE:', error);
      }
    };
    
    newEventSource.onerror = (error) => {
      console.error('Error en la conexión SSE:', error);
      newEventSource.close();
    };
    
    setEventSource(newEventSource);
    
    // Configurar un temporizador para obtener el resultado cuando termine el procesamiento
    setTimeout(checkForResults, 2000);
  };
  
  // Función para verificar si hay resultados disponibles
  const checkForResults = async () => {
    if (!progressId) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/result/${progressId}`);
      
      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setIsLoading(false);
        
        // Actualizar prompts si existen
        if (data.meta?.prompts) {
          setTwitterPrompt(data.meta.prompts.twitter || '');
          setLinkedinPrompt(data.meta.prompts.linkedin || '');
          setInstagramPrompt(data.meta.prompts.instagram || '');
        }
        if (data.image_prompt) {
          setImagePrompt(data.image_prompt || '');
        }
        
        // Cerrar el SSE ya que tenemos el resultado
        if (eventSource) {
          eventSource.close();
          setEventSource(null);
        }
      } else {
        // Si aún no hay resultados, verificar nuevamente en 2 segundos
        setTimeout(checkForResults, 2000);
      }
    } catch (error) {
      console.error('Error al verificar resultados:', error);
      setTimeout(checkForResults, 3000); // Reintento con tiempo adicional si hay error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setProgressMessages([]); // Limpiar mensajes anteriores
    setResult(null); // Limpiar resultados anteriores
    setProgressId(null); // Reiniciar ID de progreso
    
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    
    try {
      // Conexión real al backend para iniciar el proceso
      const response = await fetch('http://localhost:3001/api/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.progressId) {
          console.log('ID de progreso recibido:', data.progressId);
          setProgressId(data.progressId);
        } else {
          console.error('No se recibió ID de progreso');
        }
      } else {
        console.error('Error al iniciar el proceso:', await response.text());
      }
    } catch (error) {
      console.error('Error en la petición:', error);
      setIsLoading(false);
    }
  };
  
  // Función para regenerar el contenido con prompts personalizados
  const handleRegenerate = async () => {
    if (!progressId) return;
    
    setRegenerating(true);
    try {
      const response = await fetch('http://localhost:3001/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          progressId,
          prompts: {
            twitter: twitterPrompt,
            linkedin: linkedinPrompt,
            instagram: instagramPrompt,
            image: imagePrompt
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setProgressId(data.progressId);
        setIsLoading(true);
        setShowPrompts(false);
        setResult(null);
        setProgressMessages([]);
      } else {
        console.error('Error al regenerar:', await response.text());
      }
    } catch (error) {
      console.error('Error en la petición de regeneración:', error);
    } finally {
      setRegenerating(false);
    }
  };
  
  // Función auxiliar para añadir mensajes de progreso locales
  const addProgressMessage = (message: string) => {
    setProgressMessages(prev => [...prev, message]);
  };

  // Render del contenido según la pestaña activa
  const renderContent = () => {
    if (!result) return null;
    
    switch (activeTab) {
      case 'article':
        return (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold">{result.title}</h3>
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: result.article_html || result.article || 'No hay contenido disponible' }}></div>
            
            {result.image_url && (
              <div className="my-6">
                <img src={result.image_url} alt={result.title} className="w-full max-h-96 object-cover rounded-lg shadow-md" />
                {result.image_prompt && <p className="text-sm text-gray-500 mt-2 italic">Prompt: {result.image_prompt}</p>}
              </div>
            )}
          </div>
        );
      case 'linkedin':
        return result.linkedin_post ? (
          <div className="whitespace-pre-wrap p-4 border rounded-lg">{result.linkedin_post}</div>
        ) : (
          <div className="p-4 border rounded-lg text-gray-500">No hay contenido disponible para LinkedIn</div>
        );
      case 'twitter':
        return result.twitter_thread ? (
          <div className="space-y-4">
            {result.twitter_thread.map((tweet: string, idx: number) => (
              <div key={idx} className="p-4 border rounded-lg shadow-sm">
                <p>{tweet}</p>
                <div className="text-xs text-right text-gray-400 mt-2">{idx + 1}/{result.twitter_thread.length}</div>
              </div>
            ))}
          </div>
        ) : result.twitter_post ? (
          <div className="p-4 border rounded-lg">{result.twitter_post}</div>
        ) : (
          <div className="p-4 border rounded-lg text-gray-500">No hay contenido disponible para Twitter</div>
        );
      case 'instagram':
        // Manejar tanto instagram_reel_script (complejo) como instagram_caption (simple)
        return result.instagram_reel_script ? (
          <div className="space-y-4">
            <h3 className="font-bold">Hook: {result.instagram_reel_script.hook}</h3>
            <div className="space-y-2">
              {result.instagram_reel_script.slides && result.instagram_reel_script.slides.map((slide: any, i: number) => (
                <div key={i} className="p-4 border rounded-lg">
                  <p className="font-bold">{slide.subtitle}</p>
                  <p>{slide.visual}</p>
                  <p className="italic">{slide.voiceover}</p>
                </div>
              ))}
            </div>
          </div>
        ) : result.instagram_caption ? (
          <div className="whitespace-pre-wrap p-4 border rounded-lg">{result.instagram_caption}</div>
        ) : (
          <div className="p-4 border rounded-lg text-gray-500">No hay contenido disponible para Instagram</div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Plataforma Y</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
        {/* Columna de entrada */}
        <div className="md:col-span-1 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Entrada de URL</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                URL del artículo a procesar
              </label>
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://ejemplo.com/articulo"
                disabled={isLoading}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded-md text-white ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isLoading ? 'Procesando...' : 'Procesar URL'}
            </button>
          </form>
          
          {result && (
            <div className="mt-4">
              <button 
                onClick={() => setShowPrompts(!showPrompts)}
                className="w-full py-2 px-4 rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                {showPrompts ? 'Ocultar prompts' : 'Mostrar prompts'}
              </button>
            </div>
          )}
        </div>
        
        {/* Columna de preview */}
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md">
          {showPrompts && result ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Editar prompts</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt para Twitter</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md h-24" 
                  value={twitterPrompt} 
                  onChange={(e) => setTwitterPrompt(e.target.value)}
                  placeholder="Define el estilo y formato para el hilo de Twitter"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt para LinkedIn</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md h-24" 
                  value={linkedinPrompt} 
                  onChange={(e) => setLinkedinPrompt(e.target.value)}
                  placeholder="Define el estilo y formato para la publicación de LinkedIn"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt para Instagram</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md h-24" 
                  value={instagramPrompt} 
                  onChange={(e) => setInstagramPrompt(e.target.value)}
                  placeholder="Define el estilo y formato para el contenido de Instagram"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt para imagen (fal.ai)</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md h-24" 
                  value={imagePrompt} 
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe la imagen que deseas generar"
                />
              </div>
              
              <div className="flex space-x-2">
                <button 
                  onClick={() => setShowPrompts(false)}
                  className="py-2 px-4 rounded-md bg-gray-200 hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleRegenerate}
                  className="py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700"
                  disabled={regenerating}
                >
                  {regenerating ? 'Regenerando...' : 'Regenerar contenido'}
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <h2 className="text-xl font-bold">Procesando URL...</h2>
              
              {/* Panel de mensajes de progreso */}
              <div className="bg-gray-50 p-4 rounded border border-gray-200 h-64 overflow-y-auto">
                {progressMessages.length > 0 ? (
                  progressMessages.map((message, index) => (
                    <div 
                      key={index} 
                      className="mb-2 text-sm font-mono"
                      data-testid={`progress-message-${index}`}
                    >
                      {message}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 italic">Esperando progreso...</div>
                )}
              </div>
            </div>
          ) : result ? (
            <div>
              <div className="border-b border-gray-200 mb-4">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('article')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'article' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
                  >
                    Artículo
                  </button>
                  <button
                    onClick={() => setActiveTab('linkedin')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'linkedin' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
                  >
                    LinkedIn
                  </button>
                  <button
                    onClick={() => setActiveTab('twitter')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'twitter' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
                  >
                    X / Twitter
                  </button>
                  <button
                    onClick={() => setActiveTab('instagram')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'instagram' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:border-gray-300'}`}
                  >
                    Reel IG
                  </button>
                </nav>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm text-gray-900">
                {renderContent()}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              Ingresa una URL para generar contenido
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
