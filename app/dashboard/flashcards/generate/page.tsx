'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function GenerateFlashcardsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    }>
      <GenerateFlashcardsContent />
    </Suspense>
  );
}

function GenerateFlashcardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get('documentId');

  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  // Configuración
  const [count, setCount] = useState('15');
  const [type, setType] = useState('all');

  useEffect(() => {
    if (documentId) {
      loadDocument();
    } else {
      setLoading(false);
      setError('No se especificó un documento');
    }
  }, [documentId]);

  const loadDocument = async () => {
    if (!documentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, content, subjects(name, color)')
        .eq('id', documentId)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Documento no encontrado');
        return;
      }

      if (!data.content || data.content.trim().length < 100) {
        setError('El documento no tiene suficiente contenido para generar flashcards');
        return;
      }

      setDocument(data);
    } catch (err: any) {
      console.error('Error loading document:', err);
      setError('Error al cargar el documento');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!documentId) {
      console.error('❌ No documentId');
      return;
    }

    console.log('🚀 Starting generation...', {
      documentId,
      count: parseInt(count),
      type
    });

    setGenerating(true);
    setError('');
    setSuccess(false);

    try {
      console.log('📤 Sending request to API...');
      
      const response = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          count: parseInt(count),
          type,
        }),
      });

      console.log('📥 Response received:', response.status);

      const data = await response.json();
      console.log('📊 Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar flashcards');
      }

      console.log('✅ Flashcards generated:', data);
      setGeneratedCount(data.count || 0);
      setSuccess(true);

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push(`/dashboard/flashcards/${documentId}`);
      }, 2000);
    } catch (err: any) {
      console.error('❌ Error generating flashcards:', err);
      setError(err.message || 'Error al generar flashcards');
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>
          <Card className="bg-gray-800 border-red-600">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-red-400 font-semibold mb-2">Error</p>
                  <p className="text-gray-300">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Link href={`/dashboard/documents/${documentId}`}>
          <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al documento
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-400" />
          Generar Flashcards
        </h1>
        {document && (
          <p className="text-gray-400 mb-8">
            Documento: <span className="text-white font-semibold">{document.title}</span>
          </p>
        )}

        {/* Configuration Card */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Configuración</CardTitle>
            <CardDescription className="text-gray-400">
              Personaliza las flashcards que se generarán con IA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cantidad */}
            <div>
              <Label className="text-white mb-3 block">Cantidad de flashcards</Label>
              <div className="grid grid-cols-2 gap-3">
                {['5', '10', '15', '20'].map((num) => (
                  <label
                    key={num}
                    className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-colors ${
                      count === num
                        ? 'bg-purple-600 border-2 border-purple-400'
                        : 'bg-gray-700/50 border-2 border-transparent hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="count"
                      value={num}
                      checked={count === num}
                      onChange={(e) => setCount(e.target.value)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="flex-1">{num} flashcards</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tipo */}
            <div>
              <Label className="text-white mb-3 block">Tipo de flashcards</Label>
              <div className="space-y-2">
                {[
                  { value: 'all', label: 'Todas (Recomendado)', desc: 'Mezcla de conceptos, definiciones y problemas' },
                  { value: 'concepts', label: 'Conceptos clave', desc: 'Ideas principales y explicaciones' },
                  { value: 'definitions', label: 'Definiciones', desc: 'Términos y sus significados' },
                  { value: 'problems', label: 'Problemas prácticos', desc: 'Ejercicios y aplicaciones' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      type === option.value
                        ? 'bg-purple-600 border-2 border-purple-400'
                        : 'bg-gray-700/50 border-2 border-transparent hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={option.value}
                      checked={type === option.value}
                      onChange={(e) => setType(e.target.value)}
                      className="w-4 h-4 mt-1 text-purple-600"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm text-gray-400">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-900/20 border-blue-600/50 mb-6">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-200">
              💡 <strong>Tip:</strong> La IA analizará el contenido del documento y creará flashcards 
              personalizadas basadas en los conceptos más importantes. El proceso puede tomar 10-30 segundos.
            </p>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="bg-red-900/20 border-red-600/50 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-200">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Message */}
        {success && (
          <Card className="bg-green-900/20 border-green-600/50 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-200 font-semibold">¡Flashcards generadas exitosamente!</p>
                  <p className="text-green-300 text-sm mt-1">
                    Se crearon {generatedCount} flashcards. Redirigiendo...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generate Button */}
        {!success && (
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generando flashcards...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generar {count} Flashcards
              </>
            )}
          </Button>
        )}

        {/* Additional Info */}
        {!success && (
          <p className="text-center text-gray-500 text-sm mt-4">
            Una vez generadas, podrás editarlas, eliminarlas o estudiarlas en modo interactivo
          </p>
        )}
      </div>
    </div>
  );
}