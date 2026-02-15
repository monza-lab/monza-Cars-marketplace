export type Platform = 'BRING_A_TRAILER' | 'CARS_AND_BIDS' | 'COLLECTING_CARS';
export type AuctionStatus = 'ACTIVE' | 'ENDING_SOON' | 'ENDED' | 'SOLD' | 'NO_SALE';
export type ReserveStatus = 'NO_RESERVE' | 'RESERVE_NOT_MET' | 'RESERVE_MET';

export interface Auction {
  id: string;
  externalId: string;
  platform: Platform;
  url: string;
  title: string;
  make: string;
  model: string;
  year: number;
  trim?: string | null;
  vin?: string | null;
  mileage?: number | null;
  mileageUnit: string;
  transmission?: string | null;
  engine?: string | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  location?: string | null;
  region?: string | null;
  currentBid?: number | null;
  reserveStatus?: ReserveStatus | null;
  bidCount: number;
  viewCount?: number | null;
  watchCount?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  status: AuctionStatus;
  finalPrice?: number | null;
  description?: string | null;
  sellerNotes?: string | null;
  images: string[];
  createdAt: string;
  updatedAt: string;
  scrapedAt: string;
  analysis?: Analysis | null;
}

export interface AuctionFilters {
  platform?: Platform;
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  status?: AuctionStatus;
  search?: string;
  sortBy?: 'endTime' | 'currentBid' | 'createdAt' | 'year';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PriceHistoryEntry {
  id: string;
  bid: number;
  timestamp: string;
}

export interface Comparable {
  id: string;
  title: string;
  platform: Platform;
  url?: string | null;
  soldDate?: string | null;
  soldPrice: number;
  mileage?: number | null;
  condition?: string | null;
}

export type AnalysisConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type InvestmentGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'SPECULATIVE';

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
  investmentGrade?: InvestmentGrade | null;
  appreciationPotential?: string | null;
  rawAnalysis?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
