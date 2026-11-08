"use client";

import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FilterOption = { value: string; label: string };

type MultiSelectFilterProps = {
  label: string; // tetikleyicideki ad, örn. "Durum"
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

/**
 * Açılır menülü çoklu seçim. Satırlar onay kutusu gibi aç/kapa olur ve menü tıklayınca
 * kapanmaz; böylece aynı filtrede birden fazla değer seçilebilir. Tetikleyicide seçili
 * sayısı yazar: "Durum (2)".
 */
export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  // İşaretlenen değer listeye eklenir, işareti kaldırılan listeden çıkar.
  function toggle(value: string, checked: boolean) {
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  }

  return (
    <DropdownMenu>
      {/* render: tetikleyici bizim Button'ımız olarak çizilir; açma/kapama Menu'den gelir. */}
      <DropdownMenuTrigger render={<Button variant={selected.length ? "secondary" : "outline"} />}>
        {selected.length ? `${label} (${selected.length})` : label}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      {/* w-auto: menü tetikleyici kadar dar kalmasın, uzun isimler sığsın. */}
      <DropdownMenuContent className="w-auto min-w-44">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => toggle(option.value, checked)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
