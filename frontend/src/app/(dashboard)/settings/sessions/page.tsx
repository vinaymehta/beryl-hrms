import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SessionsList } from "@/features/auth/components/sessions-list"

export const metadata = { title: "Sessions" }

export default function SessionsPage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Everywhere you&apos;re currently signed in. Revoke any device you don&apos;t recognize.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsList />
        </CardContent>
      </Card>
    </div>
  )
}
