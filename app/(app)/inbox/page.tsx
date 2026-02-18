import InboxClient from "./InboxClient"

export const dynamic = "force-dynamic"

export default function InboxPage() {
  return <InboxClient ssrBootstrap={null} />
}
