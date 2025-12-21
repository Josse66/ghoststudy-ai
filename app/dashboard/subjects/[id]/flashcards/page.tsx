'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Loader2, BookOpen, Trash2, Play, Sparkles, Filter } from 'lucide-react';
import Link from 'next/link';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  difficulty: string;
  document_id: string | null;
  created_at: string;
  documents?: {
    title: string;
  };
}

export default function SubjectFlashcardsPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.id as string;

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [subject, setSubject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');

  useEffect(() => {
    if (subjectId) {
      loadFlashcards();
      loadSubject();
    } else {
      setLoading(false);
    }
  }, [subjectId]);

  const loadSubject = async () => {
    if (!subjectId) return;

    const { data } = await supabase
      .from('subjects')
      .select('id, name, color, icon')
      .eq('id', subjectId)
      .single();

    if (data) {
      setSubject(data);
    }
  };

  const loadFlashcards = async () => {
    if (!subjectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select(`
          *,
          documents (
            title
          )
        `)
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFlashcards(data || []);
    } catch (error) {
      console.error('Error loading flashcards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta flashcard?')) return;

    setDeleting(id);
    try {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFlashcards(flashcards.filter((fc) => fc.id !== id));
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      alert('Error al eliminar la flashcard');
    } finally {
      setDeleting(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      concepto: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      definicion: 'bg-green-500/20 text-green-400 border-green-500/50',
      problema: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      formula: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      proceso: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      comparacion: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    };
    return colors[category] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-500/20 text-green-400 border-green-500/50',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      hard: 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return colors[difficulty] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  const getDifficultyLabel = (difficulty: string) => {
    const labels: Record<string, string> = {
      easy: 'Fácil',
      medium: 'Medio',
      hard: 'Difícil',
    };
    return labels[difficulty] || difficulty;
  };

  // Filtrar flashcards por dificultad
  const filteredFlashcards =
    filterDifficulty === 'all'
      ? flashcards
      : flashcards.filter((fc) => fc.difficulty === filterDifficulty);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/dashboard/subjects/${subjectId}`}>
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la materia
            </Button>
          </Link>

          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-purple-400" />
            Flashcards de la Materia
          </h1>
          {subject && (
            <p className="text-gray-400">
              Materia: <span className="text-white font-semibold">{subject.name}</span>
            </p>
          )}
        </div>

        {/* Stats */}
        {flashcards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-400">{flashcards.length}</p>
                  <p className="text-sm text-gray-400">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-400">
                    {flashcards.filter((fc) => fc.difficulty === 'easy').length}
                  </p>
                  <p className="text-sm text-gray-400">Fáciles</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-400">
                    {flashcards.filter((fc) => fc.difficulty === 'medium').length}
                  </p>
                  <p className="text-sm text-gray-400">Medias</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-400">
                    {flashcards.filter((fc) => fc.difficulty === 'hard').length}
                  </p>
                  <p className="text-sm text-gray-400">Difíciles</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter and Actions */}
        {flashcards.length > 0 && (
          <div className="mb-6 space-y-3">
            {/* Filtro de dificultad */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400">Filtrar por dificultad:</span>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'Todas' },
                  { value: 'easy', label: 'Fácil' },
                  { value: 'medium', label: 'Medio' },
                  { value: 'hard', label: 'Difícil' },
                ].map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => setFilterDifficulty(option.value)}
                    variant={filterDifficulty === option.value ? 'default' : 'outline'}
                    size="sm"
                    className={
                      filterDifficulty === option.value
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'border-gray-600 text-gray-400 hover:bg-gray-700'
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3">
              <Link href={`/dashboard/subjects/${subjectId}/flashcards/study`} className="flex-1">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Modo de Estudio
                </Button>
              </Link>
              <Link href={`/dashboard/flashcards/generate-subject?subjectId=${subjectId}`}>
                <Button variant="outline" className="border-purple-600 text-purple-400 hover:bg-purple-600/10">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar más
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Empty State */}
        {flashcards.length === 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-12 pb-12 text-center">
              <BookOpen className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">
                No hay flashcards generadas para esta materia
              </p>
              <Link href={`/dashboard/flashcards/generate-subject?subjectId=${subjectId}`}>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar Flashcards
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Flashcards List */}
        {filteredFlashcards.length > 0 ? (
          <>
            <p className="text-sm text-gray-400 mb-4">
              Mostrando {filteredFlashcards.length} de {flashcards.length} flashcards
            </p>
            <div className="space-y-4">
              {filteredFlashcards.map((flashcard) => (
                <Card
                  key={flashcard.id}
                  className="bg-gray-800 border-gray-700 hover:border-purple-600/50 transition-colors"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        {/* Front */}
                        <div className="mb-4">
                          <p className="text-sm text-gray-400 mb-1">Pregunta:</p>
                          <p className="text-white font-semibold">{flashcard.front}</p>
                        </div>

                        {/* Back */}
                        <div className="mb-4">
                          <p className="text-sm text-gray-400 mb-1">Respuesta:</p>
                          <p className="text-gray-300">{flashcard.back}</p>
                        </div>

                        {/* Tags y Documento */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${getCategoryColor(
                              flashcard.category
                            )}`}
                          >
                            {flashcard.category}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyColor(
                              flashcard.difficulty
                            )}`}
                          >
                            {getDifficultyLabel(flashcard.difficulty)}
                          </span>
                          {flashcard.documents && (
                            <span className="inline-flex items-center rounded-md border border-gray-600 bg-gray-700/50 px-2.5 py-0.5 text-xs text-gray-400">
                              📄 {flashcard.documents.title}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(flashcard.id)}
                        disabled={deleting === flashcard.id}
                        className="text-gray-400 hover:text-red-400"
                      >
                        {deleting === flashcard.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : flashcards.length > 0 ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-12 pb-12 text-center">
              <Filter className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                No hay flashcards con dificultad "{getDifficultyLabel(filterDifficulty)}"
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}