export interface Service {
  id: string;
  name: string;
  command: string;
  path: string;
  sort_index: number;
  env_vars: Record<string, string>;
  log_path: string;
  service_type: string;
  favorite: boolean;
}

export interface Project {
  id: string;
  name: string;
  services: Service[];
  sort_index: number;
  favorite: boolean;
}

export type View = "projects" | "services";
