import { db } from '@/lib/db'
import { shortUrls, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

const decryptor = async (text: string) => {
  const user = await db
    .select({
      id: users.id,
      apiKeySalt: users.apiKeySalt,
    })
    .from(users)
    .where(eq(users.apiKey, text.slice(0, 32)))

  if (!user.length) return false

  const encodedSalt = new TextEncoder().encode(user[0].apiKeySalt as string)
  const encodedKey = new TextEncoder().encode(process.env.NEXTAUTH_SECRET)

  const importedKey = await crypto.subtle.importKey(
    'raw',
    encodedSalt,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  )

  const encryptedText = atob(text)
  const encryptedBuffer = new Uint8Array(
    encryptedText.split('').map((char) => char.charCodeAt(0)),
  ) as any

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: encodedKey,
    },
    importedKey,
    encryptedBuffer,
  )

  const decryptedString = new TextDecoder().decode(decrypted)

  if (decryptedString === user[0].id + '.' + user[0].apiKeySalt) {
    return {
      id: user[0].id,
    }
  }

  return false
}

// GET /api/v1 for docs
export async function GET() {
  return NextResponse.json({
    endpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1`,
    message: 'Use POST method to access the API',
    headers: {
      authorization: 'Bearer <API Key>',
    },
    body: {
      '1. To get short urls': {
        intent: 'get',
      },
      '2. To create short url': {
        message: 'Not implemented yet',
      },
      '3. To update short url': {
        message: 'Not implemented yet',
      },
      '4. To delete short url': {
        message: 'Not implemented yet',
      },
    },
    contributeAt:
      'https://github.com/nrjdalal/rdt-li/blob/main/src/app/api/v1/route.ts',
  })
}

export async function POST(request: Request) {
  try {
    const { intent } = await request.json()

    if (!intent) return NextResponse.json({ message: 'No intent', status: 400 })

    if (!['get', 'create', 'update', 'delete'].includes(intent))
      return NextResponse.json({ message: 'Invalid intent', status: 400 })

    const apiKey = request.headers.get('Authorization')?.split(' ')[1]

    const isMatch = await decryptor(apiKey as string)

    if (isMatch) {
      if (intent === 'get') {
        const shortUrlsData = await db
          .select()
          .from(shortUrls)
          .where(eq(shortUrls.userId, isMatch.id))

        return NextResponse.json({
          data: shortUrlsData,
          status: 200,
        })
      }

      if (intent === 'create' || intent === 'update' || intent === 'delete') {
        return NextResponse.json({ message: 'Not implemented', status: 501 })
      }
    }

    return NextResponse.json({ message: 'User does not exist', status: 404 })
  } catch {
    return NextResponse.json({ message: 'Please try again', status: 409 })
  }
}
