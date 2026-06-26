use regex::Regex;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct MethodInfo {
    pub name: String,
    pub start_line: usize,
    pub end_line: usize,
}

pub fn analyze_file_static(content: &str) -> (String, String, String, Vec<MethodInfo>) {
    let class_name = extract_class_name(content);
    let package = extract_package(content);
    let layer = detect_layer(content);
    let methods = extract_methods(content);
    (class_name, package, layer, methods)
}

fn extract_class_name(content: &str) -> String {
    let re = Regex::new(r"(public\s+)?(class|interface|enum)\s+(\w+)").unwrap();
    if let Some(cap) = re.captures(content) {
        cap.get(3).map_or("Unknown".to_string(), |m| m.as_str().to_string())
    } else {
        "Unknown".to_string()
    }
}

fn extract_package(content: &str) -> String {
    let re = Regex::new(r"package\s+([\w.]+);").unwrap();
    if let Some(cap) = re.captures(content) {
        cap.get(1).map_or(String::new(), |m| m.as_str().to_string())
    } else {
        String::new()
    }
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

fn extract_methods(content: &str) -> Vec<MethodInfo> {
    let re = Regex::new(r"(public|private|protected)\s+\w+\s+(\w+)\s*\(").unwrap();
    let mut methods = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut brace_count = 0;
    let mut current_method: Option<(String, usize)> = None;

    for (i, line) in lines.iter().enumerate() {
        let line_num = i + 1;

        if let Some(cap) = re.captures(line) {
            if !line.contains("class ") && !line.contains("interface ") {
                if let Some((name, start)) = current_method.take() {
                    methods.push(MethodInfo {
                        name,
                        start_line: start,
                        end_line: line_num - 1,
                    });
                }
                let name = cap.get(2).map_or(String::new(), |m| m.as_str().to_string());
                current_method = Some((name, line_num));
                brace_count = line.matches('{').count() as i32 - line.matches('}').count() as i32;
                continue;
            }
        }

        if let Some((ref _name, ref _start)) = current_method {
            brace_count += line.matches('{').count() as i32;
            brace_count -= line.matches('}').count() as i32;
            if brace_count <= 0 {
                if let Some((name, start)) = current_method.take() {
                    methods.push(MethodInfo {
                        name,
                        start_line: start,
                        end_line: line_num,
                    });
                }
            }
        }
    }

    if let Some((name, start)) = current_method.take() {
        methods.push(MethodInfo {
            name,
            start_line: start,
            end_line: lines.len(),
        });
    }

    methods
}
