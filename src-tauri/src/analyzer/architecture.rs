use crate::models::Issue;
use serde::Serialize;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use regex::Regex;
use super::static_rules::run_all_rules;

#[derive(Serialize)]
pub struct ArchNode {
    pub id: String,
    pub name: String,
    pub layer: String,
    pub pkg: String,
    pub path: String,
    pub microservice: String,
    pub lines: usize,
    pub issues: Vec<Issue>,
    pub endpoints: Vec<Endpoint>,
    pub dependencies: Vec<String>,
}

#[derive(Serialize)]
pub struct Endpoint {
    pub method: String,
    pub path: String,
}

#[derive(Serialize)]
pub struct ArchEdge {
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub edge_type: String,
}

#[derive(Serialize)]
pub struct ArchitectureGraph {
    pub nodes: Vec<ArchNode>,
    pub edges: Vec<ArchEdge>,
}

pub fn build_architecture_graph(root: &str) -> Result<ArchitectureGraph, String> {
    let mut nodes = Vec::new();
    let root_path = Path::new(root);

    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map(|e| e == "java").unwrap_or(false) {
            let content = fs::read_to_string(path).unwrap_or_default();
            let name = extract_class_name(&content);
            let layer = detect_layer(&content);
            let pkg = extract_package(&content);
            let microservice = path.parent()
                .and_then(|p| p.strip_prefix(root_path).ok())
                .and_then(|p| p.components().next())
                .map(|c| c.as_os_str().to_string_lossy().to_string())
                .unwrap_or_else(|| "default".to_string());
            
            nodes.push(ArchNode {
                id: name.clone(),
                name,
                layer,
                pkg,
                path: path.to_string_lossy().to_string(),
                microservice,
                lines: content.lines().count(),
                issues: run_all_rules(&path.to_string_lossy(), &content),
                endpoints: extract_endpoints(&content),
                dependencies: extract_dependencies(&content),
            });
        }
    }

    let mut edges = Vec::new();
    for node in &nodes {
        for dep in &node.dependencies {
            let edge_type = if nodes.iter().any(|n| &n.name == dep) {
                "INJECTION".to_string()
            } else {
                "MISSING".to_string()
            };
            edges.push(ArchEdge {
                from: node.id.clone(),
                to: dep.clone(),
                edge_type,
            });
        }
    }

    Ok(ArchitectureGraph { nodes, edges })
}

fn extract_class_name(content: &str) -> String {
    let re = Regex::new(r"(public\s+)?(class|interface|enum)\s+(\w+)").unwrap();
    re.captures(content).and_then(|c| c.get(3)).map(|m| m.as_str().to_string()).unwrap_or_else(|| "Unknown".to_string())
}

fn detect_layer(content: &str) -> String {
    if content.contains("@RestController") || content.contains("@Controller") { "CONTROLLER".to_string() }
    else if content.contains("@Service") { "SERVICE".to_string() }
    else if content.contains("@Repository") { "REPOSITORY".to_string() }
    else if content.contains("@Entity") { "ENTITY".to_string() }
    else { "UNKNOWN".to_string() }
}

fn extract_package(content: &str) -> String {
    Regex::new(r"package\s+([\w.]+);").unwrap().captures(content)
        .and_then(|c| c.get(1)).map(|m| m.as_str().to_string()).unwrap_or_default()
}

fn extract_endpoints(content: &str) -> Vec<Endpoint> {
    let re = Regex::new(r#"@([A-Z][a-z]+)Mapping\(\s*"([^"]+)"\)"#).unwrap();
    re.captures_iter(content).map(|c| Endpoint {
        method: c.get(1).map(|m| m.as_str().to_uppercase()).unwrap_or_default(),
        path: c.get(2).map(|m| m.as_str().to_string()).unwrap_or_default(),
    }).collect()
}

fn extract_dependencies(content: &str) -> Vec<String> {
    let re = Regex::new(r"@Autowired\s+(?:private|public)\s+(\w+)\s+\w+").unwrap();
    re.captures_iter(content).map(|c| c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default()).collect()
}
