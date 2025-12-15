// lib/vision-extractor.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

interface VisionResult {
  text: string;
  description: string;
  confidence: number;
}

/**
 * Convierte buffer a formato que Gemini pueda procesar
 */
function bufferToGenerativePart(buffer: Buffer, mimeType: string) {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType
    }
  };
}

/**
 * Extrae texto de imágenes o PDFs usando Google Gemini
 * Soporta: JPG, PNG, WebP, PDF
 */
export async function extractFromImage(
  buffer: Buffer, 
  mimeType: string = 'image/jpeg'
): Promise<VisionResult> {
  console.log('🖼️ Starting Gemini Vision extraction...');
  console.log('📋 MIME Type:', mimeType);
  console.log('📏 Buffer size:', buffer.length, 'bytes');

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    console.log('🔑 API key found, length:', apiKey.length);

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Usar modelo correcto según el tipo de archivo
    const modelName = mimeType === 'application/pdf' 
  ? 'gemini-2.5-flash'  // ✅ Este sí existe
  : 'gemini-2.0-flash-exp';  // ✅ Este también
    
    console.log('🤖 Using model:', modelName);

    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `Eres un experto en extraer texto de documentos. Analiza este ${mimeType === 'application/pdf' ? 'PDF' : 'imagen'} y extrae TODO el texto que contenga.

INSTRUCCIONES IMPORTANTES:
- Transcribe TODO el texto exactamente como aparece, sin omitir nada
- Si es texto manuscrito, haz tu mejor esfuerzo para leerlo
- Mantén la estructura y formato (párrafos, listas, etc.)
- Si hay tablas, organízalas claramente
- Si hay ecuaciones matemáticas, transcríbelas de forma legible
- Si hay diagramas con texto, extrae el texto de las etiquetas
- Respeta saltos de línea y espaciado
- NO inventes contenido que no esté en el documento

Formato de respuesta en español:

TEXTO EXTRAÍDO:
[Aquí todo el texto extraído del documento]

DESCRIPCIÓN:
[Breve descripción de 1-2 líneas: tipo de documento, tema principal, formato]

CONCEPTOS CLAVE:
[Lista de 3-5 conceptos principales del documento]`;

    console.log('📤 Sending request to Gemini API...');

    const imagePart = bufferToGenerativePart(buffer, mimeType);
    
    const generationConfig = {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
      generationConfig,
    });

    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini response received, length:', text.length);

    // Extraer las secciones de la respuesta
    const textMatch = text.match(/TEXTO EXTRAÍDO:\s*([\s\S]*?)\s*(?:DESCRIPCIÓN:|$)/i);
    const descMatch = text.match(/DESCRIPCIÓN:\s*([\s\S]*?)\s*(?:CONCEPTOS CLAVE:|$)/i);
    const conceptsMatch = text.match(/CONCEPTOS CLAVE:\s*([\s\S]*?)$/i);

    let extractedText = textMatch ? textMatch[1].trim() : text;
    let description = descMatch ? descMatch[1].trim() : 'Documento procesado con OCR';
    const concepts = conceptsMatch ? conceptsMatch[1].trim() : '';

    if (!textMatch && text.length > 0) {
      console.log('⚠️ No structured sections found, using full response as text');
      extractedText = text;
    }

    if (concepts) {
      description += '\n\nConceptos: ' + concepts;
    }

    let confidence = 70;
    if (extractedText.length > 100) confidence += 10;
    if (extractedText.length > 500) confidence += 10;
    if (concepts) confidence += 5;
    if (extractedText.includes('\n')) confidence += 5;
    confidence = Math.min(95, confidence);

    console.log('✅ Gemini Vision extraction complete:', {
      textLength: extractedText.length,
      descriptionLength: description.length,
      confidence: confidence.toFixed(2) + '%',
      model: modelName
    });

    return {
      text: extractedText,
      description,
      confidence
    };
  } catch (error: any) {
    console.error('❌ Error in Gemini Vision extraction:', error);
    throw error;
  }
}

/**
 * Extrae texto de una imagen JPG/PNG/WebP
 */
export async function extractTextFromImageFile(
  buffer: Buffer, 
  mimeType: string = 'image/jpeg'
): Promise<VisionResult> {
  console.log('📸 Processing image file with Gemini Vision');
  return extractFromImage(buffer, mimeType);
}

/**
 * Extrae texto de un PDF (especialmente PDFs escaneados)
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<VisionResult> {
  console.log('📄 Processing PDF with Gemini Vision OCR');
  return extractFromImage(buffer, 'application/pdf');
}