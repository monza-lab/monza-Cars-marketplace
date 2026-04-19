export type AnalysisConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type MarketTrend = 'APPRECIATING' | 'STABLE' | 'DECLINING';

export interface Analysis {
  id: string;
  auctionId: string;
  bidTargetLow?: number | null;
  bidTargetHigh?: number | null;
  confidence?: AnalysisConfidence | null;
  criticalQuestions: string[];
  redFlags: string[];
  keyStrengths: string[];
  yearlyMaintenance?: number | null;
  insuranceEstimate?: number | null;
  majorServiceCost?: number | null;
  appreciationPotential?: string | null;
  rawAnalysis?: AIAnalysisResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIAnalysisResponse {
  bidTarget: {
    low: number;
    high: number;
    confidence: AnalysisConfidence;
    reasoning: string;
  };
  criticalQuestions: string[];
  redFlags: string[];
  keyStrengths: string[];
  ownershipCosts: {
    yearlyMaintenance: number;
    insuranceEstimate: number;
    majorService: {
      description: string;
      estimatedCost: number;
      intervalMiles: number;
    };
  };
  investmentOutlook: {
    trend: MarketTrend;
    reasoning: string;
  };
  comparableAnalysis: string;
}

export interface MarketData {
  id: string;
  make: string;
  model: string;
  yearStart?: number | null;
  yearEnd?: number | null;
  avgPrice?: number | null;
  medianPrice?: number | null;
  lowPrice?: number | null;
  highPrice?: number | null;
  totalSales: number;
  trend?: MarketTrend | null;
  lastUpdated: string;
}
