import type { Profession } from "@/lib/types";
import { PROFESSION_STYLES, PROFESSION_LABEL } from "@/lib/professions";

// Sleek tinted pill used for a player's profession set — shared by the live
// dashboard and the exportable team sheet so styling never drifts.
export function ProfessionBadge({ profession }: { profession: Profession }) {
    const s = PROFESSION_STYLES[profession];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[11px] font-medium capitalize tracking-tight ${s.chip} ${s.text}`}>
            <span className={`size-1.5 rounded-full ${s.dot}`} />
            {PROFESSION_LABEL[profession]}
        </span>
    );
}
