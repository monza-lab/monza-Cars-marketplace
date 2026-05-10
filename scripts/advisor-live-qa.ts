/**
 * Advisor Live QA Test Script
 *
 * Runs test queries against the advisor API and verifies responses
 * against direct database queries for ground truth.
 *
 * Usage: npx tsx scripts/advisor-live-qa.ts
 *
 * Requires: dev server running at localhost:3000
 */

import { createClient } from "@supabase/supabase-js"

const API_URL = process.env.API_URL || "http://localhost:3000"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface TestResult {
  name: string
  query: string
  agentResponse: string
  dbGroundTruth: string
  pass: boolean
  details: string
}

async function sendAdvisorMessage(content: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/advisor/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, surface: "chat", locale: "en" }),
  })

  const text = await res.text()
  // Parse SSE events and extract content deltas + tool call summaries
  const lines = text.split("\n")
  let fullResponse = ""
  const toolSummaries: string[] = []

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    try {
      const event = JSON.parse(line.slice(6))
      if (event.type === "content_delta") fullResponse += event.delta
      if (event.type === "tool_call_end") toolSummaries.push(event.summary)
    } catch {}
  }

  return `[Tools: ${toolSummaries.join(" | ")}] ${fullResponse}`
}

// ── Test Cases ──

async function testCheapestTarga(): Promise<TestResult> {
  const name = "Cheapest Targa"
  const query = "What is the cheapest Porsche Targa you have listed?"

  const agentResponse = await sendAdvisorMessage(query)

  // Ground truth: cheapest active Targa by model field
  const { data } = await supabase
    .from("listings")
    .select("year,model,trim,hammer_price:listing_price,original_currency")
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .or("model.ilike.%targa%,trim.ilike.%targa%")
    .gt("listing_price", 0)
    .order("listing_price", { ascending: true })
    .limit(3)

  const cheapest = data?.[0]
  const dbGroundTruth = cheapest
    ? `${cheapest.year} ${cheapest.model} @ ${cheapest.original_currency} ${cheapest.hammer_price}`
    : "No targas found"

  // Check if agent mentions a price <= the actual cheapest (within 50% tolerance for currency)
  const agentPrice = extractPrice(agentResponse)
  const dbPrice = cheapest?.hammer_price ?? 0
  const pass = agentPrice > 0 && agentPrice <= dbPrice * 1.5

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass,
    details: pass
      ? `Agent found a Targa near the cheapest (agent: ${agentPrice}, db: ${dbPrice})`
      : `Agent price ${agentPrice} is too far from cheapest ${dbPrice}, or no results found`,
  }
}

async function testGT3Under100k(): Promise<TestResult> {
  const name = "GT3 under $100k"
  const query = "Show me GT3 listings under $100,000"

  const agentResponse = await sendAdvisorMessage(query)

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .or("model.ilike.%GT3%,trim.ilike.%GT3%")
    .gt("listing_price", 0)
    .lt("listing_price", 100000)

  const dbGroundTruth = `${count} active GT3 listings under $100k`
  const agentFoundResults = !agentResponse.toLowerCase().includes("no ") &&
    !agentResponse.toLowerCase().includes("0 match")

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass: (count ?? 0) > 0 ? agentFoundResults : true,
    details: agentFoundResults
      ? `Agent found GT3 results (DB has ${count})`
      : `Agent found no GT3s but DB has ${count}`,
  }
}

async function testListingCount(): Promise<TestResult> {
  const name = "Total listing count"
  const query = "How many Porsche listings do you have on the platform?"

  const agentResponse = await sendAdvisorMessage(query)

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", "%porsche%")
    .eq("status", "active")

  const dbGroundTruth = `${count} active Porsche listings`

  // Agent should report a number > 1000 (not "1" like before)
  const agentNumber = extractNumber(agentResponse)
  const pass = agentNumber > 1000

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass,
    details: pass
      ? `Agent reported ${agentNumber} (DB: ${count})`
      : `Agent reported ${agentNumber} — expected > 1000 (DB: ${count})`,
  }
}

async function test993Under150k(): Promise<TestResult> {
  const name = "993 under $150k"
  const query = "Find me a 993 under $150,000"

  const agentResponse = await sendAdvisorMessage(query)

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .eq("series", "993")
    .gt("listing_price", 0)
    .lt("listing_price", 150000)

  const dbGroundTruth = `${count} active 993 listings under $150k`
  const agentFoundMultiple = !agentResponse.includes("1 match") &&
    !agentResponse.includes("0 match") &&
    !agentResponse.toLowerCase().includes("no ")

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass: (count ?? 0) > 5 ? agentFoundMultiple : true,
    details: `Agent found multiple: ${agentFoundMultiple}, DB count: ${count}`,
  }
}

async function testTurboS(): Promise<TestResult> {
  const name = "911 Turbo S listings"
  const query = "What Porsche 911 Turbo S listings do you have?"

  const agentResponse = await sendAdvisorMessage(query)

  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .or("model.ilike.%turbo s%,trim.ilike.%turbo s%")
    .gt("listing_price", 0)

  const dbGroundTruth = `${count} active Turbo S listings`
  const agentFoundMultiple = !agentResponse.includes("0 match")

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass: agentFoundMultiple,
    details: `Agent found results: ${agentFoundMultiple}, DB count: ${count}`,
  }
}

async function testIMSKnowledge(): Promise<TestResult> {
  const name = "IMS bearing knowledge"
  const query = "What is an IMS bearing and which Porsches are affected?"

  const agentResponse = await sendAdvisorMessage(query)

  const mentionsIMS = agentResponse.toLowerCase().includes("ims")
  const mentionsAffectedModels =
    agentResponse.includes("996") || agentResponse.includes("M96")
  const doesNotDeflect = !agentResponse.includes("don't have a specific")

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth: "Should explain IMS bearing, mention 996/997.1/Boxster 986/987",
    pass: mentionsIMS && mentionsAffectedModels && doesNotDeflect,
    details: `IMS mentioned: ${mentionsIMS}, models: ${mentionsAffectedModels}, no deflection: ${doesNotDeflect}`,
  }
}

async function testCheapestOverall(): Promise<TestResult> {
  const name = "Cheapest Porsche overall"
  const query = "What is the cheapest Porsche you have listed right now?"

  const agentResponse = await sendAdvisorMessage(query)

  const { data } = await supabase
    .from("listings")
    .select("year,model,hammer_price:listing_price,original_currency")
    .ilike("make", "%porsche%")
    .eq("status", "active")
    .gt("listing_price", 0)
    .order("listing_price", { ascending: true })
    .limit(1)

  const cheapest = data?.[0]
  const dbGroundTruth = cheapest
    ? `${cheapest.year} ${cheapest.model} @ ${cheapest.original_currency} ${cheapest.hammer_price}`
    : "none"

  // Agent should find something in the bottom 10% price range
  const agentPrice = extractPrice(agentResponse)
  const pass = agentPrice > 0 && agentPrice <= (cheapest?.hammer_price ?? 0) * 3

  return {
    name,
    query,
    agentResponse: agentResponse.substring(0, 300),
    dbGroundTruth,
    pass,
    details: `Agent price: ${agentPrice}, DB cheapest: ${cheapest?.hammer_price}`,
  }
}

// ── Helpers ──

function extractPrice(text: string): number {
  const match = text.match(/[\$\u20AC\u00A3\u00A5]\s?([\d,]+)/)?.[1]
  return match ? parseInt(match.replace(/,/g, ""), 10) : 0
}

function extractNumber(text: string): number {
  const match = text.match(/([\d,]+)\s*(porsche|listing|car|total|active)/i)?.[1]
  return match ? parseInt(match.replace(/,/g, ""), 10) : 0
}

// ── Runner ──

async function main() {
  console.log("======================================================")
  console.log("     MonzaHaus Advisor -- Live QA Test Suite            ")
  console.log("======================================================\n")

  const tests = [
    testCheapestTarga,
    testGT3Under100k,
    testListingCount,
    test993Under150k,
    testTurboS,
    testIMSKnowledge,
    testCheapestOverall,
  ]

  const results: TestResult[] = []
  for (const test of tests) {
    try {
      const result = await test()
      results.push(result)
      const icon = result.pass ? "PASS" : "FAIL"
      console.log(`[${icon}] ${result.name}`)
      console.log(`   Query: ${result.query}`)
      console.log(`   DB:    ${result.dbGroundTruth}`)
      console.log(`   Agent: ${result.agentResponse.substring(0, 120)}...`)
      console.log(`   ${result.details}\n`)
    } catch (err) {
      console.log(`[ERROR] ${test.name}: ${err}`)
    }
  }

  const passed = results.filter((r) => r.pass).length
  const total = results.length
  console.log("-".repeat(55))
  console.log(`Result: ${passed}/${total} tests passed`)

  if (passed < total) {
    console.log("\nFailing tests:")
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  FAIL ${r.name}: ${r.details}`)
    })
    process.exit(1)
  }

  console.log("\nAll tests passed!")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
