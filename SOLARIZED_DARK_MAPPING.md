# Solarized Dark Color Mapping for MindShifting

## Solarized Dark Palette
```
base03:  #002b36  (darkest background)
base02:  #073642  (dark background highlights)
base01:  #586e75  (optional emphasized content)
base00:  #657b83  (body text / default code / primary content)
base0:   #839496  (primary content)
base1:   #93a1a1  (comments / secondary content)
base2:   #eee8d5  (background highlights)
base3:   #fdf6e3  (lightest background)

Accent colors:
yellow:  #b58900
orange:  #cb4b16
red:     #dc322f
magenta: #d33682
violet:  #6c71c4
blue:    #268bd2
cyan:    #2aa198
green:   #859900
```

## Color Replacement Strategy

### Background Colors
- `dark:bg-gray-900` → `dark:bg-[#002b36]` (base03)
- `dark:bg-gray-800` → `dark:bg-[#073642]` (base02)
- `dark:bg-gray-700` → `dark:bg-[#586e75]` (base01)
- `dark:bg-gray-600` → `dark:bg-[#657b83]` (base00)
- `dark:bg-gray-50` → keep light mode unchanged

### Text Colors
- `dark:text-white` → `dark:text-[#fdf6e3]` (base3)
- `dark:text-gray-300` → `dark:text-[#93a1a1]` (base1)
- `dark:text-gray-400` → `dark:text-[#839496]` (base0)
- `dark:text-gray-500` → `dark:text-[#839496]` (base0)
- `dark:text-gray-600` → `dark:text-[#657b83]` (base00)

### Border Colors
- `dark:border-gray-700` → `dark:border-[#586e75]` (base01)
- `dark:border-gray-600` → `dark:border-[#657b83]` (base00)
- `dark:border-gray-800` → `dark:border-[#073642]` (base02)

### Hover States
- `dark:hover:bg-gray-700` → `dark:hover:bg-[#586e75]` (base01)
- `dark:hover:bg-gray-600` → `dark:hover:bg-[#657b83]` (base00)
- `dark:hover:text-gray-200` → `dark:hover:text-[#eee8d5]` (base2)

### Special Elements
- Indigo colors (keep for branding/primary actions)
- Success/Error states can use green/red from Solarized
