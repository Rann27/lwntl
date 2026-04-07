/**
 * LWNTL ComboBox Component
 * Combines dropdown with text input — user can select from list or type custom value
 */

import { useState, useRef, useEffect } from 'react'
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
        <label className="block mb-1.5" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666' }}>
          {label}
        </label>
      )}
      <div
        className="flex items-center"
        style={{
          border: '2.5px solid #111',
          background: '#fff',
          position: 'relative',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
          style={{
            border: 'none',
            outline: 'none',
            padding: '8px 12px',
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
            background: 'transparent',
            minWidth: 0,
          }}
        />
        {inputValue && (
          <button
            type="button"
            onClick={() => { setInputValue(''); onChange(''); inputRef.current?.focus() }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 4px 4px 0', color: '#999' }}
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => { setIsOpen(!isOpen); inputRef.current?.focus() }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px 4px 2px', color: '#111' }}
        >
          <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
      </div>

      {isOpen && (filteredOptions.length > 0 || isCustomValue) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '2.5px solid #111',
            borderTop: 'none',
            zIndex: 50,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <ul ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {filteredOptions.map((opt, idx) => (
              <li
                key={opt}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: "'Inter', sans-serif",
                  background: highlightedIndex === idx ? '#00F7FF' : 'transparent',
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
                borderTop: '2px solid #eee',
                padding: '6px',
              }}
            >
              <button
                type="button"
                onClick={handleAddCustom}
                className="flex items-center gap-1 w-full"
                style={{
                  padding: '6px 8px',
                  border: '2px dashed #111',
                  background: '#00F7FF',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <Plus size={12} />
                Tambah "{inputValue.trim()}" ke daftar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}