import { Badge } from "@/components/ui/badge"
import { roleBadgeClasses } from "@/constants/permissions"
import { cn } from "cn"

export function RoleBadge({ name, slug }: { name: string; slug: string }) {
  return <Badge className={cn("border-transparent", roleBadgeClasses(slug))}>{name}</Badge>
}
