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
  depends_on: string[];
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

export interface ServiceHealth {
  service_id: string;
  status: "healthy" | "unhealthy" | "starting" | "unknown";
  last_check: number;
  message?: string;
}

export interface ServiceWithHealth extends Service {
  health?: ServiceHealth;
  running: boolean;
  pid?: number;
}
