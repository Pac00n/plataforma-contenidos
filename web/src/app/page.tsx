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
      console.log('Enviando solicitud al backend...');
      
      // Usar datos de prueba para verificar si el frontend muestra correctamente la información
      const mockData = {
        article_html: "<article><h2>Artículo de prueba</h2><p>Este es un artículo de prueba generado localmente.</p></article>",
        image_prompt: "A dramatic editorial photo showing test content",
        linkedin_post: "Publicación de LinkedIn de prueba",
        twitter_thread: ["Tweet 1 de prueba", "Tweet 2 de prueba", "Tweet 3 de prueba"],
        instagram_reel_script: {
          hook: "¿Sabías que esto es una prueba?",
          slides: [
            { subtitle: "Introducción de prueba", visual: "Imagen de prueba", voiceover: "Voz en off de prueba" },
            { subtitle: "Punto clave de prueba", visual: "Gráfico de prueba", voiceover: "Datos de prueba" }
          ]
        }
      };
      
      // Simulamos una llamada al backend, pero usamos datos locales para verificar
      console.log('Usando datos de prueba para verificar la interfaz...');
      setTimeout(() => {
        setResult(mockData);
        setIsLoading(false);
      }, 1500);
      
      /* Código real comentado para depuración
      const response = await fetch('http://localhost:3001/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) throw new Error('Error al procesar la solicitud');
      
      const data = await response.json();
      setResult(data);
      */
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (!result) return null;

    switch(activeTab) {
      case 'article':
        return <div dangerouslySetInnerHTML={{ __html: result.article_html }} />;
      case 'linkedin':
        return <div className="whitespace-pre-wrap">{result.linkedin_post}</div>;
      case 'twitter':
        return (
          <div className="space-y-4">
            {result.twitter_thread.map((tweet: string, i: number) => (
              <div key={i} className="p-4 border rounded-lg">{tweet}</div>
            ))}
          </div>
        );
      case 'instagram':
        return (
          <div className="space-y-4">
            <h3 className="font-bold">Hook: {result.instagram_reel_script.hook}</h3>
            <div className="space-y-2">
              {result.instagram_reel_script.slides.map((slide: any, i: number) => (
                <div key={i} className="p-4 border rounded-lg">
                  <p className="font-bold">{slide.subtitle}</p>
                  <p>{slide.visual}</p>
                  <p className="italic">{slide.voiceover}</p>
                </div>
              ))}
            </div>
          </div>
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
