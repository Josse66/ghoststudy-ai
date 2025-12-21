// app/api/flashcards/generate-subject/route.ts
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase-server';

export const maxDuration = 60;

interface GenerateSubjectRequest {
  subjectId: string;
  documentIds: string[];
  count?: number;
  type?: 'all' | 'concepts' | 'definitions' | 'problems';
}

interface Flashcard {
  front: string;
  back: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export async function POST(request: Request) {
  console.log('=== GENERATE SUBJECT FLASHCARDS API CALLED ===');

  try {
    const body: GenerateSubjectRequest = await request.json();
    const { subjectId, documentIds, count = 20, type = 'all' } = body;

    console.log('📋 Request:', { subjectId, documentIds, count, type });

    if (!subjectId || !documentIds || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'subjectId y documentIds son requeridos' },
        { status: 400 }
      );
    }

    // Autenticar usuario
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.id);

    // Cargar los documentos seleccionados
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, title, content')
      .in('id', documentIds)
      .eq('subject_id', subjectId);

    if (docsError) {
      console.error('❌ Error loading documents:', docsError);
      return NextResponse.json(
        { error: 'Error al cargar documentos' },
        { status: 500 }
      );
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron documentos' },
        { status: 404 }
      );
    }

    console.log('📄 Documents loaded:', documents.length);

    // Combinar contenido de todos los documentos
    const combinedContent = documents
      .map((doc, index) => {
        const preview = doc.content.substring(0, 3000); // Limitar a 3000 chars por doc
        return `### DOCUMENTO ${index + 1}: "${doc.title}"\n\n${preview}\n\n`;
      })
      .join('\n---\n\n');

    console.log('📊 Combined content length:', combinedContent.length, 'chars');

    // Preparar el prompt según el tipo
    let typeInstruction = '';
    switch (type) {
      case 'concepts':
        typeInstruction = 'Enfócate en CONCEPTOS CLAVE y explicaciones de ideas principales.';
        break;
      case 'definitions':
        typeInstruction = 'Enfócate en DEFINICIONES de términos importantes.';
        break;
      case 'problems':
        typeInstruction = 'Enfócate en PROBLEMAS PRÁCTICOS, ejercicios y aplicaciones.';
        break;
      default:
        typeInstruction = 'Crea una MEZCLA equilibrada de conceptos, definiciones y problemas.';
    }

    const prompt = `Eres un experto en crear flashcards educativas. Analiza el contenido de MÚLTIPLES documentos y crea ${count} flashcards que cubran los temas más importantes de TODA LA MATERIA.

${typeInstruction}

CONTENIDO DE LOS DOCUMENTOS:
${combinedContent}

INSTRUCCIONES:
1. Lee y comprende el contenido de TODOS los documentos
2. Identifica los temas y conceptos MÁS IMPORTANTES que aparecen en los documentos
3. Crea ${count} flashcards que cubran de forma equilibrada todos los documentos
4. Distribuye las flashcards entre los diferentes documentos (no todas de uno solo)
5. Cada flashcard debe ser clara, concisa y educativa
6. La pregunta (front) debe ser directa y específica
7. La respuesta (back) debe ser completa pero no excesivamente larga
8. Asigna una categoría apropiada a cada flashcard
9. Asigna una dificultad basada en la complejidad del concepto

CATEGORÍAS DISPONIBLES:
- concepto: Ideas principales y explicaciones
- definicion: Términos y sus significados
- problema: Ejercicios y aplicaciones prácticas
- formula: Fórmulas matemáticas o científicas
- proceso: Procedimientos y pasos
- comparacion: Diferencias y similitudes entre conceptos

DIFICULTADES:
- easy: Conceptos básicos y definiciones simples
- medium: Conceptos intermedios que requieren comprensión
- hard: Conceptos avanzados, problemas complejos

FORMATO DE RESPUESTA (JSON):
{
  "flashcards": [
    {
      "front": "¿Pregunta clara y directa?",
      "back": "Respuesta completa y educativa",
      "category": "concepto|definicion|problema|formula|proceso|comparacion",
      "difficulty": "easy|medium|hard"
    }
  ]
}

IMPORTANTE: 
- Responde SOLO con JSON válido
- NO incluyas texto adicional, markdown o explicaciones
- Asegúrate de cubrir contenido de TODOS los documentos proporcionados
- Las flashcards deben reflejar la MATERIA COMPLETA, no solo un documento`;

    console.log('🤖 Calling Groq API...');

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en educación que crea flashcards de alta calidad. Respondes ÚNICAMENTE con JSON válido.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    console.log('✅ Groq response received:', responseText.substring(0, 200) + '...');

    // Parsear respuesta JSON
    let flashcardsData: { flashcards: Flashcard[] };
    try {
      // Limpiar respuesta (por si incluye markdown)
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      flashcardsData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Error parsing JSON:', parseError);
      console.error('Raw response:', responseText);
      return NextResponse.json(
        { error: 'Error al procesar la respuesta de la IA' },
        { status: 500 }
      );
    }

    if (!flashcardsData.flashcards || !Array.isArray(flashcardsData.flashcards)) {
      console.error('❌ Invalid flashcards format');
      return NextResponse.json(
        { error: 'Formato de flashcards inválido' },
        { status: 500 }
      );
    }

    console.log('📊 Flashcards parsed:', flashcardsData.flashcards.length);

    // Guardar flashcards en la base de datos
    const flashcardsToInsert = flashcardsData.flashcards.map((fc) => ({
      user_id: user.id,
      subject_id: subjectId,
      document_id: null, // Flashcards de materia no tienen documento específico
      front: fc.front,
      back: fc.back,
      category: fc.category,
      difficulty: fc.difficulty,
    }));

    const { data: savedFlashcards, error: insertError } = await supabase
      .from('flashcards')
      .insert(flashcardsToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error inserting flashcards:', insertError);
      return NextResponse.json(
        { error: 'Error al guardar flashcards' },
        { status: 500 }
      );
    }

    console.log('✅ Flashcards saved to database:', savedFlashcards?.length);

    return NextResponse.json({
      success: true,
      count: savedFlashcards?.length || 0,
      flashcards: savedFlashcards,
      documentsAnalyzed: documents.length,
    });
  } catch (error: any) {
    console.error('❌ Error in generate-subject API:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}