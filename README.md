# JavaLens

![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131?style=flat&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat&logo=tailwindcss&logoColor=white)

Analizador estático de proyectos **Java/Spring Boot**. Aplicación de escritorio independiente — no requiere JDK, Maven ni Spring instalados.

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 + TypeScript + Tailwind CSS |
| Visualización | Recharts + CodeMirror |
| Estado | Zustand |
| Backend | Rust + Tauri 2.x |
| Análisis IA | OpenCode CLI |

## Arquitectura

```
┌─────────────────────────────────────────┐
│              Frontend (React)            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │FileTree │ │CodeViewer│ │Dashboard │ │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ │
│       └───────────┼────────────┘        │
│              ┌────┴────┐               │
│              │ Zustand │               │
│              └────┬────┘               │
└───────────────────┼────────────────────┘
                    │ Tauri IPC (invoke)
┌───────────────────┼────────────────────┐
│         Backend (Rust + Tauri)          │
│  ┌──────────────────────────────────┐  │
│  │       main.rs (comandos)         │  │
│  └───┬────┬──────┬──────┬──────────┘  │
│  ┌───┴┐ ┌─┴──┐ ┌─┴───┐ ┌┴────────┐  │
│  │file│ │sta-│ │par- │ │opencode │  │
│  │scan│ │tic │ │ser  │ │runner   │  │
│  │ner │ │rules│ │     │ │         │  │
│  └────┘ └────┘ └─────┘ └─────────┘  │
└────────────────────────────────────────┘
```

1. El usuario selecciona una carpeta desde la UI.
2. `file_scanner` escanea recursivamente archivos `.java`.
3. `static_rules` aplica reglas de análisis (SRP, inyección, credenciales, etc.).
4. Los resultados se muestran en el Dashboard y BugPanel.
5. Opcionalmente, `opencode` ejecuta análisis por IA.

## Requisitos

- [Rust](https://rustup.rs/) (edition 2021)
- [Node.js](https://nodejs.org/) >= 18
- [OpenCode CLI](https://opencode.ai) (opcional, para análisis por IA)

## Instalación

```bash
npm install
```

## Ejecución

```bash
cargo tauri dev
```

> Si `cargo` no se reconoce, agrégalo al PATH:
> ```powershell
> $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"; cargo tauri dev
> ```
> O cierra y abre una nueva terminal.

## Build

```bash
cargo tauri build
```

## Reglas de análisis

| Regla | Severidad | Descripción |
|-------|-----------|-------------|
| `MISSING_TRANSACTIONAL` | CRITICAL | Service sin `@Transactional` con múltiples repo calls |
| `FIELD_INJECTION` | WARNING | `@Autowired` en campo (preferir constructor) |
| `EMPTY_CATCH` | CRITICAL | Bloque catch vacío |
| `NULL_OPTIONAL` | CRITICAL | `return null` en Optional |
| `MISSING_VALIDATION` | WARNING | `@RequestBody` sin `@Valid` |
| `HARDCODED_URL` | WARNING | URL hardcodeada |
| `HARDCODED_CREDENTIALS` | CRITICAL | Credencial hardcodeada |
| `SRP_CLASS_SIZE` | INFO | Clase > 300 líneas |
| `LONG_METHOD` | INFO | Método > 30 líneas |

## Comandos Tauri

| Comando | Descripción |
|---------|-------------|
| `open_folder` | Abre selector de carpeta y escanea `.java` |
| `analyze_file` | Analiza un archivo individual |
| `analyze_project` | Análisis completo del proyecto |
| `run_opencode` | Ejecuta OpenCode CLI para análisis IA |
| `apply_fix` | Aplica un fix sugerido a un archivo |
| `generate_test` | Genera clase de test JUnit 5 |
| `save_test` | Guarda test en disco |
