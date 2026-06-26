use anyhow::Result;
use std::fs;

pub fn apply_fix_to_file(path: &str, line: usize, code_fix: &str) -> Result<()> {
    let content = fs::read_to_string(path)?;
    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

    if line == 0 || line > lines.len() {
        anyhow::bail!("Número de línea inválido: {}", line);
    }

    // Reemplazar la línea target con el code_fix (soporta multi-línea)
    lines[line - 1] = code_fix.to_string();

    let new_content = lines.join("\n");
    fs::write(path, new_content)?;

    Ok(())
}
