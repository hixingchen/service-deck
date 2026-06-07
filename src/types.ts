export interface Service {
  id: string;
  name: string;
  command: string;
  path: string;
  sort_index: number;
  env_vars: Record<string, string>;
  log_path: string;
  service_type: string;
  cli_path: string;
  health_check_url: string;
  health_check_interval: number;
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
