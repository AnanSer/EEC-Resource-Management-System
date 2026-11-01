import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { Search, X, ChevronDown, Check, AlertCircle, Building2, User, Briefcase, ShieldCheck } from 'lucide-react';
import { Employee } from '../../types';

export interface EmployeeSearchComboboxProps {
  employees: Employee[];
  selectedEmployeeId: string;
  onSelect: (employee: Employee | null) => void;
  selectedDepartmentId?: string;
  departmentName?: string;
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: string | null;
  className?: string;
}

/**
 * Validates whether an employee is eligible for asset allocation:
 * 1. Must belong to the currently selected department/directorate.
 * 2. Must be active (isActive = true).
 * 3. Must have an APPROVED account status (PENDING, REJECTED, SUSPENDED forbidden).
 */
export function isEligibleEmployee(e: Employee, selectedDepartmentId?: string): boolean {
  // 1. Department boundary check
  if (selectedDepartmentId && e.departmentId !== selectedDepartmentId) {
    return false;
  }

  // 2. Active status check
  if (!e.isActive) {
    return false;
  }

  // 3. Account eligibility check: strictly disallow PENDING, REJECTED, or SUSPENDED
  const status = (e.accountStatus || '').toUpperCase();
  if (status === 'PENDING' || status === 'REJECTED' || status === 'SUSPENDED') {
    return false;
  }

  // Must be APPROVED (or legacy ACTIVE without a pending/suspended user account)
  if (status === 'APPROVED') {
    return true;
  }

  if (!e.accountStatus && e.isActive) {
    return true;
  }

  if (status === 'ACTIVE' && !e.userId) {
    return true;
  }

  return false;
}

/**
 * Searchable Combobox for Employee Selection in Requisition and Direct Allocation forms.
 * 
 * Supports search by:
 * - Employee Full Name (e.g. Haile Gebrselassie)
 * - Employee ID (e.g. EEC-EMP-045)
 * - Designation (e.g. Senior Geotechnical Engineer)
 * - Department Name or Code (e.g. TID, Transport & Infrastructure Design)
 * 
 * Enforces:
 * - Only APPROVED, active employees belonging to the selected department are shown.
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Tab).
 * - Immediate clear when department changes.
 */
export const EmployeeSearchCombobox: React.FC<EmployeeSearchComboboxProps> = ({
  employees,
  selectedEmployeeId,
  onSelect,
  selectedDepartmentId,
  departmentName,
  isLoading = false,
  disabled = false,
  label = 'Assignee Employee',
  required = false,
  placeholder = 'Search by employee name, ID, designation, or department...',
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

  // Find currently selected employee object
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Filter only eligible employees belonging to the selected directorate with APPROVED accounts
  const eligibleEmployees = useMemo(() => {
    return employees.filter((e) => isEligibleEmployee(e, selectedDepartmentId));
  }, [employees, selectedDepartmentId]);

  // Filter based on search query (name, employee ID, designation, department)
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleEmployees;

    return eligibleEmployees.filter((e) => {
      const name = (e.name || '').toLowerCase();
      const empId = (e.employeeId || '').toLowerCase();
      const designation = (e.designation || '').toLowerCase();
      const deptName = (e.departmentName || '').toLowerCase();
      const deptCode = (e.departmentCode || '').toLowerCase();

      return (
        name.includes(q) ||
        empId.includes(q) ||
        designation.includes(q) ||
        deptName.includes(q) ||
        deptCode.includes(q)
      );
    });
  }, [eligibleEmployees, searchQuery]);

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
    if (isOpen && listRef.current && filteredEmployees.length > 0) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen, filteredEmployees.length]);

  const handleSelectEmployee = (employee: Employee) => {
    onSelect(employee);
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
        setHighlightedIndex((prev) => (prev + 1 < filteredEmployees.length ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredEmployees.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredEmployees.length > 0 && filteredEmployees[highlightedIndex]) {
          handleSelectEmployee(filteredEmployees[highlightedIndex]);
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
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={comboboxId}
            className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
          >
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {selectedEmployee && (
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={disabled}
              className="text-[11px] font-semibold text-eec-primary hover:text-[#0E5161] hover:underline transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Change Employee
            </button>
          )}
        </div>
      )}

      {/* Selected Employee Display Card */}
      {selectedEmployee && !isOpen ? (
        <div className="bg-slate-50 border-2 border-emerald-500/30 rounded-xl p-3 shadow-xs transition-all relative group">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-xs truncate flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-eec-primary shrink-0" />
                  {selectedEmployee.name}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-white text-slate-700 border border-slate-300">
                  {selectedEmployee.employeeId}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3" />
                  APPROVED
                </span>
              </div>

              {/* Designation & Department */}
              <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <Briefcase className="w-3 h-3 text-slate-400" />
                  {selectedEmployee.designation || 'Staff Member'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 text-slate-500 font-medium">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  {selectedEmployee.departmentName || selectedEmployee.departmentCode || departmentName || 'Assigned Directorate'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearSelection}
              disabled={disabled}
              title="Change employee selection"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors shrink-0"
              aria-label="Clear employee selection"
            >
              <X className="w-3.5 h-3.5" />
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
              placeholder={
                eligibleEmployees.length === 0
                  ? 'No approved employees in this directorate...'
                  : placeholder
              }
              className={`w-full pl-9 pr-20 py-2.5 text-xs bg-white border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-eec-primary/20 transition-all ${
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
                  Approved Directorate Staff: <strong className="text-slate-700">{filteredEmployees.length}</strong>
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
                    <span>Loading employee roster...</span>
                  </li>
                ) : eligibleEmployees.length === 0 ? (
                  <li className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <span className="font-semibold text-slate-700">No Approved Employees in Directorate</span>
                    <span className="text-[11px] text-slate-400 max-w-xs text-center">
                      There are no active, approved personnel in this directorate. Check User Approvals to activate accounts.
                    </span>
                  </li>
                ) : filteredEmployees.length === 0 ? (
                  <li className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <span className="font-semibold text-slate-700">No Matching Employees</span>
                    <span className="text-[11px] text-slate-400 max-w-xs text-center">
                      No approved employees in this directorate match "{searchQuery}". Try searching by name, ID, or designation.
                    </span>
                  </li>
                ) : (
                  filteredEmployees.map((emp, index) => {
                    const isSelected = emp.id === selectedEmployeeId;
                    const isHighlighted = index === highlightedIndex;

                    return (
                      <li
                        key={emp.id}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => handleSelectEmployee(emp)}
                        className={`px-3.5 py-2.5 cursor-pointer transition-colors text-left flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-50/80 hover:bg-emerald-50'
                            : isHighlighted
                            ? 'bg-slate-100/90'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          {/* Name + Employee ID badge + APPROVED badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs truncate flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-500" />
                              {emp.name}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {emp.employeeId}
                            </span>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              APPROVED
                            </span>
                          </div>

                          {/* Designation & Department */}
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Briefcase className="w-3 h-3 text-slate-400" />
                              {emp.designation || 'Staff Member'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {emp.departmentName || emp.departmentCode || departmentName || 'Assigned Directorate'}
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

      {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

