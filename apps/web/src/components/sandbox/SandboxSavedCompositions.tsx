'use client';

export interface SavedComposition {
  id: string;
  plan_hash: string;
  vector_hash: string;
  created_at: string;
  export_id?: string | null;
  source?: string | null;
}

export interface SandboxSavedCompositionsProps {
  savedList: SavedComposition[];
  listLoading: boolean;
  listError: string | null;
  onRefresh: () => void;
  onLoad: (compositionId: string) => void;
}

export function SandboxSavedCompositions({
  savedList,
  listLoading,
  listError,
  onRefresh,
  onLoad,
}: SandboxSavedCompositionsProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-text-primary">Saved</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={listLoading}
          className="px-2 py-1 text-xs rounded border border-border bg-bgElev hover:bg-bgElev/80 disabled:opacity-50 text-text-primary"
        >
          {listLoading ? '…' : 'Refresh'}
        </button>
      </div>
      {listError && <p className="mb-2 text-xs text-red-400">{listError}</p>}
      {savedList.length === 0 ? (
        <p className="text-xs text-text-secondary">No saved compositions. Generate then Save.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {savedList.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-xs border border-border/60 rounded p-2 bg-bgElev/50">
              <span className="truncate text-text-secondary" title={item.id}>
                {item.plan_hash?.slice(0, 8) ?? item.id.slice(0, 8)} — {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
              </span>
              <button
                type="button"
                onClick={() => onLoad(item.id)}
                className="flex-shrink-0 px-2 py-1 rounded border border-border bg-bgElev hover:bg-bgElev/80 text-text-primary"
              >
                Load
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
