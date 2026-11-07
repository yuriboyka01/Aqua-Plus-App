import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Check,
  AlertTriangle,
  RotateCw,
  Plus,
  ArrowRight,
  Layers,
  FileText,
  PackageCheck,
  HelpCircle,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryCategory,
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABELS,
  InventoryScanResult,
  ScannedItemSuggestion,
} from '../../types';
import { compressImage, formatFileSize, CompressedImageResult } from '../../utils/imageCompressor';
import { scanInventoryImage } from '../../services/apiService';
import { addInventoryItem, adjustInventoryQuantity } from '../../services/dbService';

interface InventoryScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingInventory: InventoryItem[];
  ownerId: string;
  onScanComplete: () => void;
}

export const InventoryScanModal: React.FC<InventoryScanModalProps> = ({
  isOpen,
  onClose,
  existingInventory,
  ownerId,
  onScanComplete,
}) => {
  if (!isOpen) return null;

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressedResult, setCompressedResult] = useState<CompressedImageResult | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanResult, setScanResult] = useState<InventoryScanResult | null>(null);
  const [editableItems, setEditableItems] = useState<(ScannedItemSuggestion & { selected: boolean })[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setCompressedResult(null);
    setIsProcessingImage(false);
    setIsScanning(false);
    setIsSaving(false);
    setScanResult(null);
    setEditableItems([]);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setSelectedFile(file);
    setIsProcessingImage(true);

    try {
      const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.85 });
      setCompressedResult(compressed);
      setImagePreview(compressed.dataUrl || null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process selected image.');
      setSelectedFile(null);
      setImagePreview(null);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void processFile(file);
    } else {
      setErrorMessage('Please drop an image file (JPEG, PNG, WebP).');
    }
  };

  const handleTriggerScan = async () => {
    if (!compressedResult) {
      setErrorMessage('Please select or capture a photo first.');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);

    try {
      const result = await scanInventoryImage(
        compressedResult.base64Data,
        compressedResult.mimeType
      );

      setScanResult(result);

      if (result.scanType === 'unrecognized' || result.items.length === 0) {
        setErrorMessage(
          result.error ||
          result.rawSummary ||
          'No spare parts or invoice line items were recognized in this photo. You can try another photo or enter items manually.'
        );
        setEditableItems([]);
        return;
      }

      // Pre-match scanned items against existing inventory by name similarity or category
      const initialized = result.items.map((item) => {
        const itemLower = item.name.toLowerCase().trim();
        const matched = existingInventory.find((inv) => {
          const invLower = inv.name.toLowerCase().trim();
          return (
            invLower === itemLower ||
            (inv.category === item.category &&
              (invLower.includes(itemLower) || itemLower.includes(invLower)))
          );
        });

        return {
          ...item,
          selected: true,
          action: matched ? ('increment_existing' as const) : ('add_new' as const),
          matchedItemId: matched ? matched.id : undefined,
          unitCost: item.unitCost ?? (matched ? matched.unitCost : 100),
          sellingPrice: item.sellingPrice ?? (matched ? matched.sellingPrice : 180),
        };
      });

      setEditableItems(initialized);
    } catch (err: any) {
      setErrorMessage(err?.message || 'AI Vision scan failed. Please check network connection.');
    } finally {
      setIsScanning(false);
    }
  };

  const updateItemField = <K extends keyof ScannedItemSuggestion>(
    index: number,
    field: K,
    value: ScannedItemSuggestion[K]
  ) => {
    setEditableItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const toggleItemSelection = (index: number) => {
    setEditableItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  const handleConfirmImport = async () => {
    const selected = editableItems.filter((i) => i.selected);
    if (selected.length === 0) {
      setErrorMessage('Please select at least one item to import.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      for (const item of selected) {
        if (item.action === 'increment_existing' && item.matchedItemId) {
          // Increment stock on existing item
          await adjustInventoryQuantity(
            item.matchedItemId,
            item.quantity,
            ownerId,
            scanResult?.scanType === 'supplier_invoice'
              ? `Supplier Invoice ${scanResult.invoiceNumber || 'Restock'}`
              : 'AI Camera Scan Restock'
          );
        } else {
          // Add as new item
          await addInventoryItem(
            {
              name: item.name.trim(),
              category: item.category,
              quantity: Math.max(1, item.quantity),
              lowStockThreshold: 5,
              unitCost: item.unitCost ?? 100,
              sellingPrice: item.sellingPrice ?? 180,
              notes: item.notes
                ? `${item.notes} (Scanned: ${scanResult?.scanType === 'supplier_invoice' ? 'Invoice' : 'Photo'})`
                : undefined,
            },
            ownerId
          );
        }
      }

      onScanComplete();
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save scanned items to inventory.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#163830] rounded-lg text-[#7EE787]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">AI Vision Inventory Scanner</h2>
              <p className="text-xs text-[#86AB9F]">
                Snap spare parts or upload supplier bills/invoices to auto-populate stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded-lg hover:bg-[#163830] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Modal Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Image Capture Zone (if no scan result yet) */}
          {!scanResult && (
            <div className="space-y-4">
              {!imagePreview ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    isDragging
                      ? 'border-[#0C231F] bg-[#EAE6DC]'
                      : 'border-[#DDD6C5] bg-white hover:bg-[#FAF8F3]'
                  }`}
                >
                  <div className="w-12 h-12 mx-auto mb-3 bg-[#EAE6DC] text-[#0C231F] rounded-full flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1F2421] mb-1">
                    Take a photo or upload an image
                  </h3>
                  <p className="text-xs text-[#5C6E67] max-w-sm mx-auto mb-5">
                    Capture RO spare parts (spun filters, membranes, pumps) or photograph a supplier's paper bill/invoice.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full sm:w-auto px-5 py-2.5 bg-[#C25E00] hover:bg-[#A34F00] text-[#FAF8F3] text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all active:scale-98"
                    >
                      <Camera className="w-4 h-4 text-[#FFD8B2]" />
                      <span>Take Photo (Camera)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-5 py-2.5 bg-[#0C231F] hover:bg-[#163830] text-[#FAF8F3] text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-[#7EE787]" />
                      <span>Browse Files / Gallery</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Preview Container */}
                  <div className="relative rounded-xl overflow-hidden border border-[#DDD6C5] bg-black/5 flex items-center justify-center max-h-64">
                    <img
                      src={imagePreview}
                      alt="Captured spare part or invoice"
                      className="max-h-64 object-contain mx-auto"
                    />
                    <button
                      type="button"
                      onClick={resetState}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                      title="Retake photo"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Compression Info */}
                  {compressedResult && (
                    <div className="flex items-center justify-between text-[11px] text-[#5C6E67] px-1">
                      <span>
                        Original: {formatFileSize(compressedResult.originalSize)} → Ready: {formatFileSize(compressedResult.compressedSize)}
                      </span>
                      <span className="font-semibold text-[#0C231F]">
                        {compressedResult.width} × {compressedResult.height}px
                      </span>
                    </div>
                  )}

                  {/* Scan Button */}
                  <button
                    type="button"
                    onClick={handleTriggerScan}
                    disabled={isScanning || isProcessingImage}
                    className="w-full py-3 bg-[#0C231F] hover:bg-[#163830] disabled:opacity-50 text-[#FAF8F3] text-sm font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-[#7EE787]" />
                    <span>{isScanning ? 'Analyzing with Gemini Vision AI...' : 'Scan & Extract Items'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Review & Confirmation Table */}
          {scanResult && editableItems.length > 0 && (
            <div className="space-y-4">
              {/* Scan summary banner */}
              <div className="p-3.5 bg-[#EAE6DC] rounded-xl border border-[#DDD6C5] space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0C231F]">
                      {scanResult.scanType === 'supplier_invoice' ? '📄 Supplier Invoice Detected' : '📦 Physical Spare Parts Detected'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={resetState}
                    className="text-xs text-[#C25E00] font-semibold hover:underline flex items-center gap-1"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Scan Another</span>
                  </button>
                </div>

                {scanResult.supplierName && (
                  <p className="text-xs text-[#1F2421]">
                    <strong>Vendor:</strong> {scanResult.supplierName}
                    {scanResult.invoiceNumber && ` • Invoice: #${scanResult.invoiceNumber}`}
                    {scanResult.invoiceDate && ` • Date: ${scanResult.invoiceDate}`}
                  </p>
                )}

                {scanResult.rawSummary && (
                  <p className="text-xs text-[#5C6E67]">{scanResult.rawSummary}</p>
                )}
              </div>

              {/* Items Staging Table */}
              <div className="border border-[#DDD6C5] rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="px-4 py-2.5 bg-[#F5F2EB] border-b border-[#DDD6C5] flex items-center justify-between text-xs font-bold text-[#1F2421]">
                  <span>Detected Items ({editableItems.filter((i) => i.selected).length} selected)</span>
                  <span className="text-[11px] text-[#5C6E67]">Review & adjust before importing</span>
                </div>

                <div className="divide-y divide-[#DDD6C5] max-h-72 overflow-y-auto">
                  {editableItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 space-y-2.5 transition-colors ${
                        item.selected ? 'bg-white' : 'bg-gray-50 opacity-60'
                      }`}
                    >
                      {/* Row 1: Checkbox + Name + Quantity */}
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleItemSelection(idx)}
                          className="w-4 h-4 text-[#0C231F] rounded border-[#DDD6C5] focus:ring-[#0C231F]"
                        />

                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                          placeholder="Part Name"
                          className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white border border-[#DDD6C5] rounded focus:ring-1 focus:ring-[#0C231F]"
                        />

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] text-[#5C6E67]">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemField(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))
                            }
                            className="w-16 px-2 py-1 text-xs font-mono font-bold bg-white border border-[#DDD6C5] rounded text-center"
                          />
                        </div>
                      </div>

                      {/* Row 2: Category + Cost + Price + Action Toggle */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        {/* Category */}
                        <div>
                          <label className="block text-[10px] text-[#5C6E67] font-medium mb-0.5">Category</label>
                          <select
                            value={item.category}
                            onChange={(e) => updateItemField(idx, 'category', e.target.value as InventoryCategory)}
                            className="w-full px-2 py-1 text-[11px] bg-white border border-[#DDD6C5] rounded"
                          >
                            {INVENTORY_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {INVENTORY_CATEGORY_LABELS[cat]}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Unit Cost */}
                        <div>
                          <label className="block text-[10px] text-[#5C6E67] font-medium mb-0.5">Unit Cost (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.unitCost ?? 0}
                            onChange={(e) =>
                              updateItemField(idx, 'unitCost', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full px-2 py-1 text-[11px] font-mono bg-white border border-[#DDD6C5] rounded"
                          />
                        </div>

                        {/* Selling Price */}
                        <div>
                          <label className="block text-[10px] text-[#5C6E67] font-medium mb-0.5">Sell Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.sellingPrice ?? 0}
                            onChange={(e) =>
                              updateItemField(idx, 'sellingPrice', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full px-2 py-1 text-[11px] font-mono bg-white border border-[#DDD6C5] rounded"
                          />
                        </div>

                        {/* Action: Add New or Increment Existing */}
                        <div>
                          <label className="block text-[10px] text-[#5C6E67] font-medium mb-0.5">Import Action</label>
                          <select
                            value={item.action}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                'action',
                                e.target.value as 'add_new' | 'increment_existing'
                              )
                            }
                            className="w-full px-2 py-1 text-[11px] bg-white border border-[#DDD6C5] rounded font-semibold text-[#0C231F]"
                          >
                            <option value="add_new">+ Add as New Part</option>
                            <option value="increment_existing">Increment Existing Stock</option>
                          </select>
                        </div>
                      </div>

                      {/* If Incrementing: Pick which existing item to increment */}
                      {item.action === 'increment_existing' && (
                        <div className="pt-1 flex items-center gap-2">
                          <span className="text-[10px] text-[#5C6E67] shrink-0">Match to Stock:</span>
                          <select
                            value={item.matchedItemId || ''}
                            onChange={(e) => updateItemField(idx, 'matchedItemId', e.target.value || undefined)}
                            className="w-full px-2 py-1 text-[11px] bg-[#FAF8F3] border border-[#DDD6C5] rounded"
                          >
                            <option value="">-- Select Existing Part --</option>
                            {existingInventory.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} (Current: {inv.quantity} in stock)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm Import Button */}
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isSaving || editableItems.filter((i) => i.selected).length === 0}
                className="w-full py-3 bg-[#C25E00] hover:bg-[#A34F00] disabled:opacity-50 text-[#FAF8F3] text-sm font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <PackageCheck className="w-5 h-5 text-[#FFD8B2]" />
                <span>
                  {isSaving
                    ? 'Saving to Inventory...'
                    : `Confirm & Import ${editableItems.filter((i) => i.selected).length} Items to Inventory`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
