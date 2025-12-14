// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase-server';

export const maxDuration = 60; // 60 segundos timeout

interface ChatRequest {
  documentId?: string;  // Opcional ahora
  subjectId?: string;   // NUEVO: Para chat multi-documento
  message: string;
  action?: 'chat' | 'summary' | 'flashcards' | 'quiz' | 'explain';
}

export async function POST(request: Request) {
  console.log('💬 Chat API called');

  try {
    const { documentId, subjectId, message, action = 'chat' }: ChatRequest = await request.json();

    if ((!documentId && !subjectId) || !message) {
      return NextResponse.json(
        { error: 'documentId or subjectId, and message are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let documents: any[] = [];
    let chatHistoryDocId = documentId;
    let subjectName = '';

    // MODO 1: Chat con un documento específico
    if (documentId) {
      console.log(`📄 Loading single document ${documentId}...`);
      
      const { data: documentData, error: docError } = await supabase
        .from('documents')
        .select('id, title, content, subjects(name)')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (docError || !documentData) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      const document: {
        id: string;
        title: string;
        content: string | null;
        subjects: { name: string } | null;
      } = documentData as any;

      documents = [document];
      subjectName = document.subjects?.name || 'N/A';
    } 
    // MODO 2: Chat con TODOS los documentos de una materia
    else if (subjectId) {
      console.log(`📚 Loading ALL documents from subject ${subjectId}...`);
      
      const { data: subjectData } = await supabase
        .from('subjects')
        .select('name')
        .eq('id', subjectId)
        .eq('user_id', user.id)
        .single();

      subjectName = subjectData?.name || 'N/A';

      const { data: allDocs, error: docsError } = await supabase
        .from('documents')
        .select('id, title, content')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (docsError || !allDocs || allDocs.length === 0) {
        return NextResponse.json(
          { error: 'No documents found in this subject' },
          { status: 404 }
        );
      }

      documents = allDocs;
      // Usar el subjectId como referencia para el historial
      chatHistoryDocId = subjectId;
      
      console.log(`✅ Loaded ${documents.length} documents`);
    }

    // 2. Obtener historial de chat reciente (últimos 10 mensajes)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('document_id', chatHistoryDocId!)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const chatHistory = (history || []).reverse(); // Orden cronológico

    console.log(`💬 Chat history: ${chatHistory.length} messages`);

    // 3. Preparar el contexto del documento(s)
    let documentContext = '';

    if (documents.length === 1) {
      // Contexto de un solo documento
      const doc = documents[0];
      documentContext = doc.content
        ? `DOCUMENTO: "${doc.title}" (Materia: ${subjectName})

CONTENIDO DEL DOCUMENTO:
${doc.content.substring(0, 15000)}

${doc.content.length > 15000 ? '[... documento truncado por tamaño ...]' : ''}`
        : `DOCUMENTO: "${doc.title}" (sin contenido extraído)`;
    } else {
      // Contexto de múltiples documentos
      documentContext = `MATERIA: "${subjectName}" (${documents.length} documentos)

CONTENIDO DE TODOS LOS DOCUMENTOS:\n\n`;

      let totalChars = 0;
      const maxCharsPerDoc = Math.floor(12000 / documents.length); // Distribuir espacio

      documents.forEach((doc, index) => {
        if (doc.content && doc.content.trim().length > 0) {
          const excerpt = doc.content.substring(0, maxCharsPerDoc);
          documentContext += `--- DOCUMENTO ${index + 1}: "${doc.title}" ---\n${excerpt}\n${doc.content.length > maxCharsPerDoc ? '[... truncado ...]\n' : ''}\n`;
          totalChars += excerpt.length;
        } else {
          documentContext += `--- DOCUMENTO ${index + 1}: "${doc.title}" --- (sin contenido)\n\n`;
        }
      });

      documentContext += `\n[Total: ${documents.length} documentos de la materia "${subjectName}"]`;
    }

    // 4. Crear el prompt según la acción
    let systemPrompt = '';
    let userPrompt = message;

    switch (action) {
      case 'summary':
        systemPrompt = `Eres un asistente educativo experto. Tu tarea es crear resúmenes claros y concisos.

${documentContext}

${documents.length > 1 
  ? `Crea un resumen INTEGRADO de todos los documentos con:
- Tema general de la materia
- Puntos clave de cada documento (máx 3 por doc)
- Conceptos que se conectan entre documentos
- Progresión/evolución de los temas
- Conclusiones generales`
  : `Crea un resumen estructurado con:
- Tema principal
- Puntos clave (3-5)
- Conceptos importantes
- Conclusiones`}`;
        userPrompt = documents.length > 1 
          ? `Resume de forma integrada todos los documentos de esta materia.`
          : 'Resume este documento de forma clara y estructurada.';
        break;

      case 'flashcards':
        systemPrompt = `Eres un experto en crear flashcards educativas efectivas.

${documentContext}

${documents.length > 1
  ? `Genera 15 flashcards que cubran TODOS los documentos en formato:
PREGUNTA: [pregunta clara y específica]
RESPUESTA: [respuesta concisa]
[FUENTE: Documento X]

Distribuye las flashcards entre todos los documentos, priorizando conceptos clave e integradores.`
  : `Genera 10 flashcards en formato:
PREGUNTA: [pregunta clara y específica]
RESPUESTA: [respuesta concisa]

Las flashcards deben cubrir los conceptos más importantes del documento.`}`;
        userPrompt = documents.length > 1
          ? `Genera 15 flashcards de todos los documentos de la materia.`
          : 'Genera 10 flashcards basadas en este documento.';
        break;

      case 'quiz':
        systemPrompt = `Eres un profesor creando exámenes de práctica.

${documentContext}

Genera 5 preguntas de opción múltiple (A, B, C, D) con:
- Pregunta clara
- 4 opciones
- Respuesta correcta marcada
- Breve explicación`;
        userPrompt = 'Crea 5 preguntas de examen sobre este documento.';
        break;

      case 'explain':
        systemPrompt = `Eres un tutor paciente y claro que explica conceptos académicos.

${documentContext}

Explica los conceptos de forma:
- Clara y simple
- Con ejemplos
- Paso a paso si es necesario
- En español`;
        break;

      case 'chat':
      default:
        systemPrompt = `Eres un asistente educativo inteligente especializado en ayudar a estudiantes.

${documentContext}

INSTRUCCIONES:
- Responde SOLO basándote en el contenido del documento proporcionado
- Si la pregunta no se puede responder con el documento, dilo claramente
- Sé claro, conciso y educativo
- Usa ejemplos del documento cuando sea relevante
- Responde en español`;
        break;
    }

    console.log(`🤖 Calling Groq API (action: ${action})...`);

    // 5. Llamar a Groq
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Agregar historial si existe y es chat normal
    if (action === 'chat' && chatHistory.length > 0) {
      chatHistory.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Agregar mensaje del usuario
    messages.push({ role: 'user', content: userPrompt });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', // Modelo más capaz de Groq
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'No pude generar una respuesta.';

    console.log(`✅ Response generated: ${assistantMessage.length} chars`);

    // 6. Guardar mensajes en la base de datos
    const messagesToSave = [
      {
        user_id: user.id,
        document_id: documentId,
        role: 'user',
        content: message,
      },
      {
        user_id: user.id,
        document_id: documentId,
        role: 'assistant',
        content: assistantMessage,
      },
    ];

    const { error: saveError } = await supabase
      .from('chat_messages')
      .insert(messagesToSave);

    if (saveError) {
      console.error('Error saving messages:', saveError);
    }

    // 7. Retornar respuesta
    return NextResponse.json({
      message: assistantMessage,
      action,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat', details: error.message },
      { status: 500 }
    );
  }
}