use crate::models::Issue;
use regex::Regex;
use std::sync::OnceLock;

fn lazy_re(pattern: &str) -> &Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(pattern).unwrap())
}

pub fn run_all_rules(path: &str, content: &str) -> Vec<Issue> {
    let mut issues = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    check_transactional(path, &lines, &mut issues);
    check_field_injection(path, &lines, &mut issues);
    check_empty_catch(path, &lines, &mut issues);
    check_null_optional(path, &lines, &mut issues);
    check_missing_validation(path, &lines, &mut issues);
    check_hardcoded_sensitive(path, &lines, &mut issues);

    if lines.len() > 300 {
        issues.push(Issue {
            file: path.to_string(),
            line: 1,
            severity: "INFO".to_string(),
            rule: "SRP_CLASS_SIZE".to_string(),
            message: format!("La clase tiene {} líneas, supera el límite recomendado de 300 líneas. Posible violación de SRP.", lines.len()),
            suggestion: "Extrae responsabilidades en clases separadas para mantener cada clase por debajo de 300 líneas.".to_string(),
            code_fix: None,
        });
    }

    for (i, method_range) in extract_method_ranges(content).iter().enumerate() {
        let method_lines = method_range.1 - method_range.0;
        if method_lines > 30 {
            issues.push(Issue {
                file: path.to_string(),
                line: method_range.0,
                severity: "INFO".to_string(),
                rule: "LONG_METHOD".to_string(),
                message: format!("El método #{} tiene {} líneas, supera el límite recomendado de 30 líneas.", i + 1, method_lines),
                suggestion: "Extrae bloques lógicos en métodos privados para reducir la longitud.".to_string(),
                code_fix: None,
            });
        }
    }

    issues
}

fn check_transactional(path: &str, lines: &[&str], issues: &mut Vec<Issue>) {
    let content = lines.join("\n");
    if !content.contains("@Service") { return; }
    if content.contains("@Transactional") { return; }

    let repo_calls: Vec<&str> = lines.iter()
        .filter(|l| l.contains(".save(") || l.contains(".delete(") || l.contains(".find"))
        .copied()
        .collect();
    if repo_calls.len() < 2 { return; }

    for (idx, line) in lines.iter().enumerate() {
        if line.contains(".save(") || line.contains(".delete(") {
            let fix = format!("    @Transactional\n{}", line);
            issues.push(Issue {
                file: path.to_string(),
                line: idx + 1,
                severity: "CRITICAL".to_string(),
                rule: "MISSING_TRANSACTIONAL".to_string(),
                message: "Método Service realiza múltiples operaciones de repositorio sin @Transactional.".to_string(),
                suggestion: "Agrega @Transactional sobre el método o la clase.".to_string(),
                code_fix: Some(fix),
            });
            break;
        }
    }
}

fn check_field_injection(path: &str, lines: &[&str], issues: &mut Vec<Issue>) {
    let full = lines.join("\n");
    let re = lazy_re(r"@Autowired\s*\n\s*(private|public|protected)");
    for cap in re.find_iter(&full) {
        let prefix = &full[..cap.start()];
        let line_num = prefix.lines().count() + 1;
        issues.push(Issue {
            file: path.to_string(),
            line: line_num,
            severity: "WARNING".to_string(),
            rule: "FIELD_INJECTION".to_string(),
            message: "Inyección por campo con @Autowired. Preferir inyección por constructor.".to_string(),
            suggestion: "Reemplaza la inyección por campo con un constructor que reciba la dependencia.".to_string(),
            code_fix: None,
        });
    }
}

fn check_empty_catch(path: &str, lines: &[&str], issues: &mut Vec<Issue>) {
    let full = lines.join("\n");
    let re = lazy_re(r"catch\s*\([^)]*\)\s*\{\s*\}");
    for cap in re.find_iter(&full) {
        let matched = cap.as_str();
        let prefix = &full[..cap.start()];
        let line_num = prefix.lines().count() + 1;
        let fix = matched.replace("{ }", "{ log.error(\"Excepción\", e); }");
        issues.push(Issue {
            file: path.to_string(),
            line: line_num,
            severity: "CRITICAL".to_string(),
            rule: "EMPTY_CATCH".to_string(),
            message: "Bloque catch vacío. La excepción se traga silenciosamente.".to_string(),
            suggestion: "Agrega al menos logging o relanza la excepción.".to_string(),
            code_fix: Some(fix),
        });
    }
}

fn check_null_optional(path: &str, lines: &[&str], issues: &mut Vec<Issue>) {
    for (i, line) in lines.iter().enumerate() {
        if line.contains("return null;") {
            let start = i.saturating_sub(3);
            let end = std::cmp::min(i + 4, lines.len());
            let nearby = &lines[start..end];
            if nearby.iter().any(|l| l.contains("Optional")) {
                let indent = line.chars().take_while(|c| c.is_whitespace()).collect::<String>();
                let fix = format!("{}return Optional.empty();", indent);
                issues.push(Issue {
                    file: path.to_string(),
                    line: i + 1,
                    severity: "CRITICAL".to_string(),
                    rule: "NULL_OPTIONAL".to_string(),
                    message: "Retorna null en un método que devuelve Optional.".to_string(),
                    suggestion: "return Optional.empty() en lugar de null.".to_string(),
                    code_fix: Some(fix),
                });
            }
        }
    }
}

fn check_missing_validation(path: &str, lines: &[&str], issues: &mut Vec<Issue>) {
    for (i, line) in lines.iter().enumerate() {
        if line.contains("@RequestBody") {
            let line_before = if i > 0 { lines[i - 1] } else { "" };
            if !line_before.contains("@Valid")
                && !line_before.contains("@NotNull")
                && !line.contains("@Valid")
                && !line.contains("@NotNull")
            {
                let fix = line.replace("@RequestBody", "@Valid @RequestBody");
                issues.push(Issue {
                    file: path.to_string(),
                    line: i + 1,
                    severity: "WARNING".to_string(),
                    rule: "MISSING_VALIDATION".to_string(),
                    message: "@RequestBody sin @Valid. No se validan los campos del cuerpo.".to_string(),
                    suggestion: "Agrega @Valid antes del parámetro @RequestBody.".to_string(),
                    code_fix: Some(fix),
                });
            }
        }
    }
}

fn check_hardcoded_sensitive(path: &str, lines: &[&str], issues: &mut Vec<Issue>) {
    let full = lines.join("\n");
    let url_re = lazy_re(r#""https?://[^"]+""#);
    let cred_re = lazy_re(r#""(password|secret|token|apikey|api_key|jwt)=[^"]*"#);

    for cap in url_re.find_iter(&full) {
        let prefix = &full[..cap.start()];
        let line_num = prefix.lines().count() + 1;
        issues.push(Issue {
            file: path.to_string(),
            line: line_num,
            severity: "WARNING".to_string(),
            rule: "HARDCODED_URL".to_string(),
            message: "URL hardcodeada en el código. Debe ir en application.properties.".to_string(),
            suggestion: "Extrae a application.properties y usa @Value.".to_string(),
            code_fix: None,
        });
    }

    for cap in cred_re.find_iter(&full) {
        let prefix = &full[..cap.start()];
        let line_num = prefix.lines().count() + 1;
        issues.push(Issue {
            file: path.to_string(),
            line: line_num,
            severity: "CRITICAL".to_string(),
            rule: "HARDCODED_CREDENTIALS".to_string(),
            message: "Posible credencial hardcodeada en el código.".to_string(),
            suggestion: "Usa variables de entorno o un vault de secretos.".to_string(),
            code_fix: None,
        });
    }
}

fn extract_method_ranges(content: &str) -> Vec<(usize, usize)> {
    let re = lazy_re(r"(public|private|protected)\s+\w+\s+\w+\s*\([^)]*\)\s*\{");
    let mut ranges = Vec::new();
    let mut brace_count = 0;
    let mut method_start = 0;
    let mut in_method = false;

    for (i, line) in content.lines().enumerate() {
        let line_num = i + 1;
        if re.is_match(line) && !in_method {
            method_start = line_num;
            in_method = true;
            brace_count = line.matches('{').count() as i32 - line.matches('}').count() as i32;
        } else if in_method {
            brace_count += line.matches('{').count() as i32;
            brace_count -= line.matches('}').count() as i32;
            if brace_count <= 0 {
                ranges.push((method_start, line_num));
                in_method = false;
            }
        }
    }
    ranges
}
