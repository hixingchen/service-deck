export interface Service {
  id: string;
  name: string;
  command: string;
  path: string;
  startup_type: string;
  sort_index: number;
  env_vars: Record<string, string>;
  log_path: string;
  category: string;
}

export interface Project {
  id: string;
  name: string;
  services: Service[];
  sort_index: number;
}

export type View = "projects" | "services";
