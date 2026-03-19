import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AVAILABLE_MODELS, MODEL_PROVIDERS, getModelDisplayName } from '@/lib/models'

interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v)
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a model…">
          {value ? getModelDisplayName(value) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MODEL_PROVIDERS.map((provider) => (
          <SelectGroup key={provider}>
            <SelectLabel>{provider}</SelectLabel>
            {AVAILABLE_MODELS.filter((m) => m.provider === provider).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
