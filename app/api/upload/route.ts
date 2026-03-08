import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'cover-images'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ url: null, error: 'No file provided', success: false }, { status: 400 })
    }

    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ url: null, error: 'Only JPEG, PNG, WebP, and GIF images are allowed', success: false }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ url: null, error: 'File must be under 5MB', success: false }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() ?? 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ url: null, error: error.message, success: false }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)

    return NextResponse.json({ url: urlData.publicUrl, error: null, success: true })
  } catch (e: any) {
    console.error('POST /api/upload exception:', e)
    return NextResponse.json({ url: null, error: 'Upload failed', success: false }, { status: 500 })
  }
}
