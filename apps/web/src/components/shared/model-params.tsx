import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/shared/section-label'

interface ModelParamsValue {
  temperature?: number
  maxTokens?: number
  topP?: number
}

interface ModelParamsProps {
  temperature?: number
  maxTokens?: number
  topP?: number
  onChange: (params: ModelParamsValue) => void
  disabled?: boolean
}

export function ModelParams({
  temperature,
  maxTokens,
  topP,
  onChange,
  disabled,
}: ModelParamsProps) {
  function handleChange(field: keyof ModelParamsValue, raw: string) {
    const parsed = raw === '' ? undefined : Number(raw)
    onChange({ temperature, maxTokens, topP, [field]: parsed })
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Model Parameters</SectionLabel>

      <div className="flex flex-col gap-1.5">
        <Label>Temperature</Label>
        <Input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={temperature ?? ''}
          onChange={(e) => handleChange('temperature', e.target.value)}
          placeholder="e.g. 0.7"
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Max Tokens</Label>
        <Input
          type="number"
          min={1}
          step={1}
          value={maxTokens ?? ''}
          onChange={(e) => handleChange('maxTokens', e.target.value)}
          placeholder="e.g. 1024"
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Top P</Label>
        <Input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={topP ?? ''}
          onChange={(e) => handleChange('topP', e.target.value)}
          placeholder="e.g. 0.9"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
