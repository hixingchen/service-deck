import { useCallback } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { invoke } from "@tauri-apps/api/core";
import type { Service, Project } from "../types";

export function useDnD(
  sortedServices: Service[],
  sortedProjects: Project[],
  loadData: () => Promise<void>
) {
  // 拖拽传感器（只定义一次）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 项目拖拽排序
  const handleProjectDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedProjects.findIndex(p => p.id === active.id);
    const newIndex = sortedProjects.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedProjects, oldIndex, newIndex);
    const updates = reordered.map((p, i) => [p.id, i] as [string, number]);

    try {
      await invoke("update_project_sort", { updates });
      await loadData();
    } catch (e) {
      console.error("更新排序失败:", e);
    }
  }, [sortedProjects, loadData]);

  // 服务拖拽排序
  const handleServiceDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedServices.findIndex(s => s.id === active.id);
    const newIndex = sortedServices.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sortedServices, oldIndex, newIndex);
    const updates = reordered.map((s, i) => [s.id, i] as [string, number]);

    try {
      await invoke("update_service_sort", { updates });
      await loadData();
    } catch (e) {
      console.error("更新服务排序失败:", e);
    }
  }, [sortedServices, loadData]);

  return {
    sensors,
    handleProjectDragEnd,
    handleServiceDragEnd,
  };
}
