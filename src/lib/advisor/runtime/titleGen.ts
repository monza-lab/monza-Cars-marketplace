import { generateJson } from "@/lib/ai/gemini"

export async function generateTitle(
  firstUserMessage: string,
  firstAssistantMessage: string,
  locale: "en" | "de" | "es" | "ja",
): Promise<string> {
  const res = await generateJson<{ title: string }>({
    systemPrompt:
      "Summarize this conversation into a 3-6 word title in the given locale. Return JSON: { \"title\": \"...\" }. No quotes around the title.",
    userPrompt: `Locale: ${locale}\nUser: """${firstUserMessage.slice(0, 500)}"""\nAssistant: """${firstAssistantMessage.slice(0, 500)}"""`,
    temperature: 0.3,
    maxOutputTokens: 2048,
  })
  if (!res.ok) return firstUserMessage.slice(0, 40)
  return res.data.title.slice(0, 80)
}
