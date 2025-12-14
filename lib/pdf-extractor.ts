// lib/pdf-extractor.ts

interface ExtractionResult {
  text: string;
  pageCount: number;
  method: 'text' | 'basic';
  confidence?: number;
}

/**
 * Extrae texto de un PDF usando pdf2json (sin dependencias nativas)
 */
export async function extractTextFromPDF(
  buffer: Buffer
): Promise<ExtractionResult> {
  console.log('🔍 Starting PDF text extraction with pdf2json...');

  try {
    const PDFParser = require('pdf2json');
    const pdfParser = new PDFParser(null, true); // true = incluir espacios en blanco

    return new Promise((resolve) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('❌ PDF parsing error:', errData?.parserError || 'Unknown error');
        resolve({
          text: '',
          pageCount: 0,
          method: 'basic',
        });
      });

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let text = '';
          const pages = pdfData?.Pages || [];
          
          console.log(`📄 Processing ${pages.length} pages...`);

          pages.forEach((page: any, pageIndex: number) => {
            const texts = page?.Texts || [];
            
            texts.forEach((textItem: any) => {
              try {
                // Cada Text puede tener múltiples runs (R)
                const runs = textItem?.R || [];
                runs.forEach((run: any) => {
                  if (run?.T) {
                    const decodedText = decodeURIComponent(run.T);
                    text += decodedText + ' ';
                  }
                });
              } catch (decodeError) {
                console.warn('Warning: Could not decode text item');
              }
            });
            
            // Agregar saltos de línea entre páginas
            if (pageIndex < pages.length - 1) {
              text += '\n\n--- Página ' + (pageIndex + 2) + ' ---\n\n';
            }
          });

          const cleanedText = text
            .replace(/\s+/g, ' ') // Múltiples espacios → uno solo
            .replace(/\n{3,}/g, '\n\n') // Múltiples saltos → máximo dos
            .trim();

          console.log(`✅ Extraction complete: ${cleanedText.length} chars, ${pages.length} pages`);

          if (cleanedText.length > 0) {
            resolve({
              text: cleanedText,
              pageCount: pages.length,
              method: 'text',
            });
          } else {
            console.log('⚠️ No text found in PDF (might be scanned or image-based)');
            resolve({
              text: '',
              pageCount: pages.length,
              method: 'basic',
            });
          }
        } catch (error: any) {
          console.error('❌ Error processing PDF data:', error.message);
          resolve({
            text: '',
            pageCount: 0,
            method: 'basic',
          });
        }
      });

      // Iniciar parsing
      try {
        pdfParser.parseBuffer(buffer);
      } catch (parseError: any) {
        console.error('❌ Error starting parse:', parseError.message);
        resolve({
          text: '',
          pageCount: 0,
          method: 'basic',
        });
      }
    });
  } catch (error: any) {
    console.error('❌ Error extracting PDF:', error.message);
    return {
      text: '',
      pageCount: 0,
      method: 'basic',
    };
  }
}

/**
 * Extrae texto de una imagen usando Gemini Vision
 */
export async function extractTextFromImage(buffer: Buffer): Promise<{
  text: string;
  confidence: number;
}> {
  console.log('🖼️ Image upload detected - using Gemini Vision');
  
  try {
    const { extractFromImage } = await import('./vision-extractor');
    const result = await extractFromImage(buffer);
    
    return {
      text: result.text,
      confidence: result.confidence,
    };
  } catch (error: any) {
    console.error('❌ Error extracting from image:', error);
    return {
      text: '',
      confidence: 0,
    };
  }
}