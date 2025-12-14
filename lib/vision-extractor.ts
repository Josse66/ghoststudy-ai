// lib/vision-extractor.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

interface VisionResult {
  text: string;
  description: string;
  confidence: number;
}

/**
 * Extrae texto y genera descripción de imágenes usando Google Gemini Vision
 */
export async function extractFromImage(buffer: Buffer): Promise<VisionResult> {
  console.log('🖼️ Starting Gemini Vision extraction...');

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Intentar usar Gemini 2.5 Flash (más reciente)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash'
    });

    console.log('📸 Converting image to base64...');
    const base64Image = buffer.toString('base64');

    console.log('🤖 Calling Gemini Vision API...');

    const prompt = `Analiza esta imagen de forma educativa y detallada. Por favor:

1. EXTRAE TODO EL TEXTO visible en la imagen (incluyendo texto escrito a mano, impreso, fórmulas, etc.)
2. DESCRIBE el contenido visual (diagramas, gráficos, ilustraciones, etc.)
3. IDENTIFICA conceptos clave y temas principales
4. Si hay fórmulas matemáticas o ecuaciones, transcríbelas correctamente

Formato de respuesta:
[TEXTO EXTRAÍDO]
(Aquí va todo el texto que encuentres)

[DESCRIPCIÓN VISUAL]
(Aquí describe el contenido visual)

[CONCEPTOS CLAVE]
(Lista los conceptos principales)`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg', // Gemini acepta jpeg, png, webp
        },
      },
    ]);

    const response = result.response;
    const fullText = response.text();

    console.log('✅ Gemini Vision extraction complete');
    console.log('Response length:', fullText.length, 'chars');

    // Parsear la respuesta estructurada
    const textMatch = fullText.match(/\[TEXTO EXTRAÍDO\]([\s\S]*?)\[DESCRIPCIÓN VISUAL\]/);
    const descriptionMatch = fullText.match(/\[DESCRIPCIÓN VISUAL\]([\s\S]*?)\[CONCEPTOS CLAVE\]/);
    const conceptsMatch = fullText.match(/\[CONCEPTOS CLAVE\]([\s\S]*?)$/);

    const extractedText = textMatch ? textMatch[1].trim() : '';
    const visualDescription = descriptionMatch ? descriptionMatch[1].trim() : '';
    const keyConcepts = conceptsMatch ? conceptsMatch[1].trim() : '';

    // Combinar todo en un texto estructurado
    let combinedText = '';
    
    if (extractedText) {
      combinedText += `=== TEXTO EXTRAÍDO ===\n${extractedText}\n\n`;
    }
    
    if (visualDescription) {
      combinedText += `=== DESCRIPCIÓN VISUAL ===\n${visualDescription}\n\n`;
    }
    
    if (keyConcepts) {
      combinedText += `=== CONCEPTOS CLAVE ===\n${keyConcepts}`;
    }

    // Si no se pudo parsear, usar la respuesta completa
    const finalText = combinedText.trim() || fullText;

    // Calcular confianza basada en la cantidad de contenido extraído
    const confidence = Math.min(95, 60 + (finalText.length / 10));

    console.log(`📊 Confidence: ${confidence.toFixed(1)}%`);

    return {
      text: finalText,
      description: visualDescription || 'Imagen procesada con IA',
      confidence: Number(confidence.toFixed(1)),
    };
  } catch (error: any) {
    console.error('❌ Error in Gemini Vision extraction:', error);
    
    // Si falla, devolver información básica
    return {
      text: '',
      description: 'Error al procesar imagen con IA',
      confidence: 0,
    };
  }
}

/**
 * Detecta el tipo MIME de la imagen basado en los primeros bytes
 */
function detectImageMimeType(buffer: Buffer): string {
  const header = buffer.slice(0, 4).toString('hex');
  
  if (header.startsWith('ffd8ff')) return 'image/jpeg';
  if (header.startsWith('89504e47')) return 'image/png';
  if (header.startsWith('47494638')) return 'image/gif';
  if (header.startsWith('52494646')) return 'image/webp';
  
  // Default
  return 'image/jpeg';
}