import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Test direct access to finds table
    const { data: finds, error: findsError } = await supabaseAdmin
      .from('finds')
      .select('*')
      .limit(5);

    // Try to insert a test find to see what columns are available
    const { data: testFind, error: testError } = await supabaseAdmin
      .from('finds')
      .insert({
        teamid: '00000000-0000-0000-0000-000000000000',
        createdby: 'test-user',
        name: 'Test Find'
      })
      .select()
      .single();

    return NextResponse.json({
      finds: finds || [],
      findsError: findsError?.message || null,
      testFind: testFind || null,
      testError: testError?.message || null
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      finds: null,
      findsError: null,
      testFind: null,
      testError: null
    });
  }
}
