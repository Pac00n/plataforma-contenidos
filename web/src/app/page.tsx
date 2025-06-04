"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("article");
  const [result, setResult] = useState<any>(null);
  const [step, setStep] = useState(1); // 1: URL, 2: prompts, 3: proceso, 4: resultado
  const [progressStep, setProgressStep] = useState(0);
  const progressStages = [
    "Extrayendo contenido",
    "Generando texto",
    "Generando imagen",
  ];
  const [prompts, setPrompts] = useState({
    article: "Genera un artículo ampliado y detallado.",
    linkedin: "Tono profesional para LinkedIn.",
    twitter: "Tono conversacional y breve.",
    instagram: "Tono impactante para Instagram.",
  });

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStep(3);
    setProgressStep(1);

    try {
      console.log("Enviando solicitud al backend...", url);

      // Conexión real al backend
      const response = await fetch("http://localhost:3001/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, prompts }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al procesar la solicitud");
      }

      setProgressStep(2);
      const data = await response.json();
      console.log("Respuesta del backend recibida:", data);
      setResult(data.generatedContent || data); // Compatibilidad con diferentes estructuras de respuesta
      setProgressStep(3);
      setIsLoading(false);
      setStep(4);
    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
      setStep(2);
    }
  };

  const renderContent = () => {
    if (!result) return null;

    // Log para depuración
    console.log("Renderizando contenido con datos:", result);

    switch (activeTab) {
      case "article":
        return (
          <div dangerouslySetInnerHTML={{ __html: result.article_html }} />
        );
      case "linkedin":
        return (
          <div className="whitespace-pre-wrap">{result.linkedin_post}</div>
        );
      case "twitter":
        // Manejar tanto twitter_thread (array) como twitter_post (string)
        return result.twitter_thread ? (
          <div className="space-y-4">
            {Array.isArray(result.twitter_thread) ? (
              result.twitter_thread.map((tweet: string, i: number) => (
                <div key={i} className="p-4 border rounded-lg">
                  {tweet}
                </div>
              ))
            ) : (
              <div className="p-4 border rounded-lg">
                {result.twitter_thread}
              </div>
            )}
          </div>
        ) : result.twitter_post ? (
          <div className="p-4 border rounded-lg">{result.twitter_post}</div>
        ) : (
          <div className="p-4 border rounded-lg text-gray-500">
            No hay contenido disponible para Twitter
          </div>
        );
      case "instagram":
        // Manejar tanto instagram_reel_script (complejo) como instagram_caption (simple)
        return result.instagram_reel_script ? (
          <div className="space-y-4">
            <h3 className="font-bold">
              Hook: {result.instagram_reel_script.hook}
            </h3>
            <div className="space-y-2">
              {result.instagram_reel_script.slides &&
                result.instagram_reel_script.slides.map(
                  (slide: any, i: number) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <p className="font-bold">{slide.subtitle}</p>
                      <p>{slide.visual}</p>
                      <p className="italic">{slide.voiceover}</p>
                    </div>
                  ),
                )}
            </div>
          </div>
        ) : result.instagram_caption ? (
          <div className="whitespace-pre-wrap p-4 border rounded-lg">
            {result.instagram_caption}
          </div>
        ) : (
          <div className="p-4 border rounded-lg text-gray-500">
            No hay contenido disponible para Instagram
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Plataforma Y</h1>

      {step === 1 && (
        <form onSubmit={handleNext} className="max-w-2xl mx-auto mb-8">
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
              disabled={!url}
              className="px-6 py-3 rounded-lg bg-primary text-white font-medium transition-colors hover:bg-primary/90"
            >
              Continuar
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form
          onSubmit={handleGenerate}
          className="max-w-2xl mx-auto mb-8 space-y-4"
        >
          <textarea
            className="w-full p-3 border rounded-lg text-gray-900"
            value={prompts.article}
            onChange={(e) =>
              setPrompts({ ...prompts, article: e.target.value })
            }
            rows={2}
            placeholder="Instrucciones para el artículo"
          />
          <textarea
            className="w-full p-3 border rounded-lg text-gray-900"
            value={prompts.linkedin}
            onChange={(e) =>
              setPrompts({ ...prompts, linkedin: e.target.value })
            }
            rows={2}
            placeholder="Instrucciones para LinkedIn"
          />
          <textarea
            className="w-full p-3 border rounded-lg text-gray-900"
            value={prompts.twitter}
            onChange={(e) =>
              setPrompts({ ...prompts, twitter: e.target.value })
            }
            rows={2}
            placeholder="Instrucciones para Twitter"
          />
          <textarea
            className="w-full p-3 border rounded-lg text-gray-900"
            value={prompts.instagram}
            onChange={(e) =>
              setPrompts({ ...prompts, instagram: e.target.value })
            }
            rows={2}
            placeholder="Instrucciones para Instagram"
          />
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-lg border"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`px-6 py-3 rounded-lg bg-primary text-white font-medium transition-colors ${isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-primary/90"}`}
            >
              {isLoading ? "Procesando..." : "Generar"}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center my-12 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <ul className="space-y-2 text-center">
            {progressStages.map((label, idx) => (
              <li
                key={idx}
                className={`transition-colors ${
                  progressStep > idx ? "text-primary" : "text-gray-500"
                }`}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 4 && result && (
        <div className="mt-8">
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab("article")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === "article" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:border-gray-300"}`}
              >
                Artículo
              </button>
              <button
                onClick={() => setActiveTab("linkedin")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === "linkedin" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:border-gray-300"}`}
              >
                LinkedIn
              </button>
              <button
                onClick={() => setActiveTab("twitter")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === "twitter" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:border-gray-300"}`}
              >
                X / Twitter
              </button>
              <button
                onClick={() => setActiveTab("instagram")}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === "instagram" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:border-gray-300"}`}
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
