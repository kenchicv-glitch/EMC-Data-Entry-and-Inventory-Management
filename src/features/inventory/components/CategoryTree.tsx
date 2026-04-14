import { useState } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Folder,
    FolderOpen,
    Package,
} from 'lucide-react';
import type { CategoryTree } from '../types/product';

interface CategoryTreeProps {
    tree: CategoryTree[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    productCounts?: Record<string, number>;
}

function TreeNode({
    node,
    selectedId,
    onSelect,
    productCounts,
    depth,
}: {
    node: CategoryTree;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    productCounts?: Record<string, number>;
    depth: number;
}) {
    const [isOpen, setIsOpen] = useState(depth === 0);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedId === node.id;
    const count = productCounts?.[node.id] ?? 0;

    return (
        <div>
            <button
                onClick={() => {
                    if (hasChildren) setIsOpen(o => !o);
                    onSelect(node.id);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-all group
                    ${isSelected
                        ? 'bg-brand-red/10 text-brand-red font-semibold'
                        : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                    }`}
                style={{ paddingLeft: `${(depth * 12) + 12}px` }}
            >
                {/* Expand toggle */}
                {hasChildren ? (
                    <span className="w-4 h-4 flex items-center justify-center shrink-0 text-text-muted">
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                ) : (
                    <span className="w-4 h-4 shrink-0" />
                )}

                {/* Folder icon */}
                {hasChildren ? (
                    isOpen
                        ? <FolderOpen size={14} className="shrink-0 text-amber-400" />
                        : <Folder size={14} className="shrink-0 text-amber-400" />
                ) : (
                    <Package size={14} className="shrink-0 text-text-muted" />
                )}

                {/* Color dot */}
                {node.color && (
                    <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: node.color }}
                    />
                )}

                <span className="flex-1 truncate">{node.name}</span>

                {count > 0 && (
                    <span className="text-[10px] font-black text-text-muted ml-1">{count}</span>
                )}
            </button>

            {isOpen && hasChildren && (
                <div>
                    {node.children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            productCounts={productCounts}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CategoryTreeComponent({
    tree,
    selectedId,
    onSelect,
    productCounts,
}: CategoryTreeProps) {
    return (
        <div className="space-y-0.5">
            {/* All Products node */}
            <button
                onClick={() => onSelect(null)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm font-semibold transition-all
                    ${selectedId === null
                        ? 'bg-brand-red/10 text-brand-red'
                        : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                    }`}
            >
                <span className="w-4 h-4 shrink-0" />
                <Package size={14} className="shrink-0" />
                <span className="flex-1">All Products</span>
            </button>

            {tree.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    productCounts={productCounts}
                    depth={0}
                />
            ))}
        </div>
    );
}
