<?php
/*
 * Núcleo común: configuración y cabeceras de seguridad.
 * Antes de incluirlo, guardar.php define METODOS_PERMITIDOS = ['POST'];
 * las páginas sólo aceptan GET/HEAD.
 */
declare(strict_types=1);

/**
 * Valores por defecto en config.php (versionado) + configuración propia de cada servidor
 * en config.local.php (NO versionado, ver .gitignore), que reemplaza a los anteriores.
 */
function config(string $clave)
{
    static $c = null;
    if ($c === null) {
        $base = require __DIR__ . '/../config.php';
        $c = is_array($base) ? $base : [];
        $local = __DIR__ . '/../config.local.php';
        if (is_file($local)) {
            $extra = require $local;
            if (is_array($extra)) {
                $c = array_replace($c, $extra);
            }
        }
    }
    return $c[$clave] ?? null;
}

// Los errores van al log del servidor, nunca a la pantalla.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);
date_default_timezone_set((string) (config('zona_horaria') ?: 'America/Santiago'));

function h(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

function es_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
        || (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https');
}

function enviar_cabeceras(array $metodos): void
{
    if (PHP_SAPI === 'cli' || headers_sent()) {
        return;
    }
    header_remove('X-Powered-By');
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', $metodos, true)) {
        header('Allow: ' . implode(', ', $metodos));
        http_response_code(405);
        exit;
    }
    if (config('forzar_https') && !es_https()) {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
            http_response_code(403);  // no se redirige un POST: los datos irían sin cifrar
            exit;
        }
        $host = preg_replace('/[^A-Za-z0-9.\-:\[\]]/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
        $ruta = strtok((string) ($_SERVER['REQUEST_URI'] ?? '/'), "\r\n");
        header('Location: https://' . $host . $ruta, true, 301);
        exit;
    }
    // Sólo se permiten peticiones al propio sitio (connect-src 'self').
    header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; "
        . "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; "
        . "base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: camera=(self), microphone=(), geolocation=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('Cache-Control: no-store, max-age=0');
    if (es_https()) {
        header('Strict-Transport-Security: max-age=31536000');
    }
}
enviar_cabeceras(defined('METODOS_PERMITIDOS') ? METODOS_PERMITIDOS : ['GET', 'HEAD']);
