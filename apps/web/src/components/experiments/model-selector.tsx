import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AVAILABLE_MODELS, MODEL_TIERS, getModelDisplayName } from '@/lib/models'

interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v)
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a model…">
          {value ? getModelDisplayName(value) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MODEL_TIERS.map((tier) => (
          <SelectGroup key={tier.key}>
            <SelectLabel>{tier.label}</SelectLabel>
            {AVAILABLE_MODELS.filter((m) => m.tier === tier.key).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span>{m.name}</span>
                <span className="ml-1.5 text-muted-foreground text-xs">{m.provider}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
