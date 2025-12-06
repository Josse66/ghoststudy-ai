import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Importar pdf-parse dinámicamente
    const pdfParse = (await import('pdf-parse')).default;

    // Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extraer texto con pdf-parse
    const data = await pdfParse(buffer);

    return NextResponse.json({
      text: data.text,
      pageCount: data.numpages,
    });
  } catch (error: any) {
    console.error('Error extracting PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract PDF' },
      { status: 500 }
    );
  }
}