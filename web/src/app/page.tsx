"use client";

import { useState } from 'react';
import useSWR from 'swr';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('article');
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      console.log('Enviando solicitud al backend...', url);
      
      // Conexión real al backend
      const response = await fetch('http://localhost:3001/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar la solicitud');
      }
      
      const data = await response.json();
      console.log('Respuesta del backend recibida:', data);
      setResult(data.generatedContent || data); // Compatibilidad con diferentes estructuras de respuesta
      setIsLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (!result) return null;

    // Log para depuración
    console.log('Renderizando contenido con datos:', result);

    switch(activeTab) {
      case 'article':
        return <div dangerouslySetInnerHTML={{ __html: result.article_html }} />;
      case 'linkedin':
        return <div className="whitespace-pre-wrap">{result.linkedin_post}</div>;
      case 'twitter':
        // Manejar tanto twitter_thread (array) como twitter_post (string)
        return result.twitter_thread ? (
          <div className="space-y-4">
            {Array.isArray(result.twitter_thread) ? result.twitter_thread.map((tweet: string, i: number) => (
              <div key={i} className="p-4 border rounded-lg">{tweet}</div>
            )) : <div className="p-4 border rounded-lg">{result.twitter_thread}</div>}
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
      
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Introduce la URL del artículo..."
            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-3 rounded-lg bg-primary text-white font-medium ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary/90'}`}
          >
            {isLoading ? 'Procesando...' : 'Reescribir'}
          </button>
        </div>
      </form>

      {isLoading && (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      )}

      {result && (
        <div className="mt-8">
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
      )}
    </div>
  );
}
