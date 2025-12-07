import { Trade, TradeFormData } from './types';

export const DEFAULT_TRADE_FORM: TradeFormData = {
  dateStr: new Date().toISOString().split('T')[0],
  pair: '',
  position: 'Buy',
  lot: 0.01,
  profit: 0,
  notes: '',
};

export const calculateProfitAndResult = (
  position: 'Buy' | 'Sell',
  entry: number,
  exit: number,
  lot: number
): { profit: number; result: 'Win' | 'Loss' | 'BreakEven' } => {
  let profit = 0;
  if (position === 'Buy') {
    profit = (exit - entry) * lot;
  } else {
    profit = (entry - exit) * lot;
  }
  
  // Round to 2 decimals for cleaner checks
  profit = Math.round(profit * 100) / 100;

  let result: 'Win' | 'Loss' | 'BreakEven' = 'BreakEven';
  if (profit > 0) result = 'Win';
  else if (profit < 0) result = 'Loss';

  return { profit, result };
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};