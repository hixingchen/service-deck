import { useState, useCallback } from "react";
import type { Project, Service } from "../types";

export function useProjectForm() {
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [newProjectServices, setNewProjectServices] = useState<Service[]>([]);

  const resetForm = useCallback(() => {
    setProjectName("");
    setNewProjectServices([]);
  }, []);

  const openAddForm = useCallback(() => {
    resetForm();
    setShowAddProject(true);
  }, [resetForm]);

  const openEditForm = useCallback((project: Project) => {
    setProjectName(project.name);
    setEditingProject(project);
  }, []);

  const closeForm = useCallback(() => {
    setShowAddProject(false);
    setEditingProject(null);
    resetForm();
  }, [resetForm]);

  const addService = useCallback((service: Service) => {
    setNewProjectServices(prev => [...prev, service]);
  }, []);

  const removeService = useCallback((serviceId: string) => {
    setNewProjectServices(prev => prev.filter(s => s.id !== serviceId));
  }, []);

  return {
    showAddProject,
    editingProject,
    projectName,
    newProjectServices,
    setProjectName,
    setEditingProject,
    openAddForm,
    openEditForm,
    closeForm,
    addService,
    removeService,
  };
}
