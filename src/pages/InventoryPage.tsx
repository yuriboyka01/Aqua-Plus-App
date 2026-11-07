import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Camera,
  Search,
  Filter,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Layers,
  ArrowUpDown,
  MapPin,
  TrendingUp,
  Boxes,
  IndianRupee,
  ShieldCheck,
  ChevronRight,
  Minus,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryCategory,
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABELS,
  StockStatus,
  getStockStatus,
  STOCK_STATUS_LABELS,
} from '../types';
import { InventoryItemModal } from '../components/inventory/InventoryItemModal';
import { InventoryScanModal } from '../components/inventory/InventoryScanModal';

interface InventoryPageProps {
  inventory: InventoryItem[];
  onAddItem: (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>) => Promise<void>;
  onUpdateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  onAdjustQuantity: (id: string, delta: number, reason?: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  ownerId: string;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  inventory,
  onAddItem,
  onUpdateItem,
  onAdjustQuantity,
  onDeleteItem,
  ownerId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Compute KPI metrics
  const metrics = useMemo(() => {
    let totalUnits = 0;
    let totalProcurementValue = 0;
    let totalRetailValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of inventory) {
      const qty = Math.max(0, item.quantity);
      totalUnits += qty;
      totalProcurementValue += qty * (item.unitCost || 0);
      totalRetailValue += qty * (item.sellingPrice || 0);

      const status = getStockStatus(item);
      if (status === 'out_of_stock') {
        outOfStockCount++;
      } else if (status === 'low_stock') {
        lowStockCount++;
      }
    }

    return {
      totalSkus: inventory.length,
      totalUnits,
      totalProcurementValue,
      totalRetailValue,
      lowStockCount,
      outOfStockCount,
    };
  }, [inventory]);

  // Filter items
  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCategory = (INVENTORY_CATEGORY_LABELS[item.category] || '')
          .toLowerCase()
          .includes(query);
        const matchesLocation = (item.storageLocation || '').toLowerCase().includes(query);
        const matchesNotes = (item.notes || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCategory && !matchesLocation && !matchesNotes) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Stock status filter
      if (selectedStatus !== 'all') {
        const status = getStockStatus(item);
        if (status !== selectedStatus) {
          return false;
        }
      }

      return true;
    });
  }, [inventory, searchTerm, selectedCategory, selectedStatus]);

  const handleOpenAddModal = () => {
    setItemToEdit(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setItemToEdit(item);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (
    data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>
  ) => {
    if (itemToEdit) {
      await onUpdateItem(itemToEdit.id, data);
    } else {
      await onAddItem(data);
    }
  };

  const handleQuickAdjust = async (item: InventoryItem, delta: number) => {
    setActionError(null);
    try {
      if (item.quantity + delta < 0) {
        setActionError(`Cannot decrease ${item.name} below 0.`);
        return;
      }
      await onAdjustQuantity(
        item.id,
        delta,
        delta > 0 ? 'Quick stock increment' : 'Quick stock reduction'
      );
    } catch (err: any) {
      setActionError(err?.message || 'Failed to adjust stock quantity.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await onDeleteItem(itemToDelete.id);
      setItemToDelete(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete inventory item.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C25E00] font-mono-data">
              Spare Parts & Storage
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1F2421] tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-[#0C231F]" />
            <span>Inventory Management</span>
          </h1>
          <p className="text-xs text-[#5C6E67] mt-0.5">
            Track RO membranes, spun cartridges, booster pumps, and stock levels in real time
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsScanModalOpen(true)}
            className="px-4 py-2 bg-[#C25E00] hover:bg-[#A34F00] text-[#FAF8F3] text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-98"
          >
            <Camera className="w-4 h-4 text-[#FFD8B2]" />
            <span>📷 AI Photo Scan</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#0C231F] hover:bg-[#163830] text-[#FAF8F3] text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4 text-[#7EE787]" />
            <span>+ Add Part</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-bold text-red-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* SKUs */}
        <div className="p-3.5 bg-white rounded-xl border border-[#DDD6C5] shadow-xs">
          <div className="flex items-center justify-between text-[#5C6E67] mb-1">
            <span className="text-[11px] font-semibold">Total SKUs</span>
            <Boxes className="w-4 h-4 text-[#0C231F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2421]">{metrics.totalSkus}</div>
          <div className="text-[10px] text-[#8B8D8C]">Catalog part types</div>
        </div>

        {/* Total Units */}
        <div className="p-3.5 bg-white rounded-xl border border-[#DDD6C5] shadow-xs">
          <div className="flex items-center justify-between text-[#5C6E67] mb-1">
            <span className="text-[11px] font-semibold">Units in Stock</span>
            <Package className="w-4 h-4 text-[#0C231F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2421]">{metrics.totalUnits}</div>
          <div className="text-[10px] text-[#8B8D8C]">Available in store</div>
        </div>

        {/* Stock Value */}
        <div className="p-3.5 bg-white rounded-xl border border-[#DDD6C5] shadow-xs">
          <div className="flex items-center justify-between text-[#5C6E67] mb-1">
            <span className="text-[11px] font-semibold">Inventory Value</span>
            <IndianRupee className="w-4 h-4 text-[#0C231F]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#1F2421]">
            ₹{metrics.totalProcurementValue.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-[#8B8D8C]">Procurement cost</div>
        </div>

        {/* Low Stock Warning */}
        <div className={`p-3.5 rounded-xl border shadow-xs ${
          metrics.lowStockCount > 0 ? 'bg-[#FFF7ED] border-[#FDBA74]' : 'bg-white border-[#DDD6C5]'
        }`}>
          <div className="flex items-center justify-between text-[#C25E00] mb-1">
            <span className="text-[11px] font-semibold">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-[#C25E00]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#C25E00]">{metrics.lowStockCount}</div>
          <div className="text-[10px] text-[#8B8D8C]">Below reorder level</div>
        </div>

        {/* Out of Stock Warning */}
        <div className={`p-3.5 rounded-xl border shadow-xs col-span-2 lg:col-span-1 ${
          metrics.outOfStockCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-[#DDD6C5]'
        }`}>
          <div className="flex items-center justify-between text-red-600 mb-1">
            <span className="text-[11px] font-semibold">Out of Stock</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-bold font-mono text-red-600">{metrics.outOfStockCount}</div>
          <div className="text-[10px] text-[#8B8D8C]">Immediate restock needed</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#DDD6C5] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#8B8D8C] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search parts by name, category, or storage rack..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0C231F] text-[#1F2421]"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-full sm:w-56 shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0C231F] text-[#1F2421]"
            >
              <option value="all">All Categories ({inventory.length})</option>
              {INVENTORY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {INVENTORY_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="w-full sm:w-44 shrink-0">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0C231F] text-[#1F2421]"
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock Alerts</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Items List / Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#DDD6C5] p-12 text-center shadow-xs">
          <div className="w-12 h-12 mx-auto mb-3 bg-[#FAF8F3] text-[#8B8D8C] rounded-full flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#1F2421] mb-1">No inventory items found</h3>
          <p className="text-xs text-[#5C6E67] max-w-sm mx-auto mb-4">
            {searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all'
              ? 'No items match your active search or filters. Try adjusting your query.'
              : 'Your stock catalog is currently empty. Add spare parts manually or snap a photo of parts/invoices to get started.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-[#0C231F] text-[#FAF8F3] text-xs font-bold rounded-lg shadow-sm"
            >
              + Add Part
            </button>
            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="px-4 py-2 bg-[#C25E00] text-[#FAF8F3] text-xs font-bold rounded-lg shadow-sm"
            >
              📷 AI Photo Scan
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block bg-white rounded-xl border border-[#DDD6C5] overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F3] border-b border-[#DDD6C5] text-[11px] font-bold text-[#5C6E67] uppercase tracking-wider">
                  <th className="py-3 px-4">Item & Location</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-center">Stock Level</th>
                  <th className="py-3 px-3">Cost / Sell (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD6C5] text-xs">
                {filteredItems.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-[#FAF8F3]/60 transition-colors">
                      {/* Name & Location */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#1F2421]">{item.name}</div>
                        {item.storageLocation && (
                          <div className="text-[11px] text-[#5C6E67] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-[#8B8D8C]" />
                            <span>{item.storageLocation}</span>
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-[10px] text-[#8B8D8C] line-clamp-1 mt-0.5">
                            {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EAE6DC] text-[#0C231F]">
                          {INVENTORY_CATEGORY_LABELS[item.category] || item.category}
                        </span>
                      </td>

                      {/* Stock Level with Stepper */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-[#FAF8F3] px-2 py-1 rounded-lg border border-[#DDD6C5]">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, -1)}
                            disabled={item.quantity <= 0}
                            className="p-1 rounded hover:bg-white text-[#5C6E67] disabled:opacity-30 transition-colors"
                            title="Decrease quantity by 1"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-xs w-8 text-center text-[#1F2421]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, 1)}
                            className="p-1 rounded hover:bg-white text-[#5C6E67] transition-colors"
                            title="Increase quantity by 1"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[10px] text-[#8B8D8C] mt-0.5">
                          Threshold: {item.lowStockThreshold}
                        </div>
                      </td>

                      {/* Pricing */}
                      <td className="py-3 px-3 font-mono">
                        <div>
                          <span className="text-[#5C6E67] text-[10px]">Cost: </span>
                          <span className="font-bold text-[#1F2421]">₹{item.unitCost}</span>
                        </div>
                        <div>
                          <span className="text-[#5C6E67] text-[10px]">Sell: </span>
                          <span className="font-bold text-[#0C231F]">₹{item.sellingPrice}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {status === 'in_stock' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>In Stock</span>
                          </span>
                        )}
                        {status === 'low_stock' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF7ED] text-[#C25E00] border border-[#FDBA74]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Low Stock</span>
                          </span>
                        )}
                        {status === 'out_of_stock' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <AlertCircle className="w-3 h-3" />
                            <span>Out of Stock</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-[#5C6E67] hover:text-[#0C231F] rounded hover:bg-[#FAF8F3] transition-colors"
                            title="Edit details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 text-[#5C6E67] hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Delete item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (Visible on small screens) */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => {
              const status = getStockStatus(item);
              return (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-xl border border-[#DDD6C5] shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-[#1F2421]">{item.name}</div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EAE6DC] text-[#0C231F] mt-1">
                        {INVENTORY_CATEGORY_LABELS[item.category] || item.category}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {status === 'in_stock' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>In Stock</span>
                        </span>
                      )}
                      {status === 'low_stock' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF7ED] text-[#C25E00] border border-[#FDBA74]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Low</span>
                        </span>
                      )}
                      {status === 'out_of_stock' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                          <AlertCircle className="w-3 h-3" />
                          <span>Out</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock Stepper & Prices */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#F5F2EB]">
                    <div>
                      <span className="text-[10px] text-[#5C6E67] block">Cost: ₹{item.unitCost}</span>
                      <span className="text-xs font-bold text-[#0C231F]">Sell: ₹{item.sellingPrice}</span>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 bg-[#FAF8F3] px-2 py-1 rounded-lg border border-[#DDD6C5]">
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust(item, -1)}
                        disabled={item.quantity <= 0}
                        className="p-1.5 rounded hover:bg-white text-[#5C6E67] disabled:opacity-30"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-bold text-sm w-9 text-center text-[#1F2421]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjust(item, 1)}
                        className="p-1.5 rounded hover:bg-white text-[#5C6E67]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-2 text-[#5C6E67] hover:text-[#0C231F] rounded-lg hover:bg-[#FAF8F3]"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-2 text-[#5C6E67] hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      <InventoryItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        onSave={handleSaveItem}
        itemToEdit={itemToEdit}
      />

      {/* AI Vision Scanner Modal */}
      <InventoryScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        existingInventory={inventory}
        ownerId={ownerId}
        onScanComplete={() => {
          setIsScanModalOpen(false);
        }}
      />

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs">
          <div className="bg-[#FAF8F3] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#DDD6C5] space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-700 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2421]">Delete Spare Part</h3>
                <p className="text-xs text-[#5C6E67]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-[#1F2421]">
              Are you sure you want to remove <strong>{itemToDelete.name}</strong> ({itemToDelete.quantity} in stock) from inventory?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-semibold text-[#5C6E67] hover:text-[#1F2421]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
