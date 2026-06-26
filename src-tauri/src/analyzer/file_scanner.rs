use crate::models::FileEntry;
use std::collections::HashMap;
use std::path::Path;
use walkdir::WalkDir;

pub fn scan_folder(root: &str) -> Result<FileEntry, anyhow::Error> {
    let root_path = Path::new(root);
    let root_name = root_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut packages: HashMap<String, Vec<FileEntry>> = HashMap::new();

    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map(|e| e == "java").unwrap_or(false) {
            let content = std::fs::read_to_string(path).unwrap_or_default();
            let lines = content.lines().count();
            let layer = detect_layer(&content);
            let pkg = extract_package(&content).unwrap_or_else(|| "default".to_string());

            let file_entry = FileEntry {
                path: path.to_string_lossy().to_string(),
                name: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                lines,
                layer,
                children: Vec::new(),
            };
            packages.entry(pkg).or_default().push(file_entry);
        }
    }

    let mut children: Vec<FileEntry> = packages
        .into_iter()
        .map(|(pkg_name, mut files)| {
            files.sort_by(|a, b| a.name.cmp(&b.name));
            FileEntry {
                path: pkg_name.clone(),
                name: pkg_name,
                lines: 0,
                layer: String::new(),
                children: files,
            }
        })
        .collect();
    children.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(FileEntry {
        path: root.to_string(),
        name: root_name,
        lines: 0,
        layer: String::new(),
        children,
    })
}

fn detect_layer(content: &str) -> String {
    if content.contains("@RestController") || content.contains("@Controller") {
        "CONTROLLER".to_string()
    } else if content.contains("@Service") {
        "SERVICE".to_string()
    } else if content.contains("@Repository") {
        "REPOSITORY".to_string()
    } else if content.contains("@Entity") {
        "ENTITY".to_string()
    } else {
        "OTHER".to_string()
    }
}

fn extract_package(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("package ") {
            return Some(
                trimmed
                    .strip_prefix("package ")?
                    .trim_end_matches(';')
                    .to_string(),
            );
        }
    }
    None
}
