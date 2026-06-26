use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub lines: usize,
    pub layer: String,
    pub children: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub file: String,
    pub line: usize,
    pub severity: String,
    pub rule: String,
    pub message: String,
    pub suggestion: String,
    pub code_fix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAnalysis {
    pub total_files: usize,
    pub total_lines: usize,
    pub issues_by_severity: SeverityCount,
    pub top_files: Vec<FileIssueCount>,
    pub layers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeverityCount {
    pub critical: usize,
    pub warning: usize,
    pub info: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileIssueCount {
    pub file: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub issues: Vec<Issue>,
    pub class_name: String,
    pub package: String,
    pub layer: String,
}
