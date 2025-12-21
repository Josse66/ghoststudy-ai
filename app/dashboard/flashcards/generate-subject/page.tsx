'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle, FileText, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface Document {
  id: string;
  title: string;
  content: string;
}

function GenerateSubjectFlashcardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectId = searchParams.get('subjectId');

  const [subject, setSubject] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  // Configuración
  const [count, setCount] = useState('20');
  const [type, setType] = useState('all');

  useEffect(() => {
    if (subjectId) {
      loadSubjectAndDocuments();
    } else {
      setLoading(false);
      setError('No se especificó una materia');
    }
  }, [subjectId]);

  const loadSubjectAndDocuments = async () => {
    if (!subjectId) return;

    setLoading(true);
    try {
      // Cargar materia
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select('id, name, color, icon')
        .eq('id', subjectId)
        .single();

      if (subjectError) throw subjectError;
      if (!subjectData) {
        setError('Materia no encontrada');
        return;
      }

      setSubject(subjectData);

      // Cargar documentos con contenido
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('id, title, content')
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: true });

      if (docsError) throw docsError;

      // Filtrar documentos con contenido
      const validDocs = (docsData || []).filter(
        (doc) => doc.content && doc.content.trim().length > 100
      );

      if (validDocs.length === 0) {
        setError('No hay documentos con suficiente contenido en esta materia');
        return;
      }

      setDocuments(validDocs);
      // Seleccionar todos por defecto
      setSelectedDocs(validDocs.map((d) => d.id));
    } catch (err: any) {
      console.error('Error loading:', err);
      setError('Error al cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const toggleDocument = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const toggleAll = () => {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(documents.map((d) => d.id));
    }
  };

  const handleGenerate = async () => {
    if (!subjectId || selectedDocs.length === 0) return;

    console.log('🚀 Starting subject flashcards generation...', {
      subjectId,
      selectedDocs,
      count: parseInt(count),
      type,
    });

    setGenerating(true);
    setError('');
    setSuccess(false);

    try {
      console.log('📤 Sending request to API...');

      const response = await fetch('/api/flashcards/generate-subject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subjectId,
          documentIds: selectedDocs,
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
        router.push(`/dashboard/subjects/${subjectId}/flashcards`);
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

  if (error && !subject) {
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
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <Link href={`/dashboard/subjects/${subjectId}/chat`}>
          <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al chat
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-400" />
          Generar Flashcards de la Materia
        </h1>
        {subject && (
          <div className="flex items-center justify-between mb-8">
            <p className="text-gray-400">
              Materia: <span className="text-white font-semibold">{subject.name}</span>
            </p>
            <Link href={`/dashboard/subjects/${subjectId}/flashcards`}>
              <Button variant="outline" className="border-purple-600 text-purple-400 hover:bg-purple-600/10">
                <BookOpen className="mr-2 h-4 w-4" />
                Ver Flashcards Existentes
              </Button>
            </Link>
          </div>
        )}

        {/* Document Selection */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Seleccionar Documentos</CardTitle>
                <CardDescription className="text-gray-400">
                  Elige los documentos para generar flashcards ({selectedDocs.length}/{documents.length} seleccionados)
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAll}
                className="border-purple-600 text-purple-400 hover:bg-purple-600/10"
              >
                {selectedDocs.length === documents.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {documents.map((doc, index) => (
                <label
                  key={doc.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedDocs.includes(doc.id)
                      ? 'bg-purple-600/20 border-2 border-purple-600'
                      : 'bg-gray-700/50 border-2 border-transparent hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleDocument(doc.id)}
                    className="w-5 h-5 mt-0.5 text-purple-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-400 flex-shrink-0" />
                      <p className="font-semibold">{doc.title}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {doc.content.length} caracteres • Documento #{index + 1}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Configuración</CardTitle>
            <CardDescription className="text-gray-400">
              Personaliza las flashcards que se generarán
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cantidad */}
            <div>
              <Label className="text-white mb-3 block">Cantidad de flashcards</Label>
              <div className="grid grid-cols-2 gap-3">
                {['10', '20', '30', '40'].map((num) => (
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
                  { value: 'concepts', label: 'Conceptos clave', desc: 'Ideas principales de todos los documentos' },
                  { value: 'definitions', label: 'Definiciones', desc: 'Términos importantes y sus significados' },
                  { value: 'problems', label: 'Problemas prácticos', desc: 'Ejercicios y aplicaciones de la materia' },
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
              💡 <strong>Tip:</strong> La IA analizará el contenido de los {selectedDocs.length} documentos seleccionados 
              y creará flashcards que cubran los conceptos más importantes de toda la materia. 
              El proceso puede tomar 30-60 segundos dependiendo de la cantidad de documentos.
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
                    Se crearon {generatedCount} flashcards de {selectedDocs.length} documentos. Redirigiendo...
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
            disabled={generating || selectedDocs.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generando flashcards de {selectedDocs.length} documentos...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generar {count} Flashcards
              </>
            )}
          </Button>
        )}

        {!success && selectedDocs.length === 0 && (
          <p className="text-center text-red-400 text-sm mt-4">
            ⚠️ Debes seleccionar al menos un documento
          </p>
        )}

        {!success && selectedDocs.length > 0 && (
          <p className="text-center text-gray-500 text-sm mt-4">
            Se generarán flashcards analizando {selectedDocs.length} documento{selectedDocs.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default function GenerateSubjectFlashcardsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    }>
      <GenerateSubjectFlashcardsContent />
    </Suspense>
  );
}