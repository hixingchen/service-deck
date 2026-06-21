use std::collections::{HashMap, HashSet};
use crate::Service;

/// 按依赖关系拓扑排序服务 ID，返回正确的启动顺序
/// 无依赖的服务排在前面，被依赖的服务排在后面
pub fn resolve_order(services: &HashMap<String, Service>, ids: &[String]) -> Vec<String> {
    let id_set: HashSet<&String> = ids.iter().collect();
    let mut visited = HashSet::new();
    let mut result = Vec::new();

    for id in ids {
        visit(id, services, &id_set, &mut visited, &mut result);
    }

    result
}

fn visit(
    id: &str,
    services: &HashMap<String, Service>,
    id_set: &HashSet<&String>,
    visited: &mut HashSet<String>,
    result: &mut Vec<String>,
) {
    if visited.contains(id) {
        return;
    }
    visited.insert(id.to_string());

    if let Some(svc) = services.get(id) {
        for dep_id in &svc.depends_on {
            if id_set.contains(dep_id) {
                visit(dep_id, services, id_set, visited, result);
            }
        }
    }

    result.push(id.to_string());
}
