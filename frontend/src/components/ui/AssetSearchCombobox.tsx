import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { Search, X, ChevronDown, Check, AlertCircle, Building2, User, MapPin } from 'lucide-react';
import { Resource } from '../../types';

export interface AssetSearchComboboxProps {
  resources: Resource[];
  selectedResourceId: string;
  onSelect: (resource: Resource | null) => void;
  mode?: 'AVAILABLE' | 'ASSIGNED';
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: string | null;
  className?: string;
}

/**
 * Helper to safely extract serial number across polymorphic resource specs
 */
export function getAssetSerialNumber(r: Resource): string {
  if (r.serialNumber && r.serialNumber.trim()) return r.serialNumber.trim();
  if (r.itSpecs?.serialNumber && r.itSpecs.serialNumber.trim()) return r.itSpecs.serialNumber.trim();
  if (r.vehicleSpecs?.chassisNumber && r.vehicleSpecs.chassisNumber.trim()) return r.vehicleSpecs.chassisNumber.trim();
  if (r.surveyingSpecs?.serialNumber && r.surveyingSpecs.serialNumber.trim()) return r.surveyingSpecs.serialNumber.trim();
  if (r.machinerySpecs?.serialNumber && r.machinerySpecs.serialNumber.trim()) return r.machinerySpecs.serialNumber.trim();
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
  if (!cat) return 'Equipment';
  return CATEGORY_NAMES[cat] || cat.replace(/_/g, ' ');
}

/**
 * Searchable Combobox for Asset Selection in Return, Direct Assignment, and Custody Transfer Workflows.
 * 
 * Supports search by:
 * - Resource/Item Code (e.g. EEC-IT-2024-0012)
 * - Resource Name (e.g. Dell Latitude 5440)
 * - Serial Number (e.g. SN: ABC123, chassis number)
 * - Model (e.g. Latitude 5440, Hilux D-4D)
 * - Category (e.g. IT Equipment, Surveying)
 * - Storage Location or Department
 * - Current Custodian (for ASSIGNED mode)
 * 
 * Modes:
 * - 'AVAILABLE': Only genuinely AVAILABLE resources (in store/inventory) can be selected.
 * - 'ASSIGNED': Only genuinely ASSIGNED resources with active custody can be selected (default for returns & transfers).
 */
export const AssetSearchCombobox: React.FC<AssetSearchComboboxProps> = ({
  resources,
  selectedResourceId,
  onSelect,
  mode = 'ASSIGNED',
  isLoading = false,
  disabled = false,
  label = 'Select Currently Assigned Asset',
  required = false,
  placeholder,
  error,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const comboboxId = useId();

  // Find currently selected resource object
  const selectedResource = useMemo(() => {
    return resources.find((r) => r.id === selectedResourceId) || null;
  }, [resources, selectedResourceId]);

  // Filter eligible resources based on mode:
  // - 'AVAILABLE': strictly r.status === 'AVAILABLE' (rejects ASSIGNED, MAINTENANCE, TESTING, RETIRED, DISPOSED)
  // - 'ASSIGNED': strictly r.status === 'ASSIGNED' (rejects AVAILABLE, MAINTENANCE, RETIRED, DISPOSED)
  const eligibleResources = useMemo(() => {
    if (mode === 'AVAILABLE') {
      return resources.filter((r) => r.status === 'AVAILABLE');
    }
    return resources.filter((r) => r.status === 'ASSIGNED');
  }, [resources, mode]);

  // Filter based on search query
  const filteredResources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleResources;

    return eligibleResources.filter((r) => {
      const itemCode = (r.itemCode || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      const serial = getAssetSerialNumber(r).toLowerCase();
      const model = getAssetModel(r).toLowerCase();
      const category = (r.category || '').toLowerCase();
      const categoryLabel = formatCategoryName(r.category).toLowerCase();
      const custodian = (r.currentAssigneeName || '').toLowerCase();
      const empId = (r.currentAssigneeEmployeeId || '').toLowerCase();
      const deptName = (r.currentDepartmentName || r.department?.name || '').toLowerCase();
      const deptCode = (r.department?.code || '').toLowerCase();
      const location = (r.location || '').toLowerCase();

      return (
        itemCode.includes(q) ||
        name.includes(q) ||
        serial.includes(q) ||
        model.includes(q) ||
        category.includes(q) ||
        categoryLabel.includes(q) ||
        custodian.includes(q) ||
        empId.includes(q) ||
        deptName.includes(q) ||
        deptCode.includes(q) ||
        location.includes(q)
      );
    });
  }, [eligibleResources, searchQuery]);

  // Keep highlighted index within bounds
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

  const computedPlaceholder = placeholder || (
    mode === 'AVAILABLE'
      ? 'Search by item code, name, serial number, model, or category...'
      : 'Search by item code, name, serial number, model, or custodian...'
  );

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
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

      {/* Selected Asset Display Card (when an asset is already selected and dropdown is closed) */}
      {selectedResource && !isOpen ? (
        <div className="bg-slate-50 border-2 border-emerald-500/30 rounded-xl p-3 shadow-sm transition-all relative group">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm truncate">
                  {selectedResource.name}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-white text-slate-700 border border-slate-300">
                  {selectedResource.itemCode}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200/70 text-slate-700">
                  {formatCategoryName(selectedResource.category)}
                </span>
                {selectedResource.status === 'AVAILABLE' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    AVAILABLE
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    ASSIGNED
                  </span>
                )}
              </div>

              {/* Identification line: SN, Model, Location / Department */}
              <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                {getAssetSerialNumber(selectedResource) && (
                  <span className="font-mono text-slate-700 font-medium">
                    SN: {getAssetSerialNumber(selectedResource)}
                  </span>
                )}
                {getAssetModel(selectedResource) && (
                  <>
                    {getAssetSerialNumber(selectedResource) && (
                      <span className="text-slate-300">•</span>
                    )}
                    <span className="text-slate-700 font-medium">
                      Model: {getAssetModel(selectedResource)}
                    </span>
                  </>
                )}
                {(getAssetSerialNumber(selectedResource) || getAssetModel(selectedResource)) && (
                  <span className="text-slate-300">•</span>
                )}
                <span className="flex items-center gap-1 text-slate-600">
                  {selectedResource.status === 'AVAILABLE' ? (
                    <>
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedResource.location || selectedResource.department?.name || 'Central Store - Kersa'}</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedResource.currentDepartmentName || selectedResource.department?.name || 'Central Office'}</span>
                    </>
                  )}
                </span>
              </div>

              {/* Custodian line for ASSIGNED assets */}
              {selectedResource.status === 'ASSIGNED' && (
                <div className="flex items-center gap-1 text-xs text-eec-primary font-medium pt-0.5">
                  <User className="w-3.5 h-3.5 text-eec-primary shrink-0" />
                  <span>
                    Currently assigned to:{' '}
                    <strong className="text-slate-900 font-bold">
                      {selectedResource.currentAssigneeName || 'Unknown Custodian'}
                    </strong>
                    {selectedResource.currentAssigneeEmployeeId ? (
                      <span className="text-slate-600 font-mono ml-1 font-semibold">
                        ({selectedResource.currentAssigneeEmployeeId})
                      </span>
                    ) : null}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleClearSelection}
              disabled={disabled}
              title="Clear selection and choose a different asset"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors shrink-0"
              aria-label="Clear selection"
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
              placeholder={computedPlaceholder}
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
                  {mode === 'AVAILABLE'
                    ? (filteredResources.length === 1 ? '1 available asset in store' : `${filteredResources.length} available assets in store`)
                    : (filteredResources.length === 1 ? '1 asset in active custody' : `${filteredResources.length} assets in active custody`)}
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
                    <span>Loading assets...</span>
                  </li>
                ) : eligibleResources.length === 0 ? (
                  <li className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-6 h-6 text-slate-400" />
                    <span className="font-semibold text-slate-700">
                      {mode === 'AVAILABLE' ? 'No Available Assets' : 'No Assigned Assets'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {mode === 'AVAILABLE'
                        ? 'There are currently no assets marked AVAILABLE in store inventory.'
                        : 'There are currently no assets assigned to any employee in the registry.'}
                    </span>
                  </li>
                ) : filteredResources.length === 0 ? (
                  <li className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <span className="font-semibold text-slate-700">No Matching Assets</span>
                    <span className="text-[11px] text-slate-400">
                      No assets match "{searchQuery}". Try searching by item code, name, serial number, model, or category.
                    </span>
                  </li>
                ) : (
                  filteredResources.map((resource, index) => {
                    const isSelected = resource.id === selectedResourceId;
                    const isHighlighted = index === highlightedIndex;
                    const serial = getAssetSerialNumber(resource);
                    const model = getAssetModel(resource);
                    const deptName =
                      resource.currentDepartmentName ||
                      resource.department?.name ||
                      'Central Office';
                    const custodianName =
                      resource.currentAssigneeName || 'Unknown Custodian';
                    const custodianEmpId = resource.currentAssigneeEmployeeId;

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
                        <div className="space-y-0.5 flex-1 min-w-0">
                          {/* Line 1: Resource Name & Category */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {resource.name}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200/70 text-slate-700">
                              {formatCategoryName(resource.category)}
                            </span>
                            {resource.status === 'AVAILABLE' ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                AVAILABLE
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                                ASSIGNED
                              </span>
                            )}
                          </div>

                          {/* Line 2: Item Code | SN: serial | Model: model */}
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap font-medium">
                            <span className="font-mono text-slate-700 font-semibold">
                              {resource.itemCode}
                            </span>
                            {serial ? (
                              <>
                                <span className="text-slate-300">|</span>
                                <span className="font-mono text-slate-600">
                                  SN: {serial}
                                </span>
                              </>
                            ) : null}
                            {model ? (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-600 font-medium">
                                  Model: {model}
                                </span>
                              </>
                            ) : null}
                          </div>

                          {/* Line 3: Details based on mode */}
                          {resource.status === 'AVAILABLE' ? (
                            <div className="text-[11px] text-slate-600 flex items-center gap-1 pt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">
                                Location: <strong className="text-slate-700">{resource.location || deptName || 'Central Store - Kersa'}</strong>
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-eec-primary font-medium flex items-center gap-1 pt-0.5">
                              <User className="w-3 h-3 text-eec-primary shrink-0" />
                              <span>
                                Currently assigned to:{' '}
                                <strong className="font-bold text-slate-800">
                                  {custodianName}
                                </strong>
                                {custodianEmpId ? (
                                  <span className="text-slate-500 font-mono ml-1 font-semibold">
                                    ({custodianEmpId})
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          )}
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

      {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
};
