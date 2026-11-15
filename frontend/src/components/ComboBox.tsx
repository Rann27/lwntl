import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
/**
 * LWNTL ComboBox Component
 * Combines dropdown with text input: user can select from list or type custom value
 */

import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, X, Plus } from 'lucide-react'

interface ComboBoxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  label?: string
  onAddOption?: (value: string) => void
  id?: string
}

export function ComboBox({ value, onChange, options, placeholder, label, onAddOption, id }: ComboBoxProps) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Sync input with value prop
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(
    (opt) => opt.toLowerCase().includes(inputValue.toLowerCase()) && opt !== inputValue
  )

  const isCustomValue = inputValue && !options.some((opt) => opt.toLowerCase() === inputValue.toLowerCase())

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    onChange(e.target.value)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleSelect = (opt: string) => {
    setInputValue(opt)
    onChange(opt)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleAddCustom = () => {
    if (inputValue.trim() && onAddOption) {
      onAddOption(inputValue.trim())
      onChange(inputValue.trim())
      setIsOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex])
        } else if (isCustomValue && onAddOption) {
          handleAddCustom()
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  return (
    <div ref={containerRef} className="relative" id={id}>
      {label && (
        <Label htmlFor={inputId} className="block mb-1.5" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {label}
        </Label>
      )}
      <div
        className="flex items-center"
        style={{ borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'relative',
        }}
      >
        <Input aria-label={placeholder}
          id={inputId}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={`${inputId}-options`}
          aria-autocomplete="list"
          aria-activedescendant={highlightedIndex >= 0 ? `${inputId}-option-${highlightedIndex}` : undefined}
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
          style={{ borderRadius: 'var(--radius)',
            border: 'none',
            outline: 'none',
            padding: '8px 12px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            background: 'transparent',
            color: 'var(--color-text)',
            minWidth: 0,
          }}
        />
        {inputValue && (
          <Button variant="ghost"
            type="button"
            aria-label="Clear value"
            onClick={() => { setInputValue(''); onChange(''); inputRef.current?.focus() }}
            style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 4px 4px 0', color: 'var(--color-text-muted)' }}
          >
            <X size={14} />
          </Button>
        )}
        <Button variant="ghost"
          type="button"
          aria-label="Show options"
          aria-expanded={isOpen}
          onClick={() => { setIsOpen(!isOpen); inputRef.current?.focus() }}
          style={{ borderRadius: 'var(--radius)',  border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px 4px 2px', color: 'var(--color-text)' }}
        >
          <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </Button>
      </div>

      {isOpen && (filteredOptions.length > 0 || isCustomValue) && (
        <div
          style={{ borderRadius: 'var(--radius)',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderTop: 'none',
            zIndex: 50,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <ul id={`${inputId}-options`} role="listbox" aria-label={label || placeholder} ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {filteredOptions.map((opt, idx) => (
              <li
                id={`${inputId}-option-${idx}`}
                role="option"
                aria-selected={highlightedIndex === idx}
                key={opt}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  color: highlightedIndex === idx ? 'var(--on-accent,#111)' : 'var(--color-text)',
                  background: highlightedIndex === idx ? 'var(--bg-cyan,#00F7FF)' : 'transparent',
                  fontWeight: opt === value ? 700 : 400,
                }}
              >
                {opt}
              </li>
            ))}
          </ul>
          {isCustomValue && onAddOption && (
            <div
              style={{
                borderTop: '1px solid var(--color-separator)',
                padding: '6px',
              }}
            >
              <Button variant="ghost"
                type="button"
                onClick={handleAddCustom}
                className="flex items-center gap-1 w-full"
                style={{ borderRadius: 'var(--radius)',
                  padding: '6px 8px',
                  border: '1px dashed var(--color-border)',
                  background: 'var(--bg-cyan,#00F7FF)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'none',
                  color: 'var(--on-accent,#111)',
                }}
              >
                <Plus size={12} />
                Tambah "{inputValue.trim()}" ke daftar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
