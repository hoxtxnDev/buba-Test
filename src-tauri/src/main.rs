mod analyzer;
mod models;
mod opencode;
mod patcher;

use analyzer::architecture::build_architecture_graph;
use analyzer::file_scanner::scan_folder;
use analyzer::parser::analyze_file_static;
use analyzer::static_rules::run_all_rules;
use models::{AnalysisResult, FileEntry, Issue, ProjectAnalysis};
use opencode::runner::run_opencode_analysis;
use patcher::apply_fix_to_file;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

fn normalize_path(path: &str) -> PathBuf {
    PathBuf::from(path.replace('/', std::path::MAIN_SEPARATOR_STR))
}

struct AppState {
    project_root: Mutex<Option<String>>,
}

#[tauri::command]
fn build_architecture(root: String) -> Result<analyzer::architecture::ArchitectureGraph, String> {
    let normalized = normalize_path(&root);
    build_architecture_graph(normalized.to_str().unwrap_or(&root)).map_err(|e| e)
}

#[tauri::command]
async fn open_folder(app: tauri::AppHandle) -> Result<FileEntry, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .pick_folder(move |file| {
            tx.send(file).ok();
        });
    let file = rx.await.map_err(|_| "Error al seleccionar carpeta".to_string())?;
    match file {
        Some(path) => {
            let path_str = path.to_string();
            let normalized = normalize_path(&path_str);
            let state = app.state::<AppState>();
            *state.project_root.lock().unwrap() = Some(path_str.clone());
            scan_folder(normalized.to_str().unwrap_or(&path_str)).map_err(|e| e.to_string())
        }
        None => Err("No se seleccionó ninguna carpeta".to_string()),
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let normalized = normalize_path(&path);
    fs::read_to_string(&normalized)
        .map_err(|e| format!("Error leyendo {}: {}", normalized.display(), e))
}

#[tauri::command]
fn analyze_file(path: String) -> Result<AnalysisResult, String> {
    let normalized = normalize_path(&path);
    let content = fs::read_to_string(&normalized)
        .map_err(|e| format!("Error leyendo {}: {}", normalized.display(), e))?;
    let (class_name, package, layer, _methods) = analyze_file_static(&content);
    let issues = run_all_rules(&path, &content);
    Ok(AnalysisResult {
        issues,
        class_name,
        package,
        layer,
    })
}

#[tauri::command]
fn analyze_project(root: String) -> Result<ProjectAnalysis, String> {
    let normalized_root = normalize_path(&root);
    let root_str = normalized_root.to_str().unwrap_or(&root);
    let entries = scan_folder(root_str).map_err(|e| e.to_string())?;
    let mut total_files = 0;
    let mut total_lines = 0;
    let mut all_issues: Vec<Issue> = Vec::new();
    let mut file_issue_counts: Vec<(String, usize)> = Vec::new();

    fn count_files_and_issues(
        entry: &FileEntry,
        files: &mut usize,
        lines: &mut usize,
        issues: &mut Vec<Issue>,
        counts: &mut Vec<(String, usize)>,
    ) {
        if entry.children.is_empty() {
            *files += 1;
            *lines += entry.lines;
            let normalized = normalize_path(&entry.path);
            if let Ok(content) = fs::read_to_string(&normalized) {
                let file_issues = run_all_rules(&entry.path, &content);
                let count = file_issues.len();
                if count > 0 {
                    counts.push((entry.path.clone(), count));
                }
                issues.extend(file_issues);
            }
        } else {
            for child in &entry.children {
                count_files_and_issues(child, files, lines, issues, counts);
            }
        }
    }
    count_files_and_issues(&entries, &mut total_files, &mut total_lines, &mut all_issues, &mut file_issue_counts);

    file_issue_counts.sort_by(|a, b| b.1.cmp(&a.1));

    let mut critical = 0;
    let mut warning = 0;
    let mut info = 0;
    for issue in &all_issues {
        match issue.severity.as_str() {
            "CRITICAL" => critical += 1,
            "WARNING" => warning += 1,
            _ => info += 1,
        }
    }

    let mut layers = std::collections::BTreeSet::new();
    fn collect_layers(entry: &FileEntry, layers: &mut std::collections::BTreeSet<String>) {
        if !entry.layer.is_empty() {
            layers.insert(entry.layer.clone());
        }
        for child in &entry.children {
            collect_layers(child, layers);
        }
    }
    collect_layers(&entries, &mut layers);

    Ok(ProjectAnalysis {
        total_files,
        total_lines,
        issues_by_severity: models::SeverityCount {
            critical,
            warning,
            info,
        },
        top_files: file_issue_counts.into_iter().take(5).map(|(f, c)| models::FileIssueCount {
            file: std::path::Path::new(&f)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or(f),
            count: c,
        }).collect(),
        layers: layers.into_iter().collect(),
    })
}

#[tauri::command]
fn run_opencode(
    app: tauri::AppHandle,
    file_content: String,
    context: String,
) -> Result<String, String> {
    let result = run_opencode_analysis(&file_content, &context)?;
    app.emit("opencode-progress", "Análisis completado").unwrap();
    Ok(result)
}

#[tauri::command]
fn apply_fix(path: String, line: usize, fix: String) -> Result<(), String> {
    let normalized = normalize_path(&path);
    apply_fix_to_file(normalized.to_str().unwrap_or(&path), line, &fix).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_test(path: String, layer: String) -> Result<String, String> {
    let normalized = normalize_path(&path);
    let content = fs::read_to_string(&normalized)
        .map_err(|e| format!("Error leyendo {}: {}", normalized.display(), e))?;
    let (class_name, package, detected_layer, _methods) = analyze_file_static(&content);
    let target_layer = if layer.is_empty() { detected_layer } else { layer };

    let test_package = format!("{}.test", package.trim_end_matches('.'));
    let test_class = format!("{}Test", class_name);

    let _annotation = match target_layer.as_str() {
        "CONTROLLER" => "@WebMvcTest",
        "SERVICE" => "@ExtendWith(MockitoExtension.class)",
        "REPOSITORY" => "@DataJpaTest",
        _ => "",
    };

    let imports = match target_layer.as_str() {
        "CONTROLLER" => {
            "import org.junit.jupiter.api.Test;\nimport org.springframework.beans.factory.annotation.Autowired;\nimport org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;\nimport org.springframework.test.context.bean.override.mockito.MockitoBean;\nimport org.springframework.test.web.servlet.MockMvc;\nimport static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;\nimport static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;"
        }
        "SERVICE" => {
            "import org.junit.jupiter.api.Test;\nimport org.junit.jupiter.api.extension.ExtendWith;\nimport org.mockito.InjectMocks;\nimport org.mockito.Mock;\nimport org.mockito.junit.jupiter.MockitoExtension;\nimport static org.mockito.Mockito.*;"
        }
        "REPOSITORY" => {
            "import org.junit.jupiter.api.Test;\nimport org.springframework.beans.factory.annotation.Autowired;\nimport org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;\nimport static org.assertj.core.api.Assertions.*;"
        }
        _ => {
            "import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;"
        }
    };

    let test_code = format!(
        r#"{package_line}

{imports}
class {class_name} {{

    @Test
    void primerTest() {{
        // TODO: implementar
    }}
}}"#,
        package_line = format!("package {};", test_package),
        imports = imports,
        class_name = test_class
    );

    Ok(test_code)
}

#[tauri::command]
fn save_test(content: String, dest: String) -> Result<(), String> {
    let normalized = normalize_path(&dest);
    fs::write(&normalized, &content).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            project_root: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            open_folder,
            read_file,
            analyze_file,
            analyze_project,
            run_opencode,
            apply_fix,
            generate_test,
            save_test,
            build_architecture,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar JavaLens");
}
