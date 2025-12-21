'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, RotateCw, ThumbsUp, Meh, ThumbsDown, CheckCircle2, Trophy } from 'lucide-react';
import Link from 'next/link';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  difficulty: string;
  times_reviewed: number;
  ease_factor: number;
}

interface ReviewResult {
  easy: number;
  medium: number;
  hard: number;
}

export default function StudyModePage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.id as string;

  const [subject, setSubject] = useState<any>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [results, setResults] = useState<ReviewResult>({ easy: 0, medium: 0, hard: 0 });
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    if (subjectId) {
      loadSubject();
      loadFlashcards();
      setStartTime(new Date());
    }
  }, [subjectId]);

  // Atajos de teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (sessionComplete) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(!isFlipped);
      } else if (isFlipped) {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          handleReview('hard');
        } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          handleReview('medium');
        } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          handleReview('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, sessionComplete, currentIndex]);

  const loadSubject = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, name, color')
      .eq('id', subjectId)
      .single();

    if (data) setSubject(data);
  };

  const loadFlashcards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('subject_id', subjectId)
        .order('next_review_at', { ascending: true, nullsFirst: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        // No hay flashcards
        setFlashcards([]);
        setLoading(false);
        return;
      }

      // Mezclar flashcards
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      setFlashcards(shuffled);
    } catch (error) {
      console.error('Error loading flashcards:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNextReview = (quality: 'easy' | 'medium' | 'hard', card: Flashcard) => {
    const now = new Date();
    let easeFactor = card.ease_factor || 2.5;
    let interval = 0;

    // Algoritmo SM-2 simplificado
    if (quality === 'hard') {
      // Repetir pronto (mismo día)
      interval = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else if (quality === 'medium') {
      // Repetir en 1-3 días
      interval = card.times_reviewed === 0 ? 1 : 3;
      easeFactor = Math.max(1.3, easeFactor - 0.15);
    } else {
      // Fácil: intervalo más largo
      if (card.times_reviewed === 0) {
        interval = 4;
      } else if (card.times_reviewed === 1) {
        interval = 7;
      } else {
        interval = Math.round((card.times_reviewed + 1) * easeFactor);
      }
      easeFactor = easeFactor + 0.1;
    }

    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      easeFactor: Math.min(2.5, easeFactor),
      nextReview: nextReview.toISOString(),
    };
  };

  const handleReview = async (quality: 'easy' | 'medium' | 'hard') => {
    if (reviewing || currentIndex >= flashcards.length) return;

    setReviewing(true);

    try {
      const currentCard = flashcards[currentIndex];
      const { easeFactor, nextReview } = calculateNextReview(quality, currentCard);

      // Actualizar en base de datos
      const { error } = await supabase
        .from('flashcards')
        .update({
          times_reviewed: currentCard.times_reviewed + 1,
          ease_factor: easeFactor,
          last_reviewed_at: new Date().toISOString(),
          next_review_at: nextReview,
        })
        .eq('id', currentCard.id);

      if (error) throw error;

      // Actualizar estadísticas
      setResults((prev) => ({
        ...prev,
        [quality]: prev[quality] + 1,
      }));

      // Siguiente tarjeta
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        // Sesión completada
        setSessionComplete(true);
      }
    } catch (error) {
      console.error('Error updating review:', error);
      alert('Error al guardar el progreso');
    } finally {
      setReviewing(false);
    }
  };

  const getSessionDuration = () => {
    if (!startTime) return '0m';
    const now = new Date();
    const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60);
    return `${diff}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-3xl mx-auto">
          <Link href={`/dashboard/subjects/${subjectId}/flashcards`}>
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-12 pb-12 text-center">
              <RotateCw className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No hay flashcards para repasar</p>
              <Link href={`/dashboard/flashcards/generate-subject?subjectId=${subjectId}`}>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  Generar Flashcards
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Sesión completada
  if (sessionComplete) {
    const total = results.easy + results.medium + results.hard;
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-12 pb-12 text-center">
              <Trophy className="h-20 w-20 text-yellow-400 mx-auto mb-6" />
              <h1 className="text-3xl font-bold mb-2">¡Sesión Completada! 🎉</h1>
              <p className="text-gray-400 mb-8">
                Has repasado {total} flashcard{total !== 1 ? 's' : ''} en {getSessionDuration()}
              </p>

              {/* Estadísticas */}
              <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mb-8">
                <Card className="bg-green-900/20 border-green-600/50">
                  <CardContent className="pt-6">
                    <ThumbsUp className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-green-400">{results.easy}</p>
                    <p className="text-sm text-gray-400">Fáciles</p>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-900/20 border-yellow-600/50">
                  <CardContent className="pt-6">
                    <Meh className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-yellow-400">{results.medium}</p>
                    <p className="text-sm text-gray-400">Medias</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-900/20 border-red-600/50">
                  <CardContent className="pt-6">
                    <ThumbsDown className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-red-400">{results.hard}</p>
                    <p className="text-sm text-gray-400">Difíciles</p>
                  </CardContent>
                </Card>
              </div>

              {/* Mensaje motivacional */}
              <p className="text-gray-400 mb-8">
                {results.hard > total / 2
                  ? '💪 Sigue practicando, mejorarás cada día!'
                  : results.easy > total / 2
                  ? '🌟 ¡Excelente trabajo! Dominas estos conceptos.'
                  : '👍 Buen progreso, sigue repasando regularmente.'}
              </p>

              {/* Botones */}
              <div className="flex gap-3 justify-center">
                <Link href={`/dashboard/subjects/${subjectId}/flashcards/study`}>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <RotateCw className="mr-2 h-4 w-4" />
                    Repasar de nuevo
                  </Button>
                </Link>
                <Link href={`/dashboard/subjects/${subjectId}/flashcards`}>
                  <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    Ver todas las flashcards
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Modo de estudio activo
  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/dashboard/subjects/${subjectId}/flashcards`}>
            <Button variant="ghost" size="sm" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </Link>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">
                Tarjeta {currentIndex + 1} de {flashcards.length}
              </p>
              <p className="text-sm text-gray-400">{Math.round(progress)}%</p>
            </div>
            <Progress value={progress} className="h-2 bg-gray-700" />
          </div>

          {subject && (
            <p className="text-gray-400 text-sm">
              Materia: <span className="text-white font-semibold">{subject.name}</span>
            </p>
          )}
        </div>

        {/* Flashcard */}
        <div className="mb-8">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer"
            style={{ minHeight: '400px' }}
          >
            <Card className="relative bg-gray-800 border-gray-700" style={{ minHeight: '400px' }}>
              <CardContent className="p-8 md:p-12 flex flex-col items-center justify-center min-h-[400px]">
                {/* Front */}
                {!isFlipped && (
                  <div className="text-center">
                    <p className="text-xs text-purple-400 mb-4 uppercase font-semibold">Pregunta</p>
                    <p className="text-2xl md:text-3xl font-bold leading-relaxed">
                      {currentCard.front}
                    </p>
                    <p className="text-sm text-gray-500 mt-8">Toca para ver la respuesta</p>
                  </div>
                )}

                {/* Back */}
                {isFlipped && (
                  <div className="text-center">
                    <p className="text-xs text-green-400 mb-4 uppercase font-semibold">Respuesta</p>
                    <p className="text-xl md:text-2xl leading-relaxed text-gray-200">
                      {currentCard.back}
                    </p>
                    <div className="mt-6">
                      <span
                        className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold ${
                          currentCard.category === 'concepto'
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                            : currentCard.category === 'definicion'
                            ? 'bg-green-500/20 text-green-400 border-green-500/50'
                            : currentCard.category === 'problema'
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                            : 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                        }`}
                      >
                        {currentCard.category}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rating Buttons */}
        {isFlipped && (
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <Button
              onClick={() => handleReview('hard')}
              disabled={reviewing}
              className="bg-red-600 hover:bg-red-700 h-auto py-4 flex flex-col gap-2"
            >
              <ThumbsDown className="h-6 w-6" />
              <div className="text-center">
                <p className="font-semibold">Difícil</p>
                <p className="text-xs opacity-75">Repetir pronto</p>
                <p className="text-xs opacity-50">(1)</p>
              </div>
            </Button>

            <Button
              onClick={() => handleReview('medium')}
              disabled={reviewing}
              className="bg-yellow-600 hover:bg-yellow-700 h-auto py-4 flex flex-col gap-2"
            >
              <Meh className="h-6 w-6" />
              <div className="text-center">
                <p className="font-semibold">Medio</p>
                <p className="text-xs opacity-75">En 3 días</p>
                <p className="text-xs opacity-50">(2)</p>
              </div>
            </Button>

            <Button
              onClick={() => handleReview('easy')}
              disabled={reviewing}
              className="bg-green-600 hover:bg-green-700 h-auto py-4 flex flex-col gap-2"
            >
              <ThumbsUp className="h-6 w-6" />
              <div className="text-center">
                <p className="font-semibold">Fácil</p>
                <p className="text-xs opacity-75">En 4-7 días</p>
                <p className="text-xs opacity-50">(3)</p>
              </div>
            </Button>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            ⌨️ Atajos: <kbd className="px-2 py-1 bg-gray-800 rounded">Espacio</kbd> = Voltear •{' '}
            {isFlipped && (
              <>
                <kbd className="px-2 py-1 bg-gray-800 rounded">1</kbd> = Difícil •{' '}
                <kbd className="px-2 py-1 bg-gray-800 rounded">2</kbd> = Medio •{' '}
                <kbd className="px-2 py-1 bg-gray-800 rounded">3</kbd> = Fácil
              </>
            )}
          </p>
        </div>

        {/* Session Stats */}
        <div className="mt-6 flex justify-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span>Completadas: {currentIndex}</span>
          </div>
          <div className="flex items-center gap-2">
            <RotateCw className="h-4 w-4 text-purple-400" />
            <span>Restantes: {flashcards.length - currentIndex}</span>
          </div>
        </div>
      </div>
    </div>
  );
}