import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Download,
  User,
  Phone,
  Calendar,
  IndianRupee,
  Package,
  Receipt,
  Sparkles,
  Check,
  Clock,
} from 'lucide-react';
import {
  InventoryItem,
  WholesaleSale,
  WholesaleSaleInput,
  WholesaleSaleLineItem,
  PaymentStatus,
  INVENTORY_CATEGORY_LABELS,
} from '../types';
import { WholesaleSaleResult } from '../services/dbService';
import { getTodayKolkata, formatDisplayDate } from '../utils/dateUtils';
import { exportWholesaleSalesToCsv } from '../utils/csvExport';

interface WholesaleSalesPageProps {
  inventory: InventoryItem[];
  wholesaleSales: WholesaleSale[];
  onRecordSale: (sale: WholesaleSaleInput) => Promise<WholesaleSaleResult>;
  onUpdatePaymentStatus: (saleId: string, status: PaymentStatus) => Promise<void>;
  initialSearch?: string;
}

interface DraftLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

export const WholesaleSalesPage: React.FC<WholesaleSalesPageProps> = ({
  inventory,
  wholesaleSales,
  onRecordSale,
  onUpdatePaymentStatus,
  initialSearch = '',
}) => {
  const today = getTodayKolkata();

  // Quick Sale Form State
  const [technicianName, setTechnicianName] = useState('');
  const [technicianPhone, setTechnicianPhone] = useState('');
  const [saleDate, setSaleDate] = useState(today);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [notes, setNotes] = useState('');

  const [partSearch, setPartSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);

  // Custom bill total per bill
  const [useCustomTotal, setUseCustomTotal] = useState(false);
  const [customTotalInput, setCustomTotalInput] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    billNumber: string;
    technicianName: string;
    totalAmount: number;
    stockChanges: WholesaleSaleResult['stockChanges'];
  } | null>(null);

  // Ledger Filter State
  const [ledgerSearch, setLedgerSearch] = useState(initialSearch);
  const [ledgerPaymentFilter, setLedgerPaymentFilter] = useState<string>('all');
  const [updatingSaleId, setUpdatingSaleId] = useState<string | null>(null);

  React.useEffect(() => {
    setLedgerSearch(initialSearch);
  }, [initialSearch]);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const item of inventory) {
      map.set(item.id, item);
    }
    return map;
  }, [inventory]);

  // Recent technician quick-fill chips derived from past bills
  const recentTechnicians = useMemo(() => {
    const seen = new Map<string, { name: string; phone?: string }>();
    for (const sale of wholesaleSales) {
      const key = sale.technicianName.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.set(key, { name: sale.technicianName.trim(), phone: sale.technicianPhone });
      }
      if (seen.size >= 6) break;
    }
    return Array.from(seen.values());
  }, [wholesaleSales]);

  // Available spare parts in picker
  const filteredParts = useMemo(() => {
    return inventory.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (partSearch.trim()) {
        const q = partSearch.toLowerCase().trim();
        const catLabel = (INVENTORY_CATEGORY_LABELS[item.category] || '').toLowerCase();
        if (
          !item.name.toLowerCase().includes(q) &&
          !catLabel.includes(q) &&
          !(item.storageLocation || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [inventory, partSearch, selectedCategory]);

  // Categories present in inventory for quick filter chips
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach((i) => cats.add(i.category));
    return Array.from(cats);
  }, [inventory]);

  // Resolved draft line items with live inventory info
  const resolvedDraftItems = useMemo(() => {
    return draftLines
      .map((line) => {
        const inv = inventoryMap.get(line.itemId);
        if (!inv) return null;
        const lineTotal = Math.max(0, line.quantity * (Number(line.unitPrice) || 0));
        return {
          ...line,
          inv,
          lineTotal,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [draftLines, inventoryMap]);

  const calculatedSubtotal = useMemo(
    () => resolvedDraftItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [resolvedDraftItems]
  );

  const totalUnitsInBill = useMemo(
    () => resolvedDraftItems.reduce((sum, item) => sum + item.quantity, 0),
    [resolvedDraftItems]
  );

  const finalBillAmount = useMemo(() => {
    if (!useCustomTotal) return calculatedSubtotal;
    const parsed = parseFloat(customTotalInput);
    return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [useCustomTotal, customTotalInput, calculatedSubtotal]);

  // KPI metrics
  const metrics = useMemo(() => {
    let todayBills = 0;
    let totalUnitsSold = 0;
    let collectedAmount = 0;
    let pendingAmount = 0;

    for (const sale of wholesaleSales) {
      if (sale.saleDate === today) todayBills++;
      totalUnitsSold += Number(sale.totalUnits) || 0;
      const amt = Number(sale.totalAmount) || 0;
      if (sale.paymentStatus === 'Paid') {
        collectedAmount += amt;
      } else {
        pendingAmount += amt;
      }
    }

    return {
      totalBills: wholesaleSales.length,
      todayBills,
      totalUnitsSold,
      collectedAmount,
      pendingAmount,
    };
  }, [wholesaleSales, today]);

  // Filtered ledger
  const filteredSales = useMemo(() => {
    return wholesaleSales.filter((sale) => {
      if (ledgerPaymentFilter !== 'all' && sale.paymentStatus !== ledgerPaymentFilter) {
        return false;
      }
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase().trim();
        const matchesTech = sale.technicianName.toLowerCase().includes(q);
        const matchesPhone = (sale.technicianPhone || '').toLowerCase().includes(q);
        const matchesBill = sale.billNumber.toLowerCase().includes(q);
        const matchesPart = sale.items.some((it) => it.itemName.toLowerCase().includes(q));
        if (!matchesTech && !matchesPhone && !matchesBill && !matchesPart) return false;
      }
      return true;
    });
  }, [wholesaleSales, ledgerPaymentFilter, ledgerSearch]);

  // Handlers
  const handleAddPart = (item: InventoryItem) => {
    setFormError(null);
    setLastResult(null);
    if (item.quantity <= 0) {
      setFormError(`"${item.name}" is out of stock (0 left). Restock it in Inventory first.`);
      return;
    }

    setDraftLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        if (existing.quantity >= item.quantity) {
          setFormError(`Only ${item.quantity} unit(s) of "${item.name}" available in stock.`);
          return prev;
        }
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          quantity: 1,
          unitPrice: Math.max(0, Number(item.sellingPrice) || 0),
        },
      ];
    });
  };

  const handleStepQuantity = (itemId: string, delta: number) => {
    setFormError(null);
    const inv = inventoryMap.get(itemId);
    if (!inv) return;

    setDraftLines((prev) => {
      const existing = prev.find((l) => l.itemId === itemId);
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((l) => l.itemId !== itemId);
      }
      if (nextQty > inv.quantity) {
        setFormError(`Only ${inv.quantity} unit(s) of "${inv.name}" available in stock.`);
        return prev;
      }
      return prev.map((l) => (l.itemId === itemId ? { ...l, quantity: nextQty } : l));
    });
  };

  const handleSetLinePrice = (itemId: string, rawValue: string) => {
    const val = rawValue === '' ? 0 : Math.max(0, parseFloat(rawValue) || 0);
    setDraftLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, unitPrice: val } : l))
    );
  };

  const handleRemoveLine = (itemId: string) => {
    setDraftLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const handleToggleCustomTotal = (enabled: boolean) => {
    setUseCustomTotal(enabled);
    if (enabled && !customTotalInput) {
      setCustomTotalInput(String(calculatedSubtotal));
    }
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLastResult(null);

    if (!technicianName.trim()) {
      setFormError('Enter the technician or buyer name.');
      return;
    }
    if (resolvedDraftItems.length === 0) {
      setFormError('Tap at least one spare part from the list to add to this bill.');
      return;
    }

    const lineItems: WholesaleSaleLineItem[] = resolvedDraftItems.map((entry) => ({
      itemId: entry.inv.id,
      itemName: entry.inv.name,
      category: entry.inv.category,
      quantity: entry.quantity,
      unitPrice: Math.max(0, Number(entry.unitPrice) || 0),
      lineTotal: entry.lineTotal,
    }));

    const payload: WholesaleSaleInput = {
      saleDate,
      technicianName: technicianName.trim(),
      technicianPhone: technicianPhone.trim() || undefined,
      items: lineItems,
      totalUnits: totalUnitsInBill,
      subtotal: calculatedSubtotal,
      isCustomTotal: useCustomTotal,
      totalAmount: finalBillAmount,
      paymentStatus,
      notes: notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const result = await onRecordSale(payload);
      setLastResult({
        billNumber: result.billNumber,
        technicianName: payload.technicianName,
        totalAmount: payload.totalAmount,
        stockChanges: result.stockChanges,
      });
      // Reset quick-sale cart for the next technician while keeping workflow snappy
      setTechnicianName('');
      setTechnicianPhone('');
      setDraftLines([]);
      setUseCustomTotal(false);
      setCustomTotalInput('');
      setNotes('');
      setPaymentStatus('Paid');
      setSaleDate(getTodayKolkata());
    } catch (err: any) {
      const raw = err instanceof Error ? err.message : String(err || 'Could not complete wholesale sale. Please try again.');
      let friendly = raw;
      if (raw.startsWith('{') && raw.includes('"error"')) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.error) {
            friendly = parsed.path
              ? `${parsed.error} (${parsed.operationType || 'write'} on ${parsed.path})`
              : String(parsed.error);
          }
        } catch {
          // Keep raw message if JSON parse fails
        }
      }
      setFormError(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (sale: WholesaleSale) => {
    setUpdatingSaleId(sale.id);
    try {
      await onUpdatePaymentStatus(sale.id, 'Paid');
    } finally {
      setUpdatingSaleId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5DEC9] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#C25E00] font-bold uppercase tracking-wider font-mono-data mb-1">
            <span>Counter & Wholesale Dispatch</span>
          </div>
          <h1 className="font-editorial text-2xl font-bold text-[#1B2421] tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-[#0C231F]" />
            <span>Technician Wholesale Sales</span>
          </h1>
          <p className="text-xs text-[#5C6E67] mt-0.5">
            Fast counter billing with custom per-bill pricing and automatic real-time inventory deduction.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportWholesaleSalesToCsv(filteredSales)}
          disabled={filteredSales.length === 0}
          className="px-3.5 py-2 bg-[#F4F0E6] hover:bg-[#EDE7DA] disabled:opacity-40 text-[#1B2421] text-xs font-semibold rounded-lg border border-[#DDD6C5] flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-[#165B50]" />
          <span>Export Wholesale CSV</span>
        </button>
      </div>

      {/* KPI Strip */}
      <section className="bg-[#0C231F] text-[#FAF8F3] rounded-xl p-4 sm:p-5 border border-[#1A3D35] flex flex-wrap items-center justify-between gap-5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-6 sm:gap-10 text-xs">
          <div>
            <span className="text-[11px] text-[#86AB9F] block">Bills Today / Total</span>
            <span className="font-mono-data text-xl font-bold text-[#FAF8F3]">
              {metrics.todayBills} <span className="text-sm font-normal text-[#86AB9F]">/ {metrics.totalBills}</span>
            </span>
          </div>

          <div className="w-px h-8 bg-[#1C3E37] hidden sm:block" />

          <div>
            <span className="text-[11px] text-[#86AB9F] block">Parts Dispatched</span>
            <span className="font-mono-data text-xl font-bold text-[#FAF8F3]">
              {metrics.totalUnitsSold}
            </span>
            <span className="text-[10px] text-[#86AB9F] ml-1.5">units</span>
          </div>

          <div className="w-px h-8 bg-[#1C3E37] hidden sm:block" />

          <div>
            <span className="text-[11px] text-[#86AB9F] block">Wholesale Collected</span>
            <span className="font-mono-data text-xl font-bold text-[#7EE787]">
              ₹{metrics.collectedAmount.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="w-px h-8 bg-[#1C3E37] hidden sm:block" />

          <div>
            <span className="text-[11px] text-[#86AB9F] block">Pending / Partial</span>
            <span className="font-mono-data text-xl font-bold text-[#F6D285]">
              ₹{metrics.pendingAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </section>

      {/* Success Toast / Stock Deduction Receipt */}
      {lastResult && (
        <div
          role="status"
          className="p-4 bg-[#EBF7F2] border border-[#A7DFC3] rounded-xl text-xs text-[#0C231F] space-y-2 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#125343]">
              <CheckCircle2 className="w-4 h-4 text-[#16795E] shrink-0" />
              <span>
                Bill {lastResult.billNumber} saved for {lastResult.technicianName} — ₹
                {lastResult.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLastResult(null)}
              className="text-[11px] font-bold text-[#165B50] hover:underline"
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {lastResult.stockChanges.map((sc) => (
              <span
                key={sc.itemId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#C6EAD8] rounded-md font-mono-data text-[11px]"
              >
                <Package className="w-3 h-3 text-[#16795E]" />
                <span>
                  {sc.itemName}: <strong>-{sc.deducted}</strong> ({sc.previousQuantity} →{' '}
                  <strong>{sc.newQuantity}</strong> left)
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Split Workspace: Quick Sale Builder (Left) + Spare Parts Tap Grid (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Tap-to-Add Spare Parts Picker */}
        <div className="lg:col-span-7 bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-editorial text-lg font-bold text-[#1B2421]">
                1. Tap Spare Parts to Add
              </h2>
              <p className="text-[11px] text-[#5C6E67]">
                Tap any part to add 1 unit to the bill. Stock counts update live from inventory.
              </p>
            </div>
            <span className="text-[11px] font-mono-data text-[#5C6E67] bg-[#FAF8F3] px-2.5 py-1 rounded-md border border-[#E5DEC9]">
              {filteredParts.length} parts shown
            </span>
          </div>

          {/* Search Parts */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={partSearch}
              onChange={(e) => setPartSearch(e.target.value)}
              placeholder="Search membrane, spun filter, pump, bin..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#FAF8F3] border border-[#DDD6C5] rounded-xl focus:outline-none focus:border-[#0C231F] text-[#1B2421] placeholder:text-[#8C9B94]"
            />
          </div>

          {/* Category Filter Chips */}
          {availableCategories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-[#0C231F] text-[#FAF8F3]'
                    : 'bg-[#F4F0E6] text-[#5C6E67] hover:bg-[#EDE7DA]'
                }`}
              >
                All Parts
              </button>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#0C231F] text-[#FAF8F3]'
                      : 'bg-[#F4F0E6] text-[#5C6E67] hover:bg-[#EDE7DA]'
                  }`}
                >
                  {INVENTORY_CATEGORY_LABELS[cat as keyof typeof INVENTORY_CATEGORY_LABELS] || cat}
                </button>
              ))}
            </div>
          )}

          {/* Tap Grid */}
          {filteredParts.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#5C6E67] bg-[#FAF8F3] rounded-xl border border-dashed border-[#DDD6C5]">
              No matching spare parts found in inventory.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredParts.map((item) => {
                const draftEntry = draftLines.find((l) => l.itemId === item.id);
                const selectedQty = draftEntry?.quantity || 0;
                const remainingAfterBill = Math.max(0, item.quantity - selectedQty);
                const isOut = item.quantity <= 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isOut}
                    onClick={() => handleAddPart(item)}
                    className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 min-h-[88px] ${
                      isOut
                        ? 'bg-slate-50 border-slate-200 opacity-55 cursor-not-allowed'
                        : selectedQty > 0
                          ? 'bg-[#EBF7F2] border-[#165B50] ring-1 ring-[#165B50] shadow-xs active:scale-[0.99]'
                          : 'bg-[#FAF8F3] hover:bg-[#F4F0E6] border-[#E5DEC9] hover:border-[#C5BDAA] active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#1B2421] leading-snug line-clamp-2">
                        {item.name}
                      </span>
                      {selectedQty > 0 && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#0C231F] text-[#7EE787] font-mono-data text-[11px] font-bold">
                          ×{selectedQty}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span
                        className={`font-mono-data font-bold px-2 py-0.5 rounded ${
                          isOut
                            ? 'bg-rose-100 text-rose-700'
                            : remainingAfterBill <= item.lowStockThreshold
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-white text-[#165B50] border border-[#DDD6C5]'
                        }`}
                      >
                        {isOut ? 'Out of stock' : `${item.quantity} in stock`}
                      </span>
                      <span className="font-mono-data text-[#5C6E67] font-semibold">
                        List: ₹{(item.sellingPrice || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Quick Sale Bill Form */}
        <form
          onSubmit={handleSubmitSale}
          className="lg:col-span-5 bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-lg font-bold text-[#1B2421] flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#C25E00]" />
              <span>2. Quick Sale Bill</span>
            </h2>
            {draftLines.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDraftLines([]);
                  setUseCustomTotal(false);
                  setCustomTotalInput('');
                }}
                className="text-[11px] font-semibold text-rose-600 hover:underline"
              >
                Clear bill
              </button>
            )}
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Technician Details */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#2D3733] mb-1">
                Technician / Buyer Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="e.g. Karthik, Mani RO Tech..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#FAF8F3] border border-[#DDD6C5] rounded-xl focus:outline-none focus:border-[#0C231F]"
                />
              </div>

              {recentTechnicians.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {recentTechnicians.map((tech) => (
                    <button
                      key={tech.name}
                      type="button"
                      onClick={() => {
                        setTechnicianName(tech.name);
                        if (tech.phone) setTechnicianPhone(tech.phone);
                      }}
                      className="px-2 py-1 text-[11px] bg-[#F4F0E6] hover:bg-[#E5DEC9] text-[#1B2421] rounded-md border border-[#DDD6C5] transition-colors"
                    >
                      {tech.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-[#2D3733] mb-1">
                  Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={technicianPhone}
                    onChange={(e) => setTechnicianPhone(e.target.value)}
                    placeholder="98421..."
                    className="w-full pl-8 pr-2.5 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-xl focus:outline-none focus:border-[#0C231F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#2D3733] mb-1">
                  Sale Date
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-xl focus:outline-none focus:border-[#0C231F]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Selected Spare Parts Cart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#2D3733]">
              <span>Selected Parts ({totalUnitsInBill} units)</span>
              <span className="text-[#5C6E67] font-normal">Edit price per item or total below</span>
            </div>

            {resolvedDraftItems.length === 0 ? (
              <div className="p-5 text-center text-xs text-[#5C6E67] bg-[#FAF8F3] rounded-xl border border-dashed border-[#DDD6C5]">
                Tap parts on the left to add them to this bill.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {resolvedDraftItems.map(({ inv, quantity, unitPrice, lineTotal }) => (
                  <div
                    key={inv.id}
                    className="p-2.5 bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1B2421] truncate">{inv.name}</p>
                        <p className="text-[10px] font-mono-data text-[#5C6E67]">
                          Stock: {inv.quantity} → {inv.quantity - quantity} after sale
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(inv.id)}
                        className="p-1 text-[#8C9B94] hover:text-rose-600 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {/* Stepper */}
                      <div className="inline-flex items-center bg-white border border-[#DDD6C5] rounded-lg">
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(inv.id, -1)}
                          className="p-1.5 text-[#1B2421] hover:bg-[#F4F0E6] rounded-l-lg"
                          aria-label={`Decrease ${inv.name}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 font-mono-data text-xs font-bold text-[#1B2421]">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(inv.id, 1)}
                          disabled={quantity >= inv.quantity}
                          className="p-1.5 text-[#1B2421] hover:bg-[#F4F0E6] disabled:opacity-40 rounded-r-lg"
                          aria-label={`Increase ${inv.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Custom Unit Price */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#5C6E67]">₹/unit</span>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={unitPrice}
                          onChange={(e) => handleSetLinePrice(inv.id, e.target.value)}
                          className="w-20 px-2 py-1 text-xs font-mono-data font-bold text-right bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:border-[#0C231F]"
                        />
                        <span className="font-mono-data text-xs font-bold text-[#0C231F] min-w-[54px] text-right">
                          ₹{lineTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Price Per Bill + Payment Status */}
          <div className="p-3.5 bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#5C6E67]">Items Subtotal</span>
              <span className="font-mono-data font-semibold text-[#1B2421]">
                ₹{calculatedSubtotal.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#1B2421] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomTotal}
                  onChange={(e) => handleToggleCustomTotal(e.target.checked)}
                  className="rounded border-[#C5BDAA] text-[#0C231F] focus:ring-[#0C231F]"
                />
                <span>Use custom price for this bill</span>
              </label>

              {useCustomTotal && (
                <div className="relative w-32">
                  <IndianRupee className="w-3.5 h-3.5 text-[#5C6E67] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={customTotalInput}
                    onChange={(e) => setCustomTotalInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-2.5 py-1.5 text-sm font-mono-data font-bold text-right bg-white border border-[#0C231F] rounded-lg focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#DDD6C5] flex items-center justify-between">
              <span className="text-xs font-bold text-[#1B2421]">Final Bill Total</span>
              <span className="font-mono-data text-xl font-bold text-[#0C231F]">
                ₹{finalBillAmount.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Payment Status Pills */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(['Paid', 'Pending', 'Partial'] as PaymentStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setPaymentStatus(status)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                    paymentStatus === status
                      ? status === 'Paid'
                        ? 'bg-[#0C231F] text-[#7EE787] border-[#0C231F]'
                        : status === 'Pending'
                          ? 'bg-[#C25E00] text-white border-[#C25E00]'
                          : 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-[#5C6E67] border-[#DDD6C5] hover:bg-[#FAF8F3]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note (e.g. GPay / cash / site reference)..."
              maxLength={500}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-xl focus:outline-none focus:border-[#0C231F]"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || resolvedDraftItems.length === 0}
            className="w-full py-3 px-4 bg-[#0C231F] hover:bg-[#163830] disabled:opacity-45 text-[#FAF8F3] text-sm font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Sparkles className="w-4 h-4 text-[#7EE787]" />
            <span>
              {submitting
                ? 'Saving Bill & Updating Stock...'
                : `Complete Sale & Deduct Stock (₹${finalBillAmount.toLocaleString('en-IN')})`}
            </span>
          </button>
        </form>
      </div>

      {/* Wholesale Sales History Ledger */}
      <section className="bg-white border border-[#E5DEC9] rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="font-editorial text-lg font-bold text-[#1B2421]">
              Recent Technician Wholesale Bills
            </h2>
            <p className="text-[11px] text-[#5C6E67]">
              Every bill automatically deducted from store inventory.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search technician, bill #, part..."
                className="w-full sm:w-60 pl-8 pr-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-lg focus:outline-none focus:border-[#0C231F]"
              />
            </div>

            <select
              value={ledgerPaymentFilter}
              onChange={(e) => setLedgerPaymentFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-lg text-[#1B2421] font-medium focus:outline-none focus:border-[#0C231F]"
            >
              <option value="all">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
            </select>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#5C6E67] bg-[#FAF8F3] rounded-xl border border-dashed border-[#DDD6C5]">
            No wholesale bills recorded yet. Use the quick sale form above to log your first technician dispatch.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredSales.map((sale) => (
              <div
                key={sale.id}
                className="p-3.5 bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-data text-xs font-bold text-[#0C231F] bg-white px-2 py-0.5 rounded border border-[#DDD6C5]">
                      {sale.billNumber}
                    </span>
                    <span className="text-sm font-bold text-[#1B2421]">{sale.technicianName}</span>
                    {sale.technicianPhone && (
                      <span className="text-xs font-mono-data text-[#5C6E67]">
                        · {sale.technicianPhone}
                      </span>
                    )}
                    <span className="text-[11px] text-[#5C6E67]">
                      · {formatDisplayDate(sale.saleDate)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {sale.items.map((item, idx) => (
                      <span
                        key={`${sale.id}_${item.itemId}_${idx}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#E5DEC9] rounded text-[11px] text-[#2D3733]"
                      >
                        <strong className="font-mono-data text-[#0C231F]">{item.quantity}×</strong>
                        <span>{item.itemName}</span>
                      </span>
                    ))}
                  </div>

                  {sale.notes && (
                    <p className="text-[11px] text-[#5C6E67] italic">{sale.notes}</p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-mono-data text-base font-bold text-[#0C231F]">
                      ₹{Number(sale.totalAmount).toLocaleString('en-IN')}
                    </div>
                    {sale.isCustomTotal && (
                      <span className="text-[10px] text-[#C25E00] font-semibold block">
                        Custom bill price (list ₹{Number(sale.subtotal).toLocaleString('en-IN')})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        sale.paymentStatus === 'Paid'
                          ? 'bg-[#EBF7F2] text-[#16795E] border border-[#C6EAD8]'
                          : sale.paymentStatus === 'Pending'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-orange-100 text-orange-800 border border-orange-200'
                      }`}
                    >
                      {sale.paymentStatus === 'Paid' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {sale.paymentStatus}
                    </span>

                    {sale.paymentStatus !== 'Paid' && (
                      <button
                        type="button"
                        disabled={updatingSaleId === sale.id}
                        onClick={() => handleMarkPaid(sale)}
                        className="px-2.5 py-1 bg-[#0C231F] hover:bg-[#163830] disabled:opacity-50 text-[#7EE787] text-[11px] font-bold rounded-lg transition-colors"
                      >
                        {updatingSaleId === sale.id ? '...' : 'Mark Paid'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
