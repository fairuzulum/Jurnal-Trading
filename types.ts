export interface Trade {
  id?: string;
  date: number; // Stored as timestamp (ms)
  pair: string;
  position: 'Buy' | 'Sell';
  entry?: number;
  exit?: number;
  lot: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  profit: number; // User inputs this directly now
  result: 'Win' | 'Loss' | 'BreakEven';
  notes: string;
  createdAt?: any;
}

export type TradeFormData = {
  dateStr: string;
  pair: string;
  position: 'Buy' | 'Sell';
  lot: number;
  profit: number; // Direct P/L input
  notes: string;
};

export interface AppSettings {
  initialCapital: number;
}

export type ViewState = 'dashboard' | 'journal' | 'add' | 'stats' | 'settings' | 'edit';

export interface KPI {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  totalProfit: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  bestPair: string;
  worstPair: string;
  currentBalance: number;
}