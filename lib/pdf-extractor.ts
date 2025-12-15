// lib/pdf-extractor.ts

interface ExtractionResult {
  text: string;
  pageCount: number;
  method: 'text' | 'ocr' | 'basic';
  confidence?: number;
}

/**
 * Extrae texto de un PDF usando múltiples métodos:
 * 1. Intenta pdf2json (para PDFs con texto digital)
 * 2. Si no hay texto significativo (PDF escaneado), usa Gemini Vision OCR
 */
export async function extractTextFromPDF(
  buffer: Buffer
): Promise<ExtractionResult> {
  console.log('🔍 Starting PDF text extraction...');
  console.log('📏 PDF size:', buffer.length, 'bytes');

  try {
    // PASO 1: Intentar extracción de texto con pdf2json
    // @ts-ignore
    const pdfParse = require('pdf2json');
    
    console.log('📄 Attempting text extraction with pdf2json...');
    
    const PDFParser = pdfParse;
    const pdfParser = new PDFParser(null, true);

    const result = await new Promise<{ text: string; pageCount: number }>((resolve) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('⚠️ pdf2json error:', errData?.parserError || 'Unknown error');
        resolve({ text: '', pageCount: 0 });
      });

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let text = '';
          const pages = pdfData?.Pages || [];
          
          console.log(`📄 Processing ${pages.length} pages with pdf2json...`);

          pages.forEach((page: any, pageIndex: number) => {
            const texts = page?.Texts || [];
            
            texts.forEach((textItem: any) => {
              try {
                const runs = textItem?.R || [];
                runs.forEach((run: any) => {
                  if (run?.T) {
                    const decodedText = decodeURIComponent(run.T);
                    text += decodedText + ' ';
                  }
                });
              } catch (decodeError) {
                console.warn('⚠️ Could not decode text item');
              }
            });
            
            // Agregar separador de página
            if (pageIndex < pages.length - 1) {
              text += '\n\n--- Página ' + (pageIndex + 2) + ' ---\n\n';
            }
          });

          // Limpiar el texto
          const cleanedText = text
            .replace(/\s+/g, ' ')      // Múltiples espacios → uno solo
            .replace(/\n{3,}/g, '\n\n') // Múltiples saltos → máximo 2
            .trim();

          resolve({
            text: cleanedText,
            pageCount: pages.length,
          });
        } catch (error: any) {
          console.error('❌ Error processing PDF data:', error);
          resolve({ text: '', pageCount: 0 });
        }
      });

      try {
        pdfParser.parseBuffer(buffer);
      } catch (parseError: any) {
        console.error('❌ Error starting parse:', parseError);
        resolve({ text: '', pageCount: 0 });
      }
    });

    console.log(`✅ pdf2json extraction complete: ${result.text.length} chars, ${result.pageCount} pages`);

    // PASO 2: Analizar si el texto extraído es significativo
    const meaningfulText = result.text
      .replace(/---\s*Página\s*\d+\s*---/g, '')
      .trim();

    console.log(`📊 Meaningful text length: ${meaningfulText.length} chars`);

    // Si hay texto significativo (más de 100 caracteres), retornar como éxito
    if (meaningfulText.length > 100) {
      console.log('✅ PDF contains digital text, using pdf2json extraction');
      return {
        text: result.text,
        pageCount: result.pageCount,
        method: 'text',
      };
    }

    // PASO 3: Si no hay texto significativo, es un PDF escaneado
    console.log('⚠️ Only', meaningfulText.length, 'chars of meaningful text found');
    console.log('🔄 PDF appears to be scanned. Attempting Gemini Vision OCR...');

    try {
      // Importar desde vision-extractor
      const visionExtractor = await import('./vision-extractor');
      
      console.log('📸 Calling Gemini Vision API for OCR...');
      const visionResult = await visionExtractor.extractTextFromPDF(buffer);
      
      console.log('📊 Gemini Vision OCR result:', {
        textLength: visionResult.text?.length || 0,
        confidence: visionResult.confidence,
        hasText: !!visionResult.text,
        description: visionResult.description.substring(0, 50) + '...'
      });
      
      if (visionResult.text && visionResult.text.trim().length > 0) {
        console.log('✅ Gemini Vision OCR successful:', visionResult.text.length, 'chars');
        
        let fullText = visionResult.text;
        if (visionResult.description) {
          fullText += '\n\n--- INFORMACIÓN DEL DOCUMENTO ---\n' + visionResult.description;
        }
        
        return {
          text: fullText,
          pageCount: result.pageCount || 1,
          method: 'ocr',
          confidence: visionResult.confidence,
        };
      } else {
        console.log('⚠️ Gemini Vision returned empty text');
      }
    } catch (ocrError: any) {
      console.error('❌ Error in Gemini Vision OCR:', ocrError);
      console.error('Error message:', ocrError.message);
    }

    // PASO 4: Si todo falla, retornar lo que tengamos
    console.log('⚠️ No text could be extracted from PDF');
    return {
      text: result.text || 'No se pudo extraer texto de este documento.',
      pageCount: result.pageCount,
      method: 'basic',
    };
  } catch (error: any) {
    console.error('❌ Fatal error extracting PDF:', error.message);
    return {
      text: '',
      pageCount: 0,
      method: 'basic',
    };
  }
}

/**
 * Extrae texto de una imagen (JPG, PNG, WebP) usando Gemini Vision
 */
export async function extractTextFromImage(buffer: Buffer): Promise<{
  text: string;
  confidence: number;
}> {
  console.log('🖼️ Image upload detected - using Gemini Vision');
  console.log('📏 Image size:', buffer.length, 'bytes');
  
  try {
    // Importar desde vision-extractor
    const visionExtractor = await import('./vision-extractor');
    
    // Detectar tipo MIME de la imagen
    let mimeType = 'image/jpeg';
    
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      mimeType = 'image/png';
    }
    else if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      mimeType = 'image/webp';
    }
    
    console.log('📋 Detected MIME type:', mimeType);
    
    const result = await visionExtractor.extractTextFromImageFile(buffer, mimeType);
    
    let fullText = result.text;
    if (result.description) {
      fullText += '\n\n--- DESCRIPCIÓN DE LA IMAGEN ---\n' + result.description;
    }
    
    return {
      text: fullText,
      confidence: result.confidence,
    };
  } catch (error: any) {
    console.error('❌ Error extracting from image:', error);
    console.error('Error details:', error.message);
    return {
      text: '',
      confidence: 0,
    };
  }
}