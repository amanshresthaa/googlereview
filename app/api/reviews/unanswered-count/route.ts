import { prisma } from "@/lib/db"
import { handleAuthedGet } from "@/lib/api/handler"

export const runtime = "nodejs"

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session }) => {
    const count = await prisma.review.count({
      where: {
        orgId: session.orgId,
        googleReplyComment: null,
        location: { enabled: true },
      },
    })

    return { body: { count } }
  })
}
