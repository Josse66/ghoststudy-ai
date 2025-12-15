// app/api/extract-pdf/route.ts
import { NextResponse } from 'next/server';
import { extractTextFromPDF, extractTextFromImage } from '@/lib/pdf-extractor';

export const maxDuration = 60; // 60 segundos timeout para OCR

export async function POST(request: Request) {
  console.log('=== ADVANCED EXTRACT API CALLED ===');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ No file provided');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📄 File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('✅ Buffer created, size:', buffer.length);

    // Detectar tipo de archivo y procesar
    if (file.type === 'application/pdf') {
      console.log('📄 Processing as PDF...');
      
      // Extraer de PDF (texto digital o escaneado con OCR automático)
      const result = await extractTextFromPDF(buffer);
      
      console.log('✅ PDF extraction complete:', {
        method: result.method,
        textLength: result.text.length,
        pageCount: result.pageCount,
        confidence: result.confidence
      });
      
      return NextResponse.json({
        text: result.text,
        pageCount: result.pageCount,
        method: result.method,
        confidence: result.confidence,
      });
    } 
    else if (file.type.startsWith('image/')) {
      console.log('🖼️ Processing as image...');
      
      // Extraer de imagen con Gemini Vision
      const result = await extractTextFromImage(buffer);
      
      console.log('✅ Image extraction complete:', {
        textLength: result.text.length,
        confidence: result.confidence
      });
      
      return NextResponse.json({
        text: result.text,
        pageCount: 1,
        method: 'ocr',
        confidence: result.confidence,
      });
    } 
    else {
      console.error('❌ Unsupported file type:', file.type);
      return NextResponse.json(
        { error: 'Tipo de archivo no soportado. Solo PDF, JPG, PNG y WebP.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('=== ERROR IN EXTRACT API ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack?.substring(0, 500));
    
    return NextResponse.json(
      { 
        error: 'Failed to extract text',
        details: error.message,
        type: error.constructor.name,
      },
      { status: 500 }
    );
  }
}