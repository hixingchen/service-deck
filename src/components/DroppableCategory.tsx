import { useDroppable } from "@dnd-kit/core";

export function DroppableCategory({ category }: { category: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `droppable-${category}` });
  return (
    <div ref={setNodeRef} className={`text-[12px] px-4 py-3 rounded-lg border border-dashed text-center transition-colors ${
      isOver ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-white/[0.06] text-gray-600"
    }`}>
      拖拽服务到这里
    </div>
  );
}
