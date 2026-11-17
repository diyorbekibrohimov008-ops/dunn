import { Badge } from "@/components/ui/badge";
import { BAND_LABEL, type AgeBand } from "@/lib/recovery";

const TONE: Record<AgeBand, "muted" | "paper" | "warn" | "danger" | "ok"> = {
  watch: "muted",
  fresh: "ok",
  warm: "paper",
  aging: "warn",
  risk: "danger",
  cold: "danger",
};

export function StatusChip({ band }: { band: AgeBand }) {
  return <Badge tone={TONE[band]}>{BAND_LABEL[band]}</Badge>;
}
