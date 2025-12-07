import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, BookOpen, PlusCircle, BarChart2, Settings, 
  Trash2, Edit2, Download, Moon, Sun, Search, X, Wallet, TrendingUp, TrendingDown 
} from 'lucide-react';
import { Card, Button, Input, Select, Textarea, Modal } from './components/Shared';
import { EquityChart, DailyPLChart, WinRatePieChart } from './components/Charts';
import { Trade, TradeFormData, ViewState, KPI } from './types';
import { formatCurrency, formatDate } from './constants';
import * as dbService from './services/firebase';

const DEFAULT_SIMPLE_FORM: TradeFormData = {
  dateStr: new Date().toISOString().split('T')[0],
  pair: '',
  position: 'Buy',
  lot: 0.01,
  profit: 0,
  notes: '',
};

const App: React.FC = () => {
  // State
  const [view, setView] = useState<ViewState>('dashboard');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [initialCapital, setInitialCapital] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  
  // Form State
  const [formData, setFormData] = useState<TradeFormData>(DEFAULT_SIMPLE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [newCapitalInput, setNewCapitalInput] = useState('');

  // Journal Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPair, setFilterPair] = useState('');
  const [filterResult, setFilterResult] = useState('');

  // Initial Fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [tradesData, settingsData] = await Promise.all([
          dbService.getTrades(200),
          dbService.getSettings()
        ]);
        setTrades(tradesData);
        setInitialCapital(settingsData.initialCapital);
        setError(null);
      } catch (err) {
        setError("Failed to load data.");
      } finally {
        setLoading(false);
      }
    };
    init();

    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Theme Toggle
  const toggleTheme = () => {
    setDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem('theme', newVal ? 'dark' : 'light');
      if (newVal) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return newVal;
    });
  };

  const fetchTrades = async () => {
    try {
      const data = await dbService.getTrades(200);
      setTrades(data);
    } catch (err) {
      console.error(err);
    }
  };

  // KPIs
  const kpi = useMemo((): KPI => {
    if (trades.length === 0) return { 
      totalTrades: 0, wins: 0, losses: 0, breakEven: 0, 
      totalProfit: 0, winRate: 0, avgProfit: 0, avgLoss: 0, 
      bestPair: '-', worstPair: '-', currentBalance: initialCapital 
    };
    
    const wins = trades.filter(t => t.result === 'Win');
    const losses = trades.filter(t => t.result === 'Loss');
    const breakEven = trades.filter(t => t.result === 'BreakEven');
    const totalProfit = trades.reduce((acc, t) => acc + t.profit, 0);
    
    // Best/Worst Pair
    const pairProfits: Record<string, number> = {};
    trades.forEach(t => {
      pairProfits[t.pair] = (pairProfits[t.pair] || 0) + t.profit;
    });
    const pairs = Object.entries(pairProfits);
    const bestPair = pairs.length ? pairs.sort((a, b) => b[1] - a[1])[0][0] : '-';
    const worstPair = pairs.length ? pairs.sort((a, b) => a[1] - b[1])[0][0] : '-';

    return {
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      breakEven: breakEven.length,
      totalProfit,
      winRate: (wins.length / trades.length) * 100,
      avgProfit: wins.length ? wins.reduce((a, t) => a + t.profit, 0) / wins.length : 0,
      avgLoss: losses.length ? losses.reduce((a, t) => a + t.profit, 0) / losses.length : 0,
      bestPair,
      worstPair,
      currentBalance: initialCapital + totalProfit
    };
  }, [trades, initialCapital]);

  // Actions
  const handleSaveTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Determine Result based on simple Profit input
    let result: 'Win' | 'Loss' | 'BreakEven' = 'BreakEven';
    if (formData.profit > 0) result = 'Win';
    else if (formData.profit < 0) result = 'Loss';

    const tradeData: Omit<Trade, 'id' | 'createdAt'> = {
      date: new Date(formData.dateStr).getTime(),
      pair: formData.pair.toUpperCase(),
      position: formData.position,
      lot: formData.lot,
      profit: formData.profit, // Direct input
      result: result,
      notes: formData.notes,
      entry: 0, // Not used in simple mode
      exit: 0, // Not used in simple mode
      stopLoss: null,
      takeProfit: null
    };
    
    try {
      if (editingId) {
        // Optimistic Update
        setTrades(prev => prev.map(t => t.id === editingId ? { ...t, ...tradeData, id: editingId } : t));
        await dbService.updateTrade(editingId, tradeData);
        setView('journal');
      } else {
        // Optimistic Add
        const tempId = 'temp-' + Date.now();
        const newTrade = { ...tradeData, id: tempId };
        setTrades(prev => [newTrade as Trade, ...prev]);

        const id = await dbService.addTrade(tradeData);
        setTrades(prev => prev.map(t => t.id === tempId ? { ...t, id } : t));
        
        setFormData(DEFAULT_SIMPLE_FORM);
        setView('dashboard');
      }
    } catch (err) {
      console.error(err);
      setError("Failed to save trade.");
      fetchTrades();
    } finally {
      setIsSubmitting(false);
      setEditingId(null);
    }
  };

  const handleEditClick = (trade: Trade) => {
    const dateStr = new Date(trade.date).toISOString().split('T')[0];
    setFormData({
      dateStr,
      pair: trade.pair,
      position: trade.position,
      lot: trade.lot,
      profit: trade.profit,
      notes: trade.notes,
    });
    setEditingId(trade.id || null);
    setView('add');
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      setTrades(prev => prev.filter(t => t.id !== deleteTargetId));
      await dbService.deleteTrade(deleteTargetId);
    } catch (err) {
      setError("Failed to delete trade.");
      fetchTrades();
    } finally {
      setShowDeleteModal(false);
      setDeleteTargetId(null);
    }
  };

  const handleUpdateCapital = async () => {
    const cap = parseFloat(newCapitalInput);
    if (isNaN(cap)) return;
    
    try {
      setInitialCapital(cap);
      await dbService.saveSettings({ initialCapital: cap });
      setShowCapitalModal(false);
    } catch (error) {
      setError("Failed to update capital");
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Pair', 'Position', 'Lot', 'Profit', 'Result', 'Notes'];
    const rows = trades.map(t => [
      formatDate(t.date),
      t.pair,
      t.position,
      t.lot,
      t.profit,
      t.result,
      `"${t.notes.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_export.csv`;
    a.click();
  };

  const handleResetData = async () => {
    if (confirm("Are you sure? This will delete ALL trades from the database!")) {
      setLoading(true);
      try {
        await dbService.deleteAllTrades();
        setTrades([]);
      } catch (err) {
        setError("Failed to reset data.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Filter Logic
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      const matchSearch = t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.notes.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPair = filterPair ? t.pair === filterPair : true;
      const matchResult = filterResult ? t.result === filterResult : true;
      return matchSearch && matchPair && matchResult;
    });
  }, [trades, searchTerm, filterPair, filterResult]);

  const uniquePairs = useMemo(() => Array.from(new Set(trades.map(t => t.pair))).sort(), [trades]);

  // Views
  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Capital & Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white dark:border-gray-700">
           <div className="flex justify-between items-start">
             <div>
               <div className="text-gray-400 text-sm mb-1">Current Balance</div>
               <div className="text-3xl font-bold">{formatCurrency(kpi.currentBalance)}</div>
               <div className={`text-sm mt-2 flex items-center gap-1 ${kpi.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                 {kpi.totalProfit >= 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                 {formatCurrency(kpi.totalProfit)} ({((kpi.totalProfit / initialCapital) * 100).toFixed(1)}%)
               </div>
             </div>
             <Wallet className="text-gray-600" size={32} />
           </div>
        </Card>
        
        <Card className="relative">
           <div className="flex justify-between items-start">
             <div>
               <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Initial Capital</div>
               <div className="text-2xl font-bold dark:text-white">{formatCurrency(initialCapital)}</div>
             </div>
             <Button variant="secondary" className="!p-2" onClick={() => {
               setNewCapitalInput(initialCapital.toString());
               setShowCapitalModal(true);
             }}>
               <Edit2 size={16} />
             </Button>
           </div>
           <div className="mt-4 text-sm text-gray-500">
             Start: {formatCurrency(initialCapital)} → Now: {formatCurrency(kpi.currentBalance)}
           </div>
        </Card>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
           <div className="text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">Total Trades</div>
           <div className="text-2xl font-bold mt-1 dark:text-white">{kpi.totalTrades}</div>
        </Card>
        <Card>
           <div className="text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">Win Rate</div>
           <div className="text-2xl font-bold mt-1 text-blue-500">{kpi.winRate.toFixed(1)}%</div>
        </Card>
        <Card>
           <div className="text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">Wins</div>
           <div className="text-2xl font-bold mt-1 text-green-500">{kpi.wins}</div>
        </Card>
        <Card>
           <div className="text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">Losses</div>
           <div className="text-2xl font-bold mt-1 text-red-500">{kpi.losses}</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Equity Curve">
          <EquityChart trades={trades} />
        </Card>
        <Card title="Daily P/L">
          <DailyPLChart trades={trades} />
        </Card>
      </div>
    </div>
  );

  const renderJournal = () => (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      {/* Filters */}
      <Card className="flex flex-col md:flex-row gap-4 p-4 sticky top-0 z-10">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search pair or notes..." 
            className="pl-10 w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white"
            value={filterPair}
            onChange={(e) => setFilterPair(e.target.value)}
          >
            <option value="">All Pairs</option>
            {uniquePairs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select 
             className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white"
             value={filterResult}
             onChange={(e) => setFilterResult(e.target.value)}
          >
            <option value="">All Results</option>
            <option value="Win">Win</option>
            <option value="Loss">Loss</option>
          </select>
        </div>
      </Card>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {filteredTrades.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No trades found.</div>
        ) : (
          <div className="grid gap-3">
            {filteredTrades.map(trade => (
              <div key={trade.id} className="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-200 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-bold text-lg dark:text-white">{trade.pair}</div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      trade.result === 'Win' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      trade.result === 'Loss' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {trade.result}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{formatDate(trade.date)}</span>
                    <span className={trade.position === 'Buy' ? 'text-blue-500' : 'text-orange-500'}>{trade.position}</span>
                    <span>{trade.lot} lots</span>
                  </div>
                  {trade.notes && (
                    <div className="text-xs text-gray-400 mt-1 line-clamp-1">{trade.notes}</div>
                  )}
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t md:border-t-0 border-gray-100 dark:border-gray-700 pt-3 md:pt-0">
                   <div className={`text-xl font-bold ${trade.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                     {trade.profit > 0 ? '+' : ''}{formatCurrency(trade.profit)}
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => handleEditClick(trade)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
                       <Edit2 size={18} />
                     </button>
                     <button onClick={() => handleDeleteClick(trade.id!)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                       <Trash2 size={18} />
                     </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAddForm = () => {
    return (
      <div className="max-w-xl mx-auto animate-fade-in pb-20">
        <Card title={editingId ? "Edit Trade" : "Quick Add Trade"}>
          <form onSubmit={handleSaveTrade} className="space-y-6">
            
            {/* Row 1: Date & Pair */}
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Date" 
                type="date" 
                required
                value={formData.dateStr}
                onChange={e => setFormData({...formData, dateStr: e.target.value})}
              />
              <Input 
                label="Pair" 
                placeholder="XAUUSD" 
                required
                value={formData.pair}
                onChange={e => setFormData({...formData, pair: e.target.value.toUpperCase()})}
              />
            </div>

            {/* Row 2: Position, Lot, Profit */}
            <div className="grid grid-cols-2 gap-4">
              <Select 
                label="Position"
                value={formData.position}
                onChange={e => setFormData({...formData, position: e.target.value as 'Buy' | 'Sell'})}
              >
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
              </Select>

              <Input 
                label="Lot Size" 
                type="number" step="0.01" 
                required
                value={formData.lot}
                onChange={e => setFormData({...formData, lot: parseFloat(e.target.value)})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Profit / Loss ($)
              </label>
              <input 
                type="number" 
                step="0.01" 
                required
                className={`w-full px-3 py-3 text-lg font-bold bg-white dark:bg-gray-900 border rounded-lg outline-none focus:ring-2 transition-colors
                  ${formData.profit > 0 ? 'text-green-500 border-green-200 focus:ring-green-500' : 
                    formData.profit < 0 ? 'text-red-500 border-red-200 focus:ring-red-500' : 
                    'text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 focus:ring-primary-500'}`}
                placeholder="0.00"
                value={formData.profit || ''}
                onChange={e => setFormData({...formData, profit: parseFloat(e.target.value)})}
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter positive for Win (e.g., 45.50), negative for Loss (e.g., -20.00).
              </p>
            </div>

            <Textarea 
              label="Notes"
              rows={3}
              placeholder="Why did you take this trade?"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 h-12 text-lg" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingId ? 'Update Trade' : 'Save Trade'}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={() => {
                  setEditingId(null);
                  setFormData(DEFAULT_SIMPLE_FORM);
                  setView('journal');
                }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    );
  };

  const renderStats = () => (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900">
           <div className="text-3xl font-bold text-green-600 dark:text-green-400">{kpi.wins}</div>
           <div className="text-sm font-medium text-green-800 dark:text-green-300 mt-1">Total Wins</div>
        </Card>
        <Card className="flex flex-col items-center justify-center p-6 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900">
           <div className="text-3xl font-bold text-red-600 dark:text-red-400">{kpi.losses}</div>
           <div className="text-sm font-medium text-red-800 dark:text-red-300 mt-1">Total Losses</div>
        </Card>
      </div>

      <Card title="Monthly Performance">
        <DailyPLChart trades={trades} />
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Win Rate">
          <WinRatePieChart trades={trades} />
        </Card>
        <Card title="Detailed Insights">
          <ul className="space-y-3 divide-y divide-gray-100 dark:divide-gray-800">
             <li className="py-2 flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Net Profit</span>
                <span className={`font-bold ${kpi.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(kpi.totalProfit)}</span>
             </li>
             <li className="py-2 flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Avg Win</span>
                <span className="font-bold text-green-500">{formatCurrency(kpi.avgProfit)}</span>
             </li>
             <li className="py-2 flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Avg Loss</span>
                <span className="font-bold text-red-500">{formatCurrency(Math.abs(kpi.avgLoss))}</span>
             </li>
             <li className="py-2 flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Best Pair</span>
                <span className="font-bold text-blue-500">{kpi.bestPair}</span>
             </li>
             <li className="py-2 flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Worst Pair</span>
                <span className="font-bold text-orange-500">{kpi.worstPair}</span>
             </li>
          </ul>
        </Card>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
       <Card title="Account Settings">
         <div className="flex justify-between items-center mb-6">
           <div>
             <div className="font-medium dark:text-white">Initial Capital</div>
             <div className="text-sm text-gray-500">Your starting balance.</div>
           </div>
           <div className="flex items-center gap-4">
             <span className="font-bold text-lg dark:text-white">{formatCurrency(initialCapital)}</span>
             <Button variant="secondary" onClick={() => {
                setNewCapitalInput(initialCapital.toString());
                setShowCapitalModal(true);
             }}>Edit</Button>
           </div>
         </div>
         <hr className="dark:border-gray-700 mb-6"/>
         <div className="flex items-center justify-between">
           <span className="dark:text-gray-300">Dark Mode</span>
           <button 
             onClick={toggleTheme}
             className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? 'bg-primary-600' : 'bg-gray-200'}`}
           >
             <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
           </button>
         </div>
       </Card>

       <Card title="Data Management">
         <div className="space-y-4">
           <div className="flex justify-between items-center">
              <div>
                <div className="font-medium dark:text-white">Export Data</div>
                <div className="text-sm text-gray-500">Download all trades as CSV.</div>
              </div>
              <Button variant="secondary" onClick={handleExportCSV}>
                <Download size={18} className="mr-2" /> Export
              </Button>
           </div>
           <hr className="dark:border-gray-700"/>
           <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-red-600">Reset Journal</div>
                <div className="text-sm text-gray-500">Permanently delete all trades.</div>
              </div>
              <Button variant="danger" onClick={handleResetData}>
                Reset All
              </Button>
           </div>
         </div>
       </Card>
    </div>
  );

  // Nav Logic
  const NavItem = ({ id, icon: Icon, label }: { id: ViewState, icon: any, label: string }) => (
    <button 
      onClick={() => {
        if(id === 'add') {
          setEditingId(null); 
          setFormData(DEFAULT_SIMPLE_FORM);
        }
        setView(id);
      }}
      className={`flex flex-col items-center justify-center w-full md:w-auto md:flex-row md:justify-start md:px-4 md:py-3 md:rounded-xl transition-all ${
        view === id || (id === 'add' && view === 'edit')
          ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400' 
          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'
      }`}
    >
      <Icon size={24} className="mb-1 md:mb-0 md:mr-3" />
      <span className="text-xs md:text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-dark-bg transition-colors duration-200 flex flex-col md:flex-row`}>
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border h-screen sticky top-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            TradeFlow
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="journal" icon={BookOpen} label="Journal" />
          <NavItem id="add" icon={PlusCircle} label="Add Trade" />
          <NavItem id="stats" icon={BarChart2} label="Analytics" />
          <NavItem id="settings" icon={Settings} label="Settings" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="md:hidden bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border p-4 flex justify-between items-center sticky top-0 z-20">
          <h1 className="text-xl font-bold dark:text-white">TradeFlow</h1>
          <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
             {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
              <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
                <X size={18} />
              </span>
            </div>
          )}
          
          {loading ? (
             <div className="flex items-center justify-center h-full">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
             </div>
          ) : (
            <>
              {view === 'dashboard' && renderDashboard()}
              {view === 'journal' && renderJournal()}
              {(view === 'add' || view === 'edit') && renderAddForm()}
              {view === 'stats' && renderStats()}
              {view === 'settings' && renderSettings()}
            </>
          )}
        </div>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border flex justify-around p-2 pb-safe z-30 shadow-lg">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Home" />
          <NavItem id="journal" icon={BookOpen} label="Journal" />
          <NavItem id="add" icon={PlusCircle} label="Add" />
          <NavItem id="stats" icon={BarChart2} label="Stats" />
          <NavItem id="settings" icon={Settings} label="More" />
        </div>
      </main>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Trade">
        <p className="text-gray-600 dark:text-gray-300 mb-6">Are you sure you want to delete this trade? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>

      {/* Capital Modal */}
      <Modal isOpen={showCapitalModal} onClose={() => setShowCapitalModal(false)} title="Set Initial Capital">
        <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">Enter your starting account balance. Your current balance will be calculated based on this plus your total profit.</p>
        <Input 
          type="number" 
          value={newCapitalInput} 
          onChange={(e) => setNewCapitalInput(e.target.value)}
          placeholder="e.g. 1000"
          className="mb-6"
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowCapitalModal(false)}>Cancel</Button>
          <Button onClick={handleUpdateCapital}>Save</Button>
        </div>
      </Modal>
    </div>
  );
};

export default App;