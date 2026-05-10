import { createToolRegistry, type ToolRegistry } from "./registry"
import { marketplaceTools } from "./marketplace"
import { knowledgeTools } from "./knowledge"
import { analysisTools } from "./analysis"
import { actionTools } from "./action"
import { userTools } from "./user"
import { premiumTools } from "./premium"
import { inventoryTools } from "./inventory"

export function buildDefaultToolRegistry(): ToolRegistry {
  const reg = createToolRegistry()
  for (const t of [
    ...marketplaceTools,
    ...knowledgeTools,
    ...analysisTools,
    ...actionTools,
    ...userTools,
    ...premiumTools,
    ...inventoryTools,
  ]) {
    reg.register(t)
  }
  return reg
}
