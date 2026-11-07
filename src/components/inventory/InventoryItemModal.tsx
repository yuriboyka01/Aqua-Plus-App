import React, { useState, useEffect } from 'react';
import { X, Package, ShieldCheck, AlertTriangle, Layers, MapPin, FileText } from 'lucide-react';
import {
  InventoryItem,
  InventoryCategory,
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABELS,
} from '../../types';

interface InventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>) => Promise<void>;
  itemToEdit?: InventoryItem | null;
}

export const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
}) => {
  const isEditing = !!itemToEdit;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('spun_filter');
  const [quantity, setQuantity] = useState(10);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [unitCost, setUnitCost] = useState(100);
  const [sellingPrice, setSellingPrice] = useState(180);
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setCategory(itemToEdit.category);
      setQuantity(itemToEdit.quantity);
      setLowStockThreshold(itemToEdit.lowStockThreshold);
      setUnitCost(itemToEdit.unitCost);
      setSellingPrice(itemToEdit.sellingPrice);
      setStorageLocation(itemToEdit.storageLocation || '');
      setNotes(itemToEdit.notes || '');
    } else {
      setName('');
      setCategory('spun_filter');
      setQuantity(10);
      setLowStockThreshold(5);
      setUnitCost(100);
      setSellingPrice(180);
      setStorageLocation('');
      setNotes('');
    }
    setErrorMessage(null);
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter an item or spare part name.');
      return;
    }

    if (quantity < 0) {
      setErrorMessage('Quantity cannot be negative.');
      return;
    }

    if (lowStockThreshold < 0) {
      setErrorMessage('Low stock threshold cannot be negative.');
      return;
    }

    if (unitCost < 0 || sellingPrice < 0) {
      setErrorMessage('Prices cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: trimmedName,
        category,
        quantity: Math.floor(quantity),
        lowStockThreshold: Math.floor(lowStockThreshold),
        unitCost: Math.round(unitCost * 100) / 100,
        sellingPrice: Math.round(sellingPrice * 100) / 100,
        storageLocation: storageLocation.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save inventory item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden my-6 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#163830] rounded-lg text-[#7EE787]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEditing ? 'Edit Spare Part' : 'Add New Inventory Item'}
              </h2>
              <p className="text-xs text-[#86AB9F]">
                {isEditing ? 'Update stock quantity, threshold, or pricing' : 'Record a new component or spare part in stock'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded-lg hover:bg-[#163830] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-130px)]">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Part Name */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2421] mb-1">
              Spare Part Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 10-inch PP Spun Filter (5 Micron)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0C231F] text-[#1F2421]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2421] mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0C231F] text-[#1F2421] appearance-none"
              >
                {INVENTORY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {INVENTORY_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
              <Layers className="w-4 h-4 text-[#8B8D8C] absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Quantity & Low Stock Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                Current Stock (Units) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 text-sm bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0C231F] text-[#1F2421] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                Low-Stock Alert Level <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 text-sm bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0C231F] text-[#1F2421] font-mono"
              />
            </div>
          </div>

          {/* Pricing: Unit Cost & Selling Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                Procurement Cost (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 text-sm bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0C231F] text-[#1F2421] font-mono"
              />
              <span className="text-[10px] text-[#5C6E67]">Purchase / wholesale price</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F2421] mb-1">
                Customer Selling Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3 py-2 text-sm bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0C231F] text-[#1F2421] font-mono"
              />
              <span className="text-[10px] text-[#5C6E67]">Service / retail price</span>
            </div>
          </div>

          {/* Storage Location */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2421] mb-1">
              Storage Location / Bin
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Rack A-02, Shelf 3, Service Van 1"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0C231F] text-[#1F2421]"
              />
              <MapPin className="w-4 h-4 text-[#8B8D8C] absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2421] mb-1">
              Notes & Compatibility
            </label>
            <div className="relative">
              <textarea
                rows={2}
                placeholder="e.g. Fits all standard 10-inch pre-filter bowls, 75 GPD Dow Filmtec compatible"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 text-sm bg-white border border-[#DDD6C5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0C231F] text-[#1F2421]"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#DDD6C5]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#5C6E67] hover:text-[#1F2421] bg-white border border-[#DDD6C5] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-[#FAF8F3] bg-[#0C231F] hover:bg-[#163830] disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-[#7EE787]" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
