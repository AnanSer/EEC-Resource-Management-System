import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { Search, X, ChevronDown, Check, AlertCircle, MapPin, Tag, Cpu, Package } from 'lucide-react';
import { Resource, ResourceCategory } from '../../types';

export interface HandoverAssetComboboxProps {
  resources: Resource[];
  selectedResourceId: string;
  onSelect: (resource: Resource | null) => void;
  requiredCategory?: ResourceCategory | string;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: string | null;
}

/**
 * Helper to safely extract serial number across polymorphic resource specs
 */
export function getAssetSerialNumber(r: Resource): string {
  if (r.serialNumber && r.serialNumber.trim()) return r.serialNumber.trim();
  if (r.itSpecs?.serialNumber && r.itSpecs.serialNumber.trim()) return r.itSpecs.serialNumber.trim();
  if (r.vehicleSpecs?.chassisNumber && r.vehicleSpecs.chassisNumber.trim()) return r.vehicleSpecs.chassisNumber.trim();
  if (r.surveyingSpecs?.serialNumber && r.surveyingSpecs.serialNumber.trim()) return r.surveyingSpecs.serialNumber.trim();
  return '';
}

/**
 * Helper to safely extract model across polymorphic resource specs
 */
export function getAssetModel(r: Resource): string {
  if ((r as any).model && typeof (r as any).model === 'string' && (r as any).model.trim()) {
    return (r as any).model.trim();
  }
  if (r.itSpecs?.model && r.itSpecs.model.trim()) return r.itSpecs.model.trim();
  if (r.vehicleSpecs?.model && r.vehicleSpecs.model.trim()) return r.vehicleSpecs.model.trim();
  if (r.machinerySpecs?.model && r.machinerySpecs.model.trim()) return r.machinerySpecs.model.trim();
  if (r.surveyingSpecs?.model && r.surveyingSpecs.model.trim()) return r.surveyingSpecs.model.trim();
  return '';
}

/**
 * Canonical human-friendly display names for EEC RMS categories
 */
export const CATEGORY_NAMES: Record<string, string> = {
  IT_EQUIPMENT: 'IT Equipment',
  VEHICLES: 'Vehicles & Transport',
  HEAVY_MACHINERY: 'Heavy Machinery',
  SURVEYING_GEOTECHNICAL: 'Surveying & Geotechnical',
  CAMP_FACILITY_FURNITURE: 'Furniture & Facilities',
  OTHER: 'Other Equipment',
};

export function formatCategoryName(cat?: string): string {
  if (!cat) return 'Uncategorized';
  return CATEGORY_NAMES[cat] || cat.replace(/_/g, ' ');
}

/**
 * Generates descriptive empty state content when no resources match the requisition category.
 */
export function getHandoverEmptyStateMessage(
  requiredCategory?: string,
  otherAvailableCount = 0,
  otherCategoriesText = ''
): { title: string; message: string } {
  const catLabel = formatCategoryName(requiredCategory);
  if (otherAvailableCount > 0) {
    const countText = `${otherAvailableCount} available ${otherAvailableCount === 1 ? 'resource' : 'resources'}`;
    const categoriesPart = otherCategoriesText ? ` (${otherCategoriesText})` : '';
    const pronoun = otherAvailableCount === 1 ? 'it' : 'they';
    const verb = otherAvailableCount === 1 ? 'is' : 'are';
    const catNoun = (otherAvailableCount > 1 && otherCategoriesText.includes(',')) ? 'other categories' : (otherAvailableCount === 1 ? 'another category' : 'other categories');
    return {
      title: `No ${catLabel} Available for Handover`,
      message: `No ${catLabel} is currently available for handover. There ${verb} ${countText} in ${catNoun}${categoriesPart}, but ${pronoun} cannot fulfill this request.`,
    };
  }

  return {
    title: 'No Available Inventory in Store',
    message: 'The warehouse store currently has no available resources across any category. Please intake or return equipment before completing handover.',
  };
}

/**
 * Searchable Combobox for Store Keeper Handover Fulfillment.
 * 
 * - Filters strictly to genuinely AVAILABLE resources matching the requisition's requested category.
 * - Supports search by item code, name, serial number, and model.
 * - Displays item code, name, serial number, category, and storage location.
 * - Supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Tab).
 * - Clear selected view with change asset action.
 */
export const HandoverAssetCombobox: React.FC<HandoverAssetComboboxProps> = ({
  resources,
  selectedResourceId,
  onSelect,
  requiredCategory,
  isLoading = false,
  disabled = false,
  label = 'Select Available Physical Asset in Warehouse',
  required = true,
  placeholder = 'Search by item code, name, serial number, or model...',
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const comboboxId = useId();

  // Find currently selected resource object
  const selectedResource = resources.find((r) => r.id === selectedResourceId) || null;

  // Filter only genuinely AVAILABLE resources that match the requisition's requested category
  const availableEligibleResources = useMemo(() => {
    return resources.filter((r) => {
      const isAvailable = r.status === 'AVAILABLE';
      const matchesCategory = !requiredCategory || r.category === requiredCategory;
      return isAvailable && matchesCategory;
    });
  }, [resources, requiredCategory]);

  // Genuinely AVAILABLE resources in other categories
  const otherCategoryAvailable = useMemo(() => {
    if (!requiredCategory) return [];
    return resources.filter((r) => r.status === 'AVAILABLE' && r.category !== requiredCategory);
  }, [resources, requiredCategory]);

  // Breakdown of available assets in other categories
  const otherCategoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of otherCategoryAvailable) {
      const cat = r.category || 'OTHER';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).map(([cat, count]) => ({
      category: cat,
      label: formatCategoryName(cat),
      count,
    }));
  }, [otherCategoryAvailable]);

  // Formatted string of other categories, e.g. "Surveying & Geotechnical" or "Surveying & Geotechnical (3), Vehicles (2)"
  const otherCategoriesListText = useMemo(() => {
    if (otherCategoryBreakdown.length === 0) return '';
    if (otherCategoryBreakdown.length === 1) {
      return otherCategoryBreakdown[0].label;
    }
    return otherCategoryBreakdown.map((b) => `${b.label} (${b.count})`).join(', ');
  }, [otherCategoryBreakdown]);

  // Filter based on search query (item code, name, serial number, model)
  const filteredResources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableEligibleResources;

    return availableEligibleResources.filter((r) => {
      const itemCode = (r.itemCode || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      const serial = getAssetSerialNumber(r).toLowerCase();
      const model = getAssetModel(r).toLowerCase();
      const subcategory = (r.subcategory || '').toLowerCase();
      const location = (r.location || '').toLowerCase();

      return (
        itemCode.includes(q) ||
        name.includes(q) ||
        serial.includes(q) ||
        model.includes(q) ||
        subcategory.includes(q) ||
        location.includes(q)
      );
    });
  }, [availableEligibleResources, searchQuery]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current && filteredResources.length > 0) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen, filteredResources.length]);

  const handleSelectResource = (resource: Resource) => {
    onSelect(resource);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClearSelection = () => {
    onSelect(null);
    setSearchQuery('');
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1 < filteredResources.length ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredResources.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredResources.length > 0 && filteredResources[highlightedIndex]) {
          handleSelectResource(filteredResources[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={comboboxId}
            className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
          >
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {selectedResource && (
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={disabled}
              className="text-[11px] font-semibold text-eec-primary hover:text-[#0E5161] hover:underline transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Change Asset
            </button>
          )}
        </div>
      )}

      {/* Selected Asset Display Card (when an asset is selected and dropdown is closed) */}
      {selectedResource && !isOpen ? (
        <div className="bg-slate-50 border-2 border-emerald-500/30 rounded-xl p-3 shadow-sm transition-all relative group">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm truncate">
                  {selectedResource.name}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-white text-slate-700 border border-slate-300">
                  {selectedResource.itemCode}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  AVAILABLE
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Tag className="w-2.5 h-2.5" />
                  {formatCategoryName(selectedResource.category)}
                </span>
              </div>

              {/* Identification line: Serial, Model, Condition */}
              <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                {getAssetSerialNumber(selectedResource) ? (
                  <span className="font-mono text-slate-700 font-medium">
                    SN: {getAssetSerialNumber(selectedResource)}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono text-[11px]">No Serial #</span>
                )}

                {getAssetModel(selectedResource) && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-slate-600 font-medium">
                      <Cpu className="w-3 h-3 text-slate-400" />
                      Model: {getAssetModel(selectedResource)}
                    </span>
                  </>
                )}

                {selectedResource.condition && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Condition: <strong>{selectedResource.condition}</strong>
                    </span>
                  </>
                )}
              </div>

              {/* Storage Location line */}
              <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>
                  Storage Location:{' '}
                  <strong className="text-slate-900 font-semibold">
                    {selectedResource.location || 'Central Store - Kersa'}
                  </strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearSelection}
              disabled={disabled}
              title="Change asset selection"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors shrink-0"
              aria-label="Clear asset selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Search Input and Combobox Trigger */
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              id={comboboxId}
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={isOpen}
              aria-autocomplete="list"
              aria-controls={`${comboboxId}-listbox`}
              disabled={disabled || isLoading}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`w-full pl-9 pr-20 py-2.5 text-xs bg-slate-50 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-eec-primary/20 transition-all ${
                error
                  ? 'border-rose-400 focus:border-rose-500 bg-rose-50/20'
                  : 'border-slate-200 focus:border-eec-primary'
              } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
            />

            <div className="absolute right-2.5 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    inputRef.current?.focus();
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                  title="Clear search"
                  tabIndex={-1}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (disabled) return;
                  setIsOpen((prev) => !prev);
                  if (!isOpen) {
                    inputRef.current?.focus();
                  }
                }}
                disabled={disabled}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                title={isOpen ? 'Close dropdown' : 'Open dropdown'}
                tabIndex={-1}
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-eec-primary' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Dropdown Menu Popover */}
          {isOpen && (
            <div
              id={`${comboboxId}-listbox`}
              role="listbox"
              className="absolute left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fadeIn max-h-72 flex flex-col"
            >
              {/* Header / stats bar */}
              <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>
                  {requiredCategory ? (
                    <>
                      Available <strong className="text-slate-700">{formatCategoryName(requiredCategory)}</strong>: {filteredResources.length}
                    </>
                  ) : (
                    `${filteredResources.length} available assets`
                  )}
                </span>
                {searchQuery && (
                  <span className="text-slate-400 truncate max-w-[160px]">
                    Matching: "{searchQuery}"
                  </span>
                )}
              </div>

              {/* Scrollable list items */}
              <ul
                ref={listRef}
                className="overflow-y-auto divide-y divide-slate-100 flex-1 overscroll-contain"
              >
                {isLoading ? (
                  <li className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-eec-primary border-t-transparent rounded-full animate-spin" />
                    <span>Loading available inventory...</span>
                  </li>
                ) : availableEligibleResources.length === 0 ? (
                  <li className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200/90 flex items-center justify-center text-amber-600 mb-0.5 shadow-sm">
                      <Package className="w-5 h-5" />
                    </div>
                    {otherCategoryAvailable.length > 0 ? (
                      <div className="space-y-1.5 max-w-sm px-2">
                        <span className="font-bold text-slate-800 text-xs block">
                          No {formatCategoryName(requiredCategory)} Available
                        </span>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          No {formatCategoryName(requiredCategory)} is currently available for handover. There {otherCategoryAvailable.length === 1 ? 'is' : 'are'}{' '}
                          <strong className="text-slate-700">{otherCategoryAvailable.length} available {otherCategoryAvailable.length === 1 ? 'resource' : 'resources'}</strong> in other categories ({otherCategoriesListText}), but {otherCategoryAvailable.length === 1 ? 'it' : 'they'} cannot fulfill this request.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-w-sm px-2">
                        <span className="font-bold text-slate-800 text-xs block">
                          No Available Inventory in Store
                        </span>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          The warehouse store currently has no available resources across any category. Please intake or return equipment before completing handover.
                        </p>
                      </div>
                    )}
                  </li>
                ) : filteredResources.length === 0 ? (
                  <li className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <span className="font-semibold text-slate-700">No Matching Assets</span>
                    <span className="text-[11px] text-slate-400 max-w-xs text-center">
                      No available {formatCategoryName(requiredCategory)} assets match "{searchQuery}". Try searching by item code, name, serial number, or model.
                    </span>
                  </li>
                ) : (
                  filteredResources.map((resource, index) => {
                    const isSelected = resource.id === selectedResourceId;
                    const isHighlighted = index === highlightedIndex;
                    const serial = getAssetSerialNumber(resource);
                    const model = getAssetModel(resource);
                    const location = resource.location || 'Central Store - Kersa';

                    return (
                      <li
                        key={resource.id}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => handleSelectResource(resource)}
                        className={`px-3.5 py-2.5 cursor-pointer transition-colors text-left flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-50/80 hover:bg-emerald-50'
                            : isHighlighted
                            ? 'bg-slate-100/90'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          {/* Line 1: Resource Name + Category Tag + Condition */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {resource.name}
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Tag className="w-2.5 h-2.5" />
                              {formatCategoryName(resource.category)}
                            </span>
                            {resource.condition && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {resource.condition}
                              </span>
                            )}
                          </div>

                          {/* Line 2: Item Code | SN: serial | Model: model */}
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap font-medium">
                            <span className="font-mono text-slate-800 font-semibold bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                              {resource.itemCode}
                            </span>
                            {serial ? (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="font-mono text-slate-600">
                                  SN: {serial}
                                </span>
                              </>
                            ) : null}
                            {model ? (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-600 flex items-center gap-1">
                                  <Cpu className="w-3 h-3 text-slate-400" />
                                  Model: {model}
                                </span>
                              </>
                            ) : null}
                          </div>

                          {/* Line 3: Storage Location */}
                          <div className="text-[11px] text-slate-600 flex items-center gap-1 pt-0.5">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>
                              Storage Location: <strong className="text-slate-800 font-medium">{location}</strong>
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="shrink-0 text-emerald-600 self-center">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Contextual helper banner when no resources match required category */}
      {!selectedResource && availableEligibleResources.length === 0 && (
        <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 mt-1.5 shadow-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed space-y-0.5">
            <span className="font-bold block text-amber-900">
              {otherCategoryAvailable.length > 0
                ? `No ${formatCategoryName(requiredCategory)} available for handover`
                : 'No inventory available in warehouse store'}
            </span>
            <p className="text-amber-800/90">
              {otherCategoryAvailable.length > 0 ? (
                <>
                  No {formatCategoryName(requiredCategory)} is currently available for handover. There {otherCategoryAvailable.length === 1 ? 'is' : 'are'}{' '}
                  <strong className="font-semibold text-amber-950">{otherCategoryAvailable.length} available {otherCategoryAvailable.length === 1 ? 'resource' : 'resources'}</strong> in other categories ({otherCategoriesListText}), but {otherCategoryAvailable.length === 1 ? 'it' : 'they'} cannot fulfill this request.
                </>
              ) : (
                'The warehouse store currently has no available resources across any category. Please intake or return equipment before completing handover.'
              )}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

