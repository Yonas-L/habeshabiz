import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { Pencil, Loader2 } from 'lucide-react';

interface InlineEditablePriceProps {
  value: number | string;
  costBasis?: number | string;
  unitId: string;
  field?: 'handover_payout' | 'cost_basis';
  onSaved?: (updatedUnit: any) => void;
  className?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
}

export const InlineEditablePrice: React.FC<InlineEditablePriceProps> = ({
  value,
  costBasis,
  unitId,
  field = 'handover_payout',
  onSaved,
  className = '',
  align = 'right',
  disabled = false,
}) => {
  const numVal = typeof value === 'string' ? parseFloat(value) || 0 : (value || 0);
  const numCostBasis = costBasis !== undefined ? (typeof costBasis === 'string' ? parseFloat(costBasis) || 0 : costBasis) : undefined;

  const [isEditing, setIsEditing] = useState(false);
  const [currentVal, setCurrentVal] = useState(numVal);
  const [inputValue, setInputValue] = useState(String(numVal || ''));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentVal(numVal);
    if (!isEditing) {
      setInputValue(String(numVal || ''));
    }
  }, [numVal, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isSaving) return;
    setInputValue(currentVal ? String(currentVal) : '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setInputValue(currentVal ? String(currentVal) : '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!isEditing) return;
    const cleanNum = parseFloat(inputValue.replace(/,/g, '').trim());

    if (isNaN(cleanNum) || cleanNum < 0) {
      handleCancel();
      return;
    }

    if (cleanNum === currentVal) {
      setIsEditing(false);
      return;
    }

    const previousValue = currentVal;
    try {
      setIsSaving(true);
      const res = await api.adjustAgreedPayout(unitId, {
        [field]: cleanNum,
      });

      setCurrentVal(cleanNum);
      setIsEditing(false);

      if (res.is_loss && res.loss_amount && res.loss_amount > 0) {
        toast.warning(
          `Below cost basis: −${res.loss_amount.toLocaleString()} ETB loss recorded`,
          {
            duration: 4000,
            action: {
              label: 'Undo',
              onClick: () => handleRevert(previousValue),
            },
          }
        );
      } else {
        toast.success(
          `Agreed ${field === 'handover_payout' ? 'payout' : 'cost'} updated to ${cleanNum.toLocaleString()} ETB`,
          {
            duration: 4000,
            action: {
              label: 'Undo',
              onClick: () => handleRevert(previousValue),
            },
          }
        );
      }

      onSaved?.(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update price');
      handleCancel();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = async (prevVal: number) => {
    try {
      const res = await api.adjustAgreedPayout(unitId, {
        [field]: prevVal,
      });
      setCurrentVal(prevVal);
      setInputValue(String(prevVal));
      onSaved?.(res.data);
      toast.info('Price change reverted');
    } catch (err: any) {
      toast.error('Failed to revert change: ' + err.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div
        className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={inputValue}
          disabled={isSaving}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-24 sm:w-28 h-6 px-1.5 font-mono font-bold text-xs rounded-md border border-emerald-500 bg-white dark:bg-[#0c1017] text-slate-900 dark:text-white focus:outline-none ring-1 ring-emerald-500/30"
          placeholder="0"
        />
        <span className="text-[10px] text-slate-400 font-sans">ETB</span>
        {isSaving && <Loader2 className="w-3 h-3 animate-spin text-emerald-500 ml-0.5" />}
      </div>
    );
  }

  const isBelowCost = numCostBasis !== undefined && currentVal > 0 && currentVal < numCostBasis;

  return (
    <div
      onClick={handleStartEdit}
      title={disabled ? undefined : 'Click to quickly edit agreed price'}
      className={`inline-flex items-center gap-1 group/inline cursor-pointer select-none ${align === 'right' ? 'justify-end' : 'justify-start'} ${className}`}
    >
      <span
        className={`font-mono font-bold text-xs tabular-nums transition-colors group-hover/inline:text-emerald-600 dark:group-hover/inline:text-emerald-400 border-b border-dashed border-transparent group-hover/inline:border-slate-300 dark:group-hover/inline:border-slate-600 ${
          isBelowCost ? 'text-amber-600 dark:text-amber-400' : ''
        }`}
      >
        {currentVal > 0 ? `${currentVal.toLocaleString()} ETB` : '—'}
      </span>
      {!disabled && (
        <Pencil className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600 group-hover/inline:text-emerald-500 transition-colors shrink-0 opacity-0 group-hover/inline:opacity-100" />
      )}
      {isBelowCost && (
        <span className="text-[9px] font-sans px-1 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold shrink-0">
          Loss
        </span>
      )}
    </div>
  );
};
