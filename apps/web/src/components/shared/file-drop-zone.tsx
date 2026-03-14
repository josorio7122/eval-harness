import { useRef, useState } from 'react'
import { Upload, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  accept?: string
  onFileSelect: (file: File) => void
  fileName?: string
  disabled?: boolean
}

export function FileDropZone({ accept, onFileSelect, fileName, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors',
        isDragging && !disabled && 'border-primary bg-primary/5',
        !isDragging && !disabled && 'border-muted-foreground/25 hover:border-muted-foreground/50',
        disabled && 'opacity-50 cursor-not-allowed',
        fileName && 'border-solid border-muted-foreground/25 bg-muted/30',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
      {fileName ? (
        <>
          <FileCheck className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-foreground font-medium">{fileName}</span>
          <span className="text-xs text-muted-foreground">Click or drop to replace</span>
        </>
      ) : (
        <>
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Drag & drop a CSV file, or click to browse
          </span>
        </>
      )}
    </div>
  )
}
