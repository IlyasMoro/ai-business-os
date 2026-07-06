import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchForm({
  placeholder = "Search...",
  defaultValue,
}: {
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <form method="GET" className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="search"
        name="q"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="pl-9"
      />
    </form>
  );
}
