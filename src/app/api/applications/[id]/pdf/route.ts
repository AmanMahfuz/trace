import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { createResumeDocument } from '@/components/ResumePDFDocument';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data: app } = await supabase
    .from('applications')
    .select('tailored')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!app?.tailored) return new NextResponse('Document not found', { status: 404 });

  const doc = createResumeDocument(app.tailored);
  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tailored-resume-${id}.pdf"`,
    },
  });
}
