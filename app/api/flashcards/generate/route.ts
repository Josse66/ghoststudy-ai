// app/api/flashcards/generate/route.ts
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase-server';

export const maxDuration = 60;

interface GenerateRequest {
  documentId: string;
  count?: number;  // Cantidad de flashcards (default: 15)
  type?: 'all' | 'concepts' | 'definitions' | 'problems';  // Tipo de flashcards
}

export async function POST(request: Request) {
  console.log('=== GENERATE FLASHCARDS API CALLED ===');
  
  try {
    const body: GenerateRequest = await request.json();
    const { documentId, count = 15, type = 'all' } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    // 1. Verificar autenticación
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // 2. Obtener el documento y su contenido
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, content, subject_id, subjects(name)')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      console.error('❌ Document not found:', docError);
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const doc = document as any;

    if (!doc.content || doc.content.trim().length === 0) {
      return NextResponse.json(
        { error: 'El documento no tiene contenido para generar flashcards' },
        { status: 400 }
      );
    }

    console.log('📄 Document loaded:', {
      title: doc.title,
      contentLength: doc.content.length,
      subject: doc.subjects?.name
    });

    // 3. Preparar el prompt según el tipo
    let typeInstruction = '';
    switch (type) {
      case 'concepts':
        typeInstruction = 'Enfócate en conceptos clave y sus explicaciones.';
        break;
      case 'definitions':
        typeInstruction = 'Enfócate en términos y sus definiciones precisas.';
        break;
      case 'problems':
        typeInstruction = 'Enfócate en problemas de práctica y sus soluciones.';
        break;
      default:
        typeInstruction = 'Incluye una mezcla de conceptos, definiciones y problemas prácticos.';
    }

    const prompt = `Eres un experto en educación creando flashcards para estudio efectivo.

DOCUMENTO: "${doc.title}"
MATERIA: ${doc.subjects?.name || 'General'}

CONTENIDO DEL DOCUMENTO:
${doc.content.substring(0, 12000)}

INSTRUCCIONES:
- Genera EXACTAMENTE ${count} flashcards basadas en el contenido del documento
- ${typeInstruction}
- Cada flashcard debe ser clara, concisa y educativa
- La pregunta (FRONT) debe ser específica y directa
- La respuesta (BACK) debe ser completa pero concisa (max 150 palabras)
- Varía la dificultad: algunas fáciles, algunas medianas, algunas difíciles
- Asigna una categoría a cada flashcard
- NO inventes información que no esté en el documento

CATEGORÍAS DISPONIBLES:
- concepto: Explicación de ideas principales
- definicion: Términos y sus significados
- problema: Ejercicios prácticos o casos de aplicación
- formula: Ecuaciones o fórmulas matemáticas
- proceso: Pasos o procedimientos
- comparacion: Diferencias entre conceptos

FORMATO DE RESPUESTA (SOLO JSON, sin markdown):
{
  "flashcards": [
    {
      "front": "¿Pregunta clara y específica?",
      "back": "Respuesta completa y precisa",
      "category": "concepto",
      "difficulty": "medium"
    }
  ]
}

IMPORTANTE: 
- Responde SOLO con el JSON, sin texto adicional
- Sin backticks de markdown
- Genera exactamente ${count} flashcards
- Dificultades: easy, medium, hard`;

    console.log('🤖 Calling Groq to generate flashcards...');

    // 4. Llamar a Groq
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto educativo que crea flashcards de alta calidad. Respondes SOLO con JSON válido, sin markdown ni texto adicional.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('✅ Groq response received, length:', responseText.length);

    // 5. Parsear respuesta
    let flashcardsData;
    try {
      flashcardsData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Error parsing Groq response:', parseError);
      console.error('Response text:', responseText.substring(0, 500));
      return NextResponse.json(
        { error: 'Error al procesar la respuesta de la IA' },
        { status: 500 }
      );
    }

    if (!flashcardsData.flashcards || !Array.isArray(flashcardsData.flashcards)) {
      console.error('❌ Invalid flashcards format:', flashcardsData);
      return NextResponse.json(
        { error: 'Formato de flashcards inválido' },
        { status: 500 }
      );
    }

    console.log('✅ Flashcards parsed:', flashcardsData.flashcards.length);

    // 6. Guardar flashcards en la base de datos
    const flashcardsToInsert = flashcardsData.flashcards.map((fc: any) => ({
      user_id: user.id,
      document_id: documentId,
      subject_id: doc.subject_id,
      front: fc.front || '',
      back: fc.back || '',
      category: fc.category || 'concepto',
      difficulty: fc.difficulty || 'medium',
    }));

    const { data: insertedFlashcards, error: insertError } = await supabase
      .from('flashcards')
      .insert(flashcardsToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error inserting flashcards:', insertError);
      return NextResponse.json(
        { error: 'Error al guardar las flashcards' },
        { status: 500 }
      );
    }

    console.log('✅ Flashcards saved to database:', insertedFlashcards?.length);

    return NextResponse.json({
      success: true,
      flashcards: insertedFlashcards,
      count: insertedFlashcards?.length || 0,
    });
  } catch (error: any) {
    console.error('=== ERROR IN GENERATE FLASHCARDS API ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack?.substring(0, 500));
    
    return NextResponse.json(
      { 
        error: 'Error al generar flashcards',
        details: error.message,
      },
      { status: 500 }
    );
  }
}