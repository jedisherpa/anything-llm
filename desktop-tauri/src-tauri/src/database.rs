use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

#[cfg(unix)]
use std::os::unix::fs::symlink;
#[cfg(windows)]
use std::os::windows::fs::symlink_file;

use crate::logs::run_bootstrap_command;

pub(crate) fn sqlite_database_url(db_path: &Path) -> String {
    let normalized = db_path.to_string_lossy().replace('\\', "/");
    if normalized.starts_with('/') {
        format!("file://{normalized}")
    } else {
        format!("file:///{normalized}")
    }
}

fn sqlite_alias_root() -> PathBuf {
    #[cfg(unix)]
    {
        PathBuf::from("/tmp").join("anythingllm-sovereign-desktop")
    }

    #[cfg(not(unix))]
    {
        std::env::temp_dir().join("anythingllm-sovereign-desktop")
    }
}

pub(crate) fn ensure_database_alias(storage_dir: &Path) -> Result<PathBuf, String> {
    let target = storage_dir.join("anythingllm.db");
    let alias_root = sqlite_alias_root();
    fs::create_dir_all(&alias_root)
        .map_err(|err| format!("Failed to create database alias directory: {err}"))?;

    let alias_path = alias_root.join("anythingllm.db");
    if let Ok(metadata) = fs::symlink_metadata(&alias_path) {
        let should_replace = if metadata.file_type().is_symlink() {
            fs::read_link(&alias_path)
                .map(|current| current != target)
                .unwrap_or(true)
        } else {
            true
        };

        if should_replace {
            if metadata.is_dir() {
                fs::remove_dir_all(&alias_path)
                    .map_err(|err| format!("Failed to replace database alias directory: {err}"))?;
            } else {
                fs::remove_file(&alias_path)
                    .map_err(|err| format!("Failed to replace database alias file: {err}"))?;
            }
        } else {
            return Ok(alias_path);
        }
    }

    #[cfg(unix)]
    symlink(&target, &alias_path)
        .map_err(|err| format!("Failed to create database alias symlink: {err}"))?;

    #[cfg(windows)]
    symlink_file(&target, &alias_path)
        .map_err(|err| format!("Failed to create database alias symlink: {err}"))?;

    Ok(alias_path)
}

pub(crate) fn ensure_runtime_database(
    core_dir: &Path,
    storage_dir: &Path,
    node_bin: &str,
    bootstrap_log_path: &Path,
) -> Result<(), String> {
    let target = storage_dir.join("anythingllm.db");
    if target.exists() {
        let metadata = target
            .metadata()
            .map_err(|err| format!("Failed to inspect desktop database file: {err}"))?;
        if metadata.len() == 0 {
            fs::remove_file(&target).map_err(|err| {
                format!("Failed to remove empty desktop database file before migration: {err}")
            })?;
        }
    }
    let should_restore_template = !target.exists()
        || target
            .metadata()
            .map(|metadata| metadata.len() == 0)
            .unwrap_or(true);

    if should_restore_template {
        let template_db = core_dir
            .parent()
            .map(|root| root.join("template").join("anythingllm.db"))
            .ok_or_else(|| "Unable to resolve runtime template directory.".to_string())?;

        if template_db.exists() {
            fs::copy(&template_db, &target).map_err(|err| {
                format!(
                    "Failed to restore bundled template database from {}: {err}",
                    template_db.display()
                )
            })?;
            ensure_database_alias(storage_dir)?;
            return Ok(());
        }
    }

    if !target.exists() {
        fs::File::create(&target)
            .map_err(|err| format!("Failed to create desktop database file: {err}"))?;
    }

    let server_dir = core_dir.join("server");
    let prisma_cli = server_dir
        .join("node_modules")
        .join("prisma")
        .join("build")
        .join("index.js");
    let runtime_schema = server_dir.join("prisma").join("runtime.prisma");

    if !prisma_cli.exists() {
        return Err(format!(
            "Missing Prisma CLI at {}. Run `npm run prepare:core` from desktop-tauri.",
            prisma_cli.display()
        ));
    }

    if !runtime_schema.exists() {
        return Err(format!(
            "Missing runtime Prisma schema at {}. Run `npm run prepare:core` from desktop-tauri.",
            runtime_schema.display()
        ));
    }

    let database_url = sqlite_database_url(&target);

    let mut migrate = Command::new(node_bin);
    migrate
        .current_dir(&server_dir)
        .arg(&prisma_cli)
        .arg("migrate")
        .arg("deploy")
        .arg("--schema")
        .arg(&runtime_schema)
        .env("DATABASE_URL", &database_url)
        .env("STORAGE_DIR", storage_dir);
    if let Err(error) =
        run_bootstrap_command(migrate, "desktop database migration", bootstrap_log_path)
    {
        if error.contains("P3005") {
            let mut db_push = Command::new(node_bin);
            db_push
                .current_dir(&server_dir)
                .arg(&prisma_cli)
                .arg("db")
                .arg("push")
                .arg("--schema")
                .arg(&runtime_schema)
                .arg("--skip-generate")
                .env("DATABASE_URL", &database_url)
                .env("STORAGE_DIR", storage_dir);
            run_bootstrap_command(db_push, "desktop database schema push", bootstrap_log_path)?;
        } else {
            return Err(error);
        }
    }

    let mut seed = Command::new(node_bin);
    seed.current_dir(&server_dir)
        .arg("prisma/seed.js")
        .env("DATABASE_URL", &database_url)
        .env("STORAGE_DIR", storage_dir);
    run_bootstrap_command(seed, "desktop database seed", bootstrap_log_path)?;

    ensure_database_alias(storage_dir)?;

    Ok(())
}
