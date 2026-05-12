import type { StepExecutor } from "../pipeline"
import { executeListingScraper } from "./listingScraper"
import { executeVehicleIdentifier } from "./vehicleIdentifier"
import { executeMarketDataBundle } from "./marketDataBundle"
import { executeFairValueEngine } from "./fairValueEngine"
import { executeTechnicalAnalyst } from "./technicalAnalyst"
import { executeInvestmentAnalyst } from "./investmentAnalyst"
import { executeDueDiligence } from "./dueDiligence"
import { executeMarketResearcher } from "./marketResearcher"
import { executeBuyerServices } from "./buyerServices"
import { executeFinalSynthesis } from "./finalSynthesis"

/**
 * Registry of all V3 pipeline step executors.
 */
export function createV3Executors(): Record<string, StepExecutor> {
  return {
    listing_scrape: executeListingScraper,
    vehicle_identity: executeVehicleIdentifier,
    market_data_bundle: executeMarketDataBundle,
    fair_value: executeFairValueEngine,
    technical_analysis: executeTechnicalAnalyst,
    investment_analysis: executeInvestmentAnalyst,
    due_diligence: executeDueDiligence,
    market_research: executeMarketResearcher,
    buyer_services: executeBuyerServices,
    final_synthesis: executeFinalSynthesis,
  }
}
