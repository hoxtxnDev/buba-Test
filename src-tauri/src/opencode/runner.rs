use std::process::Command;
use std::io::Write;

pub fn run_opencode_analysis(file_content: &str, context: &str) -> Result<String, String> {
    let prompt = format!(
        r##"Eres un experto analista de código Java y Spring Boot 3.x.

Analiza el siguiente código fuente y el contexto de análisis estático.
Devuelve un JSON con bugs adicionales y una clase de test JUnit 5 generada.

CONTEXTO DEL ANÁLISIS ESTÁTICO:
{}

CÓDIGO FUENTE:
{}
"##,
        context, file_content
    );

    let mut child = Command::new("opencode")
        .arg("--model")
        .arg("deepseek-v4-flash-free")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Error al ejecutar opencode: {}", e))?;

    if let Some(ref mut stdin) = child.stdin {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Error al escribir stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Error al esperar opencode: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("OpenCode falló: {}", stderr))
    }
}
