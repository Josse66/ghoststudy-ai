// app/api/flashcards/update-review/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const maxDuration = 10;

interface UpdateReviewRequest {
  flashcardId: string;
  quality: 'easy' | 'medium' | 'hard';
}

/**
 * Calcula el próximo repaso usando algoritmo SM-2 simplificado
 */
function calculateNextReview(
  quality: 'easy' | 'medium' | 'hard',
  timesReviewed: number,
  currentEaseFactor: number
) {
  const now = new Date();
  let easeFactor = currentEaseFactor || 2.5;
  let interval = 0;

  // Algoritmo SM-2 simplificado
  if (quality === 'hard') {
    // Difícil: repetir pronto (mismo día o siguiente)
    interval = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (quality === 'medium') {
    // Medio: repetir en 1-3 días
    if (timesReviewed === 0) {
      interval = 1; // Primera vez
    } else {
      interval = 3; // Siguientes veces
    }
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else {
    // Fácil: intervalo más largo
    if (timesReviewed === 0) {
      interval = 4;
    } else if (timesReviewed === 1) {
      interval = 7;
    } else {
      // Intervalo crece según el factor de facilidad
      interval = Math.round((timesReviewed + 1) * easeFactor);
    }
    easeFactor = Math.min(2.5, easeFactor + 0.1);
  }

  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    easeFactor,
    nextReview: nextReview.toISOString(),
    interval,
  };
}

export async function POST(request: Request) {
  console.log('=== UPDATE REVIEW API CALLED ===');

  try {
    const body: UpdateReviewRequest = await request.json();
    const { flashcardId, quality } = body;

    console.log('📋 Request:', { flashcardId, quality });

    if (!flashcardId || !quality) {
      return NextResponse.json(
        { error: 'flashcardId y quality son requeridos' },
        { status: 400 }
      );
    }

    if (!['easy', 'medium', 'hard'].includes(quality)) {
      return NextResponse.json(
        { error: 'quality debe ser easy, medium o hard' },
        { status: 400 }
      );
    }

    // Autenticar usuario
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.id);

    // Obtener la flashcard actual
    const { data: flashcard, error: fetchError } = await supabase
      .from('flashcards')
      .select('*')
      .eq('id', flashcardId)
      .eq('user_id', user.id) // Verificar que pertenece al usuario
      .single();

    if (fetchError || !flashcard) {
      console.error('❌ Error fetching flashcard:', fetchError);
      return NextResponse.json(
        { error: 'Flashcard no encontrada' },
        { status: 404 }
      );
    }

    console.log('📄 Current flashcard:', {
      id: flashcard.id,
      timesReviewed: flashcard.times_reviewed,
      easeFactor: flashcard.ease_factor,
    });

    // Calcular próximo repaso
    const { easeFactor, nextReview, interval } = calculateNextReview(
      quality,
      flashcard.times_reviewed || 0,
      flashcard.ease_factor || 2.5
    );

    console.log('📊 Calculated next review:', {
      quality,
      easeFactor,
      interval,
      nextReview,
    });

    // Actualizar flashcard
    const { data: updated, error: updateError } = await supabase
      .from('flashcards')
      .update({
        times_reviewed: (flashcard.times_reviewed || 0) + 1,
        ease_factor: easeFactor,
        last_reviewed_at: new Date().toISOString(),
        next_review_at: nextReview,
      })
      .eq('id', flashcardId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating flashcard:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar flashcard' },
        { status: 500 }
      );
    }

    console.log('✅ Flashcard updated successfully');

    return NextResponse.json({
      success: true,
      flashcard: updated,
      nextReviewIn: interval,
      message:
        interval === 0
          ? 'Repasa esta tarjeta pronto'
          : `Próximo repaso en ${interval} día${interval !== 1 ? 's' : ''}`,
    });
  } catch (error: any) {
    console.error('❌ Error in update-review API:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint para obtener estadísticas de repaso
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener estadísticas del usuario
    const { data: stats, error } = await supabase
      .from('flashcards')
      .select('times_reviewed, difficulty, next_review_at')
      .eq('user_id', user.id);

    if (error) throw error;

    const total = stats?.length || 0;
    const reviewed = stats?.filter((s) => s.times_reviewed > 0).length || 0;
    const dueToday = stats?.filter((s) => {
      if (!s.next_review_at) return true; // Nunca revisada
      return new Date(s.next_review_at) <= new Date();
    }).length || 0;

    return NextResponse.json({
      total,
      reviewed,
      dueToday,
      stats,
    });
  } catch (error: any) {
    console.error('❌ Error getting stats:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}